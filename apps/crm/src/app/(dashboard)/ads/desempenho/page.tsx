import { TrendingUp, Wallet, MousePointerClick, Eye, Users } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  fetchBreakdown,
  fetchLeadsPorDia,
  fetchSerieDiariaGasto,
  fetchTopCampanhas,
  metaAdsConfigurado,
  MetaAdsError,
  resolverRange,
  type BreakdownLinha,
  type DiaGastoAds,
  type DiaLeads,
  type TopCampanha,
} from "@/lib/meta-ads";
import { CampanhaFiltro } from "@/components/ads/CampanhaFiltro";
import { PeriodoFiltro } from "@/components/ads/PeriodoFiltro";
import { RefreshAds } from "@/components/ads/RefreshAds";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { DesempenhoClient } from "./client";

// /ads/desempenho — período fechado OU range custom via querystring; série
// própria (Supabase) + breakdowns da Graph, e o funil (leads/dia → CPL).
export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export default async function AdsDesempenhoPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string; campanha?: string }>;
}) {
  await requirePapel("ceo");
  const sp = await searchParams;
  const { range, preset } = resolverRange(sp);
  // id da Meta é numérico — valida antes de usar em query/Graph
  const campanhaId = sp.campanha && /^\d{5,25}$/.test(sp.campanha) ? sp.campanha : undefined;

  if (!metaAdsConfigurado()) {
    return (
      <div className="space-y-4">
        <PageHeader title="Desempenho" description="Gasto, alcance e funil no período" dense />
        <EmptyState
          icon={TrendingUp}
          title="Integração Meta não configurada"
          description="Defina META_ACCESS_TOKEN e META_AD_ACCOUNT_ID no ambiente do Engine para ativar esta tela."
        />
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();

  let serie: DiaGastoAds[] = [];
  let top: TopCampanha[] = [];
  let opcoesCampanha: TopCampanha[] = [];
  let leadsDia: DiaLeads[] = [];
  let idade: BreakdownLinha[] = [];
  let genero: BreakdownLinha[] = [];
  let plataforma: BreakdownLinha[] = [];
  let erro: string | null = null;
  try {
    // Graph (breakdowns) em paralelo entre si; Supabase em sequência (padrão da casa).
    // Com ?campanha=<id>, todos os recortes viram DAQUELA campanha (nó da Graph).
    [idade, genero, plataforma] = await Promise.all([
      fetchBreakdown("age", range, campanhaId),
      fetchBreakdown("gender", range, campanhaId),
      fetchBreakdown("publisher_platform", range, campanhaId),
    ]);
    serie = await fetchSerieDiariaGasto(supabase, range, campanhaId);
    top = await fetchTopCampanhas(supabase, range, 10);
    // Opções do filtro: tudo que já gastou em 12m (independe do range ativo)
    opcoesCampanha = await fetchTopCampanhas(supabase, resolverRange({ periodo: "12m" }).range, 1000);
    leadsDia = await fetchLeadsPorDia(supabase, range, campanhaId);
  } catch (e) {
    erro = e instanceof MetaAdsError ? e.message : "Falha inesperada ao consultar a Meta.";
  }

  if (erro) {
    return (
      <div className="space-y-4">
        <PageHeader title="Desempenho" description="Gasto, alcance e funil no período" dense />
        <EmptyState icon={TrendingUp} title="Não foi possível carregar o desempenho" description={erro} />
      </div>
    );
  }

  const gastoTotal = serie.reduce((s, d) => s + d.gasto, 0);
  const cliquesTotal = serie.reduce((s, d) => s + d.cliques, 0);
  const imprTotal = serie.reduce((s, d) => s + d.impressoes, 0);
  const leadsTotal = leadsDia.reduce((s, d) => s + d.leads, 0);
  const cplPeriodo = leadsTotal > 0 && gastoTotal > 0 ? gastoTotal / leadsTotal : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Desempenho"
        description={`De ${range.since.split("-").reverse().join("/")} a ${range.until.split("-").reverse().join("/")}${
          campanhaId ? ` · ${opcoesCampanha.find((c) => c.campanhaId === campanhaId)?.nome ?? "campanha filtrada"}` : ""
        }`}
        dense
        actions={<RefreshAds />}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <PeriodoFiltro presetAtivo={preset} de={range.since} ate={range.until} />
        <CampanhaFiltro
          opcoes={opcoesCampanha.map((c) => ({ id: c.campanhaId, nome: c.nome }))}
          campanhaAtiva={campanhaId ?? null}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Gasto no período" value={brl.format(gastoTotal)} icon={Wallet} accent="burgundy" />
        <StatCard label="Impressões" value={compacto.format(imprTotal)} icon={Eye} accent="brand" />
        <StatCard label="Cliques" value={compacto.format(cliquesTotal)} context={imprTotal > 0 ? `CTR ${((cliquesTotal / imprTotal) * 100).toFixed(2)}%` : undefined} icon={MousePointerClick} accent="blue" />
        <StatCard label="Leads do funil" value={String(leadsTotal)} context={cplPeriodo !== null ? `CPL ${brl.format(cplPeriodo)}` : "sem leads no período"} icon={Users} accent="green" />
      </div>

      <DesempenhoClient
        serie={serie}
        top={top}
        leadsDia={leadsDia}
        idade={idade}
        genero={genero}
        plataforma={plataforma}
        campanhaFiltrada={Boolean(campanhaId)}
      />
    </div>
  );
}
