"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/ui/ChartCard";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import type { FluxoDia } from "@/types/fluxo";
import { cn } from "@/lib/utils";

// Filtros (fluxo + período) por querystring — o server refaz a consulta.
export function MetricasClient({
  fluxos,
  fluxoAtivo,
  diasAtivo,
  periodos,
  serie,
}: {
  fluxos: Array<{ id: string; nome: string }>;
  fluxoAtivo: string | null;
  diasAtivo: number;
  periodos: number[];
  serie: FluxoDia[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navegar = (patch: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) params.set(k, v);
    router.push(`${pathname}?${params.toString()}`);
  };

  const dados = serie.map((d) => ({ ...d, label: d.dia.slice(8, 10) + "/" + d.dia.slice(5, 7) }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="fluxo-metricas">Fluxo</label>
        <select
          id="fluxo-metricas"
          value={fluxoAtivo ?? ""}
          onChange={(e) => navegar({ fluxo: e.target.value })}
          className="max-w-72 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {fluxos.map((f) => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </select>
        <div role="group" aria-label="Período" className="flex gap-1.5">
          {periodos.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => navegar({ dias: String(d) })}
              aria-pressed={diasAtivo === d}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                diasAtivo === d
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>

      <ChartCard title="Entradas × capturas por dia" subtitle="Quantos entraram no fluxo e quantos deixaram contato">
        {dados.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Sem execuções no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gCapturas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="entradas" name="Entradas" stroke="var(--chart-1)" fill="url(#gEntradas)" strokeWidth={2} />
              <Area type="monotone" dataKey="capturas" name="Capturas" stroke="var(--chart-5)" fill="url(#gCapturas)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
