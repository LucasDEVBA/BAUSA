import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePapel } from "@/lib/auth";
import { getFasesFamiliaConfigOverrides } from "@/lib/actions/configuracoes";
import { mergeJourneyConfig } from "@/lib/fases-familia";
import { FamiliasConsolidadasClient } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    experiencia_id: string | null;
    fase: string | null;
    temperatura: string | null;
    status: string | null;
  }>;
  valor_total: number;
}

export default async function FamiliasPage() {
  await requirePapel(["ceo", "head_sucesso"]);

  const supabase = await createServerSupabaseClient();
  const journeyConfig = mergeJourneyConfig(
    await getFasesFamiliaConfigOverrides(),
  );

  type ExperienciaRow = {
    id: string;
    atleta_id: string | null;
    fase: string | null;
    temperatura: string | null;
    status: string | null;
  };
  type AtletaRow = {
    id: string;
    nome_completo: string | null;
    lead_classificacao: string | null;
    lead_score: number | null;
    responsavel_id: string | null;
  };
  type DealRow = {
    id: string;
    atleta_id: string | null;
    etapa: string | null;
    valor_estimado: number | null;
  };
  type ResponsavelRow = {
    id: string;
    nome: string | null;
    profissao: string | null;
    whatsapp: string | null;
  };

  // ─── 1. crm_experiencia ativas → fonte da verdade para "família é família" ──
  const { data: expData, error: expErr } = await supabase
    .from("crm_experiencia")
    .select("id, atleta_id, fase, temperatura, status")
    .is("deleted_at", null);

  if (expErr) {
    console.error(
      "[familias] crm_experiencia erro:",
      JSON.stringify(expErr, null, 2),
    );
  }
  const experiencias = (expData ?? []) as ExperienciaRow[];

  if (experiencias.length === 0) {
    return <FamiliasConsolidadasClient familias={[]} journeyConfig={journeyConfig} />;
  }

  const atletaIdsComExperiencia = experiencias
    .map((e) => e.atleta_id)
    .filter((id): id is string => id !== null);

  if (atletaIdsComExperiencia.length === 0) {
    return <FamiliasConsolidadasClient familias={[]} journeyConfig={journeyConfig} />;
  }

  const expByAtleta = new Map<string, ExperienciaRow>();
  for (const e of experiencias) {
    if (e.atleta_id) expByAtleta.set(e.atleta_id, e);
  }

  // ─── 2. Atletas com experiência ──
  const { data: atData, error: atErr } = await supabase
    .from("atletas")
    .select("id, nome_completo, lead_classificacao, lead_score, responsavel_id")
    .in("id", atletaIdsComExperiencia)
    .is("deleted_at", null);

  if (atErr) {
    console.error("[familias] atletas erro:", JSON.stringify(atErr, null, 2));
  }
  const atletas = (atData ?? []) as AtletaRow[];

  // ─── 3. Responsáveis desses atletas ──
  const respIds = atletas
    .map((a) => a.responsavel_id)
    .filter((id): id is string => id !== null);
  const uniqueRespIds = Array.from(new Set(respIds));

  if (uniqueRespIds.length === 0) {
    return <FamiliasConsolidadasClient familias={[]} journeyConfig={journeyConfig} />;
  }

  const { data: respData, error: respErr } = await supabase
    .from("responsaveis")
    .select("id, nome, profissao, whatsapp")
    .in("id", uniqueRespIds)
    .is("deleted_at", null)
    .order("nome", { ascending: true });

  if (respErr) {
    console.error(
      "[familias] responsaveis erro:",
      JSON.stringify(respErr, null, 2),
    );
  }
  const responsaveis = (respData ?? []) as ResponsavelRow[];

  // ─── 4. Deals desses atletas (para etapa + valor) ──
  const { data: dealsData } = await supabase
    .from("deals")
    .select("id, atleta_id, etapa, valor_estimado")
    .in("atleta_id", atletaIdsComExperiencia)
    .is("deleted_at", null);
  const deals = (dealsData ?? []) as DealRow[];

  const dealByAtleta = new Map<string, DealRow>();
  for (const d of deals) {
    if (d.atleta_id && !dealByAtleta.has(d.atleta_id)) {
      dealByAtleta.set(d.atleta_id, d);
    }
  }

  // ─── 5. Map responsavel → atletas ──
  const atletasByResp = new Map<string, AtletaRow[]>();
  for (const a of atletas) {
    if (!a.responsavel_id) continue;
    const list = atletasByResp.get(a.responsavel_id) ?? [];
    list.push(a);
    atletasByResp.set(a.responsavel_id, list);
  }

  const familias: FamiliaConsolidada[] = responsaveis.map((r) => {
    const atletasResp = atletasByResp.get(r.id) ?? [];
    const atletasMapped = atletasResp.map((a) => {
      const deal = dealByAtleta.get(a.id);
      const exp = expByAtleta.get(a.id);
      return {
        id: a.id,
        nome_completo: a.nome_completo ?? "Atleta",
        classificacao: a.lead_classificacao ?? null,
        etapa: deal?.etapa ?? null,
        lead_score: a.lead_score != null ? Number(a.lead_score) : null,
        deal_valor:
          deal?.valor_estimado != null ? Number(deal.valor_estimado) : null,
        experiencia_id: exp?.id ?? null,
        fase: exp?.fase ?? null,
        temperatura: exp?.temperatura ?? null,
        status: exp?.status ?? null,
      };
    });
    const valor_total = atletasMapped.reduce(
      (sum, a) => sum + (a.deal_valor ?? 0),
      0,
    );
    return {
      responsavel_id: r.id,
      responsavel_nome: r.nome ?? "Responsavel",
      profissao: r.profissao ?? null,
      whatsapp: r.whatsapp ?? null,
      atletas: atletasMapped,
      valor_total,
    };
  });

  console.log("[familias] consolidadas (filtro: admission+)", {
    experiencias: experiencias.length,
    atletas: atletas.length,
    responsaveis: responsaveis.length,
    familias: familias.length,
  });

  return (
    <FamiliasConsolidadasClient familias={familias} journeyConfig={journeyConfig} />
  );
}
