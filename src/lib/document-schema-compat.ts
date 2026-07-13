import type { DocumentRecord, VendorRequirementRecord } from "@/components/dashboard/types";

export type SchemaCompatResult = {
  data: unknown[] | null;
  error: { message?: string; code?: string } | null;
};

export const requirementSelectWithRules =
  "id, organization_id, vendor_id, property_id, requirement_template_id, name, document_type, required, expires_required, expiration_rule, status, due_date, expires_at, created_at, updated_at";

export const requirementSelectBase =
  "id, organization_id, vendor_id, property_id, requirement_template_id, name, document_type, required, expires_required, status, due_date, expires_at, created_at, updated_at";

export const documentSelectWithAi =
  "id, organization_id, vendor_id, property_id, vendor_requirement_id, document_type, status, business_name, policy_number, issuing_authority, issued_at, expires_at, ai_extraction_status, ai_extraction_model, ai_extraction_raw, ai_extraction_confidence, ai_extraction_flags, ai_extraction_usage, ai_extraction_error, ai_extraction_completed_at, ai_extraction_confirmed_at, ai_extraction_confirmed_by, ai_extraction_corrected_fields, ai_extracted_document_type, ai_extracted_business_name, ai_extracted_policy_number, ai_extracted_effective_date, ai_extracted_expiration_date, ai_extracted_issuing_authority, created_at, updated_at";

export const documentSelectBase =
  "id, organization_id, vendor_id, property_id, vendor_requirement_id, document_type, status, issued_at, expires_at, created_at, updated_at";

export function isMissingColumnError(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    /column .* does not exist/i.test(message) ||
    /could not find .* column/i.test(message) ||
    /schema cache/i.test(message)
  );
}

export function withRequirementDefaults(row: VendorRequirementRecord): VendorRequirementRecord {
  return {
    ...row,
    expiration_rule: row.expiration_rule ?? "none",
  };
}

export function withDocumentDefaults(row: DocumentRecord): DocumentRecord {
  return {
    ...row,
    business_name: row.business_name ?? null,
    policy_number: row.policy_number ?? null,
    issuing_authority: row.issuing_authority ?? null,
    ai_extraction_status: row.ai_extraction_status ?? "not_started",
    ai_extraction_model: row.ai_extraction_model ?? null,
    ai_extraction_raw: row.ai_extraction_raw ?? null,
    ai_extraction_confidence: row.ai_extraction_confidence ?? null,
    ai_extraction_flags: row.ai_extraction_flags ?? [],
    ai_extraction_usage: row.ai_extraction_usage ?? null,
    ai_extraction_error: row.ai_extraction_error ?? null,
    ai_extraction_completed_at: row.ai_extraction_completed_at ?? null,
    ai_extraction_confirmed_at: row.ai_extraction_confirmed_at ?? null,
    ai_extraction_confirmed_by: row.ai_extraction_confirmed_by ?? null,
    ai_extraction_corrected_fields: row.ai_extraction_corrected_fields ?? null,
    ai_extracted_document_type: row.ai_extracted_document_type ?? null,
    ai_extracted_business_name: row.ai_extracted_business_name ?? null,
    ai_extracted_policy_number: row.ai_extracted_policy_number ?? null,
    ai_extracted_effective_date: row.ai_extracted_effective_date ?? null,
    ai_extracted_expiration_date: row.ai_extracted_expiration_date ?? null,
    ai_extracted_issuing_authority: row.ai_extracted_issuing_authority ?? null,
  };
}
