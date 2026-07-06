"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type ToastTone = "success" | "error";
type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
};

const ToastContext = createContext<{
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((tone: ToastTone, title: string, message?: string) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, tone, title, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const value = useMemo(
    () => ({
      success: (title: string, message?: string) => push("success", title, message),
      error: (title: string, message?: string) => push("error", title, message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-[80] grid w-[min(360px,calc(100vw-2rem))] gap-2">
        {toasts.map((toast) => {
          const Icon = toast.tone === "success" ? CheckCircle2 : XCircle;
          return (
            <div
              key={toast.id}
              role="status"
              className={`rounded-lg border p-3 shadow-2xl backdrop-blur-xl ${
                toast.tone === "success"
                  ? "border-emerald-400/25 bg-emerald-950/90 text-emerald-50"
                  : "border-rose-400/25 bg-rose-950/90 text-rose-50"
              }`}
            >
              <div className="flex gap-3">
                <Icon size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{toast.title}</p>
                  {toast.message ? (
                    <p className="mt-1 text-sm opacity-80">{toast.message}</p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
