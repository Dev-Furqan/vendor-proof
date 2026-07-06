import { notFound } from "next/navigation";
import type {
  DocumentRecord,
  DocumentReviewRecord,
  DocumentVersionRecord,
  VendorRecord,
  VendorRequirementRecord,
} from "@/components/dashboard/types";
import { VendorPortalClient } from "@/components/vendor/vendor-portal-client";
import { attachDocumentsToRequirements } from "@/lib/compliance/status";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { resolveVendorPortalToken } from "@/lib/vendor-portal/tokens";

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
  const [vendorResult, requirementsResult, documentsResult] = await Promise.all([
    admin
      .from("vendors")
      .select("id, name, email, phone, trade, category, status, default_requirement_template_id, created_at")
      .eq("organization_id", invite.organization_id)
      .eq("id", invite.vendor_id)
      .maybeSingle(),
    admin
      .from("vendor_requirements")
      .select("id, organization_id, vendor_id, property_id, requirement_template_id, name, document_type, required, expires_required, status, due_date, expires_at, created_at, updated_at")
      .eq("organization_id", invite.organization_id)
      .eq("vendor_id", invite.vendor_id)
      .order("created_at", { ascending: true }),
    admin
      .from("documents")
      .select("id, organization_id, vendor_id, property_id, vendor_requirement_id, document_type, status, issued_at, expires_at, created_at, updated_at")
      .eq("organization_id", invite.organization_id)
      .eq("vendor_id", invite.vendor_id),
  ]);

  if (!vendorResult.data) {
    notFound();
  }

  const documents = (documentsResult.data ?? []) as DocumentRecord[];
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
      : [{ data: [] }, { data: [] }];

  const requirements = attachDocumentsToRequirements({
    requirements: (requirementsResult.data ?? []) as VendorRequirementRecord[],
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
