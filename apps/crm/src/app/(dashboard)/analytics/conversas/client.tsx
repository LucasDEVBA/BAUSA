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
  FunilTiming,
} from "@/lib/conversas-queries";

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

export function ConversasClient({
  period,
  conversa,
  funil,
}: {
  period: ConversaPeriod;
  conversa: ConversaMetrics;
  funil: FunilTiming;
}) {
  const router = useRouter();
  const semDados = conversa.totalMensagens === 0 && conversa.conversasAtivas === 0;

  const funilData = funil.etapas
    .filter((e) => e.medianaDias !== null)
    .map((e) => ({ label: e.label, dias: e.medianaDias as number, amostra: e.amostra }));

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
            {/* Funil — tempos */}
            <ChartCard
              title="Tempos do funil"
              subtitle="Mediana de dias por transição"
            >
              {funilData.length === 0 ? (
                <EmptyState
                  icon={Timer}
                  title="Sem transições no período"
                  description="Os tempos aparecem quando leads avançam pelas etapas."
                />
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={funilData}
                      layout="vertical"
                      margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={chartAxisTick}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => `${v}d`}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        tick={chartAxisTick}
                        axisLine={false}
                        tickLine={false}
                        width={150}
                      />
                      <Tooltip
                        cursor={{ fill: "var(--secondary)" }}
                        content={
                          <ChartTooltip
                            valueFormatter={(v) =>
                              typeof v === "number" ? `${v.toFixed(1)} dias` : String(v)
                            }
                          />
                        }
                      />
                      <Bar dataKey="dias" name="Mediana" fill="var(--bau-blue)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Ciclo total (1º contato → contrato):{" "}
                <span className="font-semibold text-foreground">
                  {fmtDias(funil.cicloMedianaDias)}
                </span>{" "}
                {funil.cicloAmostra > 0 && `(${funil.cicloAmostra} contrato${funil.cicloAmostra > 1 ? "s" : ""})`}
              </p>
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
          </p>
        </>
      )}
    </div>
  );
}
