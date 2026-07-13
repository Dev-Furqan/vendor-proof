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
import {
  documentSelectBase,
  documentSelectWithAi,
  isMissingColumnError,
  requirementSelectBase,
  requirementSelectWithRules,
  type SchemaCompatResult,
  withDocumentDefaults,
  withRequirementDefaults,
} from "@/lib/document-schema-compat";
import { createClient } from "@/lib/supabase/server";

export async function loadComplianceData(organizationId: string) {
  const supabase = createClient();
  const [propertiesResult, vendorsResult, initialRequirementsResult, initialDocumentsResult] =
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
        .select(requirementSelectWithRules)
        .eq("organization_id", organizationId),
      supabase
        .from("documents")
        .select(documentSelectWithAi)
        .eq("organization_id", organizationId),
    ]);
  let requirementsResult = initialRequirementsResult as SchemaCompatResult;
  let documentsResult = initialDocumentsResult as SchemaCompatResult;

  if (isMissingColumnError(requirementsResult.error)) {
    requirementsResult = await supabase
      .from("vendor_requirements")
      .select(requirementSelectBase)
      .eq("organization_id", organizationId);
  }

  if (isMissingColumnError(documentsResult.error)) {
    documentsResult = await supabase
      .from("documents")
      .select(documentSelectBase)
      .eq("organization_id", organizationId);
  }

  const baseError =
    propertiesResult.error ??
    vendorsResult.error ??
    requirementsResult.error ??
    documentsResult.error;

  if (baseError) {
    throw new Error(baseError.message);
  }

  const documents = ((documentsResult.data ?? []) as DocumentRecord[]).map(withDocumentDefaults);
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
      : [{ data: [], error: null }, { data: [], error: null }];

  const documentError = versionsResult.error ?? reviewsResult.error;

  if (documentError) {
    throw new Error(documentError.message);
  }

  const requirements = attachDocumentsToRequirements({
    requirements: ((requirementsResult.data ?? []) as VendorRequirementRecord[]).map(
      withRequirementDefaults,
    ),
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
