import { NextResponse } from "next/server";
import Stripe from "stripe";
import { billingPlans, getBillingPlan } from "@/lib/billing/plans";
import { captureServerEvent } from "@/lib/posthog/events";
import { getStripe } from "@/lib/stripe/client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SubscriptionWithPeriods = Stripe.Subscription & {
  current_period_start?: number | null;
  current_period_end?: number | null;
};

type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  status_transitions?: {
    paid_at?: number | null;
  };
};

function fromUnix(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function planFromPrice(priceId: string | null | undefined) {
  return billingPlans.find((plan) => plan.stripePriceId === priceId)?.key ?? "starter";
}

async function organizationIdForCustomer(customerId: string) {
  const admin = getSupabaseAdmin();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("organization_id")
    .eq("stripe_customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscription?.organization_id) {
    return subscription.organization_id as string;
  }

  const customer = await getStripe().customers.retrieve(customerId);
  if (!customer.deleted && customer.metadata?.organization_id) {
    return customer.metadata.organization_id;
  }

  return null;
}

async function upsertSubscription(subscription: SubscriptionWithPeriods) {
  const admin = getSupabaseAdmin();
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const organizationId =
    subscription.metadata?.organization_id ??
    (await organizationIdForCustomer(customerId));

  if (!organizationId) {
    return;
  }

  const baseItem = subscription.items.data.find(
    (item) => item.price.id !== process.env.STRIPE_VENDOR_OVERAGE_PRICE_ID,
  );
  const planKey = subscription.metadata?.plan ?? planFromPrice(baseItem?.price.id);
  const plan = getBillingPlan(planKey);

  await admin.from("subscriptions").upsert(
    {
      organization_id: organizationId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: baseItem?.price.id ?? null,
      stripe_metered_price_id: process.env.STRIPE_VENDOR_OVERAGE_PRICE_ID ?? null,
      plan: plan.key,
      status: subscription.status,
      current_period_start: fromUnix(subscription.current_period_start),
      current_period_end: fromUnix(subscription.current_period_end),
      trial_start: fromUnix(subscription.trial_start),
      trial_end: fromUnix(subscription.trial_end),
      cancel_at_period_end: subscription.cancel_at_period_end,
      vendor_limit: plan.vendorLimit,
      payment_failed_at:
        subscription.status === "past_due" ? new Date().toISOString() : null,
      metadata: subscription.metadata ?? {},
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function recordInvoice(invoice: InvoiceWithSubscription) {
  const admin = getSupabaseAdmin();
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id ?? null;
  const subscriptionId =
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? null;

  if (!customerId) {
    return;
  }

  const organizationId = await organizationIdForCustomer(customerId);
  if (!organizationId) {
    return;
  }

  const { data: localSubscription } = subscriptionId
    ? await admin
        .from("subscriptions")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle()
    : { data: null };

  await admin.from("invoices").upsert(
    {
      organization_id: organizationId,
      subscription_id: localSubscription?.id ?? null,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_invoice_id: invoice.id,
      status: invoice.status ?? "draft",
      amount_due: invoice.amount_due ?? 0,
      amount_paid: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? "usd",
      due_at: fromUnix(invoice.due_date),
      paid_at: fromUnix(invoice.status_transitions?.paid_at),
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
    },
    { onConflict: "stripe_invoice_id" },
  );
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid Stripe webhook signature",
      },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription === "string") {
        const subscription = (await stripe.subscriptions.retrieve(
          session.subscription,
        )) as SubscriptionWithPeriods;
        await upsertSubscription(subscription);
        if (session.metadata?.organization_id) {
          await captureServerEvent("checkout_completed", {
            organization_id: session.metadata.organization_id,
            plan: session.metadata.plan,
            stripe_session_id: session.id,
          });
        }
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await upsertSubscription(event.data.object as SubscriptionWithPeriods);
      break;
    }
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
    case "invoice.finalized": {
      const invoice = event.data.object as InvoiceWithSubscription;
      await recordInvoice(invoice);
      if (event.type === "invoice.payment_failed") {
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id ?? null;
        const organizationId = customerId
          ? await organizationIdForCustomer(customerId)
          : null;
        if (organizationId) {
          await getSupabaseAdmin()
            .from("subscriptions")
            .update({
              status: "past_due",
              payment_failed_at: new Date().toISOString(),
            })
            .eq("organization_id", organizationId);
        }
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
