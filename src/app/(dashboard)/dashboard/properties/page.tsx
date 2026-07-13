import type { Metadata } from "next";
import { PropertiesClient } from "@/components/dashboard/properties-client";
import type { PropertyRecord } from "@/components/dashboard/types";
import { requirePrimaryOrganization } from "@/lib/auth/require-organization";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Properties | VendorProof",
  description: "Create and maintain portfolio properties.",
};

export default async function PropertiesPage() {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("properties")
    .select("id, name, address_line1, city, state, postal_code, unit_count, property_type, created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return <PropertiesClient properties={(data ?? []) as PropertyRecord[]} />;
}
