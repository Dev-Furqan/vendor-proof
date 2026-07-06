"use client";

import { useEffect, type ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { initPostHog } from "@/lib/posthog/client";

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return <ToastProvider>{children}</ToastProvider>;
}
