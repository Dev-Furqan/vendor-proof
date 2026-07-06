"use server";

import { redirect } from "next/navigation";
import { requirePrimaryOrganization } from "@/lib/auth/require-organization";
import {
  billingPlans,
  getBillingPlan,
  meteredVendorPriceId,
  vendorOverageForPlan,
  type BillingPlanKey,
} from "@/lib/billing/plans";
import { getSiteUrl } from "@/lib/site-url";
import { getStripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

type SubscriptionItemsWithUsage = {
  createUsageRecord: (
    subscriptionItem: string,
    params: {
      quantity: number;
      timestamp: number;
      action: "set";
    },
  ) => Promise<unknown>;
};

type BillingSubscriptionRow = {
  id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plan?: string | null;
};

function assertPlanKey(planKey: string): BillingPlanKey {
  if (billingPlans.some((plan) => plan.key === planKey)) {
    return planKey as BillingPlanKey;
  }

  throw new Error("Unknown billing plan.");
}

async function activeVendorCount(organizationId: string) {
  const supabase = createClient();
  const { count } = await supabase
    .from("vendors")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "active");

  return count ?? 0;
}

async function getOrCreateStripeCustomer({
  organizationId,
  organizationName,
}: {
  organizationId: string;
  organizationName: string;
}) {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, stripe_customer_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingSubscription = existing as BillingSubscriptionRow | null;

  if (existingSubscription?.stripe_customer_id) {
    return existingSubscription.stripe_customer_id;
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: organizationName,
    metadata: { organization_id: organizationId },
  });

  if (existingSubscription?.id) {
    await supabase
      .from("subscriptions")
      .update({ stripe_customer_id: customer.id })
      .eq("organization_id", organizationId)
      .eq("id", existingSubscription.id);
  } else {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    await supabase.from("subscriptions").insert({
      organization_id: organizationId,
      stripe_customer_id: customer.id,
      plan: "starter",
      status: "trialing",
      trial_start: new Date().toISOString(),
      trial_end: trialEnd.toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd.toISOString(),
      vendor_limit: 50,
    });
  }

  return customer.id;
}

export async function createCheckoutSession(planKey: string) {
  const organization = await requirePrimaryOrganization();
  const plan = getBillingPlan(assertPlanKey(planKey));

  if (!plan.stripePriceId) {
    redirect(
      `/dashboard/billing?error=${encodeURIComponent(
        `Missing Stripe price id for ${plan.name}. Add it to .env.local.`,
      )}`,
    );
  }

  if (!meteredVendorPriceId) {
    redirect(
      `/dashboard/billing?error=${encodeURIComponent(
        "Missing STRIPE_VENDOR_OVERAGE_PRICE_ID in .env.local.",
      )}`,
    );
  }

  const stripe = getStripe();
  const customerId = await getOrCreateStripeCustomer({
    organizationId: organization.id,
    organizationName: organization.name,
  });
  const siteUrl = getSiteUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [
      { price: plan.stripePriceId, quantity: 1 },
      { price: meteredVendorPriceId },
    ],
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        organization_id: organization.id,
        plan: plan.key,
      },
    },
    metadata: {
      organization_id: organization.id,
      plan: plan.key,
    },
    success_url: `${siteUrl}/dashboard/billing?checkout=success`,
    cancel_url: `${siteUrl}/dashboard/billing?checkout=cancelled`,
  });

  redirect(session.url ?? "/dashboard/billing");
}

export async function createCustomerPortalSession() {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const portalSubscription = subscription as BillingSubscriptionRow | null;

  if (!portalSubscription?.stripe_customer_id) {
    redirect(
      `/dashboard/billing?error=${encodeURIComponent(
        "Start a paid plan before opening the Stripe customer portal.",
      )}`,
    );
  }

  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: portalSubscription.stripe_customer_id,
    return_url: `${getSiteUrl()}/dashboard/billing`,
  });

  redirect(portal.url);
}

export async function reportCurrentVendorUsage() {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, stripe_subscription_id, plan")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const usageSubscription = subscription as BillingSubscriptionRow | null;

  if (!usageSubscription?.stripe_subscription_id) {
    return;
  }

  const plan = getBillingPlan(usageSubscription.plan);
  const vendorCount = await activeVendorCount(organization.id);
  const overage = vendorOverageForPlan(plan, vendorCount);

  await supabase
    .from("subscriptions")
    .update({ metered_usage: overage, vendor_limit: plan.vendorLimit })
    .eq("organization_id", organization.id)
    .eq("id", usageSubscription.id);

  if (!meteredVendorPriceId || overage === 0) {
    return;
  }

  const stripe = getStripe();
  const stripeSubscription = await stripe.subscriptions.retrieve(
    usageSubscription.stripe_subscription_id,
  );
  const overageItem = stripeSubscription.items.data.find(
    (item) => item.price.id === meteredVendorPriceId,
  );

  if (!overageItem) {
    return;
  }

  await (
    stripe.subscriptionItems as unknown as SubscriptionItemsWithUsage
  ).createUsageRecord(overageItem.id, {
    quantity: overage,
    timestamp: Math.floor(Date.now() / 1000),
    action: "set",
  });
}
