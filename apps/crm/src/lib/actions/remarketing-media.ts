"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Upload de imagem de campanha de re-marketing → bucket PÚBLICO
// (remarketing-media). Retorna URL pública estável, pois a CF envia a imagem
// via Z-API ao longo de dias (signed URL expiraria). Só CEO. Só imagens.
// ════════════════════════════════════════════════════════════════════════

const BUCKET = "remarketing-media";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
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

export async function uploadRemarketingImage(
  formData: FormData,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode subir imagens de campanha." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Arquivo inválido." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { success: false, error: `Tipo não permitido: ${file.type || "desconhecido"} (use PNG/JPG/WebP/GIF).` };
  }
  if (file.size > MAX_BYTES) {
    return {
      success: false,
      error: `Imagem muito grande (máx 10MB). Recebido: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  const supabase = await createAuditedSupabaseClient();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `campanhas/${stamp}-${sanitizeFilename(file.name)}`;

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
}
