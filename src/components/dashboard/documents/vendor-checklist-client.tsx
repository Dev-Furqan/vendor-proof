"use client";

import Link from "next/link";
import { AlertTriangle, Download, ExternalLink, FileUp, MessageSquareWarning, Send, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  completeDocumentUpload,
  createSignedDocumentUpload,
  inviteVendorToPortal,
  reviewDocument,
  scanUploadedDocument,
} from "@/app/(dashboard)/dashboard/actions";
import { Field, inputClass, primaryButton, secondaryButton, textareaClass } from "@/components/dashboard/form-controls";
import { StatusBadge } from "@/components/dashboard/documents/status-badge";
import type {
  CommunicationRecord,
  ComplianceStatus,
  VendorRecord,
  VendorRequirementRecord,
} from "@/components/dashboard/types";
import { formatDate } from "@/lib/format";
import { posthog } from "@/lib/posthog/client";
import { getRequirementStatus, daysUntil } from "@/lib/compliance/status";
import { createClient } from "@/lib/supabase/client";
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

function documentStatus(requirement: VendorRequirementRecord): ComplianceStatus {
  return getRequirementStatus(requirement);
}

function flagLabel(flag: string) {
  return flag
    .replace(/^missing_/, "missing ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function UploadControl({
  vendor,
  requirement,
}: {
  vendor: VendorRecord;
  requirement: VendorRequirementRecord;
}) {
  const router = useRouter();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState(requirement.expires_at ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function upload() {
    setError(null);
    if (!file) {
      setError("Choose a file to upload.");
      toast.error("Choose a file to upload");
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
      const uploadForm = new FormData();
      uploadForm.set("vendorId", vendor.id);
      uploadForm.set("requirementId", requirement.id);
      uploadForm.set("fileName", file.name);

      const signed = await createSignedDocumentUpload(uploadForm);

      if (!signed.ok || !signed.path || !signed.token) {
        setError(signed.error ?? "Could not create upload URL.");
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
      completeForm.set("vendorId", vendor.id);
      completeForm.set("requirementId", requirement.id);
      completeForm.set("storagePath", signed.path);
      completeForm.set("fileName", file.name);
      completeForm.set("mimeType", file.type);
      completeForm.set("sizeBytes", String(file.size));
      completeForm.set("expiresAt", expiresAt);

      const completed = await completeDocumentUpload(completeForm);

      if (!completed.ok) {
        setError(completed.error ?? "Upload recorded, but metadata save failed.");
        toast.error("Upload metadata was not saved", completed.error);
        return;
      }

      toast.success("Document uploaded", "It is ready for review.");
      posthog.capture("document_uploaded", {
        vendor_id: vendor.id,
        requirement_id: requirement.id,
      });
      setFile(null);
      if (
        completed.aiExtractionConfigured &&
        completed.documentId &&
        completed.documentVersionId &&
        completed.requirementId
      ) {
        const scanForm = new FormData();
        scanForm.set("documentId", completed.documentId);
        scanForm.set("documentVersionId", completed.documentVersionId);
        scanForm.set("requirementId", completed.requirementId);
        void scanUploadedDocument(scanForm).then(() => router.refresh());
      }
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2 lg:grid-cols-[1fr_150px_auto]">
      <input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/*"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        className={`${inputClass} file:mr-3 file:border-0 file:bg-transparent file:text-sm file:text-accent`}
      />
      <input
        type="date"
        value={expiresAt}
        onChange={(event) => setExpiresAt(event.target.value)}
        className={inputClass}
        aria-label="Expiration date"
      />
      <button type="button" onClick={upload} disabled={isPending} className={primaryButton}>
        <FileUp size={15} />
        {isPending ? "Uploading..." : "Upload"}
      </button>
      {error ? (
        <div className="rounded-md border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100 lg:col-span-3">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function ReviewForm({
  vendorId,
  requirement,
}: {
  vendorId: string;
  requirement: VendorRequirementRecord;
}) {
  const router = useRouter();
  const toast = useToast();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const document = requirement.document;
  const version = document?.latestVersion;
  const [businessName, setBusinessName] = useState(
    document?.business_name ?? document?.ai_extracted_business_name ?? "",
  );
  const [policyNumber, setPolicyNumber] = useState(
    document?.policy_number ?? document?.ai_extracted_policy_number ?? "",
  );
  const [effectiveDate, setEffectiveDate] = useState(
    document?.issued_at ?? document?.ai_extracted_effective_date ?? "",
  );
  const [expirationDate, setExpirationDate] = useState(
    document?.expires_at ?? document?.ai_extracted_expiration_date ?? "",
  );
  const [issuingAuthority, setIssuingAuthority] = useState(
    document?.issuing_authority ?? document?.ai_extracted_issuing_authority ?? "",
  );

  useEffect(() => {
    setBusinessName(document?.business_name ?? document?.ai_extracted_business_name ?? "");
    setPolicyNumber(document?.policy_number ?? document?.ai_extracted_policy_number ?? "");
    setEffectiveDate(document?.issued_at ?? document?.ai_extracted_effective_date ?? "");
    setExpirationDate(document?.expires_at ?? document?.ai_extracted_expiration_date ?? "");
    setIssuingAuthority(
      document?.issuing_authority ?? document?.ai_extracted_issuing_authority ?? "",
    );
  }, [
    document?.ai_extracted_business_name,
    document?.ai_extracted_effective_date,
    document?.ai_extracted_expiration_date,
    document?.ai_extracted_issuing_authority,
    document?.ai_extracted_policy_number,
    document?.business_name,
    document?.expires_at,
    document?.issued_at,
    document?.issuing_authority,
    document?.policy_number,
  ]);

  if (!document || !version || document.status !== "pending_review") {
    return null;
  }

  const reviewDocumentRow = document;
  const reviewVersion = version;

  function submit(decision: "approved" | "rejected") {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("vendorId", vendorId);
      formData.set("requirementId", requirement.id);
      formData.set("documentId", reviewDocumentRow.id);
      formData.set("documentVersionId", reviewVersion.id);
      formData.set("decision", decision);
      formData.set("note", note);
      formData.set("confirmedBusinessName", businessName);
      formData.set("confirmedPolicyNumber", policyNumber);
      formData.set("confirmedEffectiveDate", effectiveDate);
      formData.set("confirmedExpirationDate", expirationDate);
      formData.set("confirmedIssuingAuthority", issuingAuthority);

      const result = await reviewDocument(formData);

      if (!result.ok) {
        setError(result.error ?? "Could not save review.");
        toast.error("Review was not saved", result.error);
        return;
      }

      toast.success(decision === "approved" ? "Document approved" : "Document marked deficient");
      if (decision === "approved") {
        posthog.capture("document_approved", {
          vendor_id: vendorId,
          requirement_id: requirement.id,
        });
      }
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="mt-4 rounded-md border border-white/10 bg-white/[0.025] p-3">
      <div className="mb-4 rounded-md border border-sky-300/20 bg-sky-400/10 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles size={15} className="text-sky-100" />
          <p className="text-sm font-medium text-white">AI-extracted, please confirm</p>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-muted">
            {document.ai_extraction_status === "pending"
              ? "Scanning"
              : document.ai_extraction_status === "manual_review"
                ? "Needs manual review"
                : document.ai_extraction_status === "disabled"
                  ? "Disabled"
                  : document.ai_extraction_status === "failed"
                    ? "Failed"
                    : "Ready"}
          </span>
          {document.ai_extraction_confidence !== null ? (
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-xs text-muted">
              {Math.round(document.ai_extraction_confidence * 100)}% confidence
            </span>
          ) : null}
        </div>

        {document.ai_extraction_error ? (
          <p className="mt-2 text-sm text-amber-100">{document.ai_extraction_error}</p>
        ) : null}

        {document.ai_extraction_flags?.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {document.ai_extraction_flags.map((flag) => (
              <span
                key={flag}
                className="inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-1 text-xs text-amber-100"
              >
                <AlertTriangle size={12} />
                {flagLabel(flag)}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label="Business or insured name">
            <input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Policy or license number">
            <input
              value={policyNumber}
              onChange={(event) => setPolicyNumber(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Effective date">
            <input
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Expiration date">
            <input
              type="date"
              value={expirationDate}
              onChange={(event) => setExpirationDate(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Issuing carrier or authority">
            <input
              value={issuingAuthority}
              onChange={(event) => setIssuingAuthority(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <Field label="Review note">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className={textareaClass}
          placeholder="Optional note for the audit log and vendor follow-up."
        />
      </Field>
      {error ? (
        <div className="mt-3 rounded-md border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => submit("rejected")}
          disabled={isPending}
          className={secondaryButton}
        >
          <MessageSquareWarning size={15} />
          Mark deficient
        </button>
        <button
          type="button"
          onClick={() => submit("approved")}
          disabled={isPending}
          className={primaryButton}
        >
          Approve
        </button>
      </div>
    </div>
  );
}

export function VendorChecklistClient({
  vendor,
  requirements,
  communications,
}: {
  vendor: VendorRecord;
  requirements: VendorRequirementRecord[];
  communications: CommunicationRecord[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSent, setInviteSent] = useState(false);
  const [isInvitePending, startInviteTransition] = useTransition();
  const summary = useMemo(() => {
    return requirements.reduce(
      (current, requirement) => {
        const status = documentStatus(requirement);
        current.total += 1;
        if (status === "compliant") current.approved += 1;
        if (status === "expiring") current.expiring += 1;
        if (status === "missing" || status === "never_responded") current.missing += 1;
        if (status === "under_review") current.review += 1;
        if (status === "deficient") current.deficient += 1;
        return current;
      },
      { total: 0, approved: 0, expiring: 0, missing: 0, review: 0, deficient: 0 },
    );
  }, [requirements]);

  function inviteVendor() {
    setInviteError(null);
    setInviteSent(false);

    startInviteTransition(async () => {
      const result = await inviteVendorToPortal(vendor.id);
      if (!result.ok) {
        setInviteError(result.error ?? "Could not send invite.");
        toast.error("Invite was not sent", result.error);
        return;
      }

      toast.success("Invite sent");
      setInviteSent(true);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-accent">
            Vendor checklist
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{vendor.name}</h1>
          <p className="mt-2 text-sm text-muted">
            {vendor.email || "No email"} · {vendor.category ?? vendor.trade ?? "Uncategorized"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={inviteVendor}
            disabled={isInvitePending || !vendor.email}
            className={primaryButton}
          >
            <Send size={15} />
            {isInvitePending ? "Sending..." : "Invite vendor"}
          </button>
          <Link href="/dashboard/vendors" className={secondaryButton}>
            Back to vendors
          </Link>
        </div>
      </div>

      {inviteError || inviteSent ? (
        <div
          className={`mb-6 rounded-md border px-3 py-2 text-sm ${
            inviteSent
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
              : "border-rose-400/25 bg-rose-400/10 text-rose-100"
          }`}
        >
          {inviteSent ? "Invite sent and logged." : inviteError}
        </div>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-5">
        {[
          ["Approved", summary.approved, "text-emerald-100"],
          ["Expiring", summary.expiring, "text-amber-100"],
          ["Missing", summary.missing, "text-rose-100"],
          ["Review", summary.review, "text-sky-100"],
          ["Deficient", summary.deficient, "text-rose-100"],
        ].map(([label, value, className]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-white/[0.025] p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
            <p className={`mt-3 text-3xl font-semibold ${className}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {requirements.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.025] p-8 text-center">
            <h2 className="text-lg font-medium text-white">No checklist assigned</h2>
            <p className="mt-2 text-sm text-muted">
              Assign a requirement template from the vendors page to generate required documents.
            </p>
          </div>
        ) : null}

        {requirements.map((requirement) => {
          const status = documentStatus(requirement);
          const document = requirement.document;
          const version = document?.latestVersion;
          const expirationDays = daysUntil(document?.expires_at ?? requirement.expires_at);

          return (
            <section
              key={requirement.id}
              className="rounded-lg border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/18"
            >
              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr_0.85fr_0.9fr] xl:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-medium text-white">{requirement.name}</h2>
                    <StatusBadge status={status} />
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {requirement.document_type.toUpperCase()} ·{" "}
                    {requirement.expires_required ? "Expiration tracked" : "No expiration required"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted">Upload date</p>
                  <p className="mt-2 text-sm text-white">{formatDate(version?.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-muted">Expiration</p>
                  <p className="mt-2 text-sm text-white">
                    {formatDate(document?.expires_at ?? requirement.expires_at)}
                    {expirationDays !== null ? (
                      <span className="ml-2 text-xs text-muted">
                        {expirationDays < 0 ? "Expired" : `${expirationDays}d left`}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  {version?.signedUrl ? (
                    <>
                      <a href={version.signedUrl} target="_blank" className={secondaryButton}>
                        <ExternalLink size={15} />
                        Preview
                      </a>
                      <a href={version.signedUrl} download className={secondaryButton}>
                        <Download size={15} />
                        Download
                      </a>
                    </>
                  ) : (
                    <span className="text-sm text-muted">No file uploaded</span>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-white/10 pt-4">
                <UploadControl vendor={vendor} requirement={requirement} />
                <ReviewForm vendorId={vendor.id} requirement={requirement} />
                {document?.latestReview?.notes ? (
                  <div className="mt-3 rounded-md border border-white/10 bg-white/[0.025] px-3 py-2 text-sm text-muted">
                    Latest review note: {document.latestReview.notes}
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-8 rounded-lg border border-white/10 bg-white/[0.025]">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-medium text-white">Communications</h2>
          <p className="mt-1 text-sm text-muted">
            Invites, reminders, and vendor portal responses for this vendor.
          </p>
        </div>
        <div className="divide-y divide-white/8">
          {communications.length === 0 ? (
            <p className="px-4 py-5 text-sm text-muted">No communications logged yet.</p>
          ) : null}
          {communications.map((item) => (
            <div key={item.id} className="grid gap-3 px-4 py-4 md:grid-cols-[160px_1fr]">
              <div>
                <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs capitalize text-white">
                  {item.direction} {item.channel}
                </span>
                <p className="mt-2 text-xs text-muted">
                  {formatDate(item.sent_at ?? item.created_at)}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{item.subject ?? "Untitled"}</p>
                {item.body ? (
                  <p className="mt-1 text-sm leading-6 text-muted">{item.body}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
