import { TrendingUp } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  fetchBreakdown,
  fetchSerieDiariaGasto,
  metaAdsConfigurado,
  MetaAdsError,
  type BreakdownLinha,
  type DiaGastoAds,
} from "@/lib/meta-ads";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { DesempenhoClient } from "./client";

// /ads/desempenho (A1): série diária de gasto (histórico próprio, Supabase)
// + breakdowns demográficos/plataforma (Graph, 90d).
export const dynamic = "force-dynamic";

export default async function AdsDesempenhoPage() {
  await requirePapel("ceo");

  if (!metaAdsConfigurado()) {
    return (
      <div className="space-y-4">
        <PageHeader title="Desempenho" description="Gasto diário e perfil do público alcançado" dense />
        <EmptyState
          icon={TrendingUp}
          title="Integração Meta não configurada"
          description="Defina META_ACCESS_TOKEN e META_AD_ACCOUNT_ID no ambiente do Engine para ativar esta tela."
        />
      </div>
    );
  }

  let serie: DiaGastoAds[] = [];
  let idade: BreakdownLinha[] = [];
  let genero: BreakdownLinha[] = [];
  let plataforma: BreakdownLinha[] = [];
  let erro: string | null = null;
  try {
    [idade, genero, plataforma] = await Promise.all([
      fetchBreakdown("age"),
      fetchBreakdown("gender"),
      fetchBreakdown("publisher_platform"),
    ]);
  } catch (e) {
    erro = e instanceof MetaAdsError ? e.message : "Falha inesperada ao consultar a Meta.";
  }
  if (!erro) {
    // Série vem do histórico próprio (Supabase) — se falhar, o gráfico rende vazio.
    try {
      serie = await fetchSerieDiariaGasto(await createServerSupabaseClient(), 90);
    } catch {
      serie = [];
    }
  }

  if (erro) {
    return (
      <div className="space-y-4">
        <PageHeader title="Desempenho" description="Gasto diário e perfil do público alcançado" dense />
        <EmptyState icon={TrendingUp} title="Não foi possível carregar o desempenho" description={erro} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Desempenho" description="Gasto diário e perfil do público alcançado (últimos 90 dias)" dense />
      <DesempenhoClient serie={serie} idade={idade} genero={genero} plataforma={plataforma} />
    </div>
  );
}
