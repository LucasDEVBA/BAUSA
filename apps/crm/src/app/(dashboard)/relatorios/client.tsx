"use client";

import { useState } from "react";
import {
  BarChart3,
  DollarSign,
  Heart,
  Layers,
  Calendar,
  TrendingUp,
  TrendingDown,
  Users,
  Briefcase,
  FileText,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ExportCSVButton } from "@/components/shared/ExportCSVButton";
import { ExportPDFButton } from "@/components/shared/ExportPDFButton";
import { ETAPA_LABELS } from "@/types/crm";

// ─── Types ─────────────────────────────────────────────────────────────

interface ReportData {
  comercial: {
    dealsByEtapa: Record<string, { count: number; total: number }>;
    dealsThisMonth: number;
    dealsLastMonth: number;
    dealsByClassificacao: Record<string, number>;
    leadsRecebidos: number;
    reunioes: number;
    propostas: number;
    contratos: number;
    taxaConversao: number;
  };
  financeiro: {
    parcelasByMonth: Record<string, { recebido: number; previsto: number; atrasado: number }>;
    totalAtrasado: number;
    aging: { d30: number; d60: number; d90: number };
    topContratos: Array<{
      id: string;
      plano: string;
      valorTotal: number;
      atleta: string;
    }>;
  };
  experiencia: {
    expByTemperatura: Record<string, number>;
    expByFase: Record<string, number>;
    satisfacaoMedia: string;
    ansiedadeMedia: string;
    familiasEmRisco: Array<{
      id: string;
      nome: string;
      temperatura: string;
      status: string;
      fase: string;
    }>;
  };
  safras: {
    list: string[];
    data: Record<string, { deals: number; revenue: number; contratos: number; avgTicket: number }>;
  };
  semanal: {
    periodStart: string;
    periodEnd: string;
    leadsThisWeek: number;
    dealsAdvanced: number;
    familiasContatadas: number;
    familiasEmRisco: number;
    tarefasAbertas: number;
  };
}

type TabId = "comercial" | "financeiro" | "experiencia" | "safra" | "semanal";

const TABS: { id: TabId; label: string; icon: typeof BarChart3 }[] = [
  { id: "comercial", label: "Comercial", icon: BarChart3 },
  { id: "financeiro", label: "Financeiro", icon: DollarSign },
  { id: "experiencia", label: "Experiencia", icon: Heart },
  { id: "safra", label: "Por Safra", icon: Layers },
  { id: "semanal", label: "Semanal", icon: Calendar },
];

// ─── Helpers ───────────────────────────────────────────────────────────

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

function MetricBox({
  label,
  value,
  sub,
  color = "text-white",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold", color)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────────

interface RelatoriosClientProps {
  data: ReportData;
}

export function RelatoriosClient({ data }: RelatoriosClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>("comercial");
  const [safra1, setSafra1] = useState(data.safras.list[0] ?? "");
  const [safra2, setSafra2] = useState(data.safras.list[1] ?? data.safras.list[0] ?? "");

  return (
    <div className="space-y-6" data-printable>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Relatorios</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Visao consolidada — dados em tempo real do CRM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPDFButton title={`Relatorio ${activeTab}`} variant="small" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-[#1e2130] bg-[#141720] p-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "comercial" && (
        <ComercialTab data={data.comercial} />
      )}
      {activeTab === "financeiro" && (
        <FinanceiroTab data={data.financeiro} />
      )}
      {activeTab === "experiencia" && (
        <ExperienciaTab data={data.experiencia} />
      )}
      {activeTab === "safra" && (
        <SafraTab
          data={data.safras}
          safra1={safra1}
          safra2={safra2}
          onSafra1Change={setSafra1}
          onSafra2Change={setSafra2}
        />
      )}
      {activeTab === "semanal" && (
        <SemanalTab data={data.semanal} />
      )}
    </div>
  );
}

// ─── Comercial Tab ─────────────────────────────────────────────────────

function ComercialTab({ data }: { data: ReportData["comercial"] }) {
  const etapaRows = Object.entries(data.dealsByEtapa).map(([etapa, v]) => [
    (ETAPA_LABELS as Record<string, string>)[etapa] ?? etapa,
    v.count.toString(),
    formatBRL(v.total),
  ]);

  const csvHeaders = ["Etapa", "Quantidade", "Valor Total"];
  const csvFilename = `relatorio-comercial-${new Date().toISOString().slice(0, 10)}.csv`;

  const monthDiff =
    data.dealsLastMonth > 0
      ? Math.round(
          ((data.dealsThisMonth - data.dealsLastMonth) / data.dealsLastMonth) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricBox
          label="Leads recebidos"
          value={data.leadsRecebidos.toString()}
          color="text-indigo-400"
        />
        <MetricBox
          label="Reunioes"
          value={data.reunioes.toString()}
          color="text-sky-400"
        />
        <MetricBox
          label="Propostas"
          value={data.propostas.toString()}
          color="text-amber-400"
        />
        <MetricBox
          label="Contratos"
          value={data.contratos.toString()}
          color="text-emerald-400"
        />
        <MetricBox
          label="Taxa conversao"
          value={`${data.taxaConversao}%`}
          color="text-purple-400"
        />
      </div>

      {/* Month comparison */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3">
          Comparativo Mensal
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-[#0c0e16] p-4 text-center">
            <p className="text-2xl font-bold text-white">{data.dealsThisMonth}</p>
            <p className="text-xs text-zinc-500">Este mes</p>
          </div>
          <div className="rounded-lg bg-[#0c0e16] p-4 text-center">
            <p className="text-2xl font-bold text-white">{data.dealsLastMonth}</p>
            <p className="text-xs text-zinc-500">Mes anterior</p>
          </div>
          <div className="rounded-lg bg-[#0c0e16] p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              {monthDiff >= 0 ? (
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <p
                className={cn(
                  "text-2xl font-bold",
                  monthDiff >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {monthDiff > 0 ? "+" : ""}
                {monthDiff}%
              </p>
            </div>
            <p className="text-xs text-zinc-500">Variacao</p>
          </div>
        </div>
      </div>

      {/* Classification */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3">
          Por Classificacao
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-[#0c0e16] p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{data.dealsByClassificacao.hot}</p>
            <p className="text-xs text-zinc-500">Quente</p>
          </div>
          <div className="rounded-lg bg-[#0c0e16] p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{data.dealsByClassificacao.warm}</p>
            <p className="text-xs text-zinc-500">Morno</p>
          </div>
          <div className="rounded-lg bg-[#0c0e16] p-4 text-center">
            <p className="text-2xl font-bold text-zinc-400">{data.dealsByClassificacao.cold}</p>
            <p className="text-xs text-zinc-500">Frio</p>
          </div>
        </div>
      </div>

      {/* Deals by stage table */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-100">
            Deals por Etapa
          </h3>
          <ExportCSVButton
            filename={csvFilename}
            headers={csvHeaders}
            rows={etapaRows}
            variant="small"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2130]">
                <th className="py-2 text-left text-xs font-semibold text-zinc-500">Etapa</th>
                <th className="py-2 text-right text-xs font-semibold text-zinc-500">Qtd</th>
                <th className="py-2 text-right text-xs font-semibold text-zinc-500">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {etapaRows.map((row, i) => (
                <tr key={i} className="border-b border-[#1e2130]/50">
                  <td className="py-2 text-zinc-300">{row[0]}</td>
                  <td className="py-2 text-right text-zinc-400">{row[1]}</td>
                  <td className="py-2 text-right font-medium text-zinc-200">{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Financeiro Tab ────────────────────────────────────────────────────

function FinanceiroTab({ data }: { data: ReportData["financeiro"] }) {
  const monthRows = Object.entries(data.parcelasByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => [month, formatBRL(v.recebido), formatBRL(v.previsto), formatBRL(v.atrasado)]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricBox
          label="Inadimplencia total"
          value={formatBRL(data.totalAtrasado)}
          color="text-red-400"
        />
        <MetricBox label="Ate 30 dias" value={formatBRL(data.aging.d30)} color="text-amber-400" />
        <MetricBox label="30-60 dias" value={formatBRL(data.aging.d60)} color="text-orange-400" />
        <MetricBox label="60+ dias" value={formatBRL(data.aging.d90)} color="text-red-500" />
      </div>

      {/* Parcelas by month table */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-100">
            Parcelas por Mes
          </h3>
          <ExportCSVButton
            filename={`relatorio-financeiro-${new Date().toISOString().slice(0, 10)}.csv`}
            headers={["Mes", "Recebido", "Previsto", "Atrasado"]}
            rows={monthRows}
            variant="small"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2130]">
                <th className="py-2 text-left text-xs font-semibold text-zinc-500">Mes</th>
                <th className="py-2 text-right text-xs font-semibold text-zinc-500">Recebido</th>
                <th className="py-2 text-right text-xs font-semibold text-zinc-500">Previsto</th>
                <th className="py-2 text-right text-xs font-semibold text-zinc-500">Atrasado</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((row, i) => (
                <tr key={i} className="border-b border-[#1e2130]/50">
                  <td className="py-2 text-zinc-300">{row[0]}</td>
                  <td className="py-2 text-right text-emerald-400">{row[1]}</td>
                  <td className="py-2 text-right text-indigo-400">{row[2]}</td>
                  <td className="py-2 text-right text-red-400">{row[3]}</td>
                </tr>
              ))}
              {monthRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-zinc-600">
                    Nenhuma parcela encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 contracts */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3">
          Top 5 Contratos por Valor
        </h3>
        <div className="space-y-2">
          {data.topContratos.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-[#1e2130] bg-[#0c0e16] px-4 py-3"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600/20 text-xs font-bold text-indigo-400">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{c.atleta}</p>
                <p className="text-[10px] text-zinc-500 capitalize">{c.plano}</p>
              </div>
              <p className="text-sm font-bold text-emerald-400">{formatBRL(c.valorTotal)}</p>
            </div>
          ))}
          {data.topContratos.length === 0 && (
            <p className="text-center text-xs text-zinc-600 py-4">
              Nenhum contrato encontrado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Experiencia Tab ───────────────────────────────────────────────────

function ExperienciaTab({ data }: { data: ReportData["experiencia"] }) {
  const faseRows = Object.entries(data.expByFase).map(([fase, count]) => [fase, count.toString()]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricBox
          label="Satisfacao media"
          value={data.satisfacaoMedia}
          sub="Escala 1–5"
          color="text-emerald-400"
        />
        <MetricBox
          label="Ansiedade media"
          value={data.ansiedadeMedia}
          sub="Escala 1–5"
          color="text-amber-400"
        />
        <MetricBox
          label="Familias em risco"
          value={data.familiasEmRisco.length.toString()}
          color="text-red-400"
        />
        <MetricBox
          label="Total acompanhadas"
          value={(
            data.expByTemperatura.verde +
            data.expByTemperatura.amarelo +
            data.expByTemperatura.vermelho
          ).toString()}
          color="text-indigo-400"
        />
      </div>

      {/* By temperatura */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <h3 className="text-sm font-semibold text-zinc-100 mb-3">
          Por Temperatura
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{data.expByTemperatura.verde}</p>
            <p className="text-xs text-zinc-500">Verde</p>
          </div>
          <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{data.expByTemperatura.amarelo}</p>
            <p className="text-xs text-zinc-500">Amarelo</p>
          </div>
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{data.expByTemperatura.vermelho}</p>
            <p className="text-xs text-zinc-500">Vermelho</p>
          </div>
        </div>
      </div>

      {/* By fase */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-100">Por Fase</h3>
          <ExportCSVButton
            filename={`relatorio-experiencia-${new Date().toISOString().slice(0, 10)}.csv`}
            headers={["Fase", "Quantidade"]}
            rows={faseRows}
            variant="small"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {Object.entries(data.expByFase).map(([fase, count]) => (
            <div
              key={fase}
              className="rounded-lg border border-[#1e2130] bg-[#0c0e16] px-3 py-2"
            >
              <p className="text-lg font-bold text-white">{count}</p>
              <p className="text-[10px] text-zinc-500 capitalize">{fase.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Families at risk */}
      {data.familiasEmRisco.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-[#141720] p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <h3 className="text-sm font-semibold text-red-400">
              Familias em Risco
            </h3>
          </div>
          <div className="space-y-2">
            {data.familiasEmRisco.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-[#1e2130] bg-[#0c0e16] px-4 py-2.5"
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    f.temperatura === "vermelho" ? "bg-red-400" : "bg-amber-400"
                  )}
                />
                <p className="flex-1 text-sm text-white">{f.nome}</p>
                <span className="text-[10px] text-zinc-500 capitalize">
                  {f.fase.replace(/_/g, " ")}
                </span>
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[10px] font-medium",
                    f.status === "crise"
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                  )}
                >
                  {f.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Safra Tab ─────────────────────────────────────────────────────────

function SafraTab({
  data,
  safra1,
  safra2,
  onSafra1Change,
  onSafra2Change,
}: {
  data: ReportData["safras"];
  safra1: string;
  safra2: string;
  onSafra1Change: (v: string) => void;
  onSafra2Change: (v: string) => void;
}) {
  const s1 = data.data[safra1];
  const s2 = data.data[safra2];

  const csvRows = data.list.map((s) => {
    const d = data.data[s];
    return [s, d.deals.toString(), formatBRL(d.revenue), d.contratos.toString(), formatBRL(d.avgTicket)];
  });

  return (
    <div className="space-y-6">
      {/* Safra selectors */}
      <div className="flex items-center gap-4">
        <div>
          <label className="text-[10px] font-medium text-zinc-500 mb-1 block">
            Safra 1
          </label>
          <select
            value={safra1}
            onChange={(e) => onSafra1Change(e.target.value)}
            className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-sm text-zinc-300 focus:border-indigo-500/50 focus:outline-none"
          >
            {data.list.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <span className="mt-4 text-zinc-600">vs</span>
        <div>
          <label className="text-[10px] font-medium text-zinc-500 mb-1 block">
            Safra 2
          </label>
          <select
            value={safra2}
            onChange={(e) => onSafra2Change(e.target.value)}
            className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-sm text-zinc-300 focus:border-indigo-500/50 focus:outline-none"
          >
            {data.list.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto">
          <ExportCSVButton
            filename={`relatorio-safras-${new Date().toISOString().slice(0, 10)}.csv`}
            headers={["Safra", "Deals", "Receita", "Contratos", "Ticket Medio"]}
            rows={csvRows}
            variant="small"
          />
        </div>
      </div>

      {/* Side-by-side comparison */}
      {s1 && s2 ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <SafraCard safra={safra1} data={s1} />
            <SafraCard safra={safra2} data={s2} />
          </div>

          {/* Delta comparison */}
          {safra1 !== safra2 && (
            <div className="rounded-xl border border-indigo-500/20 bg-[#141720] p-5">
              <h3 className="text-sm font-semibold text-zinc-100 mb-4">
                Delta: {safra1} vs {safra2}
              </h3>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                {[
                  { label: "Deals", v1: s1.deals, v2: s2.deals, fmt: (v: number) => v.toString() },
                  { label: "Receita", v1: s1.revenue, v2: s2.revenue, fmt: formatBRL },
                  { label: "Contratos", v1: s1.contratos, v2: s2.contratos, fmt: (v: number) => v.toString() },
                  { label: "Ticket Medio", v1: s1.avgTicket, v2: s2.avgTicket, fmt: formatBRL },
                  {
                    label: "Conversao",
                    v1: s1.deals > 0 ? Math.round((s1.contratos / s1.deals) * 100) : 0,
                    v2: s2.deals > 0 ? Math.round((s2.contratos / s2.deals) * 100) : 0,
                    fmt: (v: number) => `${v}%`,
                  },
                ].map(({ label, v1, v2, fmt }) => {
                  const diff = v1 - v2;
                  const pctDiff = v2 !== 0 ? Math.round((diff / v2) * 100) : diff > 0 ? 100 : 0;
                  const isPositive = diff > 0;
                  const isNeutral = diff === 0;
                  return (
                    <div key={label} className="rounded-lg bg-[#0c0e16] p-3 text-center">
                      <p className="text-[10px] text-zinc-500 mb-1">{label}</p>
                      <div className="flex items-center justify-center gap-1">
                        {!isNeutral && (
                          isPositive ? (
                            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                          )
                        )}
                        <p className={cn(
                          "text-lg font-bold",
                          isNeutral ? "text-zinc-400" : isPositive ? "text-emerald-400" : "text-red-400",
                        )}>
                          {isPositive ? "+" : ""}{pctDiff}%
                        </p>
                      </div>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {fmt(v1)} vs {fmt(v2)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-8 text-center">
          <Layers className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">
            {data.list.length === 0
              ? "Nenhuma safra encontrada."
              : "Selecione duas safras para comparar."}
          </p>
        </div>
      )}

      {/* Full table */}
      {data.list.length > 0 && (
        <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
          <h3 className="text-sm font-semibold text-zinc-100 mb-3">Todas as Safras</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e2130]">
                  <th className="py-2 text-left text-xs font-semibold text-zinc-500">Safra</th>
                  <th className="py-2 text-right text-xs font-semibold text-zinc-500">Deals</th>
                  <th className="py-2 text-right text-xs font-semibold text-zinc-500">Receita</th>
                  <th className="py-2 text-right text-xs font-semibold text-zinc-500">Contratos</th>
                  <th className="py-2 text-right text-xs font-semibold text-zinc-500">Ticket Medio</th>
                  <th className="py-2 text-right text-xs font-semibold text-zinc-500">Conversao</th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((safra) => {
                  const d = data.data[safra];
                  const conv = d.deals > 0 ? Math.round((d.contratos / d.deals) * 100) : 0;
                  return (
                    <tr key={safra} className="border-b border-[#1e2130]/50">
                      <td className="py-2 font-medium text-zinc-300">{safra}</td>
                      <td className="py-2 text-right text-zinc-400">{d.deals}</td>
                      <td className="py-2 text-right text-emerald-400">{formatBRL(d.revenue)}</td>
                      <td className="py-2 text-right text-zinc-400">{d.contratos}</td>
                      <td className="py-2 text-right text-indigo-400">{formatBRL(d.avgTicket)}</td>
                      <td className="py-2 text-right text-purple-400">{conv}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SafraCard({
  safra,
  data,
}: {
  safra: string;
  data: { deals: number; revenue: number; contratos: number; avgTicket: number };
}) {
  const conv = data.deals > 0 ? Math.round((data.contratos / data.deals) * 100) : 0;

  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
      <h3 className="text-sm font-semibold text-indigo-400 mb-4">Safra {safra}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-[#0c0e16] p-3 text-center">
          <p className="text-xl font-bold text-white">{data.deals}</p>
          <p className="text-[10px] text-zinc-500">Deals</p>
        </div>
        <div className="rounded-lg bg-[#0c0e16] p-3 text-center">
          <p className="text-xl font-bold text-emerald-400">{formatBRL(data.revenue)}</p>
          <p className="text-[10px] text-zinc-500">Receita</p>
        </div>
        <div className="rounded-lg bg-[#0c0e16] p-3 text-center">
          <p className="text-xl font-bold text-white">{data.contratos}</p>
          <p className="text-[10px] text-zinc-500">Contratos</p>
        </div>
        <div className="rounded-lg bg-[#0c0e16] p-3 text-center">
          <p className="text-xl font-bold text-purple-400">{conv}%</p>
          <p className="text-[10px] text-zinc-500">Conversao</p>
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-[#0c0e16] p-3 text-center">
        <p className="text-lg font-bold text-indigo-400">{formatBRL(data.avgTicket)}</p>
        <p className="text-[10px] text-zinc-500">Ticket Medio</p>
      </div>
    </div>
  );
}

// ─── Semanal Tab ───────────────────────────────────────────────────────

function SemanalTab({ data }: { data: ReportData["semanal"] }) {
  const periodStart = new Date(data.periodStart).toLocaleDateString("pt-BR");
  const periodEnd = new Date(data.periodEnd).toLocaleDateString("pt-BR");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-indigo-500/20 bg-[#141720] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Relatorio Semanal
            </h3>
            <p className="text-xs text-zinc-500">
              Periodo: {periodStart} a {periodEnd}
            </p>
          </div>
          <ExportPDFButton title="Relatorio Semanal" variant="small" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-lg border border-[#1e2130] bg-[#0c0e16] p-4 text-center">
            <Users className="mx-auto h-5 w-5 text-indigo-400 mb-2" />
            <p className="text-2xl font-bold text-white">{data.leadsThisWeek}</p>
            <p className="text-[10px] text-zinc-500">Novos leads</p>
          </div>
          <div className="rounded-lg border border-[#1e2130] bg-[#0c0e16] p-4 text-center">
            <TrendingUp className="mx-auto h-5 w-5 text-emerald-400 mb-2" />
            <p className="text-2xl font-bold text-white">{data.dealsAdvanced}</p>
            <p className="text-[10px] text-zinc-500">Deals avancados</p>
          </div>
          <div className="rounded-lg border border-[#1e2130] bg-[#0c0e16] p-4 text-center">
            <Heart className="mx-auto h-5 w-5 text-purple-400 mb-2" />
            <p className="text-2xl font-bold text-white">{data.familiasContatadas}</p>
            <p className="text-[10px] text-zinc-500">Familias contatadas</p>
          </div>
          <div className="rounded-lg border border-[#1e2130] bg-[#0c0e16] p-4 text-center">
            <AlertTriangle className="mx-auto h-5 w-5 text-red-400 mb-2" />
            <p className="text-2xl font-bold text-white">{data.familiasEmRisco}</p>
            <p className="text-[10px] text-zinc-500">Em risco</p>
          </div>
          <div className="rounded-lg border border-[#1e2130] bg-[#0c0e16] p-4 text-center">
            <CheckCircle className="mx-auto h-5 w-5 text-amber-400 mb-2" />
            <p className="text-2xl font-bold text-white">{data.tarefasAbertas}</p>
            <p className="text-[10px] text-zinc-500">Tarefas abertas</p>
          </div>
        </div>
      </div>
    </div>
  );
}
