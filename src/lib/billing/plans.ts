export type BillingPlanKey = "starter" | "pro" | "business";

export type BillingPlan = {
  key: BillingPlanKey;
  name: string;
  monthlyPrice: number;
  vendorLimit: number | null;
  stripePriceId?: string;
};

export const billingPlans: BillingPlan[] = [
  {
    key: "starter",
    name: "Starter",
    monthlyPrice: 79,
    vendorLimit: 50,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID,
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPrice: 199,
    vendorLimit: 250,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  {
    key: "business",
    name: "Business",
    monthlyPrice: 499,
    vendorLimit: null,
    stripePriceId: process.env.STRIPE_BUSINESS_PRICE_ID,
  },
];

export const meteredVendorPriceId = process.env.STRIPE_VENDOR_OVERAGE_PRICE_ID;

export function getBillingPlan(planKey: string | null | undefined) {
  return billingPlans.find((plan) => plan.key === planKey) ?? billingPlans[0];
}

export function vendorOverageForPlan(plan: BillingPlan, activeVendorCount: number) {
  if (plan.vendorLimit === null) {
    return 0;
  }

  return Math.max(activeVendorCount - plan.vendorLimit, 0);
}

export function isPaidStatus(status: string | null | undefined) {
  return ["active", "trialing", "past_due"].includes(status ?? "");
}

export function isTrialExpired(subscription: {
  status?: string | null;
  trial_end?: string | null;
}) {
  if (subscription.status !== "trialing" || !subscription.trial_end) {
    return false;
  }

  return new Date(subscription.trial_end).getTime() < Date.now();
}
