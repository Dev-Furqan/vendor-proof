import { RequirementsClient } from "@/components/dashboard/requirements-client";
import type { RequirementTemplateRecord } from "@/components/dashboard/types";
import { requirePrimaryOrganization } from "@/lib/auth/require-organization";
import { createClient } from "@/lib/supabase/server";

export default async function RequirementsPage() {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();
  const { data } = await supabase
    .from("requirement_templates")
    .select("id, name, description, document_type, expires_required, expiration_rule, requirements, created_at")
    .eq("organization_id", organization.id)
    .order("name", { ascending: true });

  return <RequirementsClient templates={(data ?? []) as RequirementTemplateRecord[]} />;
}
