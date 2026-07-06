import { getSupabaseAdmin } from "@/lib/supabase/admin";

type EnsureWorkspaceInput = {
  userId: string;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
};

function workspaceError(message: string) {
  if (
    message.includes("schema cache") ||
    message.includes("public.users") ||
    message.includes("Could not find the table")
  ) {
    return new Error(
      "VendorProof database tables are missing. Apply the Supabase migrations in supabase/migrations, then try again.",
    );
  }

  return new Error(message);
}

export async function ensureUserWorkspace({
  userId,
  email,
  fullName,
  avatarUrl,
}: EnsureWorkspaceInput) {
  const supabase = getSupabaseAdmin();

  const { error: userError } = await supabase.from("users").upsert({
    id: userId,
    email,
    full_name: fullName,
    avatar_url: avatarUrl,
  });

  if (userError) {
    throw workspaceError(userError.message);
  }

  const { data: existingMembership, error: membershipLookupError } = await supabase
    .from("memberships")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipLookupError) {
    throw workspaceError(membershipLookupError.message);
  }

  if (existingMembership?.organization_id) {
    return existingMembership.organization_id as string;
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .insert({
      name: "Untitled organization",
      created_by: userId,
    })
    .select("id")
    .single();

  if (organizationError) {
    throw workspaceError(organizationError.message);
  }

  const { error: membershipError } = await supabase.from("memberships").insert({
    organization_id: organization.id,
    user_id: userId,
    role: "owner",
  });

  if (membershipError) {
    throw workspaceError(membershipError.message);
  }

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);

  const { error: subscriptionError } = await supabase.from("subscriptions").insert({
    organization_id: organization.id,
    plan: "starter",
    status: "trialing",
    trial_start: new Date().toISOString(),
    trial_end: trialEnd.toISOString(),
    current_period_start: new Date().toISOString(),
    current_period_end: trialEnd.toISOString(),
    vendor_limit: 50,
  });

  if (subscriptionError) {
    throw workspaceError(subscriptionError.message);
  }

  return organization.id as string;
}
