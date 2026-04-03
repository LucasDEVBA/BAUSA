"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, DollarSign, Users, FileCheck, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RevenueMonth } from "@/types/revenue";
import { AnalyticsExportButton } from "@/components/analytics/AnalyticsExportButton";

// ─── Types ───────────────────────────────────────────────────────────────────

type Period = "30d" | "90d" | "6m" | "12m";

const PERIOD_MONTHS: Record<Period, number> = {
  "30d": 1,
  "90d": 3,
  "6m": 6,
  "12m": 12,
};

const PERIOD_LABELS: Record<Period, string> = {
  "30d": "Ultimos 30 dias",
  "90d": "Ultimos 90 dias",
  "6m": "Ultimos 6 meses",
  "12m": "Ultimos 12 meses",
};

// ─── Helpers ──��──────────────────────────────────────────────────────────────

function formatBrl(value: number): string {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value}`;
}

function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  delta?: number | null;
  compareEnabled: boolean;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

function KpiCard({ title, value, subtitle, delta, compareEnabled, icon: Icon, accent }: KpiCardProps) {
  const showDelta = compareEnabled && delta !== null && delta !== undefined;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#1e2130] bg-[#141720] p-4">
      <div className="flex items-center justify-between">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", accent)}>
          <Icon className="h-4 w-4" />
        </div>
        {showDelta && delta !== null && (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              delta > 0
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : delta < 0
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "border-zinc-600/30 bg-zinc-700/20 text-zinc-500"
            )}
          >
            {delta > 0 ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : delta < 0 ? (
              <TrendingDown className="h-2.5 w-2.5" />
            ) : (
              <Minus className="h-2.5 w-2.5" />
            )}
            {delta > 0 ? "+" : ""}{delta}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-100">{value}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{subtitle ?? title}</p>
      </div>
    </div>
  );
}

const CustomBarTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-semibold text-zinc-300">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: entry.color }} />
          {entry.name}: {formatBrl(entry.value)}
        </p>
      ))}
    </div>
  );
};

const CustomLineTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1.5 font-semibold text-zinc-300">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: {formatBrl(entry.value)}
        </p>
      ))}
    </div>
  );
};

// ─── Main client ─────────────────────────────────────────────────────────────

interface AnalyticsClientProps {
  revenueMonths: RevenueMonth[];
}

export function AnalyticsClient({ revenueMonths }: AnalyticsClientProps) {
  const [period, setPeriod] = useState<Period>("12m");
  const [compareEnabled, setCompareEnabled] = useState(false);

  const months = PERIOD_MONTHS[period];
  const allMonths = revenueMonths;

  const currentSlice = useMemo(
    () => allMonths.slice(Math.max(0, allMonths.length - months)),
    [allMonths, months]
  );

  const previousSlice = useMemo(
    () =>
      allMonths.slice(
        Math.max(0, allMonths.length - months * 2),
        Math.max(0, allMonths.length - months)
      ),
    [allMonths, months]
  );

  const sumField = (arr: RevenueMonth[], field: keyof RevenueMonth) =>
    arr.reduce((acc, m) => acc + (m[field] as number), 0);

  const cur = {
    contracted: sumField(currentSlice, "contracted_usd"),
    received: sumField(currentSlice, "received_usd"),
    families: sumField(currentSlice, "families_signed"),
    contracts: currentSlice.length,
  };

  const prev = {
    contracted: sumField(previousSlice, "contracted_usd"),
    received: sumField(previousSlice, "received_usd"),
    families: sumField(previousSlice, "families_signed"),
    contracts: previousSlice.length,
  };

  const barData = currentSlice.map((m, i) => ({
    month: m.month_label,
    Contratado: m.contracted_usd,
    Recebido: m.received_usd,
    ...(compareEnabled && previousSlice[i]
      ? {
          "Contratado (ant.)": previousSlice[i].contracted_usd,
          "Recebido (ant.)": previousSlice[i].received_usd,
        }
      : {}),
  }));

  const lineData = useMemo(() => {
    let cumCurrent = 0;
    let cumPrev = 0;
    const maxLen = Math.max(currentSlice.length, compareEnabled ? previousSlice.length : 0);

    return Array.from({ length: maxLen }, (_, i) => {
      const curMonth = currentSlice[i];
      const prv = previousSlice[i];
      if (curMonth) cumCurrent += curMonth.received_usd;
      if (prv && compareEnabled) cumPrev += prv.received_usd;

      return {
        idx: i + 1,
        label: curMonth?.month_label ?? `M${i + 1}`,
        "Acumulado atual": curMonth ? cumCurrent : undefined,
        ...(compareEnabled && prv ? { "Acumulado anterior": cumPrev } : {}),
      };
    });
  }, [currentSlice, previousSlice, compareEnabled]);

  const tableData = currentSlice.map((m) => ({
    label: m.month_label,
    contracted: m.contracted_usd,
    received: m.received_usd,
    families: m.families_signed,
    recvRate: m.contracted_usd > 0 ? Math.round((m.received_usd / m.contracted_usd) * 100) : 0,
  }));

  const bestMonth = tableData.length > 0
    ? tableData.reduce((best, m) => (m.received > best.received ? m : best), tableData[0])
    : { label: "—", received: 0 };
  const worstMonth = tableData.length > 0
    ? tableData.reduce((worst, m) => (m.received < worst.received ? m : worst), tableData[0])
    : { label: "—", received: 0 };
  const avgMonthly = tableData.length > 0 ? Math.round(cur.received / tableData.length) : 0;
  const overallRecvRate = cur.contracted > 0 ? Math.round((cur.received / cur.contracted) * 100) : 0;

  const PERIODS: Period[] = ["30d", "90d", "6m", "12m"];

  if (allMonths.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Analytics</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Sem dados financeiros registrados.</p>
        </div>
        <div className="text-center py-16">
          <BarChart2 className="h-12 w-12 mx-auto text-zinc-600 mb-4" />
          <p className="text-sm text-zinc-500">Os graficos aparecerão aqui quando houver contratos e parcelas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Analytics</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{PERIOD_LABELS[period]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AnalyticsExportButton revenueMonths={currentSlice} />
          <div className="flex items-center gap-1 rounded-lg border border-[#1e2130] bg-[#141720] p-1">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  period === p
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
                )}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCompareEnabled((v) => !v)}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
              compareEnabled
                ? "border-indigo-500/50 bg-indigo-600/20 text-indigo-300"
                : "border-[#1e2130] bg-[#141720] text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"
            )}
          >
            <span
              className={cn(
                "h-3.5 w-3.5 rounded-full border-2 transition-all",
                compareEnabled ? "border-indigo-400 bg-indigo-400" : "border-zinc-600 bg-transparent"
              )}
            />
            Comparar periodos
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          title="Receita Contratada"
          value={formatBrl(cur.contracted)}
          subtitle="Total contratado no periodo"
          delta={deltaPct(cur.contracted, prev.contracted)}
          compareEnabled={compareEnabled}
          icon={DollarSign}
          accent="bg-indigo-500/10 text-indigo-400"
        />
        <KpiCard
          title="Receita Recebida"
          value={formatBrl(cur.received)}
          subtitle={`Taxa de recebimento: ${overallRecvRate}%`}
          delta={deltaPct(cur.received, prev.received)}
          compareEnabled={compareEnabled}
          icon={BarChart2}
          accent="bg-emerald-500/10 text-emerald-400"
        />
        <KpiCard
          title="Familias Assinadas"
          value={String(cur.families)}
          subtitle="Novos contratos no periodo"
          delta={deltaPct(cur.families, prev.families)}
          compareEnabled={compareEnabled}
          icon={Users}
          accent="bg-purple-500/10 text-purple-400"
        />
        <KpiCard
          title="Media Mensal"
          value={formatBrl(avgMonthly)}
          subtitle="Receita recebida / mes"
          delta={null}
          compareEnabled={false}
          icon={TrendingUp}
          accent="bg-blue-500/10 text-blue-400"
        />
      </div>

      {/* Bar chart */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <p className="mb-4 text-sm font-semibold text-zinc-200">Contratado vs Recebido por mes</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} barSize={compareEnabled ? 8 : 14} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomBarTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
            {compareEnabled && (
              <>
                <Bar dataKey="Contratado (ant.)" fill="#3730a3" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Recebido (ant.)" fill="#065f46" radius={[3, 3, 0, 0]} />
              </>
            )}
            <Bar dataKey="Contratado" fill="#6366f1" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Recebido" fill="#10b981" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Line chart */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <p className="mb-4 text-sm font-semibold text-zinc-200">Receita Acumulada no periodo</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={lineData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
            <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomLineTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
            {compareEnabled && (
              <Line
                type="monotone"
                dataKey="Acumulado anterior"
                stroke="#6366f1"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="Acumulado atual"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#10b981" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Table + highlights */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-xl border border-[#1e2130] bg-[#141720]">
          <div className="border-b border-[#1e2130] px-5 py-3">
            <p className="text-sm font-semibold text-zinc-200">Detalhamento mensal</p>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#1e2130]">
                  {["Mes", "Contratado", "Recebido", "Familias", "Taxa recv."].map((h) => (
                    <th key={h} className="px-5 py-2.5 text-left font-medium text-zinc-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-[#1e2130]/50 transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-2.5 font-medium text-zinc-300">{row.label}</td>
                    <td className="px-5 py-2.5 text-indigo-400">{formatBrl(row.contracted)}</td>
                    <td className="px-5 py-2.5 text-emerald-400">{formatBrl(row.received)}</td>
                    <td className="px-5 py-2.5 text-zinc-400">{row.families}</td>
                    <td className="px-5 py-2.5">
                      <span
                        className={cn(
                          "font-semibold",
                          row.recvRate >= 90
                            ? "text-emerald-400"
                            : row.recvRate >= 70
                            ? "text-amber-400"
                            : "text-red-400"
                        )}
                      >
                        {row.recvRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600">
              Melhor mes
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-400">{bestMonth.label}</p>
            <p className="text-xs text-zinc-500">{formatBrl(bestMonth.received)} recebido</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-red-600">
              Pior mes
            </p>
            <p className="mt-1 text-lg font-bold text-red-400">{worstMonth.label}</p>
            <p className="text-xs text-zinc-500">{formatBrl(worstMonth.received)} recebido</p>
          </div>
          <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Taxa de recebimento
            </p>
            <p className="mt-1 text-lg font-bold text-zinc-100">{overallRecvRate}%</p>
            <p className="text-xs text-zinc-500">Recebido / contratado no periodo</p>
          </div>
          <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
              Media mensal
            </p>
            <p className="mt-1 text-lg font-bold text-zinc-100">{formatBrl(avgMonthly)}</p>
            <p className="text-xs text-zinc-500">Receita recebida por mes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
