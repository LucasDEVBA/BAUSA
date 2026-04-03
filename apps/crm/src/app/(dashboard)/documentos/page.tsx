import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { DocumentosClient } from "./DocumentosClient";

export default async function DocumentosPage() {
  await requirePapel(["ceo", "head_sucesso"]);

  const supabase = await createServerSupabaseClient();

  const { data: atletas } = await supabase
    .from("atletas")
    .select("id, nome_completo, form_submission_id")
    .not("form_submission_id", "is", null)
    .is("deleted_at", null)
    .order("nome_completo", { ascending: true });

  const atletaIds = (atletas ?? []).map((a) => a.id);

  let documentos: Record<string, unknown>[] = [];
  if (atletaIds.length > 0) {
    const { data } = await supabase
      .from("documentos_atleta")
      .select("*")
      .in("atleta_id", atletaIds)
      .is("deleted_at", null)
      .order("tipo", { ascending: true });
    documentos = data ?? [];
  }

  return (
    <DocumentosClient
      atletasIniciais={atletas ?? []}
      documentosIniciais={documentos}
    />
  );
}
