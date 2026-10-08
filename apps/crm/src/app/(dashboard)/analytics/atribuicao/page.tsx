import { createServerSupabaseClient } from "@/lib/supabase-server";
import { buscarTodasAsPaginas } from "@/lib/supabase-paginacao";
import { AtribuicaoClient } from "./client";

export interface LeadAttribution {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  cta_source: string | null;
  device_type: string | null;
  qualification_classification: string | null;
  submitted_at: string;
}

export default async function AtribuicaoPage() {
  const supabase = await createServerSupabaseClient();

  // Base inteira (todos os tempos): passa de 1000 linhas ~19/10 — paginado
  // para o gráfico não perder os leads mais antigos em silêncio (T8.4).
  const { data: rows } = await buscarTodasAsPaginas((de, ate) =>
    supabase
      .from("form_submissions")
      .select(
        "utm_source, utm_medium, utm_campaign, cta_source, device_type, qualification_classification, submitted_at",
      )
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: false })
      .range(de, ate),
  );

  return <AtribuicaoClient leads={(rows as LeadAttribution[]) ?? []} />;
}
