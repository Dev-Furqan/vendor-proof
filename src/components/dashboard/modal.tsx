"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ open, title, description, children, onClose }: ModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/58 px-4 py-8 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            onClick={onClose}
            aria-label="Close modal"
          />
          <motion.section
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-white/10 bg-[#080d16] p-6 shadow-[0_28px_120px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start justify-between gap-5">
              <div>
                <h2 className="text-xl font-semibold text-white">{title}</h2>
                {description ? (
                  <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-md border border-white/10 text-muted transition hover:border-white/25 hover:bg-white/[0.04] hover:text-white"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-6">{children}</div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
