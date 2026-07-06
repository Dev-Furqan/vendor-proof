"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export type DataTableColumn<T> = {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  className?: string;
  render?: (row: T) => ReactNode;
};

type DataTableProps<T extends { id: string }> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  emptyTitle: string;
  emptyText: string;
  emptyAction?: ReactNode;
  pageSize?: number;
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  emptyTitle,
  emptyText,
  emptyAction,
  pageSize = 8,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T & string>(columns[0]?.key);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const sortedRows = useMemo(() => {
    const clone = [...rows];
    clone.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const leftText = left == null ? "" : String(left).toLowerCase();
      const rightText = right == null ? "" : String(right).toLowerCase();
      return sortDirection === "asc"
        ? leftText.localeCompare(rightText)
        : rightText.localeCompare(leftText);
    });
    return clone;
  }, [rows, sortDirection, sortKey]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  function sortBy(key: keyof T & string) {
    setPage(1);
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.035] text-xs uppercase tracking-[0.14em] text-muted">
            <tr>
              {columns.map((column) => {
                const active = sortKey === column.key;
                const Icon = active
                  ? sortDirection === "asc"
                    ? ArrowUp
                    : ArrowDown
                  : ChevronsUpDown;

                return (
                  <th key={column.key} className={`px-4 py-3 font-medium ${column.className ?? ""}`}>
                    {column.sortable ? (
                      <button
                        type="button"
                        onClick={() => sortBy(column.key)}
                        className="inline-flex items-center gap-2 transition hover:text-white"
                      >
                        {column.label}
                        <Icon size={13} />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {visibleRows.map((row) => (
              <tr key={row.id} className="transition hover:bg-white/[0.035]">
                {columns.map((column) => (
                  <td key={column.key} className={`px-4 py-3 text-muted ${column.className ?? ""}`}>
                    {column.render ? column.render(row) : String(row[column.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyText} action={emptyAction} />
      ) : (
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm text-muted">
          <span>
            Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, rows.length)} of {rows.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="rounded-md border border-white/10 px-3 py-1.5 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={safePage === totalPages}
              className="rounded-md border border-white/10 px-3 py-1.5 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
