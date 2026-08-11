import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageOff, Megaphone, Wallet, Users, CalendarCheck, HandCoins, Percent } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { fetchCampanhaMetrics, type CampanhaRoi } from "@/lib/cac-queries";
import {
  fetchBreakdown,
  fetchCampanhaDetalhe,
  fetchLeadsCampanha,
  fetchSerieDiariaGasto,
  gasto7dDaSerie,
  metaAdsConfigurado,
  MetaAdsError,
  resolverRange,
  type BreakdownLinha,
  type DiaGastoAds,
  type LeadCampanha,
  type PublicoAlvo,
} from "@/lib/meta-ads";
import { AcaoOrcamentoAds, AcaoStatusAds } from "@/components/ads/AcoesAds";
import { AdsStatusBadge, OBJETIVO_LABEL, VeiculacaoBadge } from "@/components/ads/ads-labels";
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
const GENERO_LABEL: Record<string, string> = { male: "Masculino", female: "Feminino", unknown: "Não informado" };
const PLATAFORMA_LABEL: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", audience_network: "Audience Network", messenger: "Messenger" };

/** Resumo de público em uma linha: "18–65 · Todos · Brasil · Instagram" */
function resumoPublico(p: PublicoAlvo): string {
  const partes: string[] = [];
  if (p.idadeMin !== null || p.idadeMax !== null) partes.push(`${p.idadeMin ?? "?"}–${p.idadeMax ?? "?"} anos`);
  partes.push(p.generos);
  if (p.locais.length > 0) partes.push(p.locais.slice(0, 3).join(", ") + (p.locais.length > 3 ? "…" : ""));
  if (p.plataformas.length > 0) partes.push(p.plataformas.map((x) => PLATAFORMA_LABEL[x] ?? x).join(", "));
  return partes.join(" · ");
}

/** Barras horizontais server-rendered (sem lib de chart) p/ demografia. */
function BarrasBreakdown({ titulo, linhas, rotulo }: { titulo: string; linhas: BreakdownLinha[]; rotulo?: Record<string, string> }) {
  const max = Math.max(...linhas.map((l) => l.gasto), 0);
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">{titulo}</p>
      {linhas.length === 0 || max <= 0 ? (
        <p className="text-xs text-muted-foreground">Sem dados da Meta para este recorte.</p>
      ) : (
        <ul className="space-y-1.5">
          {linhas.map((l) => (
            <li key={l.chave} className="flex items-center gap-2 text-xs">
              <span className="w-24 shrink-0 truncate text-muted-foreground">{rotulo?.[l.chave] ?? l.chave}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <span
                  className="block h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.max(2, Math.round((l.gasto / max) * 100))}%` }}
                />
              </span>
              <span className="w-20 shrink-0 text-right font-semibold text-foreground">{brl.format(l.gasto)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  let demoIdade: BreakdownLinha[] = [];
  let demoGenero: BreakdownLinha[] = [];
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
  // Demografia DESTA campanha (vida toda) — enriquecimento, degrada sozinho
  try {
    [demoIdade, demoGenero] = await Promise.all([
      fetchBreakdown("age", "maximum", id),
      fetchBreakdown("gender", "maximum", id),
    ]);
  } catch {
    demoIdade = [];
    demoGenero = [];
  }

  // Gasto 7d do NOSSO histórico → badge de veiculação (Ativa ≠ entregando)
  const gasto7d = gasto7dDaSerie(serie);

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
            <VeiculacaoBadge status={detalhe.status} fimEm={detalhe.fimEm} gasto7d={gasto7d} />
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
            {[
              { label: "Impressões (vida)", valor: compacto.format(detalhe.total.impressoes) },
              { label: "Alcance", valor: detalhe.total.alcance !== null ? compacto.format(detalhe.total.alcance) : "—" },
              { label: "Cliques (vida)", valor: compacto.format(detalhe.total.cliques) },
              { label: "Cliques no link", valor: detalhe.total.cliquesLink !== null ? compacto.format(detalhe.total.cliquesLink) : "—" },
              { label: "CTR", valor: detalhe.total.ctr !== null ? `${detalhe.total.ctr.toFixed(2)}%` : "—" },
              { label: "CPM", valor: detalhe.total.cpm !== null ? brl.format(detalhe.total.cpm) : "—" },
              { label: "CPC", valor: detalhe.total.cpc !== null ? brl.format(detalhe.total.cpc) : "—" },
              { label: "Frequência", valor: detalhe.total.frequencia !== null ? detalhe.total.frequencia.toFixed(1) : "—" },
            ].map((m) => (
              <div key={m.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">{m.label}</p>
                <p className="text-sm font-bold text-foreground">{m.valor}</p>
              </div>
            ))}
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

      {/* Quem esta campanha atingiu — demografia real da Meta (vida toda) */}
      {demoIdade.length > 0 || demoGenero.length > 0 ? (
        <Card className="p-5">
          <h2 className="text-sm font-bold text-foreground">Quem foi atingido (gasto por segmento, vida toda)</h2>
          <div className="mt-3 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <BarrasBreakdown titulo="Por idade" linhas={[...demoIdade].sort((a, b) => a.chave.localeCompare(b.chave))} />
            <BarrasBreakdown titulo="Por gênero" linhas={demoGenero} rotulo={GENERO_LABEL} />
          </div>
        </Card>
      ) : null}

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
                      {cj.gastoVida > 0 ? `${brl.format(cj.gastoVida)} · ` : ""}
                      {compacto.format(cj.impressoesVida)} impr. · {compacto.format(cj.cliquesVida)} cliques
                      {cj.alcanceVida !== null ? ` · alcance ${compacto.format(cj.alcanceVida)}` : ""} (vida toda)
                    </p>
                    {cj.publico ? (
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="truncate" title={resumoPublico(cj.publico)}>🎯 {resumoPublico(cj.publico)}</span>
                        {cj.publico.advantage ? (
                          <Badge tone="blue" size="sm" title="Advantage+ audience: a Meta expande o público automaticamente">Advantage+</Badge>
                        ) : null}
                        {cj.publico.publicosCustom.length > 0 ? (
                          <Badge tone="purple" size="sm" title={cj.publico.publicosCustom.join(", ")}>
                            {cj.publico.publicosCustom.length} público(s) custom
                          </Badge>
                        ) : null}
                        {cj.publico.interesses.length > 0 ? (
                          <span className="truncate text-label-tertiary" title={cj.publico.interesses.join(", ")}>
                            interesses: {cj.publico.interesses.slice(0, 3).join(", ")}{cj.publico.interesses.length > 3 ? "…" : ""}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
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
                      {an.gastoVida > 0 ? `${brl.format(an.gastoVida)} · ` : ""}
                      {compacto.format(an.impressoesVida)} impr. · {compacto.format(an.cliquesVida)} cliques
                      {an.ctrVida !== null ? ` · CTR ${an.ctrVida.toFixed(2)}%` : ""} (vida toda)
                    </p>
                    {/* Auditoria de destino + UTM — onde a atribuição nasce ou morre */}
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {an.linkDestino ? (
                        <>
                          <span className="truncate text-muted-foreground" title={an.linkDestino}>
                            → {an.linkDestino.replace(/^https?:\/\//, "").slice(0, 48)}
                          </span>
                          {an.urlTags?.includes("utm_id=") ? (
                            <Badge tone="green" size="sm">UTM ✓</Badge>
                          ) : (
                            <Badge tone="red" size="sm">SEM UTM — lead não atribui</Badge>
                          )}
                        </>
                      ) : (
                        <Badge tone="neutral" size="sm" title="Boost de post: o link mora no post orgânico do Instagram — sem URL própria, sem UTM">
                          Post orgânico (sem link próprio)
                        </Badge>
                      )}
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
