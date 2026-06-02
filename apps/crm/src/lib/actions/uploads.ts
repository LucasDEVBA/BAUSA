"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

const BUCKET = "crm-uploads";
const MAX_BYTES = 20 * 1024 * 1024; // 20MB

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

export interface UploadedFile {
  path: string;
  name: string;
  type: string;
  size: number;
  uploaded_at: string;
}

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

/**
 * Upload genérico para o bucket crm-uploads.
 * @param scope ex: "contatos", "documentos", "experiencia"
 * @param scopeId id do objeto pai (experiencia_id, atleta_id, etc.)
 */
export async function uploadFile(
  formData: FormData,
): Promise<
  | { success: true; file: UploadedFile }
  | { success: false; error: string }
> {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) {
    return { success: false, error: "Sem permissão para upload." };
  }

  const file = formData.get("file");
  const scope = String(formData.get("scope") ?? "");
  const scopeId = String(formData.get("scopeId") ?? "");

  if (!(file instanceof File)) {
    return { success: false, error: "Arquivo inválido." };
  }
  if (!scope || !scopeId) {
    return { success: false, error: "Scope inválido." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      success: false,
      error: `Tipo de arquivo não permitido: ${file.type}`,
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      success: false,
      error: `Arquivo muito grande (máx 20MB). Recebido: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  const supabase = await createAuditedSupabaseClient();

  const safeName = sanitizeFilename(file.name);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${scope}/${scopeId}/${stamp}-${safeName}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadErr) {
    console.error("[uploadFile] erro:", uploadErr.message);
    return { success: false, error: `Falha no upload: ${uploadErr.message}` };
  }

  return {
    success: true,
    file: {
      path,
      name: file.name,
      type: file.type,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    },
  };
}

/**
 * Gera signed URL temporária (1h) para visualizar arquivo.
 */
export async function getFileSignedUrl(
  path: string,
): Promise<{ url: string | null; error?: string }> {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) {
    return { url: null, error: "Sem permissão." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  if (error || !data) {
    return { url: null, error: error?.message ?? "Falha ao gerar URL" };
  }
  return { url: data.signedUrl };
}

/**
 * Deleta arquivo (usado quando documento/contato é removido).
 */
export async function deleteFile(path: string): Promise<{ success: boolean; error?: string }> {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) {
    return { success: false, error: "Sem permissão." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}
