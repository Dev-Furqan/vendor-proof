"use client";

import { Edit3, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createRequirementTemplate,
  deleteRequirementTemplate,
  updateRequirementTemplate,
} from "@/app/(dashboard)/dashboard/actions";
import { DataTable, type DataTableColumn } from "@/components/dashboard/data-table";
import {
  Field,
  ghostButton,
  inputClass,
  primaryButton,
  secondaryButton,
  textareaClass,
} from "@/components/dashboard/form-controls";
import { Modal } from "@/components/dashboard/modal";
import { useToast } from "@/components/ui/toast";
import type {
  RequirementTemplateRecord,
  TemplateRequirement,
} from "@/components/dashboard/types";

const documentTypes = [
  { value: "coi", label: "COI" },
  { value: "license", label: "License" },
  { value: "w9", label: "W-9" },
  { value: "other", label: "Other" },
];

const expirationRules = [
  { value: "none", label: "No expiration" },
  { value: "expires_on_date", label: "Use document expiration date" },
  { value: "annual", label: "Annual renewal" },
  { value: "custom", label: "Custom review cadence" },
];

const starterRequirements: TemplateRequirement[] = [
  {
    documentType: "coi",
    label: "Certificate of insurance",
    expiresRequired: true,
    expirationRule: "expires_on_date",
  },
  {
    documentType: "w9",
    label: "W-9",
    expiresRequired: false,
    expirationRule: "none",
  },
];

function normalizeRequirements(template?: RequirementTemplateRecord) {
  if (template?.requirements?.length) {
    return template.requirements;
  }

  if (template?.document_type) {
    return [
      {
        documentType: template.document_type,
        label: template.document_type.toUpperCase(),
        expiresRequired: Boolean(template.expires_required),
        expirationRule: template.expiration_rule ?? "none",
      },
    ];
  }

  return starterRequirements;
}

function TemplateForm({
  template,
  onSaved,
}: {
  template?: RequirementTemplateRecord;
  onSaved: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [requirements, setRequirements] = useState<TemplateRequirement[]>(
    normalizeRequirements(template),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const serializedRequirements = useMemo(
    () => JSON.stringify(requirements),
    [requirements],
  );

  function updateRequirement(
    index: number,
    updates: Partial<TemplateRequirement>,
  ) {
    setRequirements((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...updates } : item,
      ),
    );
  }

  function addRequirement() {
    setRequirements((current) => [
      ...current,
      {
        documentType: "license",
        label: "License",
        expiresRequired: true,
        expirationRule: "expires_on_date",
      },
    ]);
  }

  function removeRequirement(index: number) {
    setRequirements((current) =>
      current.length === 1
        ? current
        : current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  function submit(formData: FormData) {
    setError(null);
    formData.set("requirements", JSON.stringify(requirements));

    startTransition(async () => {
      const result = template
        ? await updateRequirementTemplate(formData)
        : await createRequirementTemplate(formData);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        toast.error("Template was not saved", result.error);
        return;
      }

      toast.success(template ? "Template updated" : "Template created");
      router.refresh();
      onSaved();
    });
  }

  return (
    <form action={submit} className="space-y-5">
      {template ? <input type="hidden" name="id" value={template.id} /> : null}
      <input type="hidden" name="requirements" value={serializedRequirements} />
      {error ? (
        <div className="rounded-md border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Template name">
          <input
            name="name"
            defaultValue={template?.name}
            className={inputClass}
            placeholder="HVAC Vendor"
            required
          />
        </Field>
        <Field label="Suggested examples">
          <select
            className={inputClass}
            defaultValue=""
            onChange={(event) => {
              const selected = event.target.value;
              if (selected) {
                const label = selected;
                const lower = selected.toLowerCase();
                setRequirements(
                  lower.includes("clean")
                    ? [
                        {
                          documentType: "coi",
                          label: "Certificate of insurance",
                          expiresRequired: true,
                          expirationRule: "expires_on_date",
                        },
                        {
                          documentType: "w9",
                          label: "W-9",
                          expiresRequired: false,
                          expirationRule: "none",
                        },
                      ]
                    : [
                        ...starterRequirements,
                        {
                          documentType: "license",
                          label: `${label} license`,
                          expiresRequired: true,
                          expirationRule: "expires_on_date",
                        },
                      ],
                );
              }
            }}
          >
            <option value="">Choose to prefill requirements</option>
            <option value="Landscaper">Landscaper</option>
            <option value="HVAC Vendor">HVAC Vendor</option>
            <option value="Turnover Cleaning">Turnover Cleaning</option>
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea
          name="description"
          defaultValue={template?.description ?? ""}
          className={textareaClass}
          placeholder="Used for vendors who need insurance and license review before work orders."
        />
      </Field>

      <div className="rounded-lg border border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h3 className="text-sm font-medium text-white">Required documents</h3>
            <p className="mt-1 text-xs text-muted">
              These become vendor requirement checklist items when assigned.
            </p>
          </div>
          <button type="button" onClick={addRequirement} className={secondaryButton}>
            <Plus size={15} />
            Add document
          </button>
        </div>
        <div className="space-y-3 p-4">
          {requirements.map((requirement, index) => (
            <div
              key={`${requirement.documentType}-${index}`}
              className="grid gap-3 rounded-md border border-white/10 bg-white/[0.025] p-3 lg:grid-cols-[0.9fr_1fr_1fr_auto]"
            >
              <select
                value={requirement.documentType}
                onChange={(event) =>
                  updateRequirement(index, { documentType: event.target.value })
                }
                className={inputClass}
              >
                {documentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <input
                value={requirement.label}
                onChange={(event) =>
                  updateRequirement(index, { label: event.target.value })
                }
                className={inputClass}
                placeholder="Document label"
              />
              <select
                value={requirement.expirationRule}
                onChange={(event) =>
                  updateRequirement(index, {
                    expirationRule: event.target.value,
                    expiresRequired: event.target.value !== "none",
                  })
                }
                className={inputClass}
              >
                {expirationRules.map((rule) => (
                  <option key={rule.value} value={rule.value}>
                    {rule.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRequirement(index)}
                className={ghostButton}
                disabled={requirements.length === 1}
              >
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="submit" disabled={isPending} className={primaryButton}>
          {isPending ? "Saving..." : template ? "Save template" : "Create template"}
        </button>
      </div>
    </form>
  );
}

export function RequirementsClient({
  templates,
}: {
  templates: RequirementTemplateRecord[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<RequirementTemplateRecord | null>(null);
  const [isPending, startTransition] = useTransition();

  function removeTemplate(template: RequirementTemplateRecord) {
    if (!window.confirm(`Delete ${template.name}?`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteRequirementTemplate(template.id);
      if (!result.ok) {
        toast.error("Template was not deleted", result.error);
        return;
      }
      toast.success("Template deleted");
      router.refresh();
    });
  }

  const columns: DataTableColumn<RequirementTemplateRecord>[] = [
    {
      key: "name",
      label: "Template",
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-white">{row.name}</div>
          <div className="mt-1 max-w-lg truncate text-xs text-muted">
            {row.description || "No description"}
          </div>
        </div>
      ),
    },
    {
      key: "requirements",
      label: "Documents",
      sortable: false,
      render: (row) => {
        const requirements = normalizeRequirements(row);
        return (
          <div className="flex flex-wrap gap-1.5">
            {requirements.map((requirement) => (
              <span
                key={`${row.id}-${requirement.label}`}
                className="rounded-full border border-white/10 bg-white/[0.035] px-2 py-1 text-xs text-white"
              >
                {requirement.label}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "expiration_rule",
      label: "Expiration",
      sortable: true,
      render: (row) =>
        normalizeRequirements(row).some((requirement) => requirement.expiresRequired)
          ? "Tracked"
          : "Not required",
    },
    {
      key: "id",
      label: "",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button type="button" onClick={() => setEditing(row)} className={ghostButton}>
            <Edit3 size={14} />
            Edit
          </button>
          <button
            type="button"
            onClick={() => removeTemplate(row)}
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
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
            Requirement library
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">
            Requirement templates
          </h1>
        </div>
        <button type="button" onClick={() => setAddOpen(true)} className={primaryButton}>
          <Plus size={16} />
          Create template
        </button>
      </div>

      <DataTable
        rows={templates}
        columns={columns}
        emptyTitle="No requirement templates yet"
        emptyText="Create reusable templates for vendors like landscapers, HVAC teams, and turnover cleaning."
        emptyAction={
          <button type="button" onClick={() => setAddOpen(true)} className={primaryButton}>
            <Plus size={16} />
            Create template
          </button>
        }
      />

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Create requirement template"
        description="Define the documents and expiration rules a vendor must satisfy."
      >
        <TemplateForm onSaved={() => setAddOpen(false)} />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit requirement template"
        description="Changes affect future assignments. Existing vendor checklist rows remain auditable."
      >
        {editing ? (
          <TemplateForm template={editing} onSaved={() => setEditing(null)} />
        ) : null}
      </Modal>
    </>
  );
}
