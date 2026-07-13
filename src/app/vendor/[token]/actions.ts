"use server";

import { revalidatePath } from "next/cache";
import { aiExtractionIsConfigured, scanDocumentVersion } from "@/lib/ai/document-scanning";
import { isMissingColumnError } from "@/lib/document-schema-compat";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isValidDateString } from "@/lib/validation";
import { resolveVendorPortalToken } from "@/lib/vendor-portal/tokens";

type ActionResult = {
  ok: boolean;
  error?: string;
  path?: string;
  token?: string;
  documentId?: string;
  documentVersionId?: string;
  requirementId?: string;
  aiExtractionConfigured?: boolean;
};

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

function numberValue(formData: FormData, key: string) {
  const text = value(formData, key);
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);

  return cleaned || "document";
}

function stripUnknownColumn<T extends Record<string, unknown>>(values: T, error: { message?: string }) {
  const message = error.message ?? "";
  const quoted = message.match(/'([a-zA-Z0-9_]+)'/);
  const dotted = message.match(/column\s+[a-zA-Z0-9_]+\.([a-zA-Z0-9_]+)/i);
  const bare = message.match(/column\s+([a-zA-Z0-9_]+)/i);
  const column = quoted?.[1] ?? dotted?.[1] ?? bare?.[1];

  if (!column || !(column in values)) {
    return null;
  }

  const next = { ...values };
  delete next[column];
  return next;
}

async function updateWithColumnFallback(
  query: (values: Record<string, unknown>) => PromiseLike<{ error: { message?: string; code?: string } | null }>,
  values: Record<string, unknown>,
) {
  let nextValues = values;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await query(nextValues);
    if (!result.error || !isMissingColumnError(result.error)) {
      return result;
    }

    const stripped = stripUnknownColumn(nextValues, result.error);
    if (!stripped) {
      return result;
    }
    nextValues = stripped;
  }

  return query(nextValues);
}

async function getRequirementForToken(portalToken: string, requirementId: string) {
  const invite = await resolveVendorPortalToken(portalToken);

  if (!invite) {
    return { invite: null, requirement: null };
  }

  const admin = getSupabaseAdmin();
  const { data: requirement } = await admin
    .from("vendor_requirements")
    .select("id, organization_id, vendor_id, property_id, document_type, name, expires_required")
    .eq("organization_id", invite.organization_id)
    .eq("vendor_id", invite.vendor_id)
    .eq("id", requirementId)
    .maybeSingle();

  return { invite, requirement };
}

export async function createVendorPortalUpload(
  formData: FormData,
): Promise<ActionResult> {
  const portalToken = value(formData, "portalToken");
  const requirementId = value(formData, "requirementId");
  const fileName = value(formData, "fileName");

  if (!portalToken || !requirementId || !fileName) {
    return { ok: false, error: "Missing upload details." };
  }

  const { invite, requirement } = await getRequirementForToken(
    portalToken,
    requirementId,
  );

  if (!invite || !requirement) {
    return { ok: false, error: "This upload link is invalid or expired." };
  }

  const path = `${invite.organization_id}/${invite.vendor_id}/${requirement.id}/${crypto.randomUUID()}-${sanitizeFileName(fileName)}`;
  const { data, error } = await getSupabaseAdmin().storage
    .from("documents")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not create upload URL." };
  }

  return { ok: true, path, token: data.token };
}

export async function completeVendorPortalUpload(
  formData: FormData,
): Promise<ActionResult> {
  const portalToken = value(formData, "portalToken");
  const requirementId = value(formData, "requirementId");
  const storagePath = value(formData, "storagePath");
  const fileName = value(formData, "fileName");
  const mimeType = value(formData, "mimeType") || null;
  const sizeBytes = numberValue(formData, "sizeBytes");
  const expiresAt = value(formData, "expiresAt") || null;

  if (!portalToken || !requirementId || !storagePath || !fileName) {
    return { ok: false, error: "Missing upload metadata." };
  }

  const { invite, requirement } = await getRequirementForToken(
    portalToken,
    requirementId,
  );

  if (!invite || !requirement) {
    return { ok: false, error: "This upload link is invalid or expired." };
  }

  if (expiresAt && !isValidDateString(expiresAt)) {
    return { ok: false, error: "Enter a valid expiration date." };
  }

  const admin = getSupabaseAdmin();
  const { data: existingDocument } = await admin
    .from("documents")
    .select("id")
    .eq("organization_id", invite.organization_id)
    .eq("vendor_requirement_id", requirementId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let documentId = existingDocument?.id as string | undefined;

  if (!documentId) {
    const { data: documentRow, error } = await admin
      .from("documents")
      .insert({
        organization_id: invite.organization_id,
        vendor_id: invite.vendor_id,
        property_id: requirement.property_id,
        vendor_requirement_id: requirement.id,
        document_type: requirement.document_type,
        status: "pending_review",
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (error || !documentRow) {
      return { ok: false, error: error?.message ?? "Could not save document." };
    }

    documentId = documentRow.id as string;
  } else {
    const { error } = await admin
      .from("documents")
      .update({
        status: "pending_review",
        expires_at: expiresAt,
        deficient_at: null,
        approved_at: null,
      })
      .eq("organization_id", invite.organization_id)
      .eq("id", documentId);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  const { count } = await admin
    .from("document_versions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", invite.organization_id)
    .eq("document_id", documentId);

  const { data: version, error: versionError } = await admin
    .from("document_versions")
    .insert({
      organization_id: invite.organization_id,
      document_id: documentId,
      version_number: (count ?? 0) + 1,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: sizeBytes || null,
      uploaded_by: null,
    })
    .select("id")
    .single();

  if (versionError || !version) {
    return {
      ok: false,
      error: versionError?.message ?? "Could not record document version.",
    };
  }

  const documentMetadataResult = await updateWithColumnFallback(
    (values) =>
      admin
        .from("documents")
        .update(values)
        .eq("organization_id", invite.organization_id)
        .eq("id", documentId),
    {
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
    },
  );

  if (documentMetadataResult.error) {
    return { ok: false, error: documentMetadataResult.error.message };
  }

  await admin
    .from("vendor_requirements")
    .update({ status: "pending_review", expires_at: expiresAt })
    .eq("organization_id", invite.organization_id)
    .eq("id", requirementId);

  await admin.from("communications").insert({
    organization_id: invite.organization_id,
    vendor_id: invite.vendor_id,
    related_document_id: documentId,
    channel: "email",
    direction: "inbound",
    subject: `Vendor uploaded ${requirement.name}`,
    body: `${fileName} was uploaded through the vendor portal.`,
    sent_at: new Date().toISOString(),
  });

  await admin.from("audit_logs").insert({
    organization_id: invite.organization_id,
    actor_user_id: null,
    action: "document.vendor_uploaded",
    entity_table: "documents",
    entity_id: documentId,
    metadata: {
      inviteId: invite.id,
      vendorId: invite.vendor_id,
      requirementId,
      versionId: version.id,
      fileName,
      storagePath,
    },
  });

  revalidatePath(`/vendor/${portalToken}`);
  return {
    ok: true,
    documentId,
    documentVersionId: version.id as string,
    requirementId,
    aiExtractionConfigured: aiExtractionIsConfigured(),
  };
}

export async function scanVendorPortalDocument(
  formData: FormData,
): Promise<ActionResult> {
  const portalToken = value(formData, "portalToken");
  const requirementId = value(formData, "requirementId");
  const documentId = value(formData, "documentId");
  const documentVersionId = value(formData, "documentVersionId");

  if (!portalToken || !requirementId || !documentId || !documentVersionId) {
    return { ok: false, error: "Document extraction metadata is missing." };
  }

  const { invite, requirement } = await getRequirementForToken(
    portalToken,
    requirementId,
  );

  if (!invite || !requirement) {
    return { ok: false, error: "This upload link is invalid or expired." };
  }

  const admin = getSupabaseAdmin();
  const { data: document, error } = await admin
    .from("documents")
    .select("id")
    .eq("organization_id", invite.organization_id)
    .eq("vendor_id", invite.vendor_id)
    .eq("vendor_requirement_id", requirementId)
    .eq("id", documentId)
    .maybeSingle();

  if (error || !document) {
    return { ok: false, error: error?.message ?? "Document could not be found." };
  }

  await scanDocumentVersion({
    organizationId: invite.organization_id,
    documentId,
    documentVersionId,
    requirementId,
    actorUserId: null,
  });

  revalidatePath(`/vendor/${portalToken}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/compliance");
  revalidatePath("/dashboard/vendors");
  revalidatePath(`/dashboard/vendors/${invite.vendor_id}`);
  return { ok: true };
}
