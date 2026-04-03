import { createBrowserClient } from "./supabase-browser";

const BUCKET_NAME = "documentos";

export async function uploadDocumento(
  atletaId: string,
  tipo: string,
  file: File,
): Promise<string> {
  const supabase = createBrowserClient();
  const path = `${atletaId}/${tipo}/${file.name}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return urlData.publicUrl;
}
