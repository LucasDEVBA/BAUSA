"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Upload de arquivo da mensagem direta (I4) — documento (PDF) ou imagem que
// entra na mensagem como LINK (WhatsApp: card clicável · e-mail: botão).
// → bucket PÚBLICO remarketing-media, path mensagens/ (mesma necessidade de
// URL pública ESTÁVEL das automações/remarketing — a mensagem referencia o
// arquivo por tempo indeterminado; signed URL expiraria — e a policy do
// bucket já restringe INSERT/DELETE a CEO). PDF permitido no bucket pela
// migration 20260706065719_mensagem_direta_pdf_bucket.sql.
// Só CEO. PDF/imagem até 10MB. Análoga a uploadAutomacaoImagem.
// ════════════════════════════════════════════════════════════════════════

const BUCKET = "remarketing-media";
const PATH_PREFIX = "mensagens";
const MAX_BYTES = 10 * 1024 * 1024; // 10MB (limite do bucket)
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/x-m4a",
  "audio/3gpp",
]);

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

export async function uploadMensagemArquivo(
  formData: FormData,
): Promise<
  | { success: true; url: string; nomeArquivo: string; tipo: "pdf" | "imagem" }
  | { success: false; error: string }
> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode subir arquivos de mensagem." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Arquivo inválido." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return {
      success: false,
      error: `Tipo não permitido: ${file.type || "desconhecido"} (use PDF ou PNG/JPG/WebP/GIF).`,
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      success: false,
      error: `Arquivo muito grande (máx 10MB). Recebido: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
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
    return {
      success: true,
      url: data.publicUrl,
      nomeArquivo: file.name,
      tipo: file.type === "application/pdf" ? "pdf" : "imagem",
    };
  } catch (err) {
    console.error({ level: "error", action: "upload_mensagem_arquivo", error: String(err) });
    return { success: false, error: "Erro inesperado no upload do arquivo." };
  }
}

/**
 * Upload de ÁUDIO gravado no navegador (mensagem de voz do espelho). O tipo do
 * MediaRecorder vem como `audio/webm;codecs=opus` — normalizamos p/ o MIME base
 * (`audio/webm`) para casar com o allowlist do bucket. Só CEO, até 10MB.
 */
export async function uploadMensagemAudio(
  formData: FormData,
): Promise<{ success: true; url: string } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode enviar áudio." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { success: false, error: "Áudio inválido." };
  }
  const baseType = file.type.split(";")[0].trim().toLowerCase();
  if (!AUDIO_TYPES.has(baseType)) {
    return {
      success: false,
      error: `Tipo de áudio não permitido: ${file.type || "desconhecido"}.`,
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      success: false,
      error: `Áudio muito grande (máx 10MB). Recebido: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const ext = baseType.split("/")[1] || "webm";
    const path = `${PATH_PREFIX}/audio/${stamp}.${ext}`;

    // O storage-js IGNORA options.contentType p/ File/Blob e usa File.type —
    // então reconstruímos o File com o MIME BASE (sem `;codecs=`) p/ casar com
    // o allowed_mime_types do bucket (senão o Storage rejeita webm;codecs=opus).
    const cleanFile = new File([await file.arrayBuffer()], `audio.${ext}`, { type: baseType });

    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, cleanFile, { contentType: baseType, upsert: false });

    if (uploadErr) {
      return { success: false, error: `Falha no upload: ${uploadErr.message}` };
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      return { success: false, error: "Falha ao gerar URL pública." };
    }
    return { success: true, url: data.publicUrl };
  } catch (err) {
    console.error({ level: "error", action: "upload_mensagem_audio", error: String(err) });
    return { success: false, error: "Erro inesperado no upload do áudio." };
  }
}
