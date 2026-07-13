import type { Metadata } from "next";
import { VendorsClient } from "@/components/dashboard/vendors-client";
import type {
  PropertyRecord,
  RequirementTemplateRecord,
  VendorRecord,
} from "@/components/dashboard/types";
import { requirePrimaryOrganization } from "@/lib/auth/require-organization";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Vendors | VendorProof",
  description: "Manage vendors, CSV imports, and compliance checklists.",
};

export default async function VendorsPage() {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();
  const [vendors, templates, requirements, properties] = await Promise.all([
    supabase
      .from("vendors")
      .select("id, name, email, phone, trade, category, status, default_requirement_template_id, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("requirement_templates")
      .select("id, name, description, document_type, expires_required, expiration_rule, requirements, created_at")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true }),
    supabase
      .from("vendor_requirements")
      .select("vendor_id, status")
      .eq("organization_id", organization.id),
    supabase
      .from("properties")
      .select("id, name, address_line1, city, state, postal_code, unit_count, property_type, created_at")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true }),
  ]);

  const queryError =
    vendors.error ?? templates.error ?? requirements.error ?? properties.error;

  if (queryError) {
    throw new Error(queryError.message);
  }

  return (
    <VendorsClient
      vendors={(vendors.data ?? []) as VendorRecord[]}
      templates={(templates.data ?? []) as RequirementTemplateRecord[]}
      properties={(properties.data ?? []) as PropertyRecord[]}
      requirements={(requirements.data ?? []) as Array<{ vendor_id: string; status: string | null }>}
    />
  );
}
