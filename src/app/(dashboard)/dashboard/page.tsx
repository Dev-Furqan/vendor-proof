import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { requirePrimaryOrganization } from "@/lib/auth/require-organization";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard | VendorProof",
  description: "Portfolio-wide vendor compliance overview.",
};

export default async function DashboardPage() {
  const organization = await requirePrimaryOrganization();
  const supabase = createClient();
  const [properties, vendors, documents, templates] = await Promise.all([
    supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    supabase
      .from("vendors")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
    supabase
      .from("requirement_templates")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organization.id),
  ]);

  const queryError =
    properties.error ?? vendors.error ?? documents.error ?? templates.error;

  if (queryError) {
    throw new Error(queryError.message);
  }

  const stats = [
    ["Properties", properties.count ?? 0],
    ["Vendors", vendors.count ?? 0],
    ["Templates", templates.count ?? 0],
    ["Documents", documents.count ?? 0],
  ];

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
        Dashboard
      </p>
      <h1 className="mt-3 text-4xl font-semibold text-white">
        {organization.name}
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Manage properties, vendors, templates, and document checklists from one
        org-scoped workspace.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-white/10 bg-white/[0.035] p-5"
          >
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-4 text-4xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {[
          ["Compliance", "/dashboard/compliance", "Scan expiring, missing, and deficient vendor documents."],
          ["Properties", "/dashboard/properties", "Create and maintain your portfolio locations."],
          ["Vendors", "/dashboard/vendors", "Import vendors and assign document checklists."],
          ["Requirements", "/dashboard/requirements", "Build reusable compliance templates."],
        ].map(([title, href, text]) => (
          <Link
            key={href}
            href={href}
            className="group rounded-lg border border-white/10 bg-white/[0.025] p-5 transition hover:border-white/20 hover:bg-white/[0.04]"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium text-white">{title}</h2>
              <ArrowRight
                size={17}
                className="text-muted transition group-hover:translate-x-0.5 group-hover:text-accent"
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
