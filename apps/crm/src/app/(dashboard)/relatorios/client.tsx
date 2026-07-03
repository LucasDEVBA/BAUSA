"use client";

import { useState } from "react";
import {
  BarChart3,
  DollarSign,
  Heart,
  Layers,
  Calendar,
  TrendingUp,
  Users,
  CheckCircle,
  Target,
  Handshake,
  FileSignature,
  AlertTriangle,
  Percent,
  Frown,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  StatCard,
  Card,
  Badge,
  DeltaBadge,
  BrandTabs,
  ScrollList,
  EmptyState,
} from "@/components/ui";
import { ExportCSVButton } from "@/components/shared/ExportCSVButton";
import { ExportPDFButton } from "@/components/shared/ExportPDFButton";
import { ETAPA_LABELS } from "@/types/crm";
import type { StatCardProps } from "@/components/ui";

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

/** Título de seção — padrão eyebrow das referências (war-room). */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-eyebrow text-muted-foreground">{children}</p>;
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
    <div className="space-y-5" data-printable>
      <PageHeader dense
        eyebrow="Executivo"
        title="Relatorios"
        description="Visao consolidada — dados em tempo real do CRM"
        actions={<ExportPDFButton title={`Relatorio ${activeTab}`} variant="small" />}
      />

      <BrandTabs
        items={TABS}
        activeId={activeTab}
        onSelect={(id) => setActiveTab(id as TabId)}
        variant="segmented"
        ariaLabel="Categorias de relatorio"
      />

      {/* Tab Content */}
      {activeTab === "comercial" && <ComercialTab data={data.comercial} />}
      {activeTab === "financeiro" && <FinanceiroTab data={data.financeiro} />}
      {activeTab === "experiencia" && <ExperienciaTab data={data.experiencia} />}
      {activeTab === "safra" && (
        <SafraTab
          data={data.safras}
          safra1={safra1}
          safra2={safra2}
          onSafra1Change={setSafra1}
          onSafra2Change={setSafra2}
        />
      )}
      {activeTab === "semanal" && <SemanalTab data={data.semanal} />}
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
      ? Math.round(((data.dealsThisMonth - data.dealsLastMonth) / data.dealsLastMonth) * 100)
      : null;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Leads recebidos" value={data.leadsRecebidos} icon={Users} accent="brand" />
        <StatCard label="Reunioes" value={data.reunioes} icon={Handshake} accent="blue" />
        <StatCard label="Propostas" value={data.propostas} icon={FileSignature} accent="orange" />
        <StatCard label="Contratos" value={data.contratos} icon={CheckCircle} accent="green" />
        <StatCard
          label="Taxa conversao"
          value={`${data.taxaConversao}%`}
          icon={Percent}
          accent="purple"
        />
      </div>

      {/* Month comparison */}
      <Card variant="plain" padding="md">
        <SectionTitle>Comparativo Mensal</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <Card variant="ghost" padding="md" className="text-center">
            <p className="text-2xl font-bold tabular-nums text-foreground">{data.dealsThisMonth}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Este mes</p>
          </Card>
          <Card variant="ghost" padding="md" className="text-center">
            <p className="text-2xl font-bold tabular-nums text-foreground">{data.dealsLastMonth}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Mes anterior</p>
          </Card>
          <Card variant="ghost" padding="md" className="flex flex-col items-center justify-center">
            <DeltaBadge value={monthDiff} />
            <p className="mt-1 text-xs text-muted-foreground">Variacao</p>
          </Card>
        </div>
      </Card>

      {/* Classification */}
      <Card variant="plain" padding="md">
        <SectionTitle>Por Classificacao</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <Card variant="ghost" padding="md" className="text-center">
            <p className="text-2xl font-bold tabular-nums text-lead-hot">
              {data.dealsByClassificacao.hot}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Quente</p>
          </Card>
          <Card variant="ghost" padding="md" className="text-center">
            <p className="text-2xl font-bold tabular-nums text-lead-warm">
              {data.dealsByClassificacao.warm}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Morno</p>
          </Card>
          <Card variant="ghost" padding="md" className="text-center">
            <p className="text-2xl font-bold tabular-nums text-muted-foreground">
              {data.dealsByClassificacao.cold}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Frio</p>
          </Card>
        </div>
      </Card>

      {/* Deals by stage table */}
      <Card variant="plain" padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 pb-3">
          <SectionTitle>Deals por Etapa</SectionTitle>
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
                <th className="px-4 py-2 text-left text-eyebrow text-muted-foreground">Etapa</th>
                <th className="px-4 py-2 text-right text-eyebrow text-muted-foreground">Qtd</th>
                <th className="px-4 py-2 text-right text-eyebrow text-muted-foreground">
                  Valor Total
                </th>
              </tr>
            </thead>
            <tbody>
              {etapaRows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-accent">
                  <td className="px-4 py-2 text-foreground">{row[0]}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {row[1]}
                  </td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums text-foreground">
                    {row[2]}
                  </td>
                </tr>
              ))}
              {etapaRows.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <EmptyState
                      icon={BarChart3}
                      title="Nenhum deal encontrado"
                      description="Deals aparecerao aqui conforme entram no pipeline."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Financeiro Tab ────────────────────────────────────────────────────

function FinanceiroTab({ data }: { data: ReportData["financeiro"] }) {
  const monthRows = Object.entries(data.parcelasByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => [month, formatBRL(v.recebido), formatBRL(v.previsto), formatBRL(v.atrasado)]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Inadimplencia total"
          value={formatBRL(data.totalAtrasado)}
          icon={AlertTriangle}
          accent="red"
        />
        <StatCard label="Ate 30 dias" value={formatBRL(data.aging.d30)} accent="orange" />
        <StatCard label="30-60 dias" value={formatBRL(data.aging.d60)} accent="orange" />
        <StatCard label="60+ dias" value={formatBRL(data.aging.d90)} accent="red" />
      </div>

      {/* Parcelas by month table */}
      <Card variant="plain" padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 pb-3">
          <SectionTitle>Parcelas por Mes</SectionTitle>
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
                <th className="px-4 py-2 text-left text-eyebrow text-muted-foreground">Mes</th>
                <th className="px-4 py-2 text-right text-eyebrow text-muted-foreground">Recebido</th>
                <th className="px-4 py-2 text-right text-eyebrow text-muted-foreground">Previsto</th>
                <th className="px-4 py-2 text-right text-eyebrow text-muted-foreground">Atrasado</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((row, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-accent">
                  <td className="px-4 py-2 text-foreground">{row[0]}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-sys-green">{row[1]}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-primary">{row[2]}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-sys-red">{row[3]}</td>
                </tr>
              ))}
              {monthRows.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={DollarSign}
                      title="Nenhuma parcela encontrada"
                      description="Parcelas aparecerao aqui conforme os contratos sao registrados."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top 5 contracts */}
      <Card variant="plain" padding="md">
        <SectionTitle>Top 5 Contratos por Valor</SectionTitle>
        <div className="space-y-2">
          {data.topContratos.map((c, i) => (
            <Card key={c.id} variant="ghost" padding="sm" className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{c.atleta}</p>
                <p className="text-[10px] capitalize text-muted-foreground">{c.plano}</p>
              </div>
              <p className="text-sm font-bold tabular-nums text-sys-green">
                {formatBRL(c.valorTotal)}
              </p>
            </Card>
          ))}
          {data.topContratos.length === 0 && (
            <EmptyState
              icon={FileSignature}
              title="Nenhum contrato encontrado"
              description="Os maiores contratos aparecerao aqui."
            />
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Experiencia Tab ───────────────────────────────────────────────────

function ExperienciaTab({ data }: { data: ReportData["experiencia"] }) {
  const faseRows = Object.entries(data.expByFase).map(([fase, count]) => [fase, count.toString()]);
  const totalAcompanhadas =
    data.expByTemperatura.verde + data.expByTemperatura.amarelo + data.expByTemperatura.vermelho;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Satisfacao media"
          value={data.satisfacaoMedia}
          context="Escala 1–5"
          icon={Smile}
          accent="green"
        />
        <StatCard
          label="Ansiedade media"
          value={data.ansiedadeMedia}
          context="Escala 1–5"
          icon={Frown}
          accent="orange"
        />
        <StatCard
          label="Familias em risco"
          value={data.familiasEmRisco.length}
          icon={AlertTriangle}
          accent="red"
        />
        <StatCard
          label="Total acompanhadas"
          value={totalAcompanhadas}
          icon={Heart}
          accent="brand"
        />
      </div>

      {/* By temperatura */}
      <Card variant="plain" padding="md">
        <SectionTitle>Por Temperatura</SectionTitle>
        <div className="grid grid-cols-3 gap-4">
          <Card variant="ghost" padding="md" accent="green" className="text-center">
            <p className="text-2xl font-bold tabular-nums text-sys-green">
              {data.expByTemperatura.verde}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Verde</p>
          </Card>
          <Card variant="ghost" padding="md" accent="orange" className="text-center">
            <p className="text-2xl font-bold tabular-nums text-sys-orange">
              {data.expByTemperatura.amarelo}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Amarelo</p>
          </Card>
          <Card variant="ghost" padding="md" accent="red" className="text-center">
            <p className="text-2xl font-bold tabular-nums text-sys-red">
              {data.expByTemperatura.vermelho}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Vermelho</p>
          </Card>
        </div>
      </Card>

      {/* By fase */}
      <Card variant="plain" padding="md">
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionTitle>Por Fase</SectionTitle>
          <ExportCSVButton
            filename={`relatorio-experiencia-${new Date().toISOString().slice(0, 10)}.csv`}
            headers={["Fase", "Quantidade"]}
            rows={faseRows}
            variant="small"
          />
        </div>
        {faseRows.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {Object.entries(data.expByFase).map(([fase, count]) => (
              <Card key={fase} variant="ghost" padding="sm">
                <p className="text-lg font-bold tabular-nums text-foreground">{count}</p>
                <p className="text-[10px] capitalize text-muted-foreground">
                  {fase.replace(/_/g, " ")}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Layers}
            title="Nenhuma fase registrada"
            description="A distribuicao por fase aparecera aqui."
          />
        )}
      </Card>

      {/* Families at risk */}
      {data.familiasEmRisco.length > 0 && (
        <Card variant="plain" accent="red" padding="lg" className="flex h-[22rem] flex-col">
          <div className="mb-3 flex shrink-0 items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-sys-red" />
            <p className="text-eyebrow text-sys-red">Familias em Risco</p>
          </div>
          <ScrollList className="space-y-2">
            {data.familiasEmRisco.map((f) => (
              <Card key={f.id} variant="ghost" padding="sm" className="flex items-center gap-3">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    f.temperatura === "vermelho" ? "bg-sys-red" : "bg-sys-orange",
                  )}
                />
                <p className="flex-1 truncate text-sm text-foreground">{f.nome}</p>
                <span className="text-[10px] capitalize text-muted-foreground">
                  {f.fase.replace(/_/g, " ")}
                </span>
                <Badge tone={f.status === "crise" ? "red" : "orange"} size="sm">
                  {f.status}
                </Badge>
              </Card>
            ))}
          </ScrollList>
        </Card>
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

  const selectClasses =
    "rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <div className="space-y-5">
      {/* Safra selectors */}
      <Card variant="plain" padding="md" className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-eyebrow text-muted-foreground">Safra 1</label>
          <select
            value={safra1}
            onChange={(e) => onSafra1Change(e.target.value)}
            className={selectClasses}
          >
            {data.list.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <span className="pb-2 text-muted-foreground">vs</span>
        <div>
          <label className="mb-1 block text-eyebrow text-muted-foreground">Safra 2</label>
          <select
            value={safra2}
            onChange={(e) => onSafra2Change(e.target.value)}
            className={selectClasses}
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
      </Card>

      {/* Side-by-side comparison */}
      {s1 && s2 ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <SafraCard safra={safra1} data={s1} />
            <SafraCard safra={safra2} data={s2} />
          </div>

          {/* Delta comparison */}
          {safra1 !== safra2 && (
            <Card variant="plain" accent="brand" padding="lg">
              <SectionTitle>
                Delta: {safra1} vs {safra2}
              </SectionTitle>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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
                  return (
                    <Card
                      key={label}
                      variant="ghost"
                      padding="sm"
                      className="flex flex-col items-center gap-1 text-center"
                    >
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <DeltaBadge value={pctDiff} />
                      <p className="text-[10px] text-muted-foreground">
                        {fmt(v1)} vs {fmt(v2)}
                      </p>
                    </Card>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card variant="plain" padding="none">
          <EmptyState
            icon={Layers}
            title={data.list.length === 0 ? "Nenhuma safra encontrada" : "Selecione duas safras"}
            description={
              data.list.length === 0
                ? "As safras aparecerao aqui conforme os deals sao classificados."
                : "Escolha duas safras acima para comparar os indicadores."
            }
          />
        </Card>
      )}

      {/* Full table */}
      {data.list.length > 0 && (
        <Card variant="plain" padding="none" className="overflow-hidden">
          <div className="p-4 pb-3">
            <SectionTitle>Todas as Safras</SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-eyebrow text-muted-foreground">Safra</th>
                  <th className="px-4 py-2 text-right text-eyebrow text-muted-foreground">Deals</th>
                  <th className="px-4 py-2 text-right text-eyebrow text-muted-foreground">Receita</th>
                  <th className="px-4 py-2 text-right text-eyebrow text-muted-foreground">
                    Contratos
                  </th>
                  <th className="px-4 py-2 text-right text-eyebrow text-muted-foreground">
                    Ticket Medio
                  </th>
                  <th className="px-4 py-2 text-right text-eyebrow text-muted-foreground">
                    Conversao
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((safra) => {
                  const d = data.data[safra];
                  const conv = d.deals > 0 ? Math.round((d.contratos / d.deals) * 100) : 0;
                  return (
                    <tr key={safra} className="border-b border-border last:border-0 hover:bg-accent">
                      <td className="px-4 py-2 font-medium text-foreground">{safra}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {d.deals}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-sys-green">
                        {formatBRL(d.revenue)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {d.contratos}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-primary">
                        {formatBRL(d.avgTicket)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-plan-legacy">{conv}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
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

  const metrics: { label: string; value: string; accent: StatCardProps["accent"] }[] = [
    { label: "Deals", value: data.deals.toString(), accent: "brand" },
    { label: "Receita", value: formatBRL(data.revenue), accent: "green" },
    { label: "Contratos", value: data.contratos.toString(), accent: "brand" },
    { label: "Conversao", value: `${conv}%`, accent: "purple" },
  ];

  return (
    <Card variant="plain" padding="md">
      <SectionTitle>Safra {safra}</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m) => (
          <StatCard key={m.label} label={m.label} value={m.value} accent={m.accent} />
        ))}
      </div>
      <div className="mt-3">
        <StatCard label="Ticket Medio" value={formatBRL(data.avgTicket)} accent="brand" />
      </div>
    </Card>
  );
}

// ─── Semanal Tab ───────────────────────────────────────────────────────

function SemanalTab({ data }: { data: ReportData["semanal"] }) {
  const periodStart = new Date(data.periodStart).toLocaleDateString("pt-BR");
  const periodEnd = new Date(data.periodEnd).toLocaleDateString("pt-BR");

  const kpis: { label: string; value: number; icon: typeof Users; accent: StatCardProps["accent"] }[] = [
    { label: "Novos leads", value: data.leadsThisWeek, icon: Users, accent: "brand" },
    { label: "Deals avancados", value: data.dealsAdvanced, icon: TrendingUp, accent: "green" },
    { label: "Familias contatadas", value: data.familiasContatadas, icon: Heart, accent: "purple" },
    { label: "Em risco", value: data.familiasEmRisco, icon: AlertTriangle, accent: "red" },
    { label: "Tarefas abertas", value: data.tarefasAbertas, icon: Target, accent: "orange" },
  ];

  return (
    <div className="space-y-5">
      <Card variant="glass" accent="brand" padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-title-2 text-foreground">Relatorio Semanal</h2>
            <p className="text-xs text-muted-foreground">
              Periodo: {periodStart} a {periodEnd}
            </p>
          </div>
          <ExportPDFButton title="Relatorio Semanal" variant="small" />
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {kpis.map((k) => (
            <StatCard key={k.label} label={k.label} value={k.value} icon={k.icon} accent={k.accent} />
          ))}
        </div>
      </Card>
    </div>
  );
}
