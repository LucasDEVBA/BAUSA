"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  DollarSign,
  Users,
  Flame,
  Trophy,
  TrendingUp,
  Trash2,
  Plus,
  Info,
} from "lucide-react";
import { toast } from "sonner";

import { MetricCard } from "@/components/dashboard/MetricCard";
import {
  salvarInvestimento,
  deletarInvestimento,
} from "@/lib/actions/investimentos";
import type { CacMetrics, Period } from "@/lib/cac-queries";
import type { InvestimentoRow } from "./page";

// ─── Helpers ────────────────────────────────────────────────────────────

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const brlExact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function money(value: number | null): string {
  return value == null ? "—" : brl.format(value);
}

const PERIODS: { value: Period; label: string }[] = [
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "6m", label: "6 meses" },
  { value: "12m", label: "12 meses" },
];

const CANAIS = [
  "instagram",
  "facebook",
  "google",
  "meta",
  "tiktok",
  "youtube",
  "outro",
] as const;

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)", "var(--sys-blue)", "var(--chart-4)", "var(--sys-orange)"];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover shadow-lg px-3 py-2 text-xs">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {brlExact.format(entry.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────

export function CacClient({
  metrics,
  period,
  lancamentos,
}: {
  metrics: CacMetrics;
  period: Period;
  lancamentos: InvestimentoRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    mes: new Date().toISOString().slice(0, 7),
    canal: "instagram",
    valor_gasto: "",
    impressoes: "",
    cliques: "",
    leads_gerados: "",
  });

  function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await salvarInvestimento({
        mes: form.mes,
        canal: form.canal as (typeof CANAIS)[number],
        valor_gasto: form.valor_gasto,
        impressoes: form.impressoes || undefined,
        cliques: form.cliques || undefined,
        leads_gerados: form.leads_gerados || undefined,
      });
      if (result.success) {
        toast.success("Gasto registrado");
        setForm((f) => ({ ...f, valor_gasto: "", impressoes: "", cliques: "", leads_gerados: "" }));
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao salvar");
      }
    });
  }

  function handleDeletar(id: string) {
    startTransition(async () => {
      const result = await deletarInvestimento(id);
      if (result.success) {
        toast.success("Gasto removido");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao remover");
      }
    });
  }

  const roiData = metrics.roiPorCanal.filter((r) => r.gasto > 0);
  const trendData = metrics.porMes.map((m) => ({ mes: m.mes, gasto: m.gasto }));

  return (
    <div className="space-y-4">
      {/* Header + período */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title-2 text-foreground">CAC / ROI</h1>
          <p className="text-sm text-muted-foreground">
            Custo de aquisição e retorno por canal — período selecionado
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => router.push(`/analytics/cac?period=${p.value}`)}
              className={
                p.value === period
                  ? "rounded-md bg-primary/15 px-3 py-1 text-xs font-medium text-foreground"
                  : "rounded-md px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Gasto Total"
          value={money(metrics.gastoTotal)}
          subtitle={`${metrics.porCanal.length} canal(is) no período`}
          icon={DollarSign}
          variant="default"
        />
        <MetricCard
          title="CAC por Lead"
          value={money(metrics.cacLead)}
          subtitle={
            metrics.totalLeads > 0
              ? `${metrics.totalLeads} leads`
              : "sem leads no período"
          }
          icon={Users}
          variant="cold"
        />
        <MetricCard
          title="CAC Lead Qualificado"
          value={money(metrics.cacLeadQualificado)}
          subtitle={
            metrics.leadsQualificados > 0
              ? `${metrics.leadsQualificados} QUENTE+MORNO`
              : "sem qualificados"
          }
          icon={Flame}
          variant="warm"
        />
        <MetricCard
          title="CAC por Cliente"
          value={money(metrics.cacCliente)}
          subtitle={
            metrics.clientes > 0
              ? `${metrics.clientes} contrato(s)`
              : "sem contratos"
          }
          icon={Trophy}
          variant="hot"
        />
      </div>

      {/* ROI por canal */}
      <section className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">ROI por canal</h2>
          <span className="flex items-center gap-1 rounded-full border border-sys-orange/30 bg-sys-orange/10 px-2 py-0.5 text-[10px] font-medium text-sys-orange">
            <Info className="h-3 w-3" />
            atribuição aproximada
          </span>
        </div>
        {roiData.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Registre gastos abaixo para ver o ROI por canal.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={roiData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="canal" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "var(--fill-4)" }}
              />
              <Bar dataKey="gasto" name="Gasto" radius={[4, 4, 0, 0]}>
                {roiData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
              <Bar
                dataKey="receitaEstimada"
                name="Receita estimada"
                radius={[4, 4, 0, 0]}
                fill="var(--chart-2)"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
        {roiData.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            {roiData.map((r) => (
              <span key={r.canal}>
                <span className="text-foreground">{r.canal}</span>:{" "}
                {r.roi == null ? (
                  "—"
                ) : (
                  <span
                    className={r.roi >= 0 ? "text-sys-green" : "text-sys-red"}
                  >
                    {(r.roi * 100).toFixed(0)}% ROI
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Tendência de gasto */}
      <section className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          Tendência de gasto mensal
        </h2>
        {trendData.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Sem dados de gasto no período.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="mes" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: "var(--border)" }}
              />
              <Line
                type="monotone"
                dataKey="gasto"
                name="Gasto"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Registrar gasto manual */}
      <section className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Plus className="h-4 w-4" />
          Registrar gasto manual
        </h2>
        <form
          onSubmit={handleSalvar}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Mês
            <input
              type="month"
              required
              value={form.mes}
              onChange={(e) => setForm({ ...form, mes: e.target.value })}
              className="rounded-md border border-border bg-popover px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Canal
            <select
              value={form.canal}
              onChange={(e) => setForm({ ...form, canal: e.target.value })}
              className="rounded-md border border-border bg-popover px-2 py-1.5 text-sm text-foreground"
            >
              {CANAIS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Gasto (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.valor_gasto}
              onChange={(e) => setForm({ ...form, valor_gasto: e.target.value })}
              className="rounded-md border border-border bg-popover px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Impressões
            <input
              type="number"
              min="0"
              value={form.impressoes}
              onChange={(e) => setForm({ ...form, impressoes: e.target.value })}
              className="rounded-md border border-border bg-popover px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Cliques
            <input
              type="number"
              min="0"
              value={form.cliques}
              onChange={(e) => setForm({ ...form, cliques: e.target.value })}
              className="rounded-md border border-border bg-popover px-2 py-1.5 text-sm text-foreground"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </form>

        {/* Tabela de lançamentos */}
        {lancamentos.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Mês</th>
                  <th className="py-2 pr-4 font-medium">Canal</th>
                  <th className="py-2 pr-4 font-medium">Gasto</th>
                  <th className="py-2 pr-4 font-medium">Origem</th>
                  <th className="py-2 pr-4 font-medium" />
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => (
                  <tr
                    key={l.id}
                    className="border-b border-border/50 text-foreground"
                  >
                    <td className="py-2 pr-4 tabular-nums">
                      {String(l.mes).slice(0, 7)}
                    </td>
                    <td className="py-2 pr-4">{l.canal}</td>
                    <td className="py-2 pr-4 tabular-nums">
                      {brlExact.format(Number(l.valor_gasto))}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                        {l.source === "meta_api" ? "auto (Meta)" : "manual"}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {l.source === "manual" && (
                        <button
                          onClick={() => handleDeletar(l.id)}
                          disabled={isPending}
                          className="text-muted-foreground transition hover:text-sys-red disabled:opacity-50"
                          aria-label="Remover lançamento"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="flex items-center gap-1.5 text-xs text-label-tertiary">
        <TrendingUp className="h-3 w-3" />
        ROI por canal é aproximado (taxa de conversão global × ticket médio).
        ROI exato por campanha chega na Fase 2 (integração Meta Marketing API).
      </p>
    </div>
  );
}
