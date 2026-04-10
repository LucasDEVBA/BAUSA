"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  MousePointerClick,
  Megaphone,
  BarChart3,
  Target,
} from "lucide-react";
import type { LeadAttribution } from "./page";

// ─── Colors ─────────────────────────────────────────────────────────────────

const COLORS = [
  "#818cf8", // indigo
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f87171", // red
  "#60a5fa", // blue
  "#a78bfa", // purple
  "#fb923c", // orange
  "#2dd4bf", // teal
];

const CLASSIFICATION_COLORS: Record<string, string> = {
  QUENTE: "#22c55e",
  MORNO: "#f59e0b",
  FRIO: "#3b82f6",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function countBy(items: LeadAttribution[], key: keyof LeadAttribution): { name: string; total: number; quente: number; morno: number; frio: number }[] {
  const map = new Map<string, { total: number; quente: number; morno: number; frio: number }>();

  for (const item of items) {
    const val = (item[key] as string) || "Direto";
    const existing = map.get(val) ?? { total: 0, quente: 0, morno: 0, frio: 0 };
    existing.total++;
    const cls = item.qualification_classification;
    if (cls === "QUENTE") existing.quente++;
    else if (cls === "MORNO") existing.morno++;
    else if (cls === "FRIO") existing.frio++;
    map.set(val, existing);
  }

  return Array.from(map.entries())
    .map(([name, counts]) => ({ name, ...counts }))
    .sort((a, b) => b.total - a.total);
}

function countSimple(items: LeadAttribution[], key: keyof LeadAttribution): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const val = (item[key] as string) || "Direto";
    map.set(val, (map.get(val) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

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
    <div className="rounded-lg border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-zinc-200">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

// ─── Metric Card ────────────────────────────────────────────────────────────

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Globe;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-2xl font-bold text-zinc-100">{value}</p>
      {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Section ────────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {title}
      </p>
      {children}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface Props {
  leads: LeadAttribution[];
}

export function AtribuicaoClient({ leads }: Props) {
  const bySource = useMemo(() => countBy(leads, "utm_source"), [leads]);
  const byMedium = useMemo(() => countBy(leads, "utm_medium"), [leads]);
  const byCampaign = useMemo(() => countBy(leads, "utm_campaign"), [leads]);
  const byCta = useMemo(() => countSimple(leads, "cta_source"), [leads]);
  const byDevice = useMemo(() => countSimple(leads, "device_type"), [leads]);

  const totalLeads = leads.length;
  const withUtm = leads.filter((l) => l.utm_source).length;
  const topSource = bySource[0]?.name ?? "—";
  const topDevice = byDevice[0]?.name ?? "—";

  const conversionBySource = useMemo(() => {
    return bySource.map((s) => ({
      name: s.name,
      total: s.total,
      qualificados: s.quente + s.morno,
      taxa: s.total > 0 ? Math.round(((s.quente + s.morno) / s.total) * 100) : 0,
    }));
  }, [bySource]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Atribuição de Leads</h1>
        <p className="text-sm text-zinc-500">
          De onde vêm os leads, por qual canal e dispositivo
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard icon={BarChart3} label="Total de Leads" value={totalLeads} />
        <MetricCard
          icon={Target}
          label="Com UTM"
          value={withUtm}
          sub={totalLeads > 0 ? `${Math.round((withUtm / totalLeads) * 100)}% rastreados` : ""}
        />
        <MetricCard icon={Globe} label="Top Fonte" value={topSource} />
        <MetricCard
          icon={DEVICE_ICONS[topDevice] ?? Monitor}
          label="Top Dispositivo"
          value={topDevice}
        />
      </div>

      {/* Row 1: Source + Device */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leads por Fonte (UTM Source) */}
        <Section title="Leads por Fonte (UTM Source)">
          {bySource.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bySource.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
                <XAxis type="number" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: "#e2e8f0", fontSize: 11 }}
                  width={100}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) =>
                    value === "quente" ? "Quente" : value === "morno" ? "Morno" : "Frio"
                  }
                />
                <Bar dataKey="quente" stackId="a" fill={CLASSIFICATION_COLORS.QUENTE} radius={[0, 0, 0, 0]} />
                <Bar dataKey="morno" stackId="a" fill={CLASSIFICATION_COLORS.MORNO} />
                <Bar dataKey="frio" stackId="a" fill={CLASSIFICATION_COLORS.FRIO} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-zinc-500">
              Nenhum lead com UTM registrado ainda
            </p>
          )}
        </Section>

        {/* Dispositivos */}
        <Section title="Dispositivos">
          {byDevice.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={250}>
                <PieChart>
                  <Pie
                    data={byDevice}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    strokeWidth={0}
                  >
                    {byDevice.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#0f1117",
                      border: "1px solid #1e2130",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-3">
                {byDevice.map((d, i) => {
                  const DeviceIcon = DEVICE_ICONS[d.name] ?? Monitor;
                  const pct = totalLeads > 0 ? Math.round((d.value / totalLeads) * 100) : 0;
                  return (
                    <div key={d.name} className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${COLORS[i % COLORS.length]}20` }}
                      >
                        <DeviceIcon className="h-4 w-4" style={{ color: COLORS[i % COLORS.length] }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-zinc-200 capitalize">{d.name}</span>
                          <span className="text-sm font-bold text-zinc-100">{pct}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-[#1e2130]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-zinc-500">
              Nenhum dado de dispositivo registrado
            </p>
          )}
        </Section>
      </div>

      {/* Row 2: Medium + CTA */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Leads por Meio (UTM Medium) */}
        <Section title="Leads por Meio (UTM Medium)">
          {byMedium.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byMedium.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
                <XAxis dataKey="name" tick={{ fill: "#e2e8f0", fontSize: 11 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 11 }}
                  formatter={(value) =>
                    value === "quente" ? "Quente" : value === "morno" ? "Morno" : "Frio"
                  }
                />
                <Bar dataKey="quente" stackId="a" fill={CLASSIFICATION_COLORS.QUENTE} />
                <Bar dataKey="morno" stackId="a" fill={CLASSIFICATION_COLORS.MORNO} />
                <Bar dataKey="frio" stackId="a" fill={CLASSIFICATION_COLORS.FRIO} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-zinc-500">Nenhum dado de meio</p>
          )}
        </Section>

        {/* CTA Clicado */}
        <Section title="CTA Clicado (Qual botão levou ao form)">
          {byCta.length > 0 ? (
            <div className="space-y-3">
              {byCta.map((c, i) => {
                const pct = totalLeads > 0 ? Math.round((c.value / totalLeads) * 100) : 0;
                const labels: Record<string, string> = {
                  hero: "Botão Principal (Hero)",
                  final: "CTA Final",
                  header: "Menu Superior",
                  links: "Página de Links",
                  Direto: "Acesso direto ao /forms",
                };
                return (
                  <div key={c.name} className="rounded-lg border border-[#1e2130] bg-[#0c0e14] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MousePointerClick className="h-4 w-4 text-indigo-400" />
                        <span className="text-sm font-medium text-zinc-200">
                          {labels[c.name] ?? c.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-zinc-100">{c.value}</span>
                        <span className="text-xs text-zinc-500">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#1e2130]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-zinc-500">Nenhum CTA rastreado</p>
          )}
        </Section>
      </div>

      {/* Row 3: Campanhas + Taxa de conversão por fonte */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Campanhas */}
        <Section title="Leads por Campanha (UTM Campaign)">
          {byCampaign.filter((c) => c.name !== "Direto").length > 0 ? (
            <div className="space-y-2">
              {byCampaign
                .filter((c) => c.name !== "Direto")
                .slice(0, 8)
                .map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between rounded-lg border border-[#1e2130] bg-[#0c0e14] px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-sm text-zinc-200">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-emerald-400">{c.quente} Q</span>
                      <span className="text-amber-400">{c.morno} M</span>
                      <span className="text-blue-400">{c.frio} F</span>
                      <span className="font-bold text-zinc-100">{c.total}</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-zinc-500">
              Nenhuma campanha registrada
            </p>
          )}
        </Section>

        {/* Taxa de Conversão por Fonte */}
        <Section title="Taxa de Qualificação por Fonte">
          {conversionBySource.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={conversionBySource.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" />
                <XAxis dataKey="name" tick={{ fill: "#e2e8f0", fontSize: 11 }} />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0]?.payload as (typeof conversionBySource)[0];
                    return (
                      <div className="rounded-lg border border-[#1e2130] bg-[#0f1117] px-3 py-2 text-xs shadow-xl">
                        <p className="mb-1 font-medium text-zinc-200">{label}</p>
                        <p className="text-indigo-400">
                          {d.qualificados}/{d.total} qualificados ({d.taxa}%)
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="taxa" fill="#818cf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-10 text-center text-sm text-zinc-500">Sem dados</p>
          )}
        </Section>
      </div>
    </div>
  );
}
