"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard, ChartTooltip } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DiaGastoAds } from "@/lib/meta-ads";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const fmtDia = (d: string): string => {
  const [, m, dd] = d.split("-");
  return `${dd}/${m}`;
};

export function CampanhaDetalheClient({ serie }: { serie: DiaGastoAds[] }) {
  return (
    <ChartCard title="Gasto diário desta campanha" subtitle="Últimos 12 meses (fonte: sync interno)">
      {serie.length === 0 ? (
        <EmptyState title="Sem gasto registrado" description="Nenhum dia com investimento nesta campanha nos últimos 12 meses." />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gastoCampanhaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="dia" tickFormatter={fmtDia} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis tickFormatter={(v: number) => brl.format(v)} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} width={86} />
              <Tooltip content={<ChartTooltip labelFormatter={(l) => (typeof l === "string" ? fmtDia(l) : l)} valueFormatter={(v) => brl.format(Number(v))} />} />
              <Area type="monotone" dataKey="gasto" name="Gasto" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gastoCampanhaFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
