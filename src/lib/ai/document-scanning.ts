import { getSiteUrl } from "@/lib/site-url";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isValidDateString } from "@/lib/validation";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
const EXTRACTION_TIMEOUT_MS = 20_000;
const MAX_IMAGE_SIDE = 1600;

type ExtractionField = string | null;

export type DocumentExtractionResult = {
  document_type: ExtractionField;
  insured_or_business_name: ExtractionField;
  policy_or_license_number: ExtractionField;
  effective_date: ExtractionField;
  expiration_date: ExtractionField;
  issuing_carrier_or_authority: ExtractionField;
  confidence: number | null;
  flags: string[];
};

type ScanDocumentInput = {
  organizationId: string;
  documentId: string;
  documentVersionId: string;
  requirementId: string;
  actorUserId?: string | null;
};

type RequirementRule = {
  id: string;
  document_type: string;
  expires_required: boolean;
  expiration_rule: string | null;
};

type DocumentVersion = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  file_name: string;
};

function aiScanningEnabled() {
  return process.env.AI_SCANNING_ENABLED !== "false" && Boolean(process.env.OPENROUTER_API_KEY);
}

function modelName() {
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned || /^unknown|n\/a|null$/i.test(cleaned)) return null;
  return cleaned.slice(0, 240);
}

function normalizeDate(value: unknown): string | null {
  const text = normalizeNullableString(value);
  if (!text) return null;

  if (isValidDateString(text)) return text;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function parseJsonObject(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("OpenRouter response did not contain a JSON object.");
  }

  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
}

function normalizeExtraction(rawText: string): DocumentExtractionResult {
  const parsed = parseJsonObject(rawText);
  const confidence = typeof parsed.confidence === "number" ? parsed.confidence : null;
  const flags = Array.isArray(parsed.flags)
    ? parsed.flags.map((flag) => normalizeNullableString(flag)).filter(Boolean)
    : [];

  return {
    document_type: normalizeNullableString(parsed.document_type),
    insured_or_business_name: normalizeNullableString(parsed.insured_or_business_name),
    policy_or_license_number: normalizeNullableString(parsed.policy_or_license_number),
    effective_date: normalizeDate(parsed.effective_date),
    expiration_date: normalizeDate(parsed.expiration_date),
    issuing_carrier_or_authority: normalizeNullableString(
      parsed.issuing_carrier_or_authority,
    ),
    confidence,
    flags: flags as string[],
  };
}

function utcDay(value: string) {
  return Date.parse(`${value}T00:00:00.000Z`);
}

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function buildRuleFlags(result: DocumentExtractionResult, requirement: RequirementRule) {
  const flags = new Set(result.flags);
  const documentType = result.document_type?.toLowerCase();

  if (documentType && documentType !== requirement.document_type.toLowerCase()) {
    flags.add("document_type_mismatch");
  }

  if (requirement.expires_required && !result.expiration_date) {
    flags.add("missing_expiration_date");
  }

  if (result.expiration_date) {
    const expiration = utcDay(result.expiration_date);
    const today = utcDay(todayUtcDate());
    if (expiration < today) {
      flags.add("already_expired");
    } else if (expiration - today <= 30 * 86_400_000) {
      flags.add("expires_within_30_days");
    }
  }

  if (
    requirement.expiration_rule === "annual" &&
    result.effective_date &&
    result.expiration_date
  ) {
    const coverageDays =
      (utcDay(result.expiration_date) - utcDay(result.effective_date)) / 86_400_000;
    if (coverageDays < 365) {
      flags.add("coverage_less_than_annual");
    }
  }

  if (!result.insured_or_business_name) flags.add("missing_business_name");
  if (!result.policy_or_license_number && requirement.document_type !== "w9") {
    flags.add("missing_policy_or_license_number");
  }

  return Array.from(flags);
}

async function renderPdfFirstPage(buffer: Buffer) {
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
  } as Parameters<typeof pdfjs.getDocument>[0] & { disableWorker: boolean });
  const pdf = await task.promise;
  const page = await pdf.getPage(1);
  const initial = page.getViewport({ scale: 2 });
  const scale = Math.min(2, MAX_IMAGE_SIDE / Math.max(initial.width, initial.height));
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
  } as unknown as Parameters<typeof page.render>[0]).promise;

  await (pdf as unknown as { destroy: () => Promise<void> }).destroy();
  return {
    dataUrl: `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`,
    mimeType: "image/png",
  };
}

async function fileToImageDataUrl(version: DocumentVersion) {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.storage
    .from("documents")
    .download(version.storage_path);

  if (error || !data) {
    throw new Error(error?.message ?? "Could not download document for AI extraction.");
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const mimeType = version.mime_type ?? "application/octet-stream";

  if (mimeType === "application/pdf" || version.file_name.toLowerCase().endsWith(".pdf")) {
    return renderPdfFirstPage(buffer);
  }

  if (mimeType.startsWith("image/")) {
    return {
      dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
      mimeType,
    };
  }

  throw new Error("AI extraction only supports PDFs and image uploads.");
}

function extractionPrompt(requirement: RequirementRule) {
  return [
    "Extract structured fields from this vendor compliance document.",
    "Return ONLY strict JSON. Do not include markdown, code fences, commentary, or trailing text.",
    "Use null when a field is not visible. Dates must be YYYY-MM-DD.",
    `The expected requirement document type is ${requirement.document_type}.`,
    "Schema: {",
    '  "document_type": "coi" | "license" | "w9" | "other" | null,',
    '  "insured_or_business_name": string | null,',
    '  "policy_or_license_number": string | null,',
    '  "effective_date": "YYYY-MM-DD" | null,',
    '  "expiration_date": "YYYY-MM-DD" | null,',
    '  "issuing_carrier_or_authority": string | null,',
    '  "confidence": number between 0 and 1,',
    '  "flags": string[]',
    "}",
  ].join("\n");
}

async function callOpenRouter(dataUrl: string, requirement: RequirementRule) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  const body = {
    model: modelName(),
    temperature: 0,
    max_tokens: 700,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "vendor_document_extraction",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            document_type: { type: ["string", "null"] },
            insured_or_business_name: { type: ["string", "null"] },
            policy_or_license_number: { type: ["string", "null"] },
            effective_date: { type: ["string", "null"] },
            expiration_date: { type: ["string", "null"] },
            issuing_carrier_or_authority: { type: ["string", "null"] },
            confidence: { type: ["number", "null"] },
            flags: { type: "array", items: { type: "string" } },
          },
          required: [
            "document_type",
            "insured_or_business_name",
            "policy_or_license_number",
            "effective_date",
            "expiration_date",
            "issuing_carrier_or_authority",
            "confidence",
            "flags",
          ],
        },
      },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: extractionPrompt(requirement) },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

    try {
      const response = await fetch(OPENROUTER_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": getSiteUrl(),
          "X-OpenRouter-Title": "VendorProof",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`OpenRouter request failed with ${response.status}.`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: Record<string, unknown>;
        model?: string;
      };
      const text = json.choices?.[0]?.message?.content ?? "";
      return {
        result: normalizeExtraction(text),
        raw: json,
        usage: json.usage ?? null,
        model: json.model ?? modelName(),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("OpenRouter request failed.");
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("OpenRouter request failed.");
}

async function markExtractionFailure(input: ScanDocumentInput, error: Error) {
  const admin = getSupabaseAdmin();
  await admin
    .from("documents")
    .update({
      ai_extraction_status: "manual_review",
      ai_extraction_model: modelName(),
      ai_extraction_error: error.message,
      ai_extraction_completed_at: new Date().toISOString(),
      ai_extraction_flags: ["needs_manual_review", "extraction_failed"],
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.documentId);

  await admin.from("audit_logs").insert({
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId ?? null,
    action: "document.ai_extraction.failed",
    entity_table: "documents",
    entity_id: input.documentId,
    metadata: {
      documentVersionId: input.documentVersionId,
      model: modelName(),
      error: error.message,
    },
  });
}

export async function scanDocumentVersion(input: ScanDocumentInput) {
  const admin = getSupabaseAdmin();

  if (!aiScanningEnabled()) {
    await admin
      .from("documents")
      .update({ ai_extraction_status: "disabled" })
      .eq("organization_id", input.organizationId)
      .eq("id", input.documentId);
    return;
  }

  await admin
    .from("documents")
    .update({
      ai_extraction_status: "pending",
      ai_extraction_model: modelName(),
      ai_extraction_error: null,
      ai_extraction_flags: [],
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.documentId);

  const [{ data: version }, { data: requirement }] = await Promise.all([
    admin
      .from("document_versions")
      .select("id, storage_path, mime_type, file_name")
      .eq("organization_id", input.organizationId)
      .eq("id", input.documentVersionId)
      .maybeSingle(),
    admin
      .from("vendor_requirements")
      .select("id, document_type, expires_required, expiration_rule")
      .eq("organization_id", input.organizationId)
      .eq("id", input.requirementId)
      .maybeSingle(),
  ]);

  if (!version || !requirement) {
    await markExtractionFailure(input, new Error("Document version or requirement was not found."));
    return;
  }

  try {
    const { dataUrl } = await fileToImageDataUrl(version as DocumentVersion);
    const extraction = await callOpenRouter(dataUrl, requirement as RequirementRule);
    const flags = buildRuleFlags(extraction.result, requirement as RequirementRule);
    const needsManualReview =
      flags.includes("missing_expiration_date") ||
      flags.includes("already_expired") ||
      flags.includes("extraction_failed");

    await admin
      .from("documents")
      .update({
        business_name: extraction.result.insured_or_business_name,
        policy_number: extraction.result.policy_or_license_number,
        issued_at: extraction.result.effective_date,
        expires_at: extraction.result.expiration_date,
        issuing_authority: extraction.result.issuing_carrier_or_authority,
        ai_extraction_status: needsManualReview ? "manual_review" : "completed",
        ai_extraction_model: extraction.model,
        ai_extraction_raw: extraction.raw,
        ai_extraction_confidence: extraction.result.confidence,
        ai_extraction_flags: flags,
        ai_extraction_usage: extraction.usage,
        ai_extraction_error: null,
        ai_extraction_completed_at: new Date().toISOString(),
        ai_extracted_document_type: extraction.result.document_type,
        ai_extracted_business_name: extraction.result.insured_or_business_name,
        ai_extracted_policy_number: extraction.result.policy_or_license_number,
        ai_extracted_effective_date: extraction.result.effective_date,
        ai_extracted_expiration_date: extraction.result.expiration_date,
        ai_extracted_issuing_authority: extraction.result.issuing_carrier_or_authority,
      })
      .eq("organization_id", input.organizationId)
      .eq("id", input.documentId);

    if (extraction.result.expiration_date) {
      await admin
        .from("vendor_requirements")
        .update({ expires_at: extraction.result.expiration_date })
        .eq("organization_id", input.organizationId)
        .eq("id", input.requirementId);
    }

    await admin.from("audit_logs").insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId ?? null,
      action: "document.ai_extraction.completed",
      entity_table: "documents",
      entity_id: input.documentId,
      metadata: {
        documentVersionId: input.documentVersionId,
        model: extraction.model,
        usage: extraction.usage,
        confidence: extraction.result.confidence,
        flags,
      },
    });
  } catch (error) {
    await markExtractionFailure(
      input,
      error instanceof Error ? error : new Error("AI extraction failed."),
    );
  }
}

export function aiExtractionIsConfigured() {
  return aiScanningEnabled();
}
