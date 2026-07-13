"use client";

import { Edit3, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createProperty,
  deleteProperty,
  updateProperty,
} from "@/app/(dashboard)/dashboard/actions";
import { DataTable, type DataTableColumn } from "@/components/dashboard/data-table";
import {
  Field,
  ghostButton,
  inputClass,
  primaryButton,
} from "@/components/dashboard/form-controls";
import { Modal } from "@/components/dashboard/modal";
import type { PropertyRecord } from "@/components/dashboard/types";
import { formatDate, formatInteger } from "@/lib/format";
import { posthog } from "@/lib/posthog/client";
import { useToast } from "@/components/ui/toast";

const propertyTypes = ["residential", "multifamily", "HOA", "commercial"];

function PropertyForm({
  property,
  onSaved,
}: {
  property?: PropertyRecord;
  onSaved: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = property
        ? await updateProperty(formData)
        : await createProperty(formData);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        toast.error("Property was not saved", result.error);
        return;
      }

      toast.success(property ? "Property updated" : "Property added");
      if (!property) posthog.capture("property_added");
      router.refresh();
      onSaved();
    });
  }

  return (
    <form action={submit} className="space-y-4">
      {property ? <input type="hidden" name="id" value={property.id} /> : null}
      {error ? (
        <div className="rounded-md border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      <Field label="Property name">
        <input
          name="name"
          defaultValue={property?.name}
          className={inputClass}
          placeholder="The Emerson Apartments"
          required
        />
      </Field>
      <Field label="Address">
        <input
          name="address"
          defaultValue={property?.address_line1 ?? ""}
          className={inputClass}
          placeholder="1200 Market Street"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Unit count">
          <input
            name="unitCount"
            type="number"
            min="0"
            defaultValue={property?.unit_count ?? 0}
            className={inputClass}
          />
        </Field>
        <Field label="Type">
          <select
            name="propertyType"
            defaultValue={property?.property_type ?? "multifamily"}
            className={inputClass}
          >
            {propertyTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" disabled={isPending} className={primaryButton}>
          {isPending ? "Saving..." : property ? "Save property" : "Add property"}
        </button>
      </div>
    </form>
  );
}

export function PropertiesClient({ properties }: { properties: PropertyRecord[] }) {
  const router = useRouter();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PropertyRecord | null>(null);
  const [isPending, startTransition] = useTransition();

  function removeProperty(property: PropertyRecord) {
    if (!window.confirm(`Delete ${property.name}?`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteProperty(property.id);
      if (!result.ok) {
        toast.error("Property was not deleted", result.error);
        return;
      }
      toast.success("Property deleted");
      router.refresh();
    });
  }

  const columns: DataTableColumn<PropertyRecord>[] = [
    {
      key: "name",
      label: "Property",
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-white">{row.name}</div>
          <div className="mt-1 text-xs text-muted">{row.address_line1 || "No address"}</div>
        </div>
      ),
    },
    {
      key: "property_type",
      label: "Type",
      sortable: true,
      render: (row) => <span className="capitalize">{row.property_type ?? "multifamily"}</span>,
    },
    {
      key: "unit_count",
      label: "Units",
      sortable: true,
      render: (row) => (
        <span className="font-mono text-white">{formatInteger(row.unit_count)}</span>
      ),
    },
    {
      key: "created_at",
      label: "Created",
      sortable: true,
      render: (row) => formatDate(row.created_at),
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
            onClick={() => removeProperty(row)}
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
            Portfolio
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Properties</h1>
        </div>
        <button type="button" onClick={() => setAddOpen(true)} className={primaryButton}>
          <Plus size={16} />
          Add property
        </button>
      </div>

      <DataTable
        rows={properties}
        columns={columns}
        emptyTitle="No properties yet"
        emptyText="Add the first property in your portfolio to start assigning vendors."
        emptyAction={
          <button type="button" onClick={() => setAddOpen(true)} className={primaryButton}>
            <Plus size={16} />
            Add property
          </button>
        }
      />

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add property"
        description="Create a portfolio location that vendors and document requirements can attach to."
      >
        <PropertyForm onSaved={() => setAddOpen(false)} />
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit property"
        description="Update the portfolio details used by your compliance workflows."
      >
        {editing ? (
          <PropertyForm property={editing} onSaved={() => setEditing(null)} />
        ) : null}
      </Modal>
    </>
  );
}
