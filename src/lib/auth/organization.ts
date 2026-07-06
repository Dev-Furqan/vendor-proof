import { createClient } from "@/lib/supabase/server";

export async function getPrimaryOrganization() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.organization_id) {
    return null;
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name, onboarding_completed_at")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (!organization) {
    return null;
  }

  return {
    id: membership.organization_id as string,
    role: membership.role as string,
    name: organization.name as string,
    onboardingCompletedAt: organization.onboarding_completed_at as string | null,
  };
}
