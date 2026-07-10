"use client";

import {
  Bar,
  Cell,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Percent, Users, Target } from "lucide-react";

import { Card, StatCard } from "@/components/ui";
import type { FinanceiroMetrics } from "@/lib/financeiro-metrics";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

interface TooltipItem {
  name: string;
  value: number;
  color: string;
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2.5 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-muted-foreground">{item.name}:</span>
          <span className="font-medium text-foreground">{formatBRL(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function ResultadoView({ metrics }: { metrics: FinanceiroMetrics }) {
  const { dre, fluxo, resumo } = metrics;
  const resultadoPositivo = resumo.resultadoMes >= 0;

  return (
    <div className="space-y-4">
      {/* KPIs de resultado */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Resultado do mês"
          value={formatBRL(resumo.resultadoMes)}
          icon={resultadoPositivo ? TrendingUp : TrendingDown}
          accent={resultadoPositivo ? "green" : "red"}
          context="receita − custos"
        />
        <StatCard
          label="Margem líquida"
          value={`${resumo.margemLiquida}%`}
          icon={Percent}
          accent="burgundy"
          context="do mês corrente"
        />
        <StatCard
          label="Folha / receita"
          value={`${resumo.folhaPctReceita}%`}
          icon={Users}
          accent="blue"
          context={formatBRL(resumo.folhaMes)}
        />
        <StatCard
          label="Break-even"
          value={`${resumo.breakEvenContratos}`}
          icon={Target}
          accent="orange"
          context="contratos/mês p/ cobrir fixos"
        />
      </div>

      {/* DRE — últimos 6 meses */}
      <Card variant="plain" padding="none" className="overflow-hidden">
        <div className="border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">DRE — Resultado por mês</h2>
          <p className="text-xs text-muted-foreground">
            Receita recebida − folha (run-rate) − marketing − despesas − impostos
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-popover text-[10px] uppercase tracking-wider text-label-tertiary">
                <th className="py-2.5 pl-5 pr-3 text-left font-semibold">Mês</th>
                <th className="px-3 py-2.5 text-right font-semibold">Receita</th>
                <th className="px-3 py-2.5 text-right font-semibold">Folha</th>
                <th className="px-3 py-2.5 text-right font-semibold">Marketing</th>
                <th className="px-3 py-2.5 text-right font-semibold">Despesas</th>
                <th className="px-3 py-2.5 text-right font-semibold">Impostos</th>
                <th className="px-3 py-2.5 text-right font-semibold">Resultado</th>
                <th className="px-3 py-2.5 pr-5 text-right font-semibold">Margem</th>
              </tr>
            </thead>
            <tbody>
              {dre.map((m) => (
                <tr key={m.mes} className="border-b border-border/60 hover:bg-accent/50">
                  <td className="py-2.5 pl-5 pr-3 font-medium text-foreground">{m.label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{formatBRL(m.receita)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">−{formatBRL(m.folha)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">−{formatBRL(m.marketing)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">−{formatBRL(m.despesas)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">−{formatBRL(m.impostos)}</td>
                  <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${m.resultado >= 0 ? "text-sys-green" : "text-sys-red"}`}>
                    {formatBRL(m.resultado)}
                  </td>
                  <td className={`px-3 py-2.5 pr-5 text-right font-semibold tabular-nums ${m.margem >= 0 ? "text-sys-green" : "text-sys-red"}`}>
                    {m.margem}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Fluxo de caixa: entradas × saídas */}
      <Card variant="plain" padding="md">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-foreground">Fluxo de caixa</h2>
          <p className="text-xs text-muted-foreground">
            Entradas × saídas — últimos {dre.length} meses + 3 projetados (barras claras)
          </p>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={fluxo} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<ChartTip />} cursor={{ fill: "var(--fill-4)" }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} iconType="circle" iconSize={8} />
              <Bar dataKey="entradas" name="Entradas" fill="var(--sys-green)" radius={[3, 3, 0, 0]}>
                {fluxo.map((f) => (
                  <Cell key={`e-${f.mes}`} fillOpacity={f.projetado ? 0.4 : 1} />
                ))}
              </Bar>
              <Bar dataKey="saidas" name="Saídas" fill="var(--sys-red)" radius={[3, 3, 0, 0]}>
                {fluxo.map((f) => (
                  <Cell key={`s-${f.mes}`} fillOpacity={f.projetado ? 0.4 : 1} />
                ))}
              </Bar>
              <Line type="monotone" dataKey="saldo" name="Saldo" stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
