import { createBrowserClient } from "./supabase-browser";

const BUCKET = "avatars";
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

/**
 * Faz upload da foto de perfil para o bucket público `avatars`, na pasta do
 * próprio usuário (`<userId>/...`) — a RLS de storage permite o dono escrever a
 * própria pasta. Retorna a URL pública (cache-buster por timestamp).
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Formato inválido. Use PNG, JPG ou WEBP.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Imagem muito grande (máx. 5MB).");
  }

  const supabase = createBrowserClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${userId}/avatar_${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, cacheControl: "3600", contentType: file.type });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
