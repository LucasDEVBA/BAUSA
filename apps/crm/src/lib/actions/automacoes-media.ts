"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Upload de imagem das ações custom de automação (WhatsApp/E-mail custom)
// → bucket PÚBLICO remarketing-media, path automacoes/ (reuso consciente:
// mesma necessidade de URL pública ESTÁVEL — a engine envia a imagem por
// tempo indeterminado; signed URL expiraria — e a policy do bucket já
// restringe INSERT/DELETE a CEO, sem precisar de migration nova).
// Só CEO. Só imagens. Análoga a uploadRemarketingImage (remarketing-media.ts).
// ════════════════════════════════════════════════════════════════════════

const BUCKET = "remarketing-media";
const PATH_PREFIX = "automacoes";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB (limite do bucket)
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

export async function uploadAutomacaoImagem(
  formData: FormData,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode subir imagens de automação." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Arquivo inválido." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      success: false,
      error: `Tipo não permitido: ${file.type || "desconhecido"} (use PNG/JPG/WebP/GIF).`,
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      success: false,
      error: `Imagem muito grande (máx 10MB). Recebido: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = `${PATH_PREFIX}/${stamp}-${sanitizeFilename(file.name)}`;

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadErr) {
      return { success: false, error: `Falha no upload: ${uploadErr.message}` };
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      return { success: false, error: "Falha ao gerar URL pública." };
    }
    return { success: true, url: data.publicUrl };
  } catch (err) {
    console.error({ level: "error", action: "upload_automacao_imagem", error: String(err) });
    return { success: false, error: "Erro inesperado no upload da imagem." };
  }
}
