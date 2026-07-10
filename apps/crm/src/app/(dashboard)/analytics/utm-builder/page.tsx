import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { UtmBuilderClient } from "./client";

export interface LinkCurtoRow {
  id: string;
  slug: string;
  destino: string;
  titulo: string | null;
  cliques: number;
  created_at: string;
}

export default async function UtmBuilderPage() {
  await requirePapel("ceo");

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("links_curtos")
    .select("id, slug, destino, titulo, cliques, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  return <UtmBuilderClient links={(data as LinkCurtoRow[]) ?? []} />;
}
