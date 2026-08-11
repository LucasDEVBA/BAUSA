"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard, ChartTooltip } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BreakdownLinha, DiaGastoAds } from "@/lib/meta-ads";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const GENERO_LABEL: Record<string, string> = { male: "Masculino", female: "Feminino", unknown: "Não informado" };
const PLATAFORMA_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  audience_network: "Audience Network",
  messenger: "Messenger",
};
const CHART_VARS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"] as const;

const fmtDia = (d: string): string => {
  const [, m, dd] = d.split("-");
  return `${dd}/${m}`;
};

export function DesempenhoClient({
  serie,
  idade,
  genero,
  plataforma,
}: {
  serie: DiaGastoAds[];
  idade: BreakdownLinha[];
  genero: BreakdownLinha[];
  plataforma: BreakdownLinha[];
}) {
  const idadeOrdenada = [...idade].sort((a, b) => a.chave.localeCompare(b.chave));
  const plataformaComGasto = plataforma.filter((p) => p.gasto > 0);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartCard title="Gasto diário" subtitle="Soma de todas as campanhas (fonte: sync interno)" className="xl:col-span-2">
        {serie.length === 0 ? (
          <EmptyState title="Sem gasto no período" description="Nenhum dia com investimento nos últimos 90 dias." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gastoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={fmtDia} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickFormatter={(v: number) => brl.format(v)} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} width={86} />
                <Tooltip
                  content={<ChartTooltip labelFormatter={(l) => (typeof l === "string" ? fmtDia(l) : l)} valueFormatter={(v) => brl.format(Number(v))} />}
                />
                <Area type="monotone" dataKey="gasto" name="Gasto" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gastoFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Gasto por faixa etária" subtitle="Últimos 90 dias">
        {idadeOrdenada.length === 0 ? (
          <EmptyState title="Sem dados demográficos" description="A Meta ainda não retornou breakdown por idade." />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={idadeOrdenada} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="chave" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v: number) => brl.format(v)} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} width={86} />
                <Tooltip content={<ChartTooltip valueFormatter={(v) => brl.format(Number(v))} />} />
                <Bar dataKey="gasto" name="Gasto" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Gasto por gênero e plataforma" subtitle="Últimos 90 dias">
        <div className="grid h-56 grid-cols-2 items-center">
          <div className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={genero} dataKey="gasto" nameKey="chave" innerRadius="55%" outerRadius="80%" paddingAngle={3} strokeWidth={0}>
                  {genero.map((g, i) => (
                    <Cell key={g.chave} fill={`var(${CHART_VARS[i % CHART_VARS.length]})`} />
                  ))}
                </Pie>
                <Tooltip
                  content={<ChartTooltip hideLabel valueFormatter={(v, n) => `${GENERO_LABEL[n ?? ""] ?? n}: ${brl.format(Number(v))}`} />}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-2 text-xs">
            {genero.map((g, i) => (
              <li key={g.chave} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: `var(${CHART_VARS[i % CHART_VARS.length]})` }} aria-hidden />
                <span className="text-muted-foreground">{GENERO_LABEL[g.chave] ?? g.chave}</span>
                <span className="ml-auto font-semibold text-foreground">{brl.format(g.gasto)}</span>
              </li>
            ))}
            {plataformaComGasto.length > 0 && (
              <li className="border-t border-border pt-2 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
                Plataformas
              </li>
            )}
            {plataformaComGasto.map((p) => (
              <li key={p.chave} className="flex items-center gap-2">
                <span className="text-muted-foreground">{PLATAFORMA_LABEL[p.chave] ?? p.chave}</span>
                <span className="ml-auto font-semibold text-foreground">{brl.format(p.gasto)}</span>
              </li>
            ))}
          </ul>
        </div>
      </ChartCard>
    </div>
  );
}
