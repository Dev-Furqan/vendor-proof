"use client";

import { AlertTriangle, CheckCircle2, Clock3, FileQuestion, UploadCloud, XCircle } from "lucide-react";
import type { ComplianceStatus } from "@/components/dashboard/types";

const statusConfig = {
  compliant: {
    label: "Approved",
    icon: CheckCircle2,
    className: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100",
  },
  expiring: {
    label: "Expiring soon",
    icon: AlertTriangle,
    className: "border-amber-300/25 bg-amber-300/10 text-amber-100",
  },
  missing: {
    label: "Missing",
    icon: XCircle,
    className: "border-rose-300/25 bg-rose-400/10 text-rose-100",
  },
  under_review: {
    label: "Uploaded - under review",
    icon: UploadCloud,
    className: "border-sky-300/25 bg-sky-400/10 text-sky-100",
  },
  deficient: {
    label: "Deficient",
    icon: AlertTriangle,
    className: "border-rose-300/25 bg-rose-400/10 text-rose-100",
  },
  never_responded: {
    label: "Never responded",
    icon: FileQuestion,
    className: "border-zinc-300/20 bg-white/[0.04] text-zinc-200",
  },
  uploaded: {
    label: "Uploaded",
    icon: Clock3,
    className: "border-sky-300/25 bg-sky-400/10 text-sky-100",
  },
} as const;

export function StatusBadge({
  status,
  label,
}: {
  status: ComplianceStatus | "uploaded";
  label?: string;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      <Icon size={13} aria-hidden="true" />
      {label ?? config.label}
    </span>
  );
}
