"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard, ChartTooltip } from "@/components/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import type { BreakdownLinha, DiaGastoAds, DiaLeads, TopCampanha } from "@/lib/meta-ads";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

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

const eixoTexto = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

interface DiaCombinado extends DiaGastoAds {
  ctr: number | null;
  cpm: number | null;
  leads: number;
  cpl: number | null;
}

export function DesempenhoClient({
  serie,
  top,
  leadsDia,
  idade,
  genero,
  plataforma,
}: {
  serie: DiaGastoAds[];
  top: TopCampanha[];
  leadsDia: DiaLeads[];
  idade: BreakdownLinha[];
  genero: BreakdownLinha[];
  plataforma: BreakdownLinha[];
}) {
  const leadsPorDia = new Map(leadsDia.map((l) => [l.dia, l.leads]));
  const combinada: DiaCombinado[] = serie.map((d) => {
    const leads = leadsPorDia.get(d.dia) ?? 0;
    return {
      ...d,
      ctr: d.impressoes > 0 ? (d.cliques / d.impressoes) * 100 : null,
      cpm: d.impressoes > 0 ? (d.gasto / d.impressoes) * 1000 : null,
      leads,
      cpl: leads > 0 && d.gasto > 0 ? d.gasto / leads : null,
    };
  });
  const idadeOrdenada = [...idade].sort((a, b) => a.chave.localeCompare(b.chave));
  const plataformaComGasto = plataforma.filter((p) => p.gasto > 0);
  const topNomeCurto = top.map((t) => ({ ...t, nomeCurto: t.nome.length > 34 ? `${t.nome.slice(0, 34)}…` : t.nome }));

  const vazio = serie.length === 0;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <ChartCard title="Gasto diário" subtitle="Soma de todas as campanhas (fonte: sync interno)" className="xl:col-span-2">
        {vazio ? (
          <EmptyState title="Sem gasto no período" description="Nenhum dia com investimento no intervalo escolhido." />
        ) : (
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinada} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gastoFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={fmtDia} tick={eixoTexto} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tickFormatter={(v: number) => brl.format(v)} tick={eixoTexto} tickLine={false} axisLine={false} width={86} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => (typeof l === "string" ? fmtDia(l) : l)} valueFormatter={(v) => brl.format(Number(v))} />} />
                <Area type="monotone" dataKey="gasto" name="Gasto" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gastoFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Leads do funil × CPL diário" subtitle="Leads com utm_id de campanha; CPL = gasto do dia ÷ leads do dia">
        {vazio ? (
          <EmptyState title="Sem dados" description="Sem gasto no período." />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={combinada} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={fmtDia} tick={eixoTexto} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis yAxisId="leads" allowDecimals={false} tick={eixoTexto} tickLine={false} axisLine={false} width={30} />
                <YAxis yAxisId="cpl" orientation="right" tickFormatter={(v: number) => brl.format(v)} tick={eixoTexto} tickLine={false} axisLine={false} width={80} />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => (typeof l === "string" ? fmtDia(l) : l)}
                      valueFormatter={(v, n) => (n === "CPL" ? brl.format(Number(v)) : String(v))}
                    />
                  }
                />
                <Bar yAxisId="leads" dataKey="leads" name="Leads" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="cpl" type="monotone" dataKey="cpl" name="CPL" stroke="var(--chart-2)" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Cliques e impressões" subtitle="Volume diário">
        {vazio ? (
          <EmptyState title="Sem dados" description="Sem gasto no período." />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinada} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={fmtDia} tick={eixoTexto} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis yAxisId="cliques" tickFormatter={(v: number) => compacto.format(v)} tick={eixoTexto} tickLine={false} axisLine={false} width={44} />
                <YAxis yAxisId="impr" orientation="right" tickFormatter={(v: number) => compacto.format(v)} tick={eixoTexto} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<ChartTooltip labelFormatter={(l) => (typeof l === "string" ? fmtDia(l) : l)} valueFormatter={(v) => compacto.format(Number(v))} />} />
                <Line yAxisId="cliques" type="monotone" dataKey="cliques" name="Cliques" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                <Line yAxisId="impr" type="monotone" dataKey="impressoes" name="Impressões" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="CTR e CPM diários" subtitle="Qualidade do criativo (CTR) × custo de mídia (CPM)">
        {vazio ? (
          <EmptyState title="Sem dados" description="Sem gasto no período." />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={combinada} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={fmtDia} tick={eixoTexto} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis yAxisId="ctr" tickFormatter={(v: number) => `${v.toFixed(1)}%`} tick={eixoTexto} tickLine={false} axisLine={false} width={44} />
                <YAxis yAxisId="cpm" orientation="right" tickFormatter={(v: number) => brl.format(v)} tick={eixoTexto} tickLine={false} axisLine={false} width={80} />
                <Tooltip
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => (typeof l === "string" ? fmtDia(l) : l)}
                      valueFormatter={(v, n) => (n === "CTR" ? `${Number(v).toFixed(2)}%` : brl.format(Number(v)))}
                    />
                  }
                />
                <Line yAxisId="ctr" type="monotone" dataKey="ctr" name="CTR" stroke="var(--chart-1)" strokeWidth={2} dot={false} connectNulls />
                <Line yAxisId="cpm" type="monotone" dataKey="cpm" name="CPM" stroke="var(--chart-4)" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Top campanhas por gasto" subtitle="No período selecionado">
        {topNomeCurto.length === 0 ? (
          <EmptyState title="Sem campanhas" description="Nenhuma campanha com gasto no período." />
        ) : (
          <div style={{ height: `${Math.max(160, topNomeCurto.length * 34 + 30)}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topNomeCurto} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v: number) => brl.format(v)} tick={eixoTexto} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nomeCurto" tick={eixoTexto} tickLine={false} axisLine={false} width={210} />
                <Tooltip content={<ChartTooltip valueFormatter={(v) => brl.format(Number(v))} />} />
                <Bar dataKey="gasto" name="Gasto" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Gasto por faixa etária" subtitle="Fonte: Meta (período selecionado)">
        {idadeOrdenada.length === 0 ? (
          <EmptyState title="Sem dados demográficos" description="A Meta não retornou breakdown por idade no período." />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={idadeOrdenada} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="chave" tick={eixoTexto} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={(v: number) => brl.format(v)} tick={eixoTexto} tickLine={false} axisLine={false} width={86} />
                <Tooltip content={<ChartTooltip valueFormatter={(v) => brl.format(Number(v))} />} />
                <Bar dataKey="gasto" name="Gasto" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Gasto por gênero e plataforma" subtitle="Fonte: Meta (período selecionado)" className="xl:col-span-2">
        {genero.length === 0 && plataformaComGasto.length === 0 ? (
          <EmptyState title="Sem dados" description="A Meta não retornou breakdowns no período." />
        ) : (
          <div className="grid h-56 grid-cols-1 items-center gap-4 sm:grid-cols-2">
            <div className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genero} dataKey="gasto" nameKey="chave" innerRadius="55%" outerRadius="80%" paddingAngle={3} strokeWidth={0}>
                    {genero.map((g, i) => (
                      <Cell key={g.chave} fill={`var(${CHART_VARS[i % CHART_VARS.length]})`} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip hideLabel valueFormatter={(v, n) => `${GENERO_LABEL[n ?? ""] ?? n}: ${brl.format(Number(v))}`} />} />
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
              {plataformaComGasto.length > 0 ? (
                <li className="border-t border-border pt-2 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Plataformas</li>
              ) : null}
              {plataformaComGasto.map((p) => (
                <li key={p.chave} className="flex items-center gap-2">
                  <span className="text-muted-foreground">{PLATAFORMA_LABEL[p.chave] ?? p.chave}</span>
                  <span className="ml-auto font-semibold text-foreground">{brl.format(p.gasto)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
