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
import { BrandTabs } from "@/components/ui";
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
  color = "text-foreground",
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="border border-border/70 bg-card/60 rounded-lg p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
        {label}
      </p>
      <p className={cn("mt-1 text-base font-semibold", color)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
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
    <div className="space-y-4" data-printable>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-2 text-foreground">Relatorios</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Visao consolidada — dados em tempo real do CRM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPDFButton title={`Relatorio ${activeTab}`} variant="small" />
        </div>
      </div>

      {/* Tabs */}
      <BrandTabs
        items={TABS}
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as TabId)}
        variant="segmented"
        ariaLabel="Tipos de relatório"
      />

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
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricBox
          label="Leads recebidos"
          value={data.leadsRecebidos.toString()}
          color="text-primary"
        />
        <MetricBox
          label="Reunioes"
          value={data.reunioes.toString()}
          color="text-sys-blue"
        />
        <MetricBox
          label="Propostas"
          value={data.propostas.toString()}
          color="text-sys-orange"
        />
        <MetricBox
          label="Contratos"
          value={data.contratos.toString()}
          color="text-sys-green"
        />
        <MetricBox
          label="Taxa conversao"
          value={`${data.taxaConversao}%`}
          color="text-plan-legacy"
        />
      </div>

      {/* Month comparison */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Comparativo Mensal
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-background p-4 text-center">
            <p className="text-base font-semibold text-foreground">{data.dealsThisMonth}</p>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </div>
          <div className="rounded-lg bg-background p-4 text-center">
            <p className="text-base font-semibold text-foreground">{data.dealsLastMonth}</p>
            <p className="text-xs text-muted-foreground">Mes anterior</p>
          </div>
          <div className="rounded-lg bg-background p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              {monthDiff >= 0 ? (
                <TrendingUp className="h-4 w-4 text-sys-green" />
              ) : (
                <TrendingDown className="h-4 w-4 text-sys-red" />
              )}
              <p
                className={cn(
                  "text-base font-semibold",
                  monthDiff >= 0 ? "text-sys-green" : "text-sys-red"
                )}
              >
                {monthDiff > 0 ? "+" : ""}
                {monthDiff}%
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Variacao</p>
          </div>
        </div>
      </div>

      {/* Classification */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Por Classificacao
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-background p-4 text-center">
            <p className="text-base font-semibold text-lead-hot">{data.dealsByClassificacao.hot}</p>
            <p className="text-xs text-muted-foreground">Quente</p>
          </div>
          <div className="rounded-lg bg-background p-4 text-center">
            <p className="text-base font-semibold text-lead-warm">{data.dealsByClassificacao.warm}</p>
            <p className="text-xs text-muted-foreground">Morno</p>
          </div>
          <div className="rounded-lg bg-background p-4 text-center">
            <p className="text-base font-semibold text-muted-foreground">{data.dealsByClassificacao.cold}</p>
            <p className="text-xs text-muted-foreground">Frio</p>
          </div>
        </div>
      </div>

      {/* Deals by stage table */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
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
              <tr className="border-b border-border">
                <th className="py-2 text-left text-xs font-semibold text-muted-foreground">Etapa</th>
                <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Qtd</th>
                <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Valor Total</th>
              </tr>
            </thead>
            <tbody>
              {etapaRows.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-accent">
                  <td className="py-2 text-foreground">{row[0]}</td>
                  <td className="py-2 text-right text-muted-foreground">{row[1]}</td>
                  <td className="py-2 text-right font-medium text-foreground">{row[2]}</td>
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
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricBox
          label="Inadimplencia total"
          value={formatBRL(data.totalAtrasado)}
          color="text-sys-red"
        />
        <MetricBox label="Ate 30 dias" value={formatBRL(data.aging.d30)} color="text-sys-orange" />
        <MetricBox label="30-60 dias" value={formatBRL(data.aging.d60)} color="text-sys-orange" />
        <MetricBox label="60+ dias" value={formatBRL(data.aging.d90)} color="text-sys-red" />
      </div>

      {/* Parcelas by month table */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
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
              <tr className="border-b border-border">
                <th className="py-2 text-left text-xs font-semibold text-muted-foreground">Mes</th>
                <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Recebido</th>
                <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Previsto</th>
                <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Atrasado</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-accent">
                  <td className="py-2 text-foreground">{row[0]}</td>
                  <td className="py-2 text-right text-sys-green">{row[1]}</td>
                  <td className="py-2 text-right text-primary">{row[2]}</td>
                  <td className="py-2 text-right text-sys-red">{row[3]}</td>
                </tr>
              ))}
              {monthRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-label-tertiary">
                    Nenhuma parcela encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 contracts */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Top 5 Contratos por Valor
        </h3>
        <div className="space-y-2">
          {data.topContratos.map((c, i) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{c.atleta}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{c.plano}</p>
              </div>
              <p className="text-sm font-bold text-sys-green">{formatBRL(c.valorTotal)}</p>
            </div>
          ))}
          {data.topContratos.length === 0 && (
            <p className="text-center text-xs text-label-tertiary py-4">
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
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricBox
          label="Satisfacao media"
          value={data.satisfacaoMedia}
          sub="Escala 1–5"
          color="text-sys-green"
        />
        <MetricBox
          label="Ansiedade media"
          value={data.ansiedadeMedia}
          sub="Escala 1–5"
          color="text-sys-orange"
        />
        <MetricBox
          label="Familias em risco"
          value={data.familiasEmRisco.length.toString()}
          color="text-sys-red"
        />
        <MetricBox
          label="Total acompanhadas"
          value={(
            data.expByTemperatura.verde +
            data.expByTemperatura.amarelo +
            data.expByTemperatura.vermelho
          ).toString()}
          color="text-primary"
        />
      </div>

      {/* By temperatura */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Por Temperatura
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg bg-sys-green/5 border border-sys-green/20 p-4 text-center">
            <p className="text-base font-semibold text-sys-green">{data.expByTemperatura.verde}</p>
            <p className="text-xs text-muted-foreground">Verde</p>
          </div>
          <div className="rounded-lg bg-sys-orange/5 border border-sys-orange/20 p-4 text-center">
            <p className="text-base font-semibold text-sys-orange">{data.expByTemperatura.amarelo}</p>
            <p className="text-xs text-muted-foreground">Amarelo</p>
          </div>
          <div className="rounded-lg bg-sys-red/5 border border-sys-red/20 p-4 text-center">
            <p className="text-base font-semibold text-sys-red">{data.expByTemperatura.vermelho}</p>
            <p className="text-xs text-muted-foreground">Vermelho</p>
          </div>
        </div>
      </div>

      {/* By fase */}
      <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Por Fase</h3>
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
              className="rounded-lg border border-border bg-background px-3 py-2"
            >
              <p className="text-lg font-bold text-foreground">{count}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{fase.replace(/_/g, " ")}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Families at risk */}
      {data.familiasEmRisco.length > 0 && (
        <div className="rounded-xl border border-sys-red/20 bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-sys-red" />
            <h3 className="text-sm font-semibold text-sys-red">
              Familias em Risco
            </h3>
          </div>
          <div className="space-y-2">
            {data.familiasEmRisco.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-2.5"
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    f.temperatura === "vermelho" ? "bg-sys-red" : "bg-sys-orange"
                  )}
                />
                <p className="flex-1 text-sm text-foreground">{f.nome}</p>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {f.fase.replace(/_/g, " ")}
                </span>
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[10px] font-medium",
                    f.status === "crise"
                      ? "border-sys-red/30 bg-sys-red/10 text-sys-red"
                      : "border-sys-orange/30 bg-sys-orange/10 text-sys-orange"
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
    <div className="space-y-4">
      {/* Safra selectors */}
      <div className="flex items-center gap-4">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Safra 1
          </label>
          <select
            value={safra1}
            onChange={(e) => onSafra1Change(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
          >
            {data.list.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <span className="mt-4 text-label-tertiary">vs</span>
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">
            Safra 2
          </label>
          <select
            value={safra2}
            onChange={(e) => onSafra2Change(e.target.value)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
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
            <div className="rounded-xl border border-primary/20 bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
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
                    <div key={label} className="rounded-lg bg-background p-3 text-center">
                      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
                      <div className="flex items-center justify-center gap-1">
                        {!isNeutral && (
                          isPositive ? (
                            <TrendingUp className="h-3.5 w-3.5 text-sys-green" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-sys-red" />
                          )
                        )}
                        <p className={cn(
                          "text-lg font-bold",
                          isNeutral ? "text-muted-foreground" : isPositive ? "text-sys-green" : "text-sys-red",
                        )}>
                          {isPositive ? "+" : ""}{pctDiff}%
                        </p>
                      </div>
                      <p className="text-[10px] text-label-tertiary mt-0.5">
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
        <div className="border border-border/70 bg-card/60 rounded-xl p-8 text-center">
          <Layers className="mx-auto h-8 w-8 text-label-tertiary mb-2" />
          <p className="text-sm text-muted-foreground">
            {data.list.length === 0
              ? "Nenhuma safra encontrada."
              : "Selecione duas safras para comparar."}
          </p>
        </div>
      )}

      {/* Full table */}
      {data.list.length > 0 && (
        <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Todas as Safras</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 text-left text-xs font-semibold text-muted-foreground">Safra</th>
                  <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Deals</th>
                  <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Receita</th>
                  <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Contratos</th>
                  <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Ticket Medio</th>
                  <th className="py-2 text-right text-xs font-semibold text-muted-foreground">Conversao</th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((safra) => {
                  const d = data.data[safra];
                  const conv = d.deals > 0 ? Math.round((d.contratos / d.deals) * 100) : 0;
                  return (
                    <tr key={safra} className="border-b border-border/50 hover:bg-accent">
                      <td className="py-2 font-medium text-foreground">{safra}</td>
                      <td className="py-2 text-right text-muted-foreground">{d.deals}</td>
                      <td className="py-2 text-right text-sys-green">{formatBRL(d.revenue)}</td>
                      <td className="py-2 text-right text-muted-foreground">{d.contratos}</td>
                      <td className="py-2 text-right text-primary">{formatBRL(d.avgTicket)}</td>
                      <td className="py-2 text-right text-plan-legacy">{conv}%</td>
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
    <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
      <h3 className="text-sm font-semibold text-primary mb-4">Safra {safra}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-background p-3 text-center">
          <p className="text-xl font-bold text-foreground">{data.deals}</p>
          <p className="text-[10px] text-muted-foreground">Deals</p>
        </div>
        <div className="rounded-lg bg-background p-3 text-center">
          <p className="text-xl font-bold text-sys-green">{formatBRL(data.revenue)}</p>
          <p className="text-[10px] text-muted-foreground">Receita</p>
        </div>
        <div className="rounded-lg bg-background p-3 text-center">
          <p className="text-xl font-bold text-foreground">{data.contratos}</p>
          <p className="text-[10px] text-muted-foreground">Contratos</p>
        </div>
        <div className="rounded-lg bg-background p-3 text-center">
          <p className="text-xl font-bold text-plan-legacy">{conv}%</p>
          <p className="text-[10px] text-muted-foreground">Conversao</p>
        </div>
      </div>
      <div className="mt-3 rounded-lg bg-background p-3 text-center">
        <p className="text-lg font-bold text-primary">{formatBRL(data.avgTicket)}</p>
        <p className="text-[10px] text-muted-foreground">Ticket Medio</p>
      </div>
    </div>
  );
}

// ─── Semanal Tab ───────────────────────────────────────────────────────

function SemanalTab({ data }: { data: ReportData["semanal"] }) {
  const periodStart = new Date(data.periodStart).toLocaleDateString("pt-BR");
  const periodEnd = new Date(data.periodEnd).toLocaleDateString("pt-BR");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Relatorio Semanal
            </h3>
            <p className="text-xs text-muted-foreground">
              Periodo: {periodStart} a {periodEnd}
            </p>
          </div>
          <ExportPDFButton title="Relatorio Semanal" variant="small" />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-lg border border-border bg-background p-4 text-center">
            <Users className="mx-auto h-5 w-5 text-primary mb-2" />
            <p className="text-base font-semibold text-foreground">{data.leadsThisWeek}</p>
            <p className="text-[10px] text-muted-foreground">Novos leads</p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4 text-center">
            <TrendingUp className="mx-auto h-5 w-5 text-sys-green mb-2" />
            <p className="text-base font-semibold text-foreground">{data.dealsAdvanced}</p>
            <p className="text-[10px] text-muted-foreground">Deals avancados</p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4 text-center">
            <Heart className="mx-auto h-5 w-5 text-plan-legacy mb-2" />
            <p className="text-base font-semibold text-foreground">{data.familiasContatadas}</p>
            <p className="text-[10px] text-muted-foreground">Familias contatadas</p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4 text-center">
            <AlertTriangle className="mx-auto h-5 w-5 text-sys-red mb-2" />
            <p className="text-base font-semibold text-foreground">{data.familiasEmRisco}</p>
            <p className="text-[10px] text-muted-foreground">Em risco</p>
          </div>
          <div className="rounded-lg border border-border bg-background p-4 text-center">
            <CheckCircle className="mx-auto h-5 w-5 text-sys-orange mb-2" />
            <p className="text-base font-semibold text-foreground">{data.tarefasAbertas}</p>
            <p className="text-[10px] text-muted-foreground">Tarefas abertas</p>
          </div>
        </div>
      </div>
    </div>
  );
}
