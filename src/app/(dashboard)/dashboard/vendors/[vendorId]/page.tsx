import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { VendorChecklistClient } from "@/components/dashboard/documents/vendor-checklist-client";
import type {
  DocumentRecord,
  DocumentReviewRecord,
  DocumentVersionRecord,
  CommunicationRecord,
  VendorRecord,
  VendorRequirementRecord,
} from "@/components/dashboard/types";
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
import { createSignedDocumentUrl } from "@/lib/documents";
import { requirePrimaryOrganization } from "@/lib/auth/require-organization";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Vendor Checklist | VendorProof",
  description: "Review uploads, approvals, and communications for a vendor.",
};

export default async function VendorDetailPage({
  params,
}: {
  params: { vendorId: string };
}) {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("id, name, email, phone, trade, category, status, default_requirement_template_id, created_at")
    .eq("organization_id", organization.id)
    .eq("id", params.vendorId)
    .maybeSingle();

  if (vendorError) {
    throw new Error(vendorError.message);
  }

  if (!vendor) {
    notFound();
  }

  const [initialRequirementsResult, initialDocumentsResult, communicationsResult] = await Promise.all([
    supabase
      .from("vendor_requirements")
      .select(requirementSelectWithRules)
      .eq("organization_id", organization.id)
      .eq("vendor_id", params.vendorId)
      .order("created_at", { ascending: true }),
    supabase
      .from("documents")
      .select(documentSelectWithAi)
      .eq("organization_id", organization.id)
      .eq("vendor_id", params.vendorId),
    supabase
      .from("communications")
      .select("id, vendor_id, channel, direction, subject, body, sent_at, created_at")
      .eq("organization_id", organization.id)
      .eq("vendor_id", params.vendorId)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);
  let requirementsResult = initialRequirementsResult as SchemaCompatResult;
  let documentsResult = initialDocumentsResult as SchemaCompatResult;

  if (isMissingColumnError(requirementsResult.error)) {
    requirementsResult = await supabase
      .from("vendor_requirements")
      .select(requirementSelectBase)
      .eq("organization_id", organization.id)
      .eq("vendor_id", params.vendorId)
      .order("created_at", { ascending: true });
  }

  if (isMissingColumnError(documentsResult.error)) {
    documentsResult = await supabase
      .from("documents")
      .select(documentSelectBase)
      .eq("organization_id", organization.id)
      .eq("vendor_id", params.vendorId);
  }

  const queryError =
    requirementsResult.error ?? documentsResult.error ?? communicationsResult.error;

  if (queryError) {
    throw new Error(queryError.message);
  }

  const documents = ((documentsResult.data ?? []) as DocumentRecord[]).map(withDocumentDefaults);
  const documentIds = documents.map((document) => document.id);

  const [versionsResult, reviewsResult] =
    documentIds.length > 0
      ? await Promise.all([
          supabase
            .from("document_versions")
            .select("id, organization_id, document_id, version_number, storage_path, file_name, mime_type, size_bytes, uploaded_by, created_at")
            .eq("organization_id", organization.id)
            .in("document_id", documentIds),
          supabase
            .from("document_reviews")
            .select("id, document_id, document_version_id, reviewer_id, status, notes, reviewed_at")
            .eq("organization_id", organization.id)
            .in("document_id", documentIds),
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

  const documentQueryError = versionsResult.error ?? reviewsResult.error;

  if (documentQueryError) {
    throw new Error(documentQueryError.message);
  }

  const versionsWithUrls = await Promise.all(
    ((versionsResult.data ?? []) as DocumentVersionRecord[]).map(async (version) => ({
      ...version,
      signedUrl: await createSignedDocumentUrl(version.storage_path),
    })),
  );

  const requirements = attachDocumentsToRequirements({
    requirements: ((requirementsResult.data ?? []) as VendorRequirementRecord[]).map(
      withRequirementDefaults,
    ),
    documents,
    versions: versionsWithUrls,
    reviews: (reviewsResult.data ?? []) as DocumentReviewRecord[],
  });

  return (
    <VendorChecklistClient
      vendor={vendor as VendorRecord}
      requirements={requirements}
      communications={(communicationsResult.data ?? []) as CommunicationRecord[]}
    />
  );
}
