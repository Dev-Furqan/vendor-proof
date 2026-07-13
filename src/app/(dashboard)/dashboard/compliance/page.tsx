import type { Metadata } from "next";
import { ComplianceClient } from "@/components/dashboard/compliance-client";
import { requirePrimaryOrganization } from "@/lib/auth/require-organization";
import { loadComplianceData } from "@/lib/compliance/load";

export const metadata: Metadata = {
  title: "Compliance Report | VendorProof",
  description: "Filter, review, and export vendor compliance status.",
};

export default async function CompliancePage() {
  const organization = await requirePrimaryOrganization();
  const { properties, propertyRows, vendorRows } = await loadComplianceData(
    organization.id,
  );

  return (
    <ComplianceClient
      properties={properties}
      propertyRows={propertyRows}
      vendorRows={vendorRows}
    />
  );
}
