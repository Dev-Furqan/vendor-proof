"use client";

import type { ReactNode } from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-white">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-md border border-white/10 bg-[#050912] px-3 text-sm text-white outline-none transition placeholder:text-muted/55 focus:border-accent/50 focus:ring-2 focus:ring-accent/15";

export const textareaClass =
  "min-h-24 w-full rounded-md border border-white/10 bg-[#050912] px-3 py-2 text-sm text-white outline-none transition placeholder:text-muted/55 focus:border-accent/50 focus:ring-2 focus:ring-accent/15";

export const primaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/12 px-4 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60";

export const ghostButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm text-muted transition hover:bg-white/[0.04] hover:text-white";
