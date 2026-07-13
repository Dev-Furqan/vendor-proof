import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  AuthNotice,
  TextInput,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/auth/auth-shell";
import { getPrimaryOrganization } from "@/lib/auth/organization";
import { addFirstProperty, saveOrganizationName, signOut } from "../../(auth)/actions";

export const metadata: Metadata = {
  title: "Onboarding | VendorProof",
  description: "Set up your VendorProof organization and first property.",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: { step?: string; error?: string };
}) {
  const organization = await getPrimaryOrganization();

  if (!organization) {
    redirect("/login");
  }

  if (organization.onboardingCompletedAt) {
    redirect("/dashboard");
  }

  const isPropertyStep = searchParams?.step === "property";

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-2xl flex-col justify-center">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
              Onboarding
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-white">
              {isPropertyStep ? "Add your first property" : "Name your organization"}
            </h1>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-white/12 px-3 py-2 text-sm text-muted transition hover:border-white/25 hover:text-white"
            >
              Log out
            </button>
          </form>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3">
          <div
            className={`h-1 rounded-full ${isPropertyStep ? "bg-accent/40" : "bg-accent"}`}
          />
          <div className={`h-1 rounded-full ${isPropertyStep ? "bg-accent" : "bg-white/10"}`} />
        </div>

        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.3)] sm:p-8">
          <AuthNotice error={searchParams?.error} />

          {isPropertyStep ? (
            <form action={addFirstProperty} className="space-y-4">
              <p className="mb-6 text-sm leading-6 text-muted">
                Add one property so VendorProof can anchor vendors, requirements,
                and document reminders to a real portfolio location.
              </p>
              <TextInput
                label="Property name"
                name="propertyName"
                placeholder="The Emerson Apartments"
                required
              />
              <TextInput
                label="Street address"
                name="addressLine1"
                placeholder="1200 Market Street"
              />
              <div className="grid gap-4 sm:grid-cols-[1fr_0.5fr_0.7fr]">
                <TextInput label="City" name="city" placeholder="Austin" />
                <TextInput label="State" name="state" placeholder="TX" />
                <TextInput label="ZIP" name="postalCode" placeholder="78701" />
              </div>
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <a href="/onboarding" className={secondaryButtonClass}>
                  Back
                </a>
                <button type="submit" className={primaryButtonClass}>
                  Finish onboarding
                </button>
              </div>
            </form>
          ) : (
            <form action={saveOrganizationName} className="space-y-4">
              <p className="mb-6 text-sm leading-6 text-muted">
                This organization owns your properties, vendors, requirements,
                communications, billing, and audit history.
              </p>
              <TextInput
                label="Organization name"
                name="organizationName"
                placeholder="Northstar Property Management"
                required
              />
              <button type="submit" className={primaryButtonClass}>
                Continue
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
