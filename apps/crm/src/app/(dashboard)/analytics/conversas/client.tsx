"use client";

import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MessageCircle,
  Clock,
  Reply,
  TrendingUp,
  AlertCircle,
  Timer,
} from "lucide-react";

import {
  PageHeader,
  StatCard,
  ChartCard,
  ChartTooltip,
  PeriodSelector,
  Card,
  EmptyState,
  chartAxisTick,
  CHART_GRID,
} from "@/components/ui";
import type {
  ConversaMetrics,
  ConversaPeriod,
  FunilAvancado,
  CadenciaPosReuniao,
  Distribuicao,
} from "@/lib/conversas-queries";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS = [
  { value: "7d" as const, label: "7 dias" },
  { value: "30d" as const, label: "30 dias" },
  { value: "90d" as const, label: "90 dias" },
  { value: "tudo" as const, label: "Tudo" },
];

const MIDIA_LABEL: Record<string, string> = {
  image: "Fotos",
  audio: "Áudios",
  video: "Vídeos",
  document: "Documentos",
  sticker: "Figurinhas",
  location: "Localizações",
  contact: "Contatos",
  reaction: "Reações",
  other: "Outros",
};

function fmtDuracaoMin(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return "<1 min";
  if (min < 60) return `${Math.round(min)} min`;
  const horas = min / 60;
  if (horas < 24) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} d`;
}

function fmtDias(dias: number | null): string {
  if (dias === null) return "—";
  if (dias < 1) return `${Math.round(dias * 24)} h`;
  return `${dias.toFixed(1)} d`;
}

function fmtDiaLabel(dia: string): string {
  // "2026-07-09" → "09/07"
  const [, m, d] = dia.split("-");
  return `${d}/${m}`;
}

function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

function fmtHoras(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function MetricaBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-label-tertiary">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-[10px] tabular-nums text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Barra de distribuição em HORAS (cadência) — p25–p75 + mediana. */
function BarraDistribuicaoHoras({ dist }: { dist: Distribuicao }) {
  if (dist.amostra === 0) return <span className="text-xs text-muted-foreground">sem dados</span>;
  const max = dist.p90 ?? dist.p75 ?? dist.p50 ?? 0;
  if (max <= 0) return <span className="text-xs text-muted-foreground">imediato (n={dist.amostra})</span>;
  const pos = (v: number | null) => (v === null ? 0 : Math.min(100, (v / max) * 100));
  return (
    <div className="space-y-1">
      <div className="relative h-2 rounded-full bg-secondary">
        <div
          className="absolute top-0 h-2 rounded-full bg-sys-green/30"
          style={{ left: `${pos(dist.p25)}%`, width: `${Math.max(2, pos(dist.p75) - pos(dist.p25))}%` }}
        />
        <div className="absolute top-[-2px] h-3 w-[2px] rounded bg-sys-green" style={{ left: `${pos(dist.p50)}%` }} />
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>p25 {fmtHoras(dist.p25)}</span>
        <span className="font-semibold text-foreground">med {fmtHoras(dist.p50)}</span>
        <span>p75 {fmtHoras(dist.p75)}</span>
        <span>p90 {fmtHoras(dist.p90)}</span>
      </div>
    </div>
  );
}

/** Barra de distribuição (p25–p90) para uma transição de tempo. */
function BarraDistribuicao({ dist }: { dist: Distribuicao }) {
  if (dist.amostra === 0) return <span className="text-xs text-muted-foreground">sem dados</span>;
  const max = dist.p90 ?? dist.p75 ?? dist.p50 ?? 0;
  if (max <= 0) {
    return <span className="text-xs text-muted-foreground">todas no mesmo dia (n={dist.amostra})</span>;
  }
  const pos = (v: number | null) => (v === null ? 0 : Math.min(100, (v / max) * 100));
  return (
    <div className="space-y-1">
      <div className="relative h-2 rounded-full bg-secondary">
        {/* faixa p25–p75 */}
        <div
          className="absolute top-0 h-2 rounded-full bg-primary/25"
          style={{ left: `${pos(dist.p25)}%`, width: `${Math.max(2, pos(dist.p75) - pos(dist.p25))}%` }}
        />
        {/* mediana */}
        <div
          className="absolute top-[-2px] h-3 w-[2px] rounded bg-primary"
          style={{ left: `${pos(dist.p50)}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>p25 {fmtDias(dist.p25)}</span>
        <span className="font-semibold text-foreground">med {fmtDias(dist.p50)}</span>
        <span>p75 {fmtDias(dist.p75)}</span>
        <span>p90 {fmtDias(dist.p90)}</span>
      </div>
    </div>
  );
}

export function ConversasClient({
  period,
  conversa,
  funil,
  cadencia,
}: {
  period: ConversaPeriod;
  conversa: ConversaMetrics;
  funil: FunilAvancado;
  cadencia: CadenciaPosReuniao;
}) {
  const router = useRouter();
  const semDados = conversa.totalMensagens === 0 && conversa.conversasAtivas === 0;

  const transicoesComDados = funil.transicoes.filter((t) => t.dist.amostra > 0);
  const maxEtapa = funil.etapas[0]?.total ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        dense
        eyebrow="Comercial"
        title="Conversas & Funil"
        description="Métricas do WhatsApp comercial e tempos do funil — dados desde a ativação do espelho."
        actions={
          <PeriodSelector
            options={PERIOD_OPTIONS}
            value={period}
            onChange={(v) => router.push(`/analytics/conversas?periodo=${v}`)}
          />
        }
      />

      {semDados ? (
        <Card>
          <EmptyState
            icon={MessageCircle}
            title="Sem mensagens no período"
            description="As métricas aparecem conforme o espelho do WhatsApp registra conversas. Ajuste o período ou aguarde novas mensagens."
          />
        </Card>
      ) : (
        <>
          {/* KPIs de conversa */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Mensagens"
              value={conversa.totalMensagens.toLocaleString("pt-BR")}
              context={`${conversa.enviadas.toLocaleString("pt-BR")} enviadas · ${conversa.recebidas.toLocaleString("pt-BR")} recebidas`}
              icon={MessageCircle}
              accent="brand"
            />
            <StatCard
              label="Conversas ativas"
              value={conversa.conversasAtivas.toLocaleString("pt-BR")}
              context="com mensagem no período"
              icon={TrendingUp}
              accent="blue"
            />
            <StatCard
              label="Nosso tempo de resposta"
              value={fmtDuracaoMin(conversa.nossaRespostaMedianaMin)}
              context={`mediana · média ${fmtDuracaoMin(conversa.nossaRespostaMediaMin)}`}
              icon={Reply}
              accent="green"
            />
            <StatCard
              label="Resposta do lead"
              value={fmtDuracaoMin(conversa.leadRespostaMedianaMin)}
              context={`mediana · média ${fmtDuracaoMin(conversa.leadRespostaMediaMin)}`}
              icon={Clock}
              accent="purple"
            />
          </div>

          {/* Volume por dia */}
          <ChartCard
            title="Volume de mensagens"
            subtitle="Enviadas vs. recebidas por dia (fuso de São Paulo)"
          >
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={conversa.volumePorDia}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="convEnviadas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--bau-blue)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--bau-blue)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="convRecebidas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--sys-green)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--sys-green)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis
                    dataKey="dia"
                    tick={chartAxisTick}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={fmtDiaLabel}
                    minTickGap={24}
                  />
                  <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                  <Tooltip
                    content={<ChartTooltip labelFormatter={(l) => fmtDiaLabel(String(l))} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="enviadas"
                    name="Enviadas"
                    stroke="var(--bau-blue)"
                    strokeWidth={2}
                    fill="url(#convEnviadas)"
                  />
                  <Area
                    type="monotone"
                    dataKey="recebidas"
                    name="Recebidas"
                    stroke="var(--sys-green)"
                    strokeWidth={2}
                    fill="url(#convRecebidas)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Funil — tempos com distribuição (percentis) */}
            <ChartCard
              title="Tempos do funil"
              subtitle="Distribuição por transição — barra = p25–p75, traço = mediana"
            >
              {transicoesComDados.length === 0 ? (
                <EmptyState
                  icon={Timer}
                  title="Sem transições no período"
                  description="Os tempos aparecem quando leads avançam pelas etapas."
                />
              ) : (
                <div className="space-y-3">
                  {transicoesComDados.map((t) => (
                    <div key={t.chave} className="space-y-1">
                      <div className="flex items-baseline justify-between">
                        <p className="text-xs font-medium text-foreground">{t.label}</p>
                        <span className="text-[10px] tabular-nums text-muted-foreground">
                          n={t.dist.amostra}
                        </span>
                      </div>
                      <BarraDistribuicao dist={t.dist} />
                    </div>
                  ))}
                </div>
              )}
            </ChartCard>

            {/* Mídia trocada */}
            <ChartCard title="Mídia trocada" subtitle="Enviada vs. recebida por tipo">
              {conversa.midiaPorTipo.length === 0 ? (
                <EmptyState
                  icon={MessageCircle}
                  title="Nenhuma mídia no período"
                  description="Fotos, áudios, vídeos e documentos aparecem aqui."
                />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={conversa.midiaPorTipo.map((m) => ({
                        tipo: MIDIA_LABEL[m.tipo] ?? m.tipo,
                        Enviadas: m.enviadas,
                        Recebidas: m.recebidas,
                      }))}
                      margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                      <XAxis dataKey="tipo" tick={chartAxisTick} axisLine={false} tickLine={false} />
                      <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
                      <Tooltip cursor={{ fill: "var(--secondary)" }} content={<ChartTooltip />} />
                      <Bar dataKey="Enviadas" fill="var(--bau-blue)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="Recebidas" fill="var(--sys-green)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Conversão entre etapas do pipeline */}
            <ChartCard
              title="Conversão entre etapas"
              subtitle="Deals que alcançaram cada marco + taxa de passagem"
            >
              {maxEtapa === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="Sem deals no período"
                  description="A conversão aparece conforme os deals avançam."
                />
              ) : (
                <div className="space-y-2">
                  {funil.etapas.map((e) => {
                    const largura = maxEtapa > 0 ? Math.max(3, (e.total / maxEtapa) * 100) : 0;
                    return (
                      <div key={e.chave}>
                        <div className="mb-0.5 flex items-baseline justify-between text-xs">
                          <span className="font-medium text-foreground">{e.label}</span>
                          <span className="tabular-nums text-muted-foreground">
                            <span className="font-semibold text-foreground">{e.total}</span>
                            {e.taxaDaAnterior !== null && (
                              <span
                                className={cn(
                                  "ml-1.5",
                                  e.taxaDaAnterior >= 0.5
                                    ? "text-sys-green"
                                    : e.taxaDaAnterior >= 0.25
                                      ? "text-sys-orange"
                                      : "text-sys-red",
                                )}
                              >
                                {pct(e.taxaDaAnterior)}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-gradient-brand"
                            style={{ width: `${largura}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ChartCard>

            {/* Cadência pós-reunião */}
            <ChartCard
              title="Cadência pós-reunião"
              subtitle="Follow-up do time após a reunião realizada"
            >
              {cadencia.amostraReunioes === 0 ? (
                <EmptyState
                  icon={Reply}
                  title="Sem reuniões no período"
                  description="Aparece quando há reuniões realizadas com follow-up registrado no espelho."
                />
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-foreground">
                      Reunião → 1º follow-up nosso (horas)
                    </p>
                    {cadencia.primeiroFollowupHoras.amostra > 0 ? (
                      <BarraDistribuicaoHoras dist={cadencia.primeiroFollowupHoras} />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Sem follow-up casado no espelho (telefone não encontrado).
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <MetricaBox
                      label="Toques até fechar"
                      value={
                        cadencia.toquesAteDecisaoMediana !== null
                          ? `${Math.round(cadencia.toquesAteDecisaoMediana)}`
                          : "—"
                      }
                      sub={`mensagens · ${cadencia.toquesAmostra} contratos`}
                    />
                    <MetricaBox
                      label="Reuniões"
                      value={cadencia.amostraReunioes.toLocaleString("pt-BR")}
                      sub="no período"
                    />
                  </div>
                </div>
              )}
            </ChartCard>
          </div>

          {/* Engajamento — estado ATUAL (all-time, não muda com o período) */}
          <div>
            <p className="mb-2 text-eyebrow text-label-tertiary">
              Engajamento (estado atual — todas as conversas)
            </p>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Aguardando resposta"
                value={conversa.aguardandoResposta.toLocaleString("pt-BR")}
                context="lead falou por último"
                icon={AlertCircle}
                accent="orange"
              />
              <StatCard
                label={`Paradas +${3}d`}
                value={conversa.paradas.toLocaleString("pt-BR")}
                context="sem mensagem recente"
                icon={Timer}
                accent="red"
              />
              <StatCard
                label="Taxa de resposta"
                value={pct(conversa.taxaResposta)}
                context="conversas com algum retorno"
                icon={Reply}
                accent="blue"
              />
              <StatCard
                label="Nunca responderam"
                value={conversa.nuncaResponderam.toLocaleString("pt-BR")}
                context="conversas sem retorno"
                icon={MessageCircle}
              />
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Cobre todas as conversas da linha comercial (não só leads qualificados); o número do
            CEO é excluído. Conversas são contadas por número — o WhatsApp novo pode dividir uma
            conversa em duas chaves (LID), então contagens de conversa são aproximadas. Histórico
            desde a ativação do espelho (sem dados anteriores).
            {(period === "7d" || period === "30d") && (
              <>
                {" "}
                Em janelas curtas os tempos/conversão do funil consideram só deals já concluídos na
                janela (coorte pode estar imatura) — veja o <span className="font-medium">n=</span> de
                cada transição. A cadência casa telefone por aproximação.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
