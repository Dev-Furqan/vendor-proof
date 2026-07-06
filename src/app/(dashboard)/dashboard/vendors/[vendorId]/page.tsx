import { notFound } from "next/navigation";
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
import { createSignedDocumentUrl } from "@/lib/documents";
import { requirePrimaryOrganization } from "@/lib/auth/require-organization";
import { createClient } from "@/lib/supabase/server";

export default async function VendorDetailPage({
  params,
}: {
  params: { vendorId: string };
}) {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, name, email, phone, trade, category, status, default_requirement_template_id, created_at")
    .eq("organization_id", organization.id)
    .eq("id", params.vendorId)
    .maybeSingle();

  if (!vendor) {
    notFound();
  }

  const [requirementsResult, documentsResult, communicationsResult] = await Promise.all([
    supabase
      .from("vendor_requirements")
      .select("id, organization_id, vendor_id, property_id, requirement_template_id, name, document_type, required, expires_required, status, due_date, expires_at, created_at, updated_at")
      .eq("organization_id", organization.id)
      .eq("vendor_id", params.vendorId)
      .order("created_at", { ascending: true }),
    supabase
      .from("documents")
      .select("id, organization_id, vendor_id, property_id, vendor_requirement_id, document_type, status, issued_at, expires_at, created_at, updated_at")
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

  const documents = (documentsResult.data ?? []) as DocumentRecord[];
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
      : [{ data: [] }, { data: [] }];

  const versionsWithUrls = await Promise.all(
    ((versionsResult.data ?? []) as DocumentVersionRecord[]).map(async (version) => ({
      ...version,
      signedUrl: await createSignedDocumentUrl(version.storage_path),
    })),
  );

  const requirements = attachDocumentsToRequirements({
    requirements: (requirementsResult.data ?? []) as VendorRequirementRecord[],
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
