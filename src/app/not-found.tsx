import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
          <ShieldAlert size={22} />
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-white">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          This VendorProof page may have moved, expired, or never existed.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition hover:bg-accent/90"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
