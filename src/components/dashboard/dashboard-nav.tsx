"use client";

import Link from "next/link";
import {
  Activity,
  Building2,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Truck,
  X,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/compliance", label: "Compliance", icon: Activity },
  { href: "/dashboard/properties", label: "Properties", icon: Building2 },
  { href: "/dashboard/vendors", label: "Vendors", icon: Truck },
  { href: "/dashboard/requirements", label: "Requirements", icon: ClipboardCheck },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
              active
                ? "bg-accent/12 text-accent ring-1 ring-accent/25"
                : "text-muted hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <Icon size={15} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function DashboardBrand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-white">
      <span className="flex size-8 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent">
        <ShieldCheck size={17} />
      </span>
      VendorProof
    </Link>
  );
}

export function DashboardNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="hidden items-center gap-1 md:flex">
        <NavLinks items={navItems} />
      </nav>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-10 items-center justify-center rounded-md border border-white/12 text-muted transition hover:border-white/25 hover:bg-white/[0.04] hover:text-white md:hidden"
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden">
          <div className="ml-auto flex min-h-full w-full max-w-xs flex-col border-l border-white/10 bg-[#080d16] p-5 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <DashboardBrand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex size-9 items-center justify-center rounded-md border border-white/10 text-muted"
                aria-label="Close navigation"
              >
                <X size={17} />
              </button>
            </div>
            <nav className="grid gap-1">
              <NavLinks items={navItems} onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
