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
  searchParams: Promise<{ periodo?: string; de?: string; ate?: string }>;
}) {
  await requirePapel("ceo");
  const sp = await searchParams;
  const { range, preset } = resolverRange(sp);

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
  let leadsDia: DiaLeads[] = [];
  let idade: BreakdownLinha[] = [];
  let genero: BreakdownLinha[] = [];
  let plataforma: BreakdownLinha[] = [];
  let erro: string | null = null;
  try {
    // Graph (breakdowns) em paralelo entre si; Supabase em sequência (padrão da casa).
    [idade, genero, plataforma] = await Promise.all([
      fetchBreakdown("age", range),
      fetchBreakdown("gender", range),
      fetchBreakdown("publisher_platform", range),
    ]);
    serie = await fetchSerieDiariaGasto(supabase, range);
    top = await fetchTopCampanhas(supabase, range, 10);
    leadsDia = await fetchLeadsPorDia(supabase, range);
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
        description={`De ${range.since.split("-").reverse().join("/")} a ${range.until.split("-").reverse().join("/")}`}
        dense
        actions={<RefreshAds />}
      />

      <PeriodoFiltro presetAtivo={preset} de={range.since} ate={range.until} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Gasto no período" value={brl.format(gastoTotal)} icon={Wallet} accent="burgundy" />
        <StatCard label="Impressões" value={compacto.format(imprTotal)} icon={Eye} accent="brand" />
        <StatCard label="Cliques" value={compacto.format(cliquesTotal)} context={imprTotal > 0 ? `CTR ${((cliquesTotal / imprTotal) * 100).toFixed(2)}%` : undefined} icon={MousePointerClick} accent="blue" />
        <StatCard label="Leads do funil" value={String(leadsTotal)} context={cplPeriodo !== null ? `CPL ${brl.format(cplPeriodo)}` : "sem leads no período"} icon={Users} accent="green" />
      </div>

      <DesempenhoClient serie={serie} top={top} leadsDia={leadsDia} idade={idade} genero={genero} plataforma={plataforma} />
    </div>
  );
}
