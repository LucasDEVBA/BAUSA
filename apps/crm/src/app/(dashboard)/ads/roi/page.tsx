import { Percent, Wallet, Users, HandCoins, TriangleAlert } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { fetchCampanhaMetrics, type CampanhaMetrics, type Period } from "@/lib/cac-queries";
import { metaAdsConfigurado } from "@/lib/meta-ads";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { RoiPeriodo } from "./RoiPeriodo";
import { RoiTabela } from "./RoiTabela";

// /ads/roi — CAC/ROI exato por campanha DENTRO da seção Ads (mesmo motor do
// /analytics/cac: gasto meta_ads_campanha × leads utm_id × contratos).
export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PERIODOS: Period[] = ["30d", "90d", "6m", "12m"];

export default async function AdsRoiPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  await requirePapel("ceo");
  const sp = await searchParams;
  const periodo: Period = PERIODOS.includes(sp.periodo as Period) ? (sp.periodo as Period) : "90d";

  if (!metaAdsConfigurado()) {
    return (
      <div className="space-y-4">
        <PageHeader title="CAC / ROI" description="Retorno exato por campanha" dense />
        <EmptyState icon={Percent} title="Integração Meta não configurada" description="Defina META_ACCESS_TOKEN e META_AD_ACCOUNT_ID no ambiente do Engine." />
      </div>
    );
  }

  let metrics: CampanhaMetrics;
  try {
    metrics = await fetchCampanhaMetrics(periodo);
  } catch {
    return (
      <div className="space-y-4">
        <PageHeader title="CAC / ROI" description="Retorno exato por campanha" dense />
        <EmptyState icon={Percent} title="Não foi possível calcular o ROI" description="Falha ao consultar o banco. Tente novamente." />
      </div>
    );
  }

  const campanhas = [...metrics.porCampanha].sort((a, b) => b.gasto - a.gasto);
  const leadsTotal = campanhas.reduce((s, c) => s + c.leads, 0);
  const clientesTotal = campanhas.reduce((s, c) => s + c.clientes, 0);
  const receitaTotal = campanhas.reduce((s, c) => s + c.receita, 0);
  const roiGeral = metrics.gastoTotal > 0 ? (receitaTotal - metrics.gastoTotal) / metrics.gastoTotal : null;

  return (
    <div className="space-y-5">
      <PageHeader title="CAC / ROI" description="Cada real da Meta rastreado até o contrato (utm_id ↔ campanha)" dense />

      <RoiPeriodo periodoAtivo={periodo} />

      {!metrics.temDados ? (
        <EmptyState
          icon={Percent}
          title="Sem dados de gasto no período"
          description="O sync do Meta ainda não trouxe gasto para este intervalo."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Gasto Meta" value={brl.format(metrics.gastoTotal)} icon={Wallet} accent="burgundy" />
            <StatCard label="Leads atribuídos" value={String(leadsTotal)} context={metrics.leadsSemCampanha > 0 ? `+${metrics.leadsSemCampanha} sem campanha` : undefined} icon={Users} accent="green" />
            <StatCard label="Clientes fechados" value={String(clientesTotal)} context={receitaTotal > 0 ? `receita ${brl.format(receitaTotal)}` : undefined} icon={HandCoins} accent="blue" />
            <StatCard
              label="ROI geral"
              value={roiGeral !== null ? `${(roiGeral * 100).toFixed(0)}%` : "—"}
              context="(receita − gasto) / gasto"
              icon={Percent}
              accent={roiGeral !== null && roiGeral >= 0 ? "green" : "red"}
            />
          </div>

          <RoiTabela campanhas={campanhas} />

          {metrics.leadsSemCampanha > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TriangleAlert className="h-3.5 w-3.5 text-sys-orange" aria-hidden />
              {metrics.leadsSemCampanha} lead(s) no período chegaram sem utm_id — não atribuíveis a campanha (tráfego orgânico/direto).
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
