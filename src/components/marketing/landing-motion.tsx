import {
  AlertTriangle,
  BellRing,
  FileCheck2,
  MailWarning,
  Send,
  ShieldCheck,
  Table2,
} from "lucide-react";
import type { ReactNode } from "react";

type FadeUpProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function FadeUp({ children, className, delay = 0 }: FadeUpProps) {
  return (
    <div
      style={{ animationDelay: `${delay}s` }}
      className={["min-w-0 max-w-full animate-[fadeUp_0.7s_ease-out_both]", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

const problems = [
  {
    icon: Table2,
    title: "Spreadsheets drift",
    text: "COI dates, license numbers, and W-9 status live in separate tabs that only one person trusts.",
  },
  {
    icon: MailWarning,
    title: "Follow-ups pile up",
    text: "Teams lose hours writing the same reminder emails when vendors miss document requests.",
  },
  {
    icon: AlertTriangle,
    title: "Renewals get missed",
    text: "Expired coverage is discovered when a job is urgent, a lease is moving, or an audit is already underway.",
  },
];

export function ProblemCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {problems.map((problem, index) => {
        const Icon = problem.icon;

        return (
          <article
            key={problem.title}
            style={{ animationDelay: `${index * 0.08}s` }}
            className="rounded-lg border border-white/10 bg-white/[0.035] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
          >
            <div className="mb-8 flex size-10 items-center justify-center rounded-md border border-accent/20 bg-accent/10 text-accent">
              <Icon size={19} strokeWidth={1.8} />
            </div>
            <h3 className="text-lg font-medium text-white">{problem.title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted">{problem.text}</p>
          </article>
        );
      })}
    </div>
  );
}

const steps = [
  {
    icon: Send,
    title: "Invite vendors",
    text: "Send a clean request link for each vendor and property relationship.",
  },
  {
    icon: FileCheck2,
    title: "Collect documents",
    text: "Gather COIs, licenses, W-9s, and expiry dates into one structured workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Track compliance",
    text: "See risk status instantly and let renewal reminders run in the background.",
  },
];

export function HowItWorksFlow() {
  return (
    <div className="relative">
      <div className="absolute left-6 right-6 top-[3.1rem] hidden h-px bg-white/10 md:block" />
      <div className="absolute left-6 right-6 top-[3.1rem] hidden h-px origin-left bg-accent md:block" />

      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => {
          const Icon = step.icon;

          return (
            <div key={step.title} className="relative">
              <article className="rounded-lg border border-white/10 bg-[#0b1220]/80 p-6">
                <div className="relative z-10 flex size-12 items-center justify-center rounded-full border border-accent/25 bg-background text-accent shadow-[0_0_0_8px_rgba(7,17,31,0.95)]">
                  <Icon size={20} strokeWidth={1.8} />
                </div>
                <p className="mt-8 font-mono text-xs uppercase tracking-[0.22em] text-accent/80">
                  0{index + 1}
                </p>
                <h3 className="mt-3 text-xl font-medium text-white">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted">{step.text}</p>
              </article>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const vendors = [
  ["Apex Roofing", "COI", "Active", "green", "42 days"],
  ["Northline Electric", "License", "Renew soon", "yellow", "9 days"],
  ["Harbor Plumbing", "W-9", "Active", "green", "87 days"],
  ["Metro Elevator", "COI", "Expired", "red", "3 days"],
  ["Clearview HVAC", "License", "Active", "green", "115 days"],
];

const statusStyles = {
  green: "bg-emerald-400/12 text-emerald-200 ring-emerald-300/20",
  yellow: "bg-amber-300/12 text-amber-200 ring-amber-200/25",
  red: "bg-rose-400/12 text-rose-200 ring-rose-300/25",
};

export function DashboardPreview() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-white/10 bg-[#0a101c] shadow-[0_34px_120px_rgba(0,0,0,0.45)]"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-400/70" />
          <span className="size-2.5 rounded-full bg-amber-300/70" />
          <span className="size-2.5 rounded-full bg-emerald-300/70" />
        </div>
        <div className="hidden h-2 w-32 rounded-full bg-white/10 sm:block" />
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-[0.82fr_1.18fr] lg:p-6">
        <aside className="rounded-md border border-white/10 bg-white/[0.03] p-4">
          <div className="text-sm text-muted">Compliance overview</div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ["82%", "Compliant", "bg-emerald-300"],
              ["11", "Renewing", "bg-amber-300"],
              ["4", "Expired", "bg-rose-400"],
            ].map(([value, label, color]) => (
              <div key={label} className="rounded-md bg-white/[0.04] p-3">
                <div className={`mb-5 h-1 rounded-full ${color}`} />
                <div className="text-2xl font-semibold text-white">{value}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-muted">
                  {label}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {[76, 52, 88, 34].map((width, index) => (
              <div key={width} className="space-y-2">
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-accent/70"
                    style={{ width: `${width}%` }}
                  />
                </div>
                {index === 1 ? (
                  <div className="h-2 w-2/3 rounded-full bg-white/8" />
                ) : null}
              </div>
            ))}
          </div>
        </aside>

        <div className="rounded-md border border-white/10 bg-white/[0.03]">
          <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr] gap-3 border-b border-white/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            <span>Vendor</span>
            <span>Doc</span>
            <span>Status</span>
            <span>Due</span>
          </div>
          <div className="divide-y divide-white/8">
            {vendors.map(([vendor, doc, status, tone, due]) => (
              <div
                key={vendor}
                className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr] items-center gap-3 px-4 py-4 text-sm"
              >
                <span className="truncate text-white">{vendor}</span>
                <span className="text-muted">{doc}</span>
                <span
                  className={`w-fit rounded-full px-2.5 py-1 text-xs ring-1 ${
                    statusStyles[tone as keyof typeof statusStyles]
                  }`}
                >
                  {status}
                </span>
                <span className="text-muted">{due}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReminderStrip() {
  return (
    <FadeUp>
      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-muted">
        <BellRing size={14} className="text-accent" />
        Automated reminders before every renewal date
      </div>
    </FadeUp>
  );
}
