import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type {
  DocumentRecord,
  DocumentReviewRecord,
  DocumentVersionRecord,
  VendorRecord,
  VendorRequirementRecord,
} from "@/components/dashboard/types";
import { VendorPortalClient } from "@/components/vendor/vendor-portal-client";
import { attachDocumentsToRequirements } from "@/lib/compliance/status";
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
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveVendorPortalToken } from "@/lib/vendor-portal/tokens";

export const metadata: Metadata = {
  title: "Vendor Upload Portal | VendorProof",
  description: "Secure vendor document upload portal.",
};

export default async function VendorPortalPage({
  params,
}: {
  params: { token: string };
}) {
  const invite = await resolveVendorPortalToken(params.token);

  if (!invite) {
    notFound();
  }

  const admin = getSupabaseAdmin();
  const [vendorResult, initialRequirementsResult, initialDocumentsResult] = await Promise.all([
    admin
      .from("vendors")
      .select("id, name, email, phone, trade, category, status, default_requirement_template_id, created_at")
      .eq("organization_id", invite.organization_id)
      .eq("id", invite.vendor_id)
      .maybeSingle(),
    admin
      .from("vendor_requirements")
      .select(requirementSelectWithRules)
      .eq("organization_id", invite.organization_id)
      .eq("vendor_id", invite.vendor_id)
      .order("created_at", { ascending: true }),
    admin
      .from("documents")
      .select(documentSelectWithAi)
      .eq("organization_id", invite.organization_id)
      .eq("vendor_id", invite.vendor_id),
  ]);
  let requirementsResult = initialRequirementsResult as SchemaCompatResult;
  let documentsResult = initialDocumentsResult as SchemaCompatResult;

  if (isMissingColumnError(requirementsResult.error)) {
    requirementsResult = await admin
      .from("vendor_requirements")
      .select(requirementSelectBase)
      .eq("organization_id", invite.organization_id)
      .eq("vendor_id", invite.vendor_id)
      .order("created_at", { ascending: true });
  }

  if (isMissingColumnError(documentsResult.error)) {
    documentsResult = await admin
      .from("documents")
      .select(documentSelectBase)
      .eq("organization_id", invite.organization_id)
      .eq("vendor_id", invite.vendor_id);
  }

  const queryError =
    vendorResult.error ?? requirementsResult.error ?? documentsResult.error;

  if (queryError) {
    throw new Error(queryError.message);
  }

  if (!vendorResult.data) {
    notFound();
  }

  const documents = ((documentsResult.data ?? []) as DocumentRecord[]).map(withDocumentDefaults);
  const documentIds = documents.map((document) => document.id);
  const [versionsResult, reviewsResult] =
    documentIds.length > 0
      ? await Promise.all([
          admin
            .from("document_versions")
            .select("id, organization_id, document_id, version_number, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at")
            .eq("organization_id", invite.organization_id)
            .in("document_id", documentIds),
          admin
            .from("document_reviews")
            .select("id, document_id, document_version_id, reviewer_id, status, notes, reviewed_at")
            .eq("organization_id", invite.organization_id)
            .in("document_id", documentIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  const documentQueryError = versionsResult.error ?? reviewsResult.error;

  if (documentQueryError) {
    throw new Error(documentQueryError.message);
  }

  const requirements = attachDocumentsToRequirements({
    requirements: ((requirementsResult.data ?? []) as VendorRequirementRecord[]).map(
      withRequirementDefaults,
    ),
    documents,
    versions: (versionsResult.data ?? []) as DocumentVersionRecord[],
    reviews: (reviewsResult.data ?? []) as DocumentReviewRecord[],
  });

  return (
    <VendorPortalClient
      portalToken={params.token}
      vendor={vendorResult.data as VendorRecord}
      requirements={requirements}
    />
  );
}
