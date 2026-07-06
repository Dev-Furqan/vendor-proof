import { redirect } from "next/navigation";
import { getPrimaryOrganization } from "@/lib/auth/organization";

export async function requirePrimaryOrganization() {
  const organization = await getPrimaryOrganization();

  if (!organization) {
    redirect("/login");
  }

  if (!organization.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  return organization;
}
