import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function createSignedDocumentUrl(storagePath: string | null | undefined) {
  if (!storagePath) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 60 * 30);

  if (error) {
    return null;
  }

  return data.signedUrl;
}
