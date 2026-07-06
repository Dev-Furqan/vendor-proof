"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, FileText, Filter, Search, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/dashboard/data-table";
import { inputClass, secondaryButton } from "@/components/dashboard/form-controls";
import { StatusBadge } from "@/components/dashboard/documents/status-badge";
import type {
  CompliancePropertyRow,
  ComplianceStatus,
  ComplianceVendorRow,
  PropertyRecord,
} from "@/components/dashboard/types";

type ComplianceClientProps = {
  properties: PropertyRecord[];
  propertyRows: CompliancePropertyRow[];
  vendorRows: ComplianceVendorRow[];
};

const filterOptions = [
  { value: "all", label: "All statuses" },
  { value: "expiring", label: "Expiring soon" },
  { value: "missing", label: "Missing documents" },
  { value: "never_responded", label: "Never responded" },
];

function statusMatches(status: ComplianceStatus, filter: string) {
  if (filter === "all") return true;
  if (filter === "missing") return status === "missing" || status === "deficient";
  return status === filter;
}

function statusTone(status: ComplianceStatus) {
  if (status === "compliant") return "border-emerald-300/25 bg-emerald-400/10";
  if (status === "expiring") return "border-amber-300/25 bg-amber-300/10";
  if (status === "under_review") return "border-sky-300/25 bg-sky-400/10";
  return "border-rose-300/25 bg-rose-400/10";
}

export function ComplianceClient({
  properties,
  propertyRows,
  vendorRows,
}: ComplianceClientProps) {
  const [query, setQuery] = useState("");
  const [propertyId, setPropertyId] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredVendorRows = useMemo(
    () =>
      vendorRows.filter((row) => {
        const matchesProperty = propertyId === "all" || row.propertyId === propertyId;
        const matchesStatus = statusMatches(row.status, statusFilter);
        const matchesQuery = `${row.vendorName} ${row.vendorEmail ?? ""} ${row.propertyName}`
          .toLowerCase()
          .includes(query.toLowerCase());
        return matchesProperty && matchesStatus && matchesQuery;
      }),
    [propertyId, query, statusFilter, vendorRows],
  );

  const filteredPropertyRows = useMemo(
    () =>
      propertyRows.filter((row) => {
        const matchesProperty = propertyId === "all" || row.propertyId === propertyId;
        const matchesStatus = statusMatches(row.status, statusFilter);
        return matchesProperty && matchesStatus;
      }),
    [propertyId, propertyRows, statusFilter],
  );

  const hero = filteredVendorRows.reduce(
    (current, row) => ({
      compliant: current.compliant + row.compliant,
      expiring: current.expiring + row.expiring,
      missing: current.missing + row.missing + row.deficient,
      review: current.review + row.underReview,
    }),
    { compliant: 0, expiring: 0, missing: 0, review: 0 },
  );

  const exportParams = new URLSearchParams();
  if (propertyId !== "all") exportParams.set("propertyId", propertyId);
  if (statusFilter !== "all") exportParams.set("filter", statusFilter);
  if (query) exportParams.set("q", query);
  const exportQuery = exportParams.toString();

  const columns: DataTableColumn<ComplianceVendorRow>[] = [
    {
      key: "vendorName",
      label: "Vendor",
      sortable: true,
      render: (row) => (
        <div>
          <Link
            href={`/dashboard/vendors/${row.vendorId}`}
            className="font-medium text-white transition hover:text-accent"
          >
            {row.vendorName}
          </Link>
          <div className="mt-1 text-xs text-muted">{row.vendorEmail || "No email"}</div>
        </div>
      ),
    },
    {
      key: "propertyName",
      label: "Property",
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "total",
      label: "Documents",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-white">
          {row.compliant}/{row.total} approved
        </span>
      ),
    },
    {
      key: "missing",
      label: "Attention",
      sortable: true,
      render: (row) => (
        <span>
          {row.expiring} expiring · {row.missing + row.deficient} missing
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
            Compliance
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Daily compliance report</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Scan portfolio risk by property and vendor, filter urgent work, and
            export the current view.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className={secondaryButton}
            href={`/dashboard/compliance/export?format=csv${exportQuery ? `&${exportQuery}` : ""}`}
          >
            <Download size={15} />
            CSV
          </a>
          <a
            className={secondaryButton}
            href={`/dashboard/compliance/export?format=pdf${exportQuery ? `&${exportQuery}` : ""}`}
          >
            <FileText size={15} />
            PDF
          </a>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          ["Compliant", hero.compliant, CheckCircle2, "text-emerald-100"],
          ["Expiring", hero.expiring, AlertTriangle, "text-amber-100"],
          ["Missing", hero.missing, XCircle, "text-rose-100"],
          ["Under review", hero.review, Search, "text-sky-100"],
        ].map(([label, value, Icon, className]) => {
          const StatIcon = Icon as typeof CheckCircle2;
          return (
            <div key={label as string} className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.14em] text-muted">{label as string}</p>
                <StatIcon size={16} className={className as string} />
              </div>
              <p className={`mt-3 text-3xl font-semibold ${className as string}`}>{value as number}</p>
            </div>
          );
        })}
      </div>

      <div className="sticky top-16 z-30 mb-6 rounded-lg border border-white/10 bg-background/90 p-3 backdrop-blur-xl">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <label className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="Search vendor, email, or property"
            />
          </label>
          <label className="relative">
            <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className={`${inputClass} pl-9`}
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <select
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
            className={inputClass}
          >
            <option value="all">All properties</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-medium text-white">By property</h2>
        <div className="grid gap-3 lg:grid-cols-3">
          {filteredPropertyRows.map((row) => (
            <div
              key={row.id}
              className={`rounded-lg border p-4 ${statusTone(row.status)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-white">{row.propertyName}</h3>
                  <p className="mt-1 text-sm text-muted">{row.vendors} vendors</p>
                </div>
                <StatusBadge status={row.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-muted">Approved</p>
                  <p className="font-mono text-white">{row.compliant}</p>
                </div>
                <div>
                  <p className="text-muted">Expiring</p>
                  <p className="font-mono text-white">{row.expiring}</p>
                </div>
                <div>
                  <p className="text-muted">Missing</p>
                  <p className="font-mono text-white">{row.missing + row.deficient}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-white">By vendor</h2>
        <DataTable
          rows={filteredVendorRows}
          columns={columns}
          emptyTitle="No compliance rows match the filters"
          emptyText="Adjust the property, status, or search filter to broaden the report."
          pageSize={12}
        />
      </section>
    </>
  );
}
