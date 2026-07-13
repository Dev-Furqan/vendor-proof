"use server";

import { revalidatePath } from "next/cache";
import { requirePrimaryOrganization } from "@/lib/auth/require-organization";
import { aiExtractionIsConfigured, scanDocumentVersion } from "@/lib/ai/document-scanning";
import { isMissingColumnError, writeWithColumnFallback } from "@/lib/document-schema-compat";
import { sendVendorInviteEmail } from "@/lib/email/vendor-emails";
import { getSiteUrl } from "@/lib/site-url";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanText, isValidDateString, isValidEmail } from "@/lib/validation";
import { createVendorPortalInvite } from "@/lib/vendor-portal/tokens";
import type { TemplateRequirement } from "@/components/dashboard/types";

type ActionResult = {
  ok: boolean;
  error?: string;
  documentId?: string;
  documentVersionId?: string;
  requirementId?: string;
  aiExtractionConfigured?: boolean;
};

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function nullableValue(formData: FormData, key: string) {
  const text = value(formData, key);
  return text ? text : null;
}

function numberValue(formData: FormData, key: string) {
  const text = value(formData, key);
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDocumentType(documentType: string) {
  const normalized = documentType.toLowerCase();
  return ["coi", "license", "w9", "other"].includes(normalized)
    ? normalized
    : "other";
}

function correctionDiff(
  extracted: Record<string, string | null | undefined>,
  confirmed: Record<string, string | null | undefined>,
) {
  return Object.entries(confirmed).reduce<Record<string, { extracted: string | null; confirmed: string | null }>>(
    (diff, [key, confirmedValue]) => {
      const extractedValue = extracted[key] ?? null;
      const normalizedConfirmed = confirmedValue || null;
      if ((extractedValue || null) !== normalizedConfirmed) {
        diff[key] = {
          extracted: extractedValue || null,
          confirmed: normalizedConfirmed,
        };
      }
      return diff;
    },
    {},
  );
}

function parseRequirements(formData: FormData) {
  const raw = value(formData, "requirements");

  if (!raw) {
    return [] as TemplateRequirement[];
  }

  try {
    const parsed = JSON.parse(raw) as TemplateRequirement[];
    return parsed
      .filter((item) => item.label?.trim() || item.documentType)
      .map((item) => ({
        documentType: normalizeDocumentType(item.documentType),
        label: item.label?.trim() || item.documentType.toUpperCase(),
        expiresRequired: Boolean(item.expiresRequired),
        expirationRule: item.expirationRule || "none",
      }));
  } catch {
    return [] as TemplateRequirement[];
  }
}

function refreshDashboardPaths() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/compliance");
  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard/vendors");
  revalidatePath("/dashboard/requirements");
}

function refreshVendorPaths(vendorId?: string) {
  refreshDashboardPaths();
  if (vendorId) {
    revalidatePath(`/dashboard/vendors/${vendorId}`);
  }
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

  return cleaned || "document";
}

async function getCurrentUserId() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}

export async function createProperty(formData: FormData): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const name = cleanText(value(formData, "name"), 120);
  const unitCount = numberValue(formData, "unitCount");

  if (!name) {
    return { ok: false, error: "Property name is required." };
  }

  if (unitCount < 0) {
    return { ok: false, error: "Unit count cannot be negative." };
  }

  const supabase = createClient();
  const { count, error: duplicateError } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .ilike("name", name);

  if (duplicateError) {
    return { ok: false, error: duplicateError.message };
  }

  if ((count ?? 0) > 0) {
    return { ok: false, error: "A property with this name already exists." };
  }

  const { error } = await supabase.from("properties").insert({
    organization_id: organization.id,
    name,
    address_line1: nullableValue(formData, "address"),
    unit_count: unitCount,
    property_type: value(formData, "propertyType") || "multifamily",
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  refreshDashboardPaths();
  return { ok: true };
}

export async function updateProperty(formData: FormData): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const id = value(formData, "id");
  const name = cleanText(value(formData, "name"), 120);
  const unitCount = numberValue(formData, "unitCount");

  if (!id || !name) {
    return { ok: false, error: "Property id and name are required." };
  }

  if (unitCount < 0) {
    return { ok: false, error: "Unit count cannot be negative." };
  }

  const supabase = createClient();
  const { count, error: duplicateError } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .ilike("name", name)
    .neq("id", id);

  if (duplicateError) {
    return { ok: false, error: duplicateError.message };
  }

  if ((count ?? 0) > 0) {
    return { ok: false, error: "Another property already uses this name." };
  }

  const { error } = await supabase
    .from("properties")
    .update({
      name,
      address_line1: nullableValue(formData, "address"),
      unit_count: unitCount,
      property_type: value(formData, "propertyType") || "multifamily",
    })
    .eq("organization_id", organization.id)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  refreshDashboardPaths();
  return { ok: true };
}

export async function deleteProperty(id: string): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();
  const { error } = await supabase
    .from("properties")
    .delete()
    .eq("organization_id", organization.id)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  refreshDashboardPaths();
  return { ok: true };
}

export async function createVendor(formData: FormData): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const name = cleanText(value(formData, "name"), 140);
  const email = value(formData, "email").toLowerCase();

  if (!name) {
    return { ok: false, error: "Vendor name is required." };
  }

  if (email && !isValidEmail(email)) {
    return { ok: false, error: "Enter a valid vendor email address." };
  }

  const supabase = createClient();
  const { count, error: duplicateError } = await supabase
    .from("vendors")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .ilike("name", name);

  if (duplicateError) {
    return { ok: false, error: duplicateError.message };
  }

  if ((count ?? 0) > 0) {
    return { ok: false, error: "A vendor with this name already exists." };
  }

  const { error } = await supabase.from("vendors").insert({
    organization_id: organization.id,
    name,
    email: email || null,
    phone: nullableValue(formData, "phone"),
    trade: nullableValue(formData, "category"),
    category: nullableValue(formData, "category"),
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  refreshDashboardPaths();
  return { ok: true };
}

export async function updateVendor(formData: FormData): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const id = value(formData, "id");
  const name = cleanText(value(formData, "name"), 140);
  const email = value(formData, "email").toLowerCase();

  if (!id || !name) {
    return { ok: false, error: "Vendor id and name are required." };
  }

  if (email && !isValidEmail(email)) {
    return { ok: false, error: "Enter a valid vendor email address." };
  }

  const supabase = createClient();
  const { count, error: duplicateError } = await supabase
    .from("vendors")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .ilike("name", name)
    .neq("id", id);

  if (duplicateError) {
    return { ok: false, error: duplicateError.message };
  }

  if ((count ?? 0) > 0) {
    return { ok: false, error: "Another vendor already uses this name." };
  }

  const { error } = await supabase
    .from("vendors")
    .update({
      name,
      email: email || null,
      phone: nullableValue(formData, "phone"),
      trade: nullableValue(formData, "category"),
      category: nullableValue(formData, "category"),
    })
    .eq("organization_id", organization.id)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  refreshDashboardPaths();
  return { ok: true };
}

export async function deleteVendor(id: string): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();
  const { error } = await supabase
    .from("vendors")
    .delete()
    .eq("organization_id", organization.id)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  refreshDashboardPaths();
  return { ok: true };
}

export async function importVendorsFromCsv(
  rows: Array<{ name: string; email?: string; phone?: string; category?: string }>,
): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const cleanRows = rows
    .map((row) => ({
      organization_id: organization.id,
      name: cleanText(row.name ?? "", 140),
      email: row.email?.trim().toLowerCase() || null,
      phone: row.phone?.trim() || null,
      trade: row.category?.trim() || null,
      category: row.category?.trim() || null,
    }))
    .filter((row) => row.name && isValidEmail(row.email))
    .filter((row, index, allRows) => {
      const name = row.name.toLowerCase();
      return allRows.findIndex((candidate) => candidate.name.toLowerCase() === name) === index;
    });

  if (cleanRows.length === 0) {
    return { ok: false, error: "No valid vendor rows were found." };
  }

  const supabase = createClient();
  const { data: existingRows, error: existingError } = await supabase
    .from("vendors")
    .select("name")
    .eq("organization_id", organization.id);

  if (existingError) {
    return { ok: false, error: existingError.message };
  }

  const existingNames = new Set(
    ((existingRows ?? []) as Array<{ name: string | null }>).map((row) =>
      (row.name ?? "").toLowerCase(),
    ),
  );
  const rowsToInsert = cleanRows.filter(
    (row) => !existingNames.has(row.name.toLowerCase()),
  );

  if (rowsToInsert.length === 0) {
    return { ok: false, error: "All rows are duplicates of existing vendors." };
  }

  const { error } = await supabase.from("vendors").insert(rowsToInsert);

  if (error) {
    return { ok: false, error: error.message };
  }

  refreshDashboardPaths();
  return { ok: true };
}

export async function createRequirementTemplate(
  formData: FormData,
): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const name = cleanText(value(formData, "name"), 120);
  const requirements = parseRequirements(formData);

  if (!name) {
    return { ok: false, error: "Template name is required." };
  }

  if (requirements.length === 0) {
    return { ok: false, error: "Add at least one required document." };
  }

  const labels = requirements.map((item) => item.label.toLowerCase());
  if (new Set(labels).size !== labels.length) {
    return { ok: false, error: "Requirement labels must be unique." };
  }

  const primaryRequirement = requirements[0];
  const supabase = createClient();
  const { count, error: duplicateError } = await supabase
    .from("requirement_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .ilike("name", name);

  if (duplicateError) {
    return { ok: false, error: duplicateError.message };
  }

  if ((count ?? 0) > 0) {
    return { ok: false, error: "A template with this name already exists." };
  }

  const { error } = await supabase.from("requirement_templates").insert({
    organization_id: organization.id,
    name,
    description: nullableValue(formData, "description"),
    document_type: primaryRequirement.documentType,
    expires_required: requirements.some((item) => item.expiresRequired),
    expiration_rule:
      requirements.find((item) => item.expirationRule !== "none")?.expirationRule ??
      "none",
    requirements,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  refreshDashboardPaths();
  return { ok: true };
}

export async function updateRequirementTemplate(
  formData: FormData,
): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const id = value(formData, "id");
  const name = cleanText(value(formData, "name"), 120);
  const requirements = parseRequirements(formData);

  if (!id || !name) {
    return { ok: false, error: "Template id and name are required." };
  }

  if (requirements.length === 0) {
    return { ok: false, error: "Add at least one required document." };
  }

  const labels = requirements.map((item) => item.label.toLowerCase());
  if (new Set(labels).size !== labels.length) {
    return { ok: false, error: "Requirement labels must be unique." };
  }

  const primaryRequirement = requirements[0];
  const supabase = createClient();
  const { count, error: duplicateError } = await supabase
    .from("requirement_templates")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .ilike("name", name)
    .neq("id", id);

  if (duplicateError) {
    return { ok: false, error: duplicateError.message };
  }

  if ((count ?? 0) > 0) {
    return { ok: false, error: "Another template already uses this name." };
  }

  const { error } = await supabase
    .from("requirement_templates")
    .update({
      name,
      description: nullableValue(formData, "description"),
      document_type: primaryRequirement.documentType,
      expires_required: requirements.some((item) => item.expiresRequired),
      expiration_rule:
        requirements.find((item) => item.expirationRule !== "none")
          ?.expirationRule ?? "none",
      requirements,
    })
    .eq("organization_id", organization.id)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  refreshDashboardPaths();
  return { ok: true };
}

export async function deleteRequirementTemplate(id: string): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();
  const { error } = await supabase
    .from("requirement_templates")
    .delete()
    .eq("organization_id", organization.id)
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }

  refreshDashboardPaths();
  return { ok: true };
}

export async function assignRequirementTemplate(
  formData: FormData,
): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const vendorId = value(formData, "vendorId");
  const templateId = value(formData, "templateId");
  const propertyId = nullableValue(formData, "propertyId");

  if (!vendorId || !templateId) {
    return { ok: false, error: "Vendor and template are required." };
  }

  const supabase = createClient();
  const { data: template, error: templateError } = await supabase
    .from("requirement_templates")
    .select("id, name, requirements")
    .eq("organization_id", organization.id)
    .eq("id", templateId)
    .maybeSingle();

  if (templateError || !template) {
    return {
      ok: false,
      error: templateError?.message ?? "Template could not be found.",
    };
  }

  const requirements = Array.isArray(template.requirements)
    ? (template.requirements as TemplateRequirement[])
    : [];

  if (requirements.length === 0) {
    return { ok: false, error: "Template has no document requirements." };
  }

  if (propertyId) {
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("id", propertyId)
      .maybeSingle();

    if (propertyError || !property) {
      return {
        ok: false,
        error: propertyError?.message ?? "Property could not be found.",
      };
    }
  }

  const { error: vendorError } = await supabase
    .from("vendors")
    .update({ default_requirement_template_id: templateId })
    .eq("organization_id", organization.id)
    .eq("id", vendorId);

  if (vendorError) {
    return { ok: false, error: vendorError.message };
  }

  const { error: deleteRequirementsError } = await supabase
    .from("vendor_requirements")
    .delete()
    .eq("organization_id", organization.id)
    .eq("vendor_id", vendorId);

  if (deleteRequirementsError) {
    return { ok: false, error: deleteRequirementsError.message };
  }

  const rows = requirements.map((requirement) => ({
    organization_id: organization.id,
    vendor_id: vendorId,
    property_id: propertyId,
    requirement_template_id: templateId,
    name: requirement.label,
    document_type: normalizeDocumentType(requirement.documentType),
    expires_required: requirement.expiresRequired,
    expiration_rule: requirement.expirationRule || "none",
    status: "missing",
  }));

  const { error: requirementError } = await supabase
    .from("vendor_requirements")
    .insert(rows);

  if (requirementError) {
    if (!isMissingColumnError(requirementError)) {
      return { ok: false, error: requirementError.message };
    }

    const fallbackRows = rows.map((row) => {
      const fallbackRow: Record<string, unknown> = { ...row };
      delete fallbackRow.expiration_rule;
      return fallbackRow;
    });
    const { error: fallbackError } = await supabase
      .from("vendor_requirements")
      .insert(fallbackRows);

    if (fallbackError) {
      return { ok: false, error: fallbackError.message };
    }
  }

  refreshDashboardPaths();
  return { ok: true };
}

export async function inviteVendorToPortal(vendorId: string): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const userId = await getCurrentUserId();
  const supabase = createClient();
  const { data: vendor, error } = await supabase
    .from("vendors")
    .select("id, name, email")
    .eq("organization_id", organization.id)
    .eq("id", vendorId)
    .maybeSingle();

  if (error || !vendor) {
    return { ok: false, error: error?.message ?? "Vendor could not be found." };
  }

  if (!vendor.email) {
    return { ok: false, error: "Add a vendor email before sending an invite." };
  }

  try {
    const portalVendor = vendor as { id: string; name: string; email: string };
    const { token } = await createVendorPortalInvite({
      organizationId: organization.id,
      vendorId: portalVendor.id,
      email: portalVendor.email,
      createdBy: userId,
    });
    const portalUrl = `${getSiteUrl()}/vendor/${token}`;
    const { error: emailError } = await sendVendorInviteEmail({
      to: portalVendor.email,
      vendorName: portalVendor.name,
      organizationName: organization.name,
      portalUrl,
    });

    if (emailError) {
      return { ok: false, error: emailError.message };
    }

    await supabase.from("communications").insert({
      organization_id: organization.id,
      vendor_id: portalVendor.id,
      channel: "email",
      direction: "outbound",
      subject: `${organization.name} requested vendor documents`,
      body: `Invite sent to ${portalVendor.email}. Portal link expires in 30 days.`,
      sent_at: new Date().toISOString(),
      created_by: userId,
    });

    refreshVendorPaths(portalVendor.id);
    return { ok: true };
  } catch (inviteError) {
    return {
      ok: false,
      error:
        inviteError instanceof Error
          ? inviteError.message
          : "Could not send vendor invite.",
    };
  }
}

export async function createSignedDocumentUpload(formData: FormData): Promise<
  ActionResult & {
    path?: string;
    token?: string;
    signedUrl?: string;
  }
> {
  const organization = await requirePrimaryOrganization();
  const vendorId = value(formData, "vendorId");
  const requirementId = value(formData, "requirementId");
  const fileName = value(formData, "fileName");

  if (!vendorId || !requirementId || !fileName) {
    return { ok: false, error: "Vendor, requirement, and file name are required." };
  }

  const supabase = createClient();
  const { data: requirement, error: requirementError } = await supabase
    .from("vendor_requirements")
    .select("id, vendor_id")
    .eq("organization_id", organization.id)
    .eq("id", requirementId)
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (requirementError || !requirement) {
    return {
      ok: false,
      error: requirementError?.message ?? "Requirement could not be found.",
    };
  }

  const safeFileName = sanitizeFileName(fileName);
  const path = `${organization.id}/${vendorId}/${requirementId}/${crypto.randomUUID()}-${safeFileName}`;
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from("documents")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create upload URL." };
  }

  return {
    ok: true,
    path,
    token: data.token,
    signedUrl: data.signedUrl,
  };
}

export async function completeDocumentUpload(
  formData: FormData,
): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const userId = await getCurrentUserId();
  const vendorId = value(formData, "vendorId");
  const requirementId = value(formData, "requirementId");
  const storagePath = value(formData, "storagePath");
  const fileName = value(formData, "fileName");
  const mimeType = nullableValue(formData, "mimeType");
  const sizeBytes = numberValue(formData, "sizeBytes");
  const expiresAt = nullableValue(formData, "expiresAt");

  if (!vendorId || !requirementId || !storagePath || !fileName) {
    return { ok: false, error: "Missing upload metadata." };
  }

  const supabase = createClient();
  let requirementResult = await supabase
    .from("vendor_requirements")
    .select("id, vendor_id, property_id, document_type, expires_required, expiration_rule")
    .eq("organization_id", organization.id)
    .eq("id", requirementId)
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (isMissingColumnError(requirementResult.error)) {
    requirementResult = await supabase
      .from("vendor_requirements")
      .select("id, vendor_id, property_id, document_type, expires_required")
      .eq("organization_id", organization.id)
      .eq("id", requirementId)
      .eq("vendor_id", vendorId)
      .maybeSingle();
  }

  const { data: requirement, error: requirementError } = requirementResult;

  if (requirementError || !requirement) {
    return {
      ok: false,
      error: requirementError?.message ?? "Requirement could not be found.",
    };
  }

  if (expiresAt && !isValidDateString(expiresAt)) {
    return { ok: false, error: "Enter a valid expiration date." };
  }

  const { data: existingDocument } = await supabase
    .from("documents")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("vendor_requirement_id", requirementId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let documentId = existingDocument?.id as string | undefined;

  if (!documentId) {
    const { data: documentRow, error: documentError } = await supabase
      .from("documents")
      .insert({
        organization_id: organization.id,
        vendor_id: vendorId,
        property_id: requirement.property_id,
        vendor_requirement_id: requirementId,
        document_type: requirement.document_type,
        status: "pending_review",
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (documentError || !documentRow) {
      return {
        ok: false,
        error: documentError?.message ?? "Could not create document.",
      };
    }

    documentId = documentRow.id as string;
  } else {
    const { error: updateDocumentError } = await supabase
      .from("documents")
      .update({
        status: "pending_review",
        expires_at: expiresAt,
        deficient_at: null,
        approved_at: null,
      })
      .eq("organization_id", organization.id)
      .eq("id", documentId);

    if (updateDocumentError) {
      return { ok: false, error: updateDocumentError.message };
    }
  }

  const { count } = await supabase
    .from("document_versions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id)
    .eq("document_id", documentId);

  const { data: version, error: versionError } = await supabase
    .from("document_versions")
    .insert({
      organization_id: organization.id,
      document_id: documentId,
      version_number: (count ?? 0) + 1,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes || null,
      uploaded_by: userId,
    })
    .select("id")
    .single();

  if (versionError || !version) {
    return {
      ok: false,
      error: versionError?.message ?? "Could not record document version.",
    };
  }

  const documentMetadataUpdate = {
      latest_document_version_id: version.id,
      status: "pending_review",
      business_name: null,
      policy_number: null,
      issued_at: null,
      expires_at: expiresAt,
      issuing_authority: null,
      ai_extraction_status: aiExtractionIsConfigured() ? "pending" : "disabled",
      ai_extraction_raw: null,
      ai_extraction_confidence: null,
      ai_extraction_flags: [],
      ai_extraction_usage: null,
      ai_extraction_error: null,
      ai_extraction_completed_at: null,
      ai_extraction_confirmed_at: null,
      ai_extraction_confirmed_by: null,
      ai_extraction_corrected_fields: null,
      ai_extracted_document_type: null,
      ai_extracted_business_name: null,
      ai_extracted_policy_number: null,
      ai_extracted_effective_date: null,
      ai_extracted_expiration_date: null,
      ai_extracted_issuing_authority: null,
    };

  const documentMetadataResult = await writeWithColumnFallback(
    (values) =>
      supabase
        .from("documents")
        .update(values)
        .eq("organization_id", organization.id)
        .eq("id", documentId),
    documentMetadataUpdate,
  );

  if (documentMetadataResult.error) {
    return { ok: false, error: documentMetadataResult.error.message };
  }

  const { error: requirementUpdateError } = await supabase
    .from("vendor_requirements")
    .update({
      status: "pending_review",
      expires_at: expiresAt,
    })
    .eq("organization_id", organization.id)
    .eq("id", requirementId);

  if (requirementUpdateError) {
    return { ok: false, error: requirementUpdateError.message };
  }

  await supabase.from("audit_logs").insert({
    organization_id: organization.id,
    actor_user_id: userId,
    action: "document.uploaded",
    entity_table: "documents",
    entity_id: documentId,
    metadata: {
      vendorId,
      requirementId,
      versionId: version.id,
      fileName,
      storagePath,
    },
  });

  refreshVendorPaths(vendorId);
  return {
    ok: true,
    documentId,
    documentVersionId: version.id as string,
    requirementId,
    aiExtractionConfigured: aiExtractionIsConfigured(),
  };
}

export async function scanUploadedDocument(formData: FormData): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const userId = await getCurrentUserId();
  const documentId = value(formData, "documentId");
  const documentVersionId = value(formData, "documentVersionId");
  const requirementId = value(formData, "requirementId");

  if (!documentId || !documentVersionId || !requirementId) {
    return { ok: false, error: "Document extraction metadata is missing." };
  }

  const supabase = createClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select("id, vendor_id, vendor_requirement_id")
    .eq("organization_id", organization.id)
    .eq("id", documentId)
    .eq("vendor_requirement_id", requirementId)
    .maybeSingle();

  if (error || !document) {
    return { ok: false, error: error?.message ?? "Document could not be found." };
  }

  await scanDocumentVersion({
    organizationId: organization.id,
    documentId,
    documentVersionId,
    requirementId,
    actorUserId: userId,
  });

  refreshVendorPaths(document.vendor_id as string);
  return { ok: true };
}

export async function reviewDocument(formData: FormData): Promise<ActionResult> {
  const organization = await requirePrimaryOrganization();
  const userId = await getCurrentUserId();
  const vendorId = value(formData, "vendorId");
  const requirementId = value(formData, "requirementId");
  const documentId = value(formData, "documentId");
  const documentVersionId = value(formData, "documentVersionId");
  const decision = value(formData, "decision");
  const note = nullableValue(formData, "note");
  const confirmedBusinessName = nullableValue(formData, "confirmedBusinessName");
  const confirmedPolicyNumber = nullableValue(formData, "confirmedPolicyNumber");
  const confirmedEffectiveDate = nullableValue(formData, "confirmedEffectiveDate");
  const confirmedExpirationDate = nullableValue(formData, "confirmedExpirationDate");
  const confirmedIssuingAuthority = nullableValue(formData, "confirmedIssuingAuthority");

  if (!vendorId || !requirementId || !documentId || !documentVersionId) {
    return { ok: false, error: "Document review metadata is missing." };
  }

  if (!["approved", "rejected", "needs_changes"].includes(decision)) {
    return { ok: false, error: "Choose a valid review decision." };
  }

  if (!isValidDateString(confirmedEffectiveDate) || !isValidDateString(confirmedExpirationDate)) {
    return { ok: false, error: "Confirmed dates must use YYYY-MM-DD format." };
  }

  const supabase = createClient();
  let documentForReviewResult = await supabase
    .from("documents")
    .select("id, ai_extracted_business_name, ai_extracted_policy_number, ai_extracted_effective_date, ai_extracted_expiration_date, ai_extracted_issuing_authority")
    .eq("organization_id", organization.id)
    .eq("id", documentId)
    .maybeSingle();

  if (isMissingColumnError(documentForReviewResult.error)) {
    documentForReviewResult = await supabase
      .from("documents")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("id", documentId)
      .maybeSingle();
  }

  const { data: documentForReview, error: documentLookupError } = documentForReviewResult;
  const [{ data: requirementForReview, error: requirementLookupError }] =
    await Promise.all([
      supabase
        .from("vendor_requirements")
        .select("id, expires_required")
        .eq("organization_id", organization.id)
        .eq("id", requirementId)
        .maybeSingle(),
    ]);

  if (documentLookupError || !documentForReview) {
    return { ok: false, error: documentLookupError?.message ?? "Document could not be found." };
  }

  if (requirementLookupError || !requirementForReview) {
    return {
      ok: false,
      error: requirementLookupError?.message ?? "Requirement could not be found.",
    };
  }

  if (decision === "approved" && requirementForReview.expires_required && !confirmedExpirationDate) {
    return { ok: false, error: "Confirm an expiration date before approving this document." };
  }

  const correctedFields = correctionDiff(
    {
      businessName: "ai_extracted_business_name" in documentForReview ? documentForReview.ai_extracted_business_name as string | null : null,
      policyNumber: "ai_extracted_policy_number" in documentForReview ? documentForReview.ai_extracted_policy_number as string | null : null,
      effectiveDate: "ai_extracted_effective_date" in documentForReview ? documentForReview.ai_extracted_effective_date as string | null : null,
      expirationDate: "ai_extracted_expiration_date" in documentForReview ? documentForReview.ai_extracted_expiration_date as string | null : null,
      issuingAuthority: "ai_extracted_issuing_authority" in documentForReview ? documentForReview.ai_extracted_issuing_authority as string | null : null,
    },
    {
      businessName: confirmedBusinessName,
      policyNumber: confirmedPolicyNumber,
      effectiveDate: confirmedEffectiveDate,
      expirationDate: confirmedExpirationDate,
      issuingAuthority: confirmedIssuingAuthority,
    },
  );

  const { error: reviewError } = await supabase.from("document_reviews").insert({
    organization_id: organization.id,
    document_id: documentId,
    document_version_id: documentVersionId,
    reviewer_id: userId,
    status: decision,
    notes: note,
  });

  if (reviewError) {
    return { ok: false, error: reviewError.message };
  }

  const approved = decision === "approved";
  const documentStatus = approved ? "approved" : "rejected";
  const requirementStatus = approved ? "compliant" : "missing";

  const documentReviewUpdate = {
      status: documentStatus,
      business_name: confirmedBusinessName,
      policy_number: confirmedPolicyNumber,
      issued_at: confirmedEffectiveDate,
      expires_at: confirmedExpirationDate,
      issuing_authority: confirmedIssuingAuthority,
      ai_extraction_confirmed_at: new Date().toISOString(),
      ai_extraction_confirmed_by: userId,
      ai_extraction_corrected_fields:
        Object.keys(correctedFields).length > 0 ? correctedFields : null,
      approved_at: approved ? new Date().toISOString() : null,
      deficient_at: approved ? null : new Date().toISOString(),
    };

  const { error: documentError } = await writeWithColumnFallback(
    (values) =>
      supabase
        .from("documents")
        .update(values)
        .eq("organization_id", organization.id)
        .eq("id", documentId),
    documentReviewUpdate,
  );

  if (documentError) {
    return { ok: false, error: documentError.message };
  }

  const { error: requirementError } = await supabase
    .from("vendor_requirements")
    .update({ status: requirementStatus, expires_at: confirmedExpirationDate })
    .eq("organization_id", organization.id)
    .eq("id", requirementId);

  if (requirementError) {
    return { ok: false, error: requirementError.message };
  }

  await supabase.from("audit_logs").insert({
    organization_id: organization.id,
    actor_user_id: userId,
    action: approved ? "document.approved" : "document.deficient",
    entity_table: "documents",
    entity_id: documentId,
    metadata: {
      vendorId,
      requirementId,
      documentVersionId,
      note,
      decision,
      correctedFields,
    },
  });

  if (Object.keys(correctedFields).length > 0) {
    await supabase.from("audit_logs").insert({
      organization_id: organization.id,
      actor_user_id: userId,
      action: "document.ai_extraction.corrected",
      entity_table: "documents",
      entity_id: documentId,
      metadata: {
        vendorId,
        requirementId,
        documentVersionId,
        correctedFields,
      },
    });
  }

  refreshVendorPaths(vendorId);
  return { ok: true };
}
