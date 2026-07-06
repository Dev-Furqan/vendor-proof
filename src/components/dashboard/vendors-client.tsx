"use client";

import { ClipboardCheck, Edit3, FileUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  assignRequirementTemplate,
  createVendor,
  deleteVendor,
  importVendorsFromCsv,
  updateVendor,
} from "@/app/(dashboard)/dashboard/actions";
import { DataTable, type DataTableColumn } from "@/components/dashboard/data-table";
import {
  Field,
  ghostButton,
  inputClass,
  primaryButton,
  secondaryButton,
} from "@/components/dashboard/form-controls";
import { Modal } from "@/components/dashboard/modal";
import type { RequirementTemplateRecord, VendorRecord } from "@/components/dashboard/types";
import { posthog } from "@/lib/posthog/client";
import { useToast } from "@/components/ui/toast";

type RequirementSummary = {
  vendor_id: string;
  status: string | null;
};

type VendorImportRow = {
  name: string;
  email?: string;
  phone?: string;
  category?: string;
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

function VendorForm({
  vendor,
  onSaved,
}: {
  vendor?: VendorRecord;
  onSaved: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = vendor ? await updateVendor(formData) : await createVendor(formData);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        toast.error("Vendor was not saved", result.error);
        return;
      }

      toast.success(vendor ? "Vendor updated" : "Vendor added");
      if (!vendor) posthog.capture("vendor_added");
      router.refresh();
      onSaved();
    });
  }

  return (
    <form action={submit} className="space-y-4">
      {vendor ? <input type="hidden" name="id" value={vendor.id} /> : null}
      {error ? (
        <div className="rounded-md border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      <Field label="Vendor name">
        <input
          name="name"
          defaultValue={vendor?.name}
          className={inputClass}
          placeholder="Apex Roofing"
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contact email">
          <input
            name="email"
            type="email"
            defaultValue={vendor?.email ?? ""}
            className={inputClass}
            placeholder="ops@vendor.com"
          />
        </Field>
        <Field label="Phone">
          <input
            name="phone"
            defaultValue={vendor?.phone ?? ""}
            className={inputClass}
            placeholder="(555) 000-0000"
          />
        </Field>
      </div>
      <Field label="Vendor type / category">
        <input
          name="category"
          defaultValue={vendor?.category ?? vendor?.trade ?? ""}
          className={inputClass}
          placeholder="HVAC, landscaping, cleaning"
        />
      </Field>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={isPending} className={primaryButton}>
          {isPending ? "Saving..." : vendor ? "Save vendor" : "Add vendor"}
        </button>
      </div>
    </form>
  );
}

function CsvImportFlow({ onImported }: { onImported: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState({
    name: "",
    email: "",
    phone: "",
    category: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const previewRows = useMemo(() => {
    const indexFor = (key: keyof typeof mapping) =>
      mapping[key] ? headers.indexOf(mapping[key]) : -1;
    const nameIndex = indexFor("name");
    const emailIndex = indexFor("email");
    const phoneIndex = indexFor("phone");
    const categoryIndex = indexFor("category");

    return rows
      .map((row) => ({
        name: nameIndex >= 0 ? row[nameIndex] ?? "" : "",
        email: emailIndex >= 0 ? row[emailIndex] ?? "" : "",
        phone: phoneIndex >= 0 ? row[phoneIndex] ?? "" : "",
        category: categoryIndex >= 0 ? row[categoryIndex] ?? "" : "",
      }))
      .filter((row) => row.name);
  }, [headers, mapping, rows]);

  function loadFile(file: File | null) {
    setError(null);
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.length < 2) {
        setError("CSV must include a header row and at least one vendor.");
        return;
      }

      const nextHeaders = parsed[0];
      setHeaders(nextHeaders);
      setRows(parsed.slice(1));
      setMapping({
        name: nextHeaders.find((header) => /name|vendor/i.test(header)) ?? "",
        email: nextHeaders.find((header) => /email/i.test(header)) ?? "",
        phone: nextHeaders.find((header) => /phone|mobile/i.test(header)) ?? "",
        category: nextHeaders.find((header) => /category|type|trade/i.test(header)) ?? "",
      });
    };
    reader.readAsText(file);
  }

  function confirmImport() {
    setError(null);
    if (!mapping.name) {
      setError("Map a column to Vendor name before importing.");
      return;
    }

    startTransition(async () => {
      const result = await importVendorsFromCsv(previewRows as VendorImportRow[]);
      if (!result.ok) {
        setError(result.error ?? "Import failed.");
        toast.error("Import failed", result.error);
        return;
      }

      toast.success("Vendors imported", `${previewRows.length} rows created.`);
      router.refresh();
      onImported();
    });
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-md border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <Field label="Upload CSV">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => loadFile(event.target.files?.[0] ?? null)}
          className={`${inputClass} file:mr-4 file:border-0 file:bg-transparent file:text-sm file:text-accent`}
        />
      </Field>

      {headers.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {(["name", "email", "phone", "category"] as const).map((field) => (
              <Field key={field} label={`Map ${field}`}>
                <select
                  value={mapping[field]}
                  onChange={(event) =>
                    setMapping((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">Do not import</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>

          <div className="rounded-lg border border-white/10">
            <div className="border-b border-white/10 px-4 py-3 text-sm text-white">
              Preview {previewRows.length} mapped rows
            </div>
            <div className="max-h-64 overflow-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-muted">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {previewRows.slice(0, 8).map((row, index) => (
                    <tr key={`${row.name}-${index}`}>
                      <td className="px-4 py-3 text-white">{row.name}</td>
                      <td className="px-4 py-3 text-muted">{row.email}</td>
                      <td className="px-4 py-3 text-muted">{row.phone}</td>
                      <td className="px-4 py-3 text-muted">{row.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={confirmImport}
              disabled={isPending || previewRows.length === 0}
              className={primaryButton}
            >
              {isPending ? "Importing..." : "Confirm import"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function VendorsClient({
  vendors,
  templates,
  requirements,
}: {
  vendors: VendorRecord[];
  templates: RequirementTemplateRecord[];
  requirements: RequirementSummary[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<VendorRecord | null>(null);
  const [assigning, setAssigning] = useState<VendorRecord | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const categories = useMemo(
    () =>
      Array.from(
        new Set(vendors.map((vendor) => vendor.category ?? vendor.trade).filter(Boolean)),
      ) as string[],
    [vendors],
  );

  const requirementCounts = useMemo(() => {
    const counts = new Map<string, { total: number; missing: number }>();
    requirements.forEach((requirement) => {
      const current = counts.get(requirement.vendor_id) ?? { total: 0, missing: 0 };
      current.total += 1;
      if (requirement.status === "missing") {
        current.missing += 1;
      }
      counts.set(requirement.vendor_id, current);
    });
    return counts;
  }, [requirements]);

  const filteredVendors = vendors.filter((vendor) => {
    const text = `${vendor.name} ${vendor.email ?? ""} ${vendor.phone ?? ""} ${vendor.category ?? ""} ${vendor.trade ?? ""}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    const vendorCategory = vendor.category ?? vendor.trade ?? "";
    const matchesCategory = category === "all" || vendorCategory === category;
    return matchesQuery && matchesCategory;
  });

  function removeVendor(vendor: VendorRecord) {
    if (!window.confirm(`Delete ${vendor.name}?`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteVendor(vendor.id);
      if (!result.ok) {
        toast.error("Vendor was not deleted", result.error);
        return;
      }
      toast.success("Vendor deleted");
      router.refresh();
    });
  }

  function assignTemplate(formData: FormData) {
    setAssignError(null);
    startTransition(async () => {
      const result = await assignRequirementTemplate(formData);
      if (!result.ok) {
        setAssignError(result.error ?? "Could not assign template.");
        toast.error("Template was not assigned", result.error);
        return;
      }

      toast.success("Checklist generated");
      router.refresh();
      setAssigning(null);
    });
  }

  const columns: DataTableColumn<VendorRecord>[] = [
    {
      key: "name",
      label: "Vendor",
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-white">{row.name}</div>
          <Link
            href={`/dashboard/vendors/${row.id}`}
            className="mt-1 inline-flex text-xs text-accent transition hover:text-accent/80"
          >
            Open checklist
          </Link>
          <div className="mt-1 text-xs text-muted">{row.email || "No contact email"}</div>
        </div>
      ),
    },
    {
      key: "category",
      label: "Category",
      sortable: true,
      render: (row) => row.category ?? row.trade ?? "—",
    },
    {
      key: "phone",
      label: "Phone",
      sortable: true,
      render: (row) => row.phone || "—",
    },
    {
      key: "default_requirement_template_id",
      label: "Checklist",
      sortable: false,
      render: (row) => {
        const counts = requirementCounts.get(row.id) ?? { total: 0, missing: 0 };
        return (
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs text-white">
            {counts.total} required · {counts.missing} missing
          </span>
        );
      },
    },
    {
      key: "id",
      label: "",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => setAssigning(row)} className={ghostButton}>
            <ClipboardCheck size={14} />
            Assign
          </button>
          <button type="button" onClick={() => setEditing(row)} className={ghostButton}>
            <Edit3 size={14} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => removeVendor(row)}
            disabled={isPending}
            className={ghostButton}
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
            Vendor network
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Vendors</h1>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => setImportOpen(true)} className={secondaryButton}>
            <FileUp size={16} />
            Import CSV
          </button>
          <button type="button" onClick={() => setAddOpen(true)} className={primaryButton}>
            <Plus size={16} />
            Add vendor
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={inputClass}
          placeholder="Search vendors by name, email, phone, or category"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className={inputClass}
        >
          <option value="all">All categories</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        rows={filteredVendors}
        columns={columns}
        emptyTitle="No vendors found"
        emptyText="Add a vendor or adjust your search filters."
        emptyAction={
          <button type="button" onClick={() => setAddOpen(true)} className={primaryButton}>
            <Plus size={16} />
            Add vendor
          </button>
        }
      />

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add vendor"
        description="Create a vendor record before assigning compliance requirements."
      >
        <VendorForm onSaved={() => setAddOpen(false)} />
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import vendors"
        description="Upload a CSV, map columns, preview the import, then create vendor records."
      >
        <CsvImportFlow onImported={() => setImportOpen(false)} />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit vendor"
        description="Update vendor contact and category details."
      >
        {editing ? <VendorForm vendor={editing} onSaved={() => setEditing(null)} /> : null}
      </Modal>

      <Modal
        open={Boolean(assigning)}
        onClose={() => setAssigning(null)}
        title="Assign requirement template"
        description="Assigning a template generates a required document checklist for this vendor."
      >
        {assigning ? (
          <form action={assignTemplate} className="space-y-4">
            <input type="hidden" name="vendorId" value={assigning.id} />
            {assignError ? (
              <div className="rounded-md border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
                {assignError}
              </div>
            ) : null}
            <Field label="Vendor">
              <input value={assigning.name} className={inputClass} disabled readOnly />
            </Field>
            <Field label="Requirement template">
              <select name="templateId" className={inputClass} required>
                <option value="">Select a template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending || templates.length === 0}
                className={primaryButton}
              >
                {isPending ? "Assigning..." : "Generate checklist"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
