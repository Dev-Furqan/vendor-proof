import type {
  DocumentRecord,
  DocumentReviewRecord,
  DocumentVersionRecord,
  PropertyRecord,
  VendorRecord,
  VendorRequirementRecord,
} from "@/components/dashboard/types";
import {
  attachDocumentsToRequirements,
  buildPropertyComplianceRows,
  buildVendorComplianceRows,
} from "@/lib/compliance/status";
import { createClient } from "@/lib/supabase/server";

export async function loadComplianceData(organizationId: string) {
  const supabase = createClient();
  const [propertiesResult, vendorsResult, requirementsResult, documentsResult] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id, name, address_line1, city, state, postal_code, unit_count, property_type, created_at")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true }),
      supabase
        .from("vendors")
        .select("id, name, email, phone, trade, category, status, default_requirement_template_id, created_at")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true }),
      supabase
        .from("vendor_requirements")
        .select("id, organization_id, vendor_id, property_id, requirement_template_id, name, document_type, required, expires_required, status, due_date, expires_at, created_at, updated_at")
        .eq("organization_id", organizationId),
      supabase
        .from("documents")
        .select("id, organization_id, vendor_id, property_id, vendor_requirement_id, document_type, status, issued_at, expires_at, created_at, updated_at")
        .eq("organization_id", organizationId),
    ]);

  const documents = (documentsResult.data ?? []) as DocumentRecord[];
  const documentIds = documents.map((document) => document.id);

  const [versionsResult, reviewsResult] =
    documentIds.length > 0
      ? await Promise.all([
          supabase
            .from("document_versions")
            .select("id, organization_id, document_id, version_number, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at")
            .eq("organization_id", organizationId)
            .in("document_id", documentIds),
          supabase
            .from("document_reviews")
            .select("id, document_id, document_version_id, reviewer_id, status, notes, reviewed_at")
            .eq("organization_id", organizationId)
            .in("document_id", documentIds),
        ])
      : [{ data: [] }, { data: [] }];

  const requirements = attachDocumentsToRequirements({
    requirements: (requirementsResult.data ?? []) as VendorRequirementRecord[],
    documents,
    versions: (versionsResult.data ?? []) as DocumentVersionRecord[],
    reviews: (reviewsResult.data ?? []) as DocumentReviewRecord[],
  });

  const properties = (propertiesResult.data ?? []) as PropertyRecord[];
  const vendors = (vendorsResult.data ?? []) as VendorRecord[];
  const vendorRows = buildVendorComplianceRows({ vendors, properties, requirements });
  const propertyRows = buildPropertyComplianceRows({ vendorRows, properties });

  return {
    properties,
    vendors,
    requirements,
    vendorRows,
    propertyRows,
  };
}
