"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-400/10 text-rose-100">
          <AlertTriangle size={22} />
        </div>
        <h1 className="mt-5 text-3xl font-semibold text-white">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          VendorProof hit an unexpected error. Your data is not changed by this screen.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground transition hover:bg-accent/90"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
