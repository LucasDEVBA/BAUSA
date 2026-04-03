import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePapel } from "@/lib/auth";
import { FamiliasConsolidadasClient } from "./client";

export interface FamiliaConsolidada {
  responsavel_id: string;
  responsavel_nome: string;
  profissao: string | null;
  whatsapp: string | null;
  atletas: Array<{
    id: string;
    nome_completo: string;
    classificacao: string | null;
    etapa: string | null;
    lead_score: number | null;
    deal_valor: number | null;
  }>;
  valor_total: number;
}

export default async function FamiliasPage() {
  await requirePapel(["ceo", "head_sucesso"]);

  const supabase = await createServerSupabaseClient();

  const { data: responsaveis } = await supabase
    .from("responsaveis")
    .select(`
      id,
      nome,
      profissao,
      whatsapp,
      atletas(
        id,
        nome_completo,
        lead_classificacao,
        lead_score,
        deals(id, etapa, valor_estimado, deleted_at)
      )
    `)
    .is("deleted_at", null)
    .order("nome", { ascending: true });

  const familias: FamiliaConsolidada[] = (responsaveis ?? []).map((r) => {
    const raw = r as Record<string, unknown>;
    const atletasRaw = (raw.atletas as Array<Record<string, unknown>>) ?? [];

    const atletas = atletasRaw.map((a) => {
      const deals = (a.deals as Array<Record<string, unknown>>) ?? [];
      const activeDeal = deals.find((d) => d.deleted_at == null);
      return {
        id: a.id as string,
        nome_completo: (a.nome_completo as string) ?? "Atleta",
        classificacao: (a.lead_classificacao as string) ?? null,
        etapa: (activeDeal?.etapa as string) ?? null,
        lead_score: a.lead_score != null ? Number(a.lead_score) : null,
        deal_valor: activeDeal?.valor_estimado != null ? Number(activeDeal.valor_estimado) : null,
      };
    });

    const valor_total = atletas.reduce((sum, a) => sum + (a.deal_valor ?? 0), 0);

    return {
      responsavel_id: raw.id as string,
      responsavel_nome: (raw.nome as string) ?? "Responsavel",
      profissao: (raw.profissao as string) ?? null,
      whatsapp: (raw.whatsapp as string) ?? null,
      atletas,
      valor_total,
    };
  });

  return <FamiliasConsolidadasClient familias={familias} />;
}
