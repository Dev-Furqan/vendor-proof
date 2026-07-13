"use client";

import { CheckCircle2, FileUp, TimerReset, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  completeVendorPortalUpload,
  createVendorPortalUpload,
  scanVendorPortalDocument,
} from "@/app/vendor/[token]/actions";
import type { VendorRecord, VendorRequirementRecord } from "@/components/dashboard/types";
import { createClient } from "@/lib/supabase/client";
import { daysUntil, getRequirementStatus } from "@/lib/compliance/status";
import { posthog } from "@/lib/posthog/client";
import { useToast } from "@/components/ui/toast";

const maxUploadBytes = 26_214_400;
const allowedMimePrefixes = ["image/"];
const allowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function isAllowedFile(file: File) {
  return (
    allowedMimeTypes.includes(file.type) ||
    allowedMimePrefixes.some((prefix) => file.type.startsWith(prefix))
  );
}

function statusCopy(requirement: VendorRequirementRecord) {
  const status = getRequirementStatus(requirement);
  if (status === "compliant") return "Approved";
  if (status === "expiring") return "Expiring soon";
  if (status === "under_review") return "Under review";
  if (status === "deficient") return "Needs update";
  return "Missing";
}

function statusClass(requirement: VendorRequirementRecord) {
  const status = getRequirementStatus(requirement);
  if (status === "compliant") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  if (status === "expiring") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  if (status === "under_review") return "border-sky-400/25 bg-sky-400/10 text-sky-100";
  return "border-rose-400/25 bg-rose-400/10 text-rose-100";
}

function UploadCard({
  portalToken,
  requirement,
}: {
  portalToken: string;
  requirement: VendorRequirementRecord;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState(requirement.expires_at ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const days = daysUntil(requirement.document?.expires_at ?? requirement.expires_at);

  function upload() {
    setError(null);
    setDone(false);

    if (!file) {
      setError("Choose a file first.");
      toast.error("Choose a file first");
      return;
    }

    if (!isAllowedFile(file)) {
      setError("Upload a PDF, Word document, or image file.");
      toast.error("Unsupported file type");
      return;
    }

    if (file.size > maxUploadBytes) {
      setError("Files must be 25 MB or smaller.");
      toast.error("File is too large");
      return;
    }

    startTransition(async () => {
      const signedForm = new FormData();
      signedForm.set("portalToken", portalToken);
      signedForm.set("requirementId", requirement.id);
      signedForm.set("fileName", file.name);

      const signed = await createVendorPortalUpload(signedForm);
      if (!signed.ok || !signed.path || !signed.token) {
        setError(signed.error ?? "Could not start upload.");
        toast.error("Upload could not start", signed.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(signed.path, signed.token, file);

      if (uploadError) {
        setError(uploadError.message);
        toast.error("Upload failed", uploadError.message);
        return;
      }

      const completeForm = new FormData();
      completeForm.set("portalToken", portalToken);
      completeForm.set("requirementId", requirement.id);
      completeForm.set("storagePath", signed.path);
      completeForm.set("fileName", file.name);
      completeForm.set("mimeType", file.type);
      completeForm.set("sizeBytes", String(file.size));
      completeForm.set("expiresAt", expiresAt);

      const completed = await completeVendorPortalUpload(completeForm);
      if (!completed.ok) {
        setError(completed.error ?? "Upload saved, but the record was not updated.");
        toast.error("Upload record was not updated", completed.error);
        return;
      }

      toast.success("Uploaded", "Your document is now under review.");
      posthog.capture("document_uploaded", {
        source: "vendor_portal",
        requirement_id: requirement.id,
      });
      setFile(null);
      setDone(true);
      if (
        completed.aiExtractionConfigured &&
        completed.documentId &&
        completed.documentVersionId &&
        completed.requirementId
      ) {
        const scanForm = new FormData();
        scanForm.set("portalToken", portalToken);
        scanForm.set("requirementId", completed.requirementId);
        scanForm.set("documentId", completed.documentId);
        scanForm.set("documentVersionId", completed.documentVersionId);
        void scanVendorPortalDocument(scanForm).then(() => router.refresh());
      }
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">{requirement.name}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {requirement.document_type.toUpperCase()}
            {days !== null ? ` · ${days < 0 ? "Expired" : `${days} days left`}` : ""}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${statusClass(requirement)}`}>
          {statusCopy(requirement)}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full rounded-lg border border-white/10 bg-[#090b10] px-3 py-3 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:text-white"
        />
        {requirement.expires_required ? (
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
              Expiration date
            </span>
            <input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#090b10] px-3 text-sm text-white outline-none focus:border-emerald-300/50"
            />
          </label>
        ) : null}
        <button
          type="button"
          onClick={upload}
          disabled={isPending}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-200 disabled:opacity-60"
        >
          <FileUp size={16} />
          {isPending ? "Uploading..." : "Upload document"}
        </button>
        {error ? (
          <p className="rounded-lg border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}
        {done ? (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
            <CheckCircle2 size={16} />
            Uploaded. Your document is now under review.
          </p>
        ) : null}
      </div>
    </section>
  );
}

export function VendorPortalClient({
  portalToken,
  vendor,
  requirements,
}: {
  portalToken: string;
  vendor: VendorRecord;
  requirements: VendorRequirementRecord[];
}) {
  const summary = useMemo(() => {
    return requirements.reduce(
      (current, requirement) => {
        const status = getRequirementStatus(requirement);
        if (status === "missing" || status === "never_responded" || status === "deficient") {
          current.needsWork += 1;
        }
        if (status === "expiring") current.expiring += 1;
        if (status === "under_review") current.review += 1;
        return current;
      },
      { needsWork: 0, expiring: 0, review: 0 },
    );
  }, [requirements]);

  return (
    <main className="min-h-screen bg-[#07080b] px-4 py-5 text-white">
      <div className="mx-auto max-w-xl">
        <header className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            VendorProof
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">
            Upload documents for {vendor.name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            No account needed. Add the requested files below and you are done.
          </p>
        </header>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
            <TriangleAlert className="text-rose-200" size={17} />
            <p className="mt-2 text-xl font-semibold">{summary.needsWork}</p>
            <p className="text-xs text-zinc-500">Missing</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
            <TimerReset className="text-amber-200" size={17} />
            <p className="mt-2 text-xl font-semibold">{summary.expiring}</p>
            <p className="text-xs text-zinc-500">Expiring</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.035] p-3">
            <CheckCircle2 className="text-sky-200" size={17} />
            <p className="mt-2 text-xl font-semibold">{summary.review}</p>
            <p className="text-xs text-zinc-500">Review</p>
          </div>
        </div>

        <div className="space-y-3">
          {requirements.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.035] p-6 text-center">
              <CheckCircle2 className="mx-auto text-emerald-200" size={24} />
              <h2 className="mt-3 text-base font-semibold">No documents requested</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                This upload link is valid, but there are no open checklist items right now.
              </p>
            </div>
          ) : null}
          {requirements.map((requirement) => (
            <UploadCard
              key={requirement.id}
              portalToken={portalToken}
              requirement={requirement}
            />
          ))}
        </div>

        <p className="py-6 text-center text-xs text-zinc-600">
          Questions? Reply to the email that sent this link.
        </p>
      </div>
    </main>
  );
}
