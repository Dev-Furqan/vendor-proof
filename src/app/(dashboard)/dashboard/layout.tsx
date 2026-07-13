import type { ReactNode } from "react";
import { signOut } from "../../(auth)/actions";
import { DashboardBrand, DashboardNav } from "@/components/dashboard/dashboard-nav";
import { getPrimaryOrganization } from "@/lib/auth/organization";
import { isTrialExpired } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";

type LayoutSubscription = {
  status?: string | null;
  trial_end?: string | null;
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const organization = await getPrimaryOrganization();
  const supabase = createClient();
  const { data: subscription } = organization
    ? await supabase
        .from("subscriptions")
        .select("status, trial_end")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };
  const trialExpired = subscription
    ? isTrialExpired(subscription as LayoutSubscription)
    : false;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-background/88 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
          <DashboardBrand />
          <DashboardNav />

          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-white/12 px-3 py-2 text-sm text-muted transition hover:border-white/25 hover:text-white"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        {trialExpired ? (
          <div className="mb-6 rounded-lg border border-amber-400/25 bg-amber-400/10 p-4">
            <p className="text-sm font-medium text-amber-100">
              Your free trial has ended.
            </p>
            <p className="mt-1 text-sm text-amber-100/80">
              Your data remains available. Upgrade from Billing to keep automated
              reminders, vendor invites, and exports running.
            </p>
          </div>
        ) : null}
        {children}
      </div>
    </main>
  );
}
