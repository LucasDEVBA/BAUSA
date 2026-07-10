"use client";

import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarCheck2,
  CalendarClock,
  RefreshCw,
  FileText,
  Timer,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  PageHeader,
  StatCard,
  ChartCard,
  ChartTooltip,
  PeriodSelector,
  chartAxisTick,
  CHART_GRID,
} from "@/components/ui";
import type { Distribuicao } from "@/lib/conversas-queries";
import type { ReunioesMetrics, ReunioesPeriod } from "@/lib/reunioes-queries";

const PERIOD_OPTIONS: { value: ReunioesPeriod; label: string }[] = [
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
  { value: "tudo", label: "Tudo" },
];

function fmtHoras(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function fmtSemana(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** Barra p25–p75 + mediana, rótulos em horas/dias. */
function BarraDistribuicaoHoras({ dist }: { dist: Distribuicao }) {
  if (dist.amostra === 0) return <span className="text-xs text-muted-foreground">sem dados</span>;
  const max = dist.p90 ?? dist.p75 ?? dist.p50 ?? 0;
  if (max <= 0)
    return <span className="text-xs text-muted-foreground">imediato (n={dist.amostra})</span>;
  const pos = (v: number | null) => (v === null ? 0 : Math.min(100, (v / max) * 100));
  return (
    <div className="space-y-1">
      <div className="relative h-2 rounded-full bg-secondary">
        <div
          className="absolute top-0 h-2 rounded-full bg-primary/25"
          style={{ left: `${pos(dist.p25)}%`, width: `${Math.max(2, pos(dist.p75) - pos(dist.p25))}%` }}
        />
        <div
          className="absolute top-[-2px] h-3 w-[2px] rounded bg-primary"
          style={{ left: `${pos(dist.p50)}%` }}
        />
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

function LinhaTempo({
  titulo,
  descricao,
  dist,
}: {
  titulo: string;
  descricao: string;
  dist: Distribuicao;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">{titulo}</p>
        <span className="text-[10px] tabular-nums text-muted-foreground">n={dist.amostra}</span>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">{descricao}</p>
      <BarraDistribuicaoHoras dist={dist} />
    </div>
  );
}

export function ReunioesClient({ metrics }: { metrics: ReunioesMetrics }) {
  const router = useRouter();

  const serie = metrics.porSemana.map((s) => ({
    semana: fmtSemana(s.semana),
    Agendadas: s.agendadas,
    Realizadas: s.realizadas,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        dense
        eyebrow="Analytics"
        title="Reuniões"
        description="Agendamentos, remarcações e tempos do ciclo de reunião."
        actions={
          <PeriodSelector
            options={PERIOD_OPTIONS}
            value={metrics.periodo}
            onChange={(v) => router.push(`/analytics/reunioes?periodo=${v}`)}
          />
        }
      />

      {/* KPIs do período */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Agendadas"
          value={metrics.agendadasPeriodo}
          icon={CalendarDays}
          accent="brand"
          context="1º agendamento no período"
        />
        <StatCard
          label="Realizadas"
          value={metrics.realizadasPeriodo}
          icon={CalendarCheck2}
          accent="green"
          context="reunião aconteceu"
        />
        <StatCard
          label="Remarcações"
          value={metrics.remarcacoesPeriodo}
          icon={RefreshCw}
          accent={metrics.remarcacoesPeriodo > 0 ? "orange" : "green"}
          context={
            metrics.taxaRemarcacaoPct !== null
              ? `${Math.round(metrics.taxaRemarcacaoPct)}% dos deals remarcam`
              : undefined
          }
        />
        <StatCard
          label="Próximas"
          value={metrics.proximasReunioes}
          icon={CalendarClock}
          accent="blue"
          context="com data futura"
        />
        <StatCard
          label="Transcrições"
          value={metrics.transcricoesPeriodo}
          icon={FileText}
          accent="purple"
          context="capturadas do Meet"
        />
        <StatCard
          label="Msg → agendou"
          value={fmtHoras(metrics.mensagemAteAgendar.p50)}
          icon={Timer}
          accent="brand"
          context="mediana no período"
        />
      </div>

      {/* Série semanal */}
      <ChartCard
        title="Reuniões por semana"
        subtitle="Agendadas (1º agendamento) × realizadas, por semana"
      >
        {serie.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Sem reuniões no período.
          </p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradAgendadas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradRealizadas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="semana" tick={chartAxisTick} tickLine={false} axisLine={false} />
                <YAxis tick={chartAxisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Agendadas"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#gradAgendadas)"
                />
                <Area
                  type="monotone"
                  dataKey="Realizadas"
                  stroke="var(--chart-5)"
                  strokeWidth={2}
                  fill="url(#gradRealizadas)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* Tempos do ciclo de reunião */}
      <ChartCard
        title="Tempos do ciclo de reunião"
        subtitle="Distribuições (faixa p25–p75, marca = mediana) dos deals com 1º agendamento no período"
      >
        <div className="grid gap-2.5 md:grid-cols-2">
          <LinhaTempo
            titulo="1º contato → agendamento"
            descricao="Do cadastro do lead até agendar a reunião."
            dist={metrics.contatoAteAgendar}
          />
          <LinhaTempo
            titulo="Mensagem → agendamento"
            descricao="Do 1º WhatsApp enviado até o lead agendar."
            dist={metrics.mensagemAteAgendar}
          />
          <LinhaTempo
            titulo="Antecedência da reunião"
            descricao="Ao agendar, para quando o lead marca a reunião."
            dist={metrics.antecedenciaReuniao}
          />
          <LinhaTempo
            titulo="1º agendamento → remarcação"
            descricao="Quando remarca, quanto tempo após o 1º agendamento."
            dist={metrics.agendamentoAteRemarcar}
          />
        </div>
      </ChartCard>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Remarcações vêm do audit trail dos deals (histórico de mudanças de reunião) — cobrem o
        período desde a ativação do trail. &ldquo;Realizadas&rdquo; usa a marcação de reunião
        realizada no pipeline; transcrições capturadas são um proxy independente.
      </p>
    </div>
  );
}
