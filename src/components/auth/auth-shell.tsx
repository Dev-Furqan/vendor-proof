import Link from "next/link";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  text: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({
  eyebrow,
  title,
  text,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center">
        <Link href="/" className="mb-10 flex items-center gap-2 text-sm font-semibold text-white">
          <span className="flex size-8 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
            <ShieldCheck size={17} strokeWidth={2} />
          </span>
          VendorProof
        </Link>

        <section className="rounded-lg border border-white/10 bg-white/[0.035] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.3)] sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-muted">{text}</p>

          <div className="mt-8">{children}</div>
        </section>

        <div className="mt-6 text-center text-sm text-muted">{footer}</div>
      </div>
    </main>
  );
}

export function AuthNotice({
  error,
  message,
}: {
  error?: string;
  message?: string;
}) {
  if (!error && !message) {
    return null;
  }

  return (
    <div
      className={`mb-5 rounded-md border px-3 py-2 text-sm ${
        error
          ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
          : "border-accent/25 bg-accent/10 text-accent"
      }`}
    >
      {error ?? message}
    </div>
  );
}

export function TextInput({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-white">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className="mt-2 h-11 w-full rounded-md border border-white/10 bg-[#080d16] px-3 text-sm text-white outline-none transition placeholder:text-muted/55 focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
      />
    </label>
  );
}

export const primaryButtonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition hover:bg-accent/90";

export const secondaryButtonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-md border border-white/12 px-4 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/[0.04]";
