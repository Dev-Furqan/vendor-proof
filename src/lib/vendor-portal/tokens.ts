import crypto from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export function createPortalToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashPortalToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createVendorPortalInvite({
  organizationId,
  vendorId,
  email,
  createdBy,
  expiresInDays = 30,
}: {
  organizationId: string;
  vendorId: string;
  email: string;
  createdBy?: string | null;
  expiresInDays?: number;
}) {
  const token = createPortalToken();
  const tokenHash = hashPortalToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from("vendor_invites").insert({
    organization_id: organizationId,
    vendor_id: vendorId,
    token_hash: tokenHash,
    email,
    expires_at: expiresAt.toISOString(),
    created_by: createdBy ?? null,
  });

  if (error) {
    throw error;
  }

  return { token, expiresAt };
}

export async function resolveVendorPortalToken(token: string) {
  const tokenHash = hashPortalToken(token);
  const admin = getSupabaseAdmin();
  const { data: invite, error } = await admin
    .from("vendor_invites")
    .select("id, organization_id, vendor_id, email, expires_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error || !invite) {
    return null;
  }

  return invite as {
    id: string;
    organization_id: string;
    vendor_id: string;
    email: string;
    expires_at: string;
  };
}
