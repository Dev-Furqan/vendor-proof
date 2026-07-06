"use server";

import { revalidatePath } from "next/cache";
import { requirePrimaryOrganization } from "@/lib/auth/require-organization";
import { sendVendorInviteEmail } from "@/lib/email/vendor-emails";
import { getSiteUrl } from "@/lib/site-url";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createVendorPortalInvite } from "@/lib/vendor-portal/tokens";
import type { TemplateRequirement } from "@/components/dashboard/types";

type ActionResult = {
  ok: boolean;
  error?: string;
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
  const name = value(formData, "name");

  if (!name) {
    return { ok: false, error: "Property name is required." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("properties").insert({
    organization_id: organization.id,
    name,
    address_line1: nullableValue(formData, "address"),
    unit_count: numberValue(formData, "unitCount"),
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
  const name = value(formData, "name");

  if (!id || !name) {
    return { ok: false, error: "Property id and name are required." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("properties")
    .update({
      name,
      address_line1: nullableValue(formData, "address"),
      unit_count: numberValue(formData, "unitCount"),
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
  const name = value(formData, "name");

  if (!name) {
    return { ok: false, error: "Vendor name is required." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("vendors").insert({
    organization_id: organization.id,
    name,
    email: nullableValue(formData, "email"),
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
  const name = value(formData, "name");

  if (!id || !name) {
    return { ok: false, error: "Vendor id and name are required." };
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("vendors")
    .update({
      name,
      email: nullableValue(formData, "email"),
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
      name: row.name?.trim(),
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      trade: row.category?.trim() || null,
      category: row.category?.trim() || null,
    }))
    .filter((row) => row.name);

  if (cleanRows.length === 0) {
    return { ok: false, error: "No valid vendor rows were found." };
  }

  const supabase = createClient();
  const { error } = await supabase.from("vendors").insert(cleanRows);

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
  const name = value(formData, "name");
  const requirements = parseRequirements(formData);

  if (!name) {
    return { ok: false, error: "Template name is required." };
  }

  if (requirements.length === 0) {
    return { ok: false, error: "Add at least one required document." };
  }

  const primaryRequirement = requirements[0];
  const supabase = createClient();
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
  const name = value(formData, "name");
  const requirements = parseRequirements(formData);

  if (!id || !name) {
    return { ok: false, error: "Template id and name are required." };
  }

  if (requirements.length === 0) {
    return { ok: false, error: "Add at least one required document." };
  }

  const primaryRequirement = requirements[0];
  const supabase = createClient();
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

  const { error: vendorError } = await supabase
    .from("vendors")
    .update({ default_requirement_template_id: templateId })
    .eq("organization_id", organization.id)
    .eq("id", vendorId);

  if (vendorError) {
    return { ok: false, error: vendorError.message };
  }

  await supabase
    .from("vendor_requirements")
    .delete()
    .eq("organization_id", organization.id)
    .eq("vendor_id", vendorId);

  const rows = requirements.map((requirement) => ({
    organization_id: organization.id,
    vendor_id: vendorId,
    requirement_template_id: templateId,
    name: requirement.label,
    document_type: normalizeDocumentType(requirement.documentType),
    expires_required: requirement.expiresRequired,
    status: "missing",
  }));

  const { error: requirementError } = await supabase
    .from("vendor_requirements")
    .insert(rows);

  if (requirementError) {
    return { ok: false, error: requirementError.message };
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
  const { data: requirement, error: requirementError } = await supabase
    .from("vendor_requirements")
    .select("id, vendor_id, property_id, document_type")
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

  await supabase
    .from("documents")
    .update({
      latest_document_version_id: version.id,
      status: "pending_review",
      expires_at: expiresAt,
    })
    .eq("organization_id", organization.id)
    .eq("id", documentId);

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

  if (!vendorId || !requirementId || !documentId || !documentVersionId) {
    return { ok: false, error: "Document review metadata is missing." };
  }

  if (!["approved", "rejected", "needs_changes"].includes(decision)) {
    return { ok: false, error: "Choose a valid review decision." };
  }

  const supabase = createClient();
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

  const { error: documentError } = await supabase
    .from("documents")
    .update({
      status: documentStatus,
      approved_at: approved ? new Date().toISOString() : null,
      deficient_at: approved ? null : new Date().toISOString(),
    })
    .eq("organization_id", organization.id)
    .eq("id", documentId);

  if (documentError) {
    return { ok: false, error: documentError.message };
  }

  const { error: requirementError } = await supabase
    .from("vendor_requirements")
    .update({ status: requirementStatus })
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
    },
  });

  refreshVendorPaths(vendorId);
  return { ok: true };
}
