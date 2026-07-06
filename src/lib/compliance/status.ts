import type {
  CompliancePropertyRow,
  ComplianceStatus,
  ComplianceVendorRow,
  DocumentRecord,
  DocumentReviewRecord,
  DocumentVersionRecord,
  PropertyRecord,
  VendorRecord,
  VendorRequirementRecord,
} from "@/components/dashboard/types";

const EXPIRING_DAYS = 30;

export function daysUntil(date: string | null | undefined) {
  if (!date) {
    return null;
  }

  const target = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function getRequirementStatus(requirement: VendorRequirementRecord): ComplianceStatus {
  const latestReview = requirement.document?.latestReview;

  if (latestReview && latestReview.status !== "approved") {
    return "deficient";
  }

  if (!requirement.document) {
    return requirement.status === "missing" ? "missing" : "never_responded";
  }

  if (requirement.document.status === "pending_review") {
    return "under_review";
  }

  if (requirement.document.status === "rejected") {
    return "deficient";
  }

  const days = daysUntil(requirement.document.expires_at ?? requirement.expires_at);
  if (days !== null && days < 0) {
    return "missing";
  }

  if (days !== null && days <= EXPIRING_DAYS) {
    return "expiring";
  }

  if (requirement.document.status === "approved" || requirement.status === "compliant") {
    return "compliant";
  }

  return "under_review";
}

export function summarizeStatuses(statuses: ComplianceStatus[]) {
  return statuses.reduce(
    (summary, status) => {
      summary.total += 1;
      if (status === "compliant") summary.compliant += 1;
      if (status === "expiring") summary.expiring += 1;
      if (status === "missing" || status === "never_responded") summary.missing += 1;
      if (status === "under_review") summary.underReview += 1;
      if (status === "deficient") summary.deficient += 1;
      return summary;
    },
    {
      total: 0,
      compliant: 0,
      expiring: 0,
      expired: 0,
      missing: 0,
      underReview: 0,
      deficient: 0,
    },
  );
}

export function overallStatus(summary: ReturnType<typeof summarizeStatuses>): ComplianceStatus {
  if (summary.deficient > 0 || summary.missing > 0) {
    return "missing";
  }

  if (summary.underReview > 0) {
    return "under_review";
  }

  if (summary.expiring > 0) {
    return "expiring";
  }

  return "compliant";
}

export function attachDocumentsToRequirements({
  requirements,
  documents,
  versions,
  reviews,
}: {
  requirements: VendorRequirementRecord[];
  documents: DocumentRecord[];
  versions: DocumentVersionRecord[];
  reviews: DocumentReviewRecord[];
}) {
  const versionsByDocument = new Map<string, DocumentVersionRecord[]>();
  versions.forEach((version) => {
    const current = versionsByDocument.get(version.document_id) ?? [];
    current.push(version);
    versionsByDocument.set(version.document_id, current);
  });

  const reviewsByDocument = new Map<string, DocumentReviewRecord[]>();
  reviews.forEach((review) => {
    const current = reviewsByDocument.get(review.document_id) ?? [];
    current.push(review);
    reviewsByDocument.set(review.document_id, current);
  });

  const documentByRequirement = new Map<string, DocumentRecord>();
  documents.forEach((document) => {
    if (!document.vendor_requirement_id) {
      return;
    }

    const sortedVersions = (versionsByDocument.get(document.id) ?? []).sort(
      (a, b) => (b.version_number ?? 0) - (a.version_number ?? 0),
    );
    const sortedReviews = (reviewsByDocument.get(document.id) ?? []).sort(
      (a, b) =>
        new Date(b.reviewed_at ?? b.id).getTime() -
        new Date(a.reviewed_at ?? a.id).getTime(),
    );

    documentByRequirement.set(document.vendor_requirement_id, {
      ...document,
      latestVersion: sortedVersions[0] ?? null,
      latestReview: sortedReviews[0] ?? null,
    });
  });

  return requirements.map((requirement) => ({
    ...requirement,
    document: documentByRequirement.get(requirement.id) ?? null,
  }));
}

export function buildVendorComplianceRows({
  vendors,
  properties,
  requirements,
}: {
  vendors: VendorRecord[];
  properties: PropertyRecord[];
  requirements: VendorRequirementRecord[];
}) {
  const propertyNames = new Map<string, string>();
  properties.forEach((property) => propertyNames.set(property.id, property.name));

  return vendors.map((vendor) => {
    const vendorRequirements = requirements.filter(
      (requirement) => requirement.vendor_id === vendor.id,
    );
    const statuses = vendorRequirements.map(getRequirementStatus);
    const summary = summarizeStatuses(statuses);
    const firstPropertyId = vendorRequirements.find((item) => item.property_id)?.property_id ?? null;
    const lastUploadAt =
      vendorRequirements
        .map((item) => item.document?.latestVersion?.created_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;

    return {
      id: vendor.id,
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      propertyId: firstPropertyId,
      propertyName: firstPropertyId
        ? propertyNames.get(firstPropertyId) ?? "Unknown property"
        : "Unassigned",
      ...summary,
      status: statuses.length === 0 ? "never_responded" : overallStatus(summary),
      lastUploadAt,
    } satisfies ComplianceVendorRow;
  });
}

export function buildPropertyComplianceRows({
  vendorRows,
  properties,
}: {
  vendorRows: ComplianceVendorRow[];
  properties: PropertyRecord[];
}) {
  const rows: CompliancePropertyRow[] = properties.map((property) => {
    const vendors = vendorRows.filter((row) => row.propertyId === property.id);
    const summary = vendors.reduce(
      (current, vendor) => ({
        total: current.total + vendor.total,
        compliant: current.compliant + vendor.compliant,
        expiring: current.expiring + vendor.expiring,
        expired: current.expired + vendor.expired,
        missing: current.missing + vendor.missing,
        underReview: current.underReview + vendor.underReview,
        deficient: current.deficient + vendor.deficient,
      }),
      {
        total: 0,
        compliant: 0,
        expiring: 0,
        expired: 0,
        missing: 0,
        underReview: 0,
        deficient: 0,
      },
    );

    return {
      id: property.id,
      propertyId: property.id,
      propertyName: property.name,
      vendors: vendors.length,
      ...summary,
      status: vendors.length === 0 ? "never_responded" : overallStatus(summary),
    } satisfies CompliancePropertyRow;
  });

  const unassigned = vendorRows.filter((row) => !row.propertyId);
  if (unassigned.length > 0) {
    const summary = unassigned.reduce(
      (current, vendor) => ({
        total: current.total + vendor.total,
        compliant: current.compliant + vendor.compliant,
        expiring: current.expiring + vendor.expiring,
        expired: current.expired + vendor.expired,
        missing: current.missing + vendor.missing,
        underReview: current.underReview + vendor.underReview,
        deficient: current.deficient + vendor.deficient,
      }),
      {
        total: 0,
        compliant: 0,
        expiring: 0,
        expired: 0,
        missing: 0,
        underReview: 0,
        deficient: 0,
      },
    );

    rows.push({
      id: "unassigned",
      propertyId: null,
      propertyName: "Unassigned",
      vendors: unassigned.length,
      ...summary,
      status: overallStatus(summary),
    });
  }

  return rows;
}
