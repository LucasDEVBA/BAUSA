import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageOff, Megaphone, Wallet, Users, CalendarCheck, HandCoins, Percent } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { fetchCampanhaMetrics, type CampanhaRoi } from "@/lib/cac-queries";
import {
  fetchCampanhaDetalhe,
  fetchLeadsCampanha,
  fetchSerieDiariaGasto,
  metaAdsConfigurado,
  MetaAdsError,
  resolverRange,
  type DiaGastoAds,
  type LeadCampanha,
} from "@/lib/meta-ads";
import { AcaoOrcamentoAds, AcaoStatusAds } from "@/components/ads/AcoesAds";
import { AdsStatusBadge, OBJETIVO_LABEL } from "@/components/ads/ads-labels";
import { metaAdsEscritaConfigurada } from "@/lib/meta-ads-escrita";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ScrollList } from "@/components/ui/ScrollList";
import { StatCard } from "@/components/ui/StatCard";
import { CampanhaDetalheClient } from "./client";

// /ads/campanha/[id] — tela de UMA campanha: hero com criativo, KPIs vida
// toda, ROI real (12m), série diária própria, conjuntos, anúncios e os
// LEADS que ela gerou (utm_id ↔ campanha_id).
export const dynamic = "force-dynamic";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const dataCurta = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const CLASSE_TONE: Record<string, "red" | "orange" | "blue"> = { QUENTE: "red", MORNO: "orange", FRIO: "blue" };

export default async function CampanhaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePapel("ceo");
  const { id } = await params;

  if (!metaAdsConfigurado()) notFound();

  let detalhe;
  try {
    detalhe = await fetchCampanhaDetalhe(id);
  } catch (e) {
    const msg = e instanceof MetaAdsError ? e.message : "Falha inesperada ao consultar a Meta.";
    return (
      <div className="space-y-4">
        <PageHeader title="Campanha" description="Detalhe da campanha" dense />
        <EmptyState icon={Megaphone} title="Não foi possível carregar a campanha" description={msg} />
      </div>
    );
  }
  if (!detalhe) notFound();

  // Enriquecimentos do nosso lado — cada um degrada sozinho, nunca mata a tela.
  const supabase = await createServerSupabaseClient();
  let serie: DiaGastoAds[] = [];
  let leads: LeadCampanha[] = [];
  let roi: CampanhaRoi | null = null;
  try {
    serie = await fetchSerieDiariaGasto(supabase, resolverRange({ periodo: "12m" }).range, id);
  } catch {
    serie = [];
  }
  try {
    leads = await fetchLeadsCampanha(supabase, id);
  } catch {
    leads = [];
  }
  try {
    const metrics = await fetchCampanhaMetrics("12m");
    roi = metrics.porCampanha.find((c) => c.campanhaId === id) ?? null;
  } catch {
    roi = null;
  }

  const objetivo = detalhe.objetivo ? (OBJETIVO_LABEL[detalhe.objetivo] ?? detalhe.objetivo) : null;
  const escrita = metaAdsEscritaConfigurada();

  return (
    <div className="space-y-5">
      <Link
        href="/ads"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Todas as campanhas
      </Link>

      {/* Hero — criativo + identidade */}
      <Card className="flex flex-col gap-4 overflow-hidden p-0 sm:flex-row">
        <div className="relative h-48 w-full shrink-0 overflow-hidden bg-secondary sm:h-auto sm:w-72">
          {detalhe.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- criativo do CDN da Meta (domínio variável)
            <img src={detalhe.thumbnailUrl} alt={`Criativo da campanha ${detalhe.nome}`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-48 w-full items-center justify-center bg-gradient-brand">
              <ImageOff className="h-10 w-10 text-white/60" aria-hidden />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <AdsStatusBadge status={detalhe.status} />
            {objetivo ? <Badge tone="blue">{objetivo}</Badge> : null}
            {detalhe.budgetDiario !== null ? <Badge tone="neutral">{brl.format(detalhe.budgetDiario)}/dia</Badge> : null}
            {detalhe.budgetTotal !== null ? <Badge tone="neutral">total {brl.format(detalhe.budgetTotal)}</Badge> : null}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 flex-1 text-lg font-bold leading-snug text-foreground">{detalhe.nome}</h1>
            {escrita ? (
              <div className="flex shrink-0 gap-2">
                <AcaoStatusAds objetoId={detalhe.id} nivel="campanha" nome={detalhe.nome} statusAtual={detalhe.status} />
                {detalhe.budgetDiario !== null ? (
                  <AcaoOrcamentoAds objetoId={detalhe.id} nivel="campanha" nome={detalhe.nome} orcamentoAtualBrl={detalhe.budgetDiario} />
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            Criada em {dataCurta(detalhe.criadaEm)}
            {detalhe.inicioEm ? ` · início ${dataCurta(detalhe.inicioEm)}` : ""}
            {detalhe.fimEm ? ` · fim ${dataCurta(detalhe.fimEm)}` : ""}
          </p>
          <div className="mt-auto grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Impressões (vida)</p>
              <p className="text-sm font-bold text-foreground">{compacto.format(detalhe.total.impressoes)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Cliques (vida)</p>
              <p className="text-sm font-bold text-foreground">{compacto.format(detalhe.total.cliques)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">CTR</p>
              <p className="text-sm font-bold text-foreground">{detalhe.total.ctr !== null ? `${detalhe.total.ctr.toFixed(2)}%` : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Frequência</p>
              <p className="text-sm font-bold text-foreground">{detalhe.total.frequencia !== null ? detalhe.total.frequencia.toFixed(1) : "—"}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* KPIs — Meta (vida toda) × Funil real (12m) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Gasto (vida toda)" value={brl.format(detalhe.total.gasto)} icon={Wallet} accent="burgundy" />
        <StatCard label="Leads reais (12m)" value={roi ? String(roi.leads) : "—"} context={roi ? `${roi.leadsQualificados} qualificados` : "sem cruzamento"} icon={Users} accent="green" />
        <StatCard label="Clientes (12m)" value={roi ? String(roi.clientes) : "—"} context={roi && roi.receita > 0 ? `receita ${brl.format(roi.receita)}` : undefined} icon={CalendarCheck} accent="blue" />
        <StatCard label="CAC por lead" value={roi?.cacLead !== null && roi?.cacLead !== undefined ? brl.format(roi.cacLead) : "—"} icon={HandCoins} accent="brand" />
        <StatCard
          label="ROI"
          value={roi?.roi !== null && roi?.roi !== undefined ? `${(roi.roi * 100).toFixed(0)}%` : "—"}
          context="(receita − gasto) / gasto"
          icon={Percent}
          accent={roi?.roi !== null && roi?.roi !== undefined && roi.roi >= 0 ? "green" : "red"}
        />
      </div>

      {/* Série diária da campanha (histórico próprio, 12m) */}
      <CampanhaDetalheClient serie={serie} />

      {/* Conjuntos + Anúncios */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card className="flex h-[26rem] flex-col p-5">
          <h2 className="shrink-0 text-sm font-bold text-foreground">Conjuntos de anúncios ({detalhe.conjuntos.length})</h2>
          {detalhe.conjuntos.length === 0 ? (
            <EmptyState title="Sem conjuntos" description="A campanha não tem conjuntos visíveis." />
          ) : (
            <ScrollList className="mt-3 divide-y divide-border" gutter={false}>
              {detalhe.conjuntos.map((cj) => (
                <div key={cj.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground" title={cj.nome}>{cj.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {cj.gasto30d > 0 ? `${brl.format(cj.gasto30d)} · ` : ""}
                      {compacto.format(cj.impressoes30d)} impr. · {compacto.format(cj.cliques30d)} cliques (30d)
                    </p>
                  </div>
                  {cj.budgetDiario !== null ? <Badge tone="neutral" size="sm">{brl.format(cj.budgetDiario)}/dia</Badge> : null}
                  <AdsStatusBadge status={cj.status} size="sm" />
                  {escrita ? (
                    <span className="flex gap-1">
                      <AcaoStatusAds objetoId={cj.id} nivel="conjunto" nome={cj.nome} statusAtual={cj.status} compacto />
                      {cj.budgetDiario !== null ? (
                        <AcaoOrcamentoAds objetoId={cj.id} nivel="conjunto" nome={cj.nome} orcamentoAtualBrl={cj.budgetDiario} />
                      ) : null}
                    </span>
                  ) : null}
                </div>
              ))}
            </ScrollList>
          )}
        </Card>

        <Card className="flex h-[26rem] flex-col p-5">
          <h2 className="shrink-0 text-sm font-bold text-foreground">Anúncios ({detalhe.anuncios.length})</h2>
          {detalhe.anuncios.length === 0 ? (
            <EmptyState title="Sem anúncios" description="A campanha não tem anúncios visíveis." />
          ) : (
            <ScrollList className="mt-3 divide-y divide-border" gutter={false}>
              {detalhe.anuncios.map((an) => (
                <div key={an.id} className="flex items-center gap-3 py-2.5">
                  {an.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- criativo do CDN da Meta
                    <img src={an.thumbnailUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand">
                      <ImageOff className="h-4 w-4 text-white/60" aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground" title={an.nome}>{an.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {an.gasto30d > 0 ? `${brl.format(an.gasto30d)} · ` : ""}
                      {compacto.format(an.impressoes30d)} impr. · {compacto.format(an.cliques30d)} cliques
                      {an.ctr30d !== null ? ` · CTR ${an.ctr30d.toFixed(2)}%` : ""} (30d)
                    </p>
                  </div>
                  <AdsStatusBadge status={an.status} size="sm" />
                  {escrita ? <AcaoStatusAds objetoId={an.id} nivel="anuncio" nome={an.nome} statusAtual={an.status} compacto /> : null}
                </div>
              ))}
            </ScrollList>
          )}
        </Card>
      </div>

      {/* Leads gerados por esta campanha */}
      <Card className="flex h-[24rem] flex-col p-5">
        <h2 className="shrink-0 text-sm font-bold text-foreground">
          Leads desta campanha {leads.length > 0 ? `(${leads.length}${leads.length === 50 ? "+" : ""})` : ""}
        </h2>
        {leads.length === 0 ? (
          <EmptyState title="Nenhum lead atribuído" description="Nenhum formulário chegou com o utm_id desta campanha." />
        ) : (
          <ScrollList className="mt-3 divide-y divide-border" gutter={false}>
            {leads.map((l, i) => (
              <div key={`${l.nome}-${i}`} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{l.nome}</p>
                  <p className="text-[11px] text-muted-foreground">{dataCurta(l.submetidoEm)}</p>
                </div>
                {l.reuniao ? <Badge tone="green" size="sm">Reunião</Badge> : null}
                {l.classe ? <Badge tone={CLASSE_TONE[l.classe] ?? "neutral"} size="sm">{l.classe}</Badge> : null}
              </div>
            ))}
          </ScrollList>
        )}
      </Card>
    </div>
  );
}
