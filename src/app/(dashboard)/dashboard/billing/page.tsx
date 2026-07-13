import { Check, ExternalLink, ReceiptText, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import {
  createCheckoutSession,
  createCustomerPortalSession,
} from "@/app/(dashboard)/dashboard/billing/actions";
import { requirePrimaryOrganization } from "@/lib/auth/require-organization";
import {
  billingPlans,
  getBillingPlan,
  isTrialExpired,
  vendorOverageForPlan,
} from "@/lib/billing/plans";
import { formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Billing | VendorProof",
  description: "Manage VendorProof plans, usage, and Stripe invoices.",
};

type SubscriptionRow = {
  plan?: string | null;
  status?: string | null;
  trial_end?: string | null;
  current_period_end?: string | null;
};

type InvoiceRow = {
  id: string;
  stripe_invoice_id: string | null;
  status: string | null;
  amount_due: number | null;
  amount_paid: number | null;
  currency: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  created_at: string | null;
};

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString();
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { checkout?: string; error?: string };
}) {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();
  const [subscriptionResult, invoicesResult, vendorsResult] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select("id, stripe_invoice_id, status, amount_due, amount_paid, currency, due_at, paid_at, hosted_invoice_url, invoice_pdf, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id)
      .eq("status", "active"),
  ]);

  const queryError =
    subscriptionResult.error ?? invoicesResult.error ?? vendorsResult.error;

  if (queryError) {
    throw new Error(queryError.message);
  }

  const subscription = subscriptionResult.data as SubscriptionRow | null;
  const activeVendorCount = vendorsResult.count ?? 0;
  const currentPlan = getBillingPlan(subscription?.plan as string | undefined);
  const overage = vendorOverageForPlan(currentPlan, activeVendorCount);
  const trialExpired = subscription ? isTrialExpired(subscription) : false;

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
            Billing
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Plan and usage</h1>
          <p className="mt-2 text-sm text-muted">
            Manage your VendorProof subscription, invoices, vendor limits, and
            Stripe billing portal.
          </p>
        </div>
        <form action={createCustomerPortalSession}>
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/12 px-4 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/[0.04]"
          >
            <ExternalLink size={15} />
            Manage billing
          </button>
        </form>
      </div>

      {searchParams.error ? (
        <div className="mb-5 rounded-md border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {searchParams.error}
        </div>
      ) : null}
      {searchParams.checkout === "success" ? (
        <div className="mb-5 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
          Checkout complete. Stripe will sync the subscription as soon as the webhook arrives.
        </div>
      ) : null}
      {trialExpired ? (
        <div className="mb-5 rounded-lg border border-amber-400/25 bg-amber-400/10 p-4">
          <h2 className="text-base font-medium text-amber-100">Your trial has ended</h2>
          <p className="mt-1 text-sm text-amber-100/80">
            Your data is still here. Pick a plan below to keep reminders,
            vendor invites, and exports running.
          </p>
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
          <p className="text-sm text-muted">Current plan</p>
          <p className="mt-2 text-2xl font-semibold text-white">{currentPlan.name}</p>
          <p className="mt-1 text-sm capitalize text-muted">
            {subscription?.status ?? "trialing"} · renews {formatDate(subscription?.current_period_end)}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
          <p className="text-sm text-muted">Active vendors</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {activeVendorCount}
            <span className="text-base text-muted">
              {" "}
              / {currentPlan.vendorLimit ?? "unlimited"}
            </span>
          </p>
          <p className="mt-1 text-sm text-muted">
            {overage > 0 ? `${overage} overage vendors at $1/mo each` : "No metered overage"}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
          <p className="text-sm text-muted">Trial</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {subscription?.trial_end ? formatDate(subscription.trial_end) : "Not active"}
          </p>
          <p className="mt-1 text-sm text-muted">14 days included on new subscriptions</p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        {billingPlans.map((plan) => {
          const highlighted = plan.key === "pro";
          const isCurrent = currentPlan.key === plan.key;
          return (
            <section
              key={plan.key}
              className={`rounded-lg border p-5 ${
                highlighted
                  ? "border-accent/45 bg-accent/10"
                  : "border-white/10 bg-white/[0.025]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                {isCurrent ? (
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white">
                    Current
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-3xl font-semibold text-white">
                ${plan.monthlyPrice}
                <span className="text-sm text-muted">/mo</span>
              </p>
              <ul className="mt-5 space-y-2 text-sm text-muted">
                <li className="flex gap-2">
                  <Check size={16} className="mt-0.5 text-accent" />
                  {plan.vendorLimit ? `Up to ${plan.vendorLimit} active vendors` : "Unlimited active vendors"}
                </li>
                <li className="flex gap-2">
                  <Check size={16} className="mt-0.5 text-accent" />
                  14-day free trial
                </li>
                <li className="flex gap-2">
                  <Check size={16} className="mt-0.5 text-accent" />
                  $1/mo per vendor above the included limit
                </li>
              </ul>
              <form action={createCheckoutSession.bind(null, plan.key)} className="mt-5">
                <button
                  type="submit"
                  className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition ${
                    highlighted
                      ? "bg-accent text-accent-foreground hover:bg-accent/90"
                      : "border border-white/12 text-white hover:border-white/25 hover:bg-white/[0.04]"
                  }`}
                >
                  <Sparkles size={15} />
                  {isCurrent ? "Update in Stripe" : "Start checkout"}
                </button>
              </form>
            </section>
          );
        })}
      </div>

      <section className="rounded-lg border border-white/10 bg-white/[0.025]">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <ReceiptText size={16} className="text-accent" />
          <h2 className="text-base font-medium text-white">Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {(invoicesResult.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted">
                    No invoices yet.
                  </td>
                </tr>
              ) : null}
              {((invoicesResult.data ?? []) as InvoiceRow[]).map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-4 py-3 text-white">{invoice.stripe_invoice_id}</td>
                  <td className="px-4 py-3 capitalize text-muted">{invoice.status}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatMoney(invoice.amount_paid || invoice.amount_due, invoice.currency)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatDate(invoice.paid_at ?? invoice.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {invoice.hosted_invoice_url ? (
                      <a
                        href={invoice.hosted_invoice_url}
                        target="_blank"
                        className="text-accent transition hover:text-accent/80"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
