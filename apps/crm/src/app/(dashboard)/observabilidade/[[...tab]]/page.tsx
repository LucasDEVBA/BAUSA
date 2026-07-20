import {
  Activity,
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle,
  Clock,
  Info,
  ListChecks,
  MessageCircle,
  Plug,
  Radar,
  RefreshCw,
  Send,
  ShieldAlert,
  Wifi,
  XCircle,
  Zap,
} from "lucide-react";

import { Badge, Card, PageHeader, ScrollList, StatCard } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import type { CardAccent } from "@/components/ui/Card";
import { requirePapel } from "@/lib/auth";
import { fetchMonitorData, tempoDesde } from "@/lib/automacoes-queries";
import type { AutomacaoStatus, FilaItem } from "@/lib/automacoes-queries";
import {
  runChecksFilas,
  runChecksGeral,
  type CheckResult,
  type CheckStatus,
} from "@/lib/observabilidade-checks";
import { avaliarSaudeAutomacoes, type AutomacaoSaude } from "@/lib/observabilidade-automacoes";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import Link from "next/link";
import { cn, formatRelativeTime } from "@/lib/utils";
import { ObservabilidadeTabNav } from "../ObservabilidadeTabNav";
import { RefreshButton } from "../RefreshButton";
import { OBSERVABILIDADE_TABS, type ObservabilidadeTab } from "../tabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Observabilidade — BAU Global",
};

// ─── Config visual por status ────────────────────────────────────────────────

const CHECK_STYLE: Record<
  CheckStatus,
  { label: string; tone: BadgeTone; accent: CardAccent; icon: typeof CheckCircle }
> = {
  ok: { label: "OK", tone: "green", accent: "green", icon: CheckCircle },
  atencao: { label: "Atenção", tone: "orange", accent: "orange", icon: AlertTriangle },
  critico: { label: "Crítico", tone: "red", accent: "red", icon: XCircle },
  info: { label: "Info", tone: "neutral", accent: "neutral", icon: Info },
};

function statusGeralDe(checks: CheckResult[]): CheckStatus {
  if (checks.some((c) => c.status === "critico")) return "critico";
  if (checks.some((c) => c.status === "atencao")) return "atencao";
  return "ok";
}

const STATUS_GERAL_LABEL: Record<CheckStatus, string> = {
  ok: "Tudo operacional",
  atencao: "Requer atenção",
  critico: "Problema crítico",
  info: "—",
};

function fmtHorario(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

// ─── Config visual das automações (herdada do monitor antigo) ────────────────

const AUTOMACAO_ICONS: Record<string, typeof Bot> = {
  "Qualificacao Gemini": Bot,
  "WhatsApp Inicial (22h)": MessageCircle,
  "Follow-up 1 (48h)": Send,
  "Follow-up 2 (7 dias)": RefreshCw,
  "Calendar Webhook": Calendar,
};

type AutomacaoStatusKey = AutomacaoStatus["status"];

const AUTOMACAO_STATUS_CONFIG: Record<
  AutomacaoStatusKey,
  { label: string; tone: BadgeTone; accent: CardAccent; icon: typeof CheckCircle }
> = {
  operacional: { label: "Operacional", tone: "green", accent: "green", icon: CheckCircle },
  atencao: { label: "Atenção", tone: "orange", accent: "orange", icon: AlertTriangle },
  critico: { label: "Crítico", tone: "red", accent: "red", icon: XCircle },
  inativo: { label: "Inativo", tone: "neutral", accent: "neutral", icon: Clock },
} as const;

// Dot pulsante por status (fill sólido — literais p/ Tailwind v4).
const AUTOMACAO_DOT: Record<AutomacaoStatusKey, string> = {
  operacional: "bg-sys-green",
  atencao: "bg-sys-orange",
  critico: "bg-sys-red",
  inativo: "bg-muted-foreground",
};

function classificationBadgeClass(classification: string): string {
  if (classification === "QUENTE") return "bg-lead-hot/15 text-lead-hot";
  if (classification === "MORNO") return "bg-lead-warm/15 text-lead-warm";
  return "bg-lead-cold/15 text-lead-cold";
}

// ─── Page (catch-all: /observabilidade e /observabilidade/geral) ─────────────

function resolveTab(seg: string | undefined): ObservabilidadeTab {
  const found = OBSERVABILIDADE_TABS.find((t) => t.slug === seg);
  return found ? found.id : "filas";
}

export default async function ObservabilidadePage({
  params,
}: {
  params: Promise<{ tab?: string[] }>;
}) {
  await requirePapel("ceo");
  const { tab } = await params;
  const activeTab = resolveTab(tab?.[0]);

  if (activeTab === "automacoes") return <AutomacoesSaudeTab />;
  return activeTab === "filas" ? <FilasTab /> : <GeralTab />;
}

// ─── Aba 3 — Saúde das automações (auto-instrumentação, F4) ──────────────────

async function AutomacoesSaudeTab() {
  const supabase = await createServerSupabaseClient();
  const saude = await avaliarSaudeAutomacoes(supabase);

  const criticas = saude.filter((s) => s.status === "critico").length;
  const atencao = saude.filter((s) => s.status === "atencao").length;
  const saudaveis = saude.filter((s) => s.status === "ok").length;
  const pausadas = saude.filter((s) => s.status === "info").length;
  const statusGeral: CheckStatus = criticas > 0 ? "critico" : atencao > 0 ? "atencao" : "ok";
  const geralStyle = CHECK_STYLE[statusGeral];

  return (
    <div className="space-y-5">
      <ObservabilidadeTabNav />

      <PageHeader
        dense
        eyebrow="Sistema"
        title="Saúde das automações"
        description="Toda automação criada nasce vigiada — saúde derivada dos runs (erro crônico, runs presos, silêncio, sem execuções), sem nenhuma configuração"
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={geralStyle.tone} className="px-3 py-1.5">
              <geralStyle.icon aria-hidden className="h-3.5 w-3.5" />
              <span>{STATUS_GERAL_LABEL[statusGeral]}</span>
            </Badge>
            <RefreshButton />
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={XCircle} label="Críticas" value={criticas} accent={criticas > 0 ? "red" : "green"} />
        <StatCard icon={AlertTriangle} label="Atenção" value={atencao} accent={atencao > 0 ? "orange" : "green"} />
        <StatCard icon={CheckCircle} label="Saudáveis" value={saudaveis} accent="green" />
        <StatCard icon={Info} label="Pausadas" value={pausadas} accent="blue" context="sem avaliação" />
      </div>

      {/* Cards por automação */}
      <section className="space-y-3">
        <p className="text-eyebrow text-primary">Automações (sistema + suas)</p>
        {saude.length === 0 ? (
          <Card variant="plain" padding="lg">
            <p className="text-xs text-muted-foreground">Nenhuma automação cadastrada ainda.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {saude.map((s) => (
              <AutomacaoSaudeCard key={s.id} saude={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AutomacaoSaudeCard({ saude }: { saude: AutomacaoSaude }) {
  const style = CHECK_STYLE[saude.status];
  const StatusIcon = style.icon;
  return (
    <Card variant="plain" padding="md" accent={style.accent} className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-foreground">{saude.nome}</p>
        <Badge tone={style.tone} size="sm" className="shrink-0">
          <StatusIcon aria-hidden className="h-3 w-3" />
          {style.label}
        </Badge>
      </div>
      <ul className="space-y-1">
        {saude.motivos.map((m, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-current" />
            <span>{m}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex items-center justify-between border-t border-border pt-2 text-[10px] text-label-tertiary">
        <span>
          {saude.ultimaRunAt ? `última run ${formatRelativeTime(saude.ultimaRunAt)}` : "sem runs em 30d"}
          {" · "}{saude.contagens.runs30d} runs/30d
          {saude.slaHoras !== null && ` · SLA ${saude.slaHoras}h`}
        </span>
        <Link
          href={`/automacoes?tab=execucoes&automacao=${saude.id}`}
          className="font-medium text-primary hover:underline"
        >
          Ver execuções →
        </Link>
      </div>
    </Card>
  );
}

// ─── Aba 1 — Monitor de filas ────────────────────────────────────────────────

async function FilasTab() {
  const [obs, monitor] = await Promise.all([runChecksFilas(), fetchMonitorData()]);

  // Status geral = pior entre os checks novos e o status das automações (antigo).
  const statusChecks = statusGeralDe(obs.checks);
  const temAutomacaoCritica = monitor.automacoes.some((a) => a.status === "critico");
  const temAutomacaoAtencao = monitor.automacoes.some((a) => a.status === "atencao");
  const statusGeral: CheckStatus =
    statusChecks === "critico" || temAutomacaoCritica
      ? "critico"
      : statusChecks === "atencao" || temAutomacaoAtencao
        ? "atencao"
        : "ok";
  const geralStyle = CHECK_STYLE[statusGeral];

  const conexaoValor =
    obs.kpis.conexaoOnline === true ? "Online" : obs.kpis.conexaoOnline === false ? "OFFLINE" : "—";
  const { metrics } = monitor;

  return (
    <div className="space-y-5">
      <ObservabilidadeTabNav />

      <PageHeader
        dense
        eyebrow="Sistema"
        title="Monitor de filas"
        description={`Verificação executada às ${fmtHorario(obs.verificadoEm)} — detecta conexão caída, envios sem entrega, timing incorreto e filas presas`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={geralStyle.tone} className="px-3 py-1.5">
              <geralStyle.icon aria-hidden className="h-3.5 w-3.5" />
              <span>{STATUS_GERAL_LABEL[statusGeral]}</span>
            </Badge>
            <RefreshButton />
          </div>
        }
      />

      {/* KPI strip — conexão/entrega (novo) + atividade do dia (antigo) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard
          icon={Wifi}
          label="Conexão Z-API"
          value={conexaoValor}
          accent={obs.kpis.conexaoOnline === false ? "red" : obs.kpis.conexaoOnline ? "green" : "orange"}
        />
        <StatCard
          icon={Activity}
          label="Fila interna Z-API"
          value={obs.kpis.filaInternaZapi ?? "—"}
          accent={(obs.kpis.filaInternaZapi ?? 0) > 0 && obs.kpis.conexaoOnline === false ? "red" : "blue"}
          context="mensagens aguardando"
        />
        <StatCard icon={Bot} label="Qualificados hoje" value={metrics.qualificadosHoje} accent="purple" />
        <StatCard icon={Send} label="Envios marcados 24h" value={obs.kpis.enviosMarcados24h} accent="brand" />
        <StatCard
          icon={MessageCircle}
          label="Espelhadas 24h"
          value={obs.kpis.espelhadasEnviadas24h}
          accent="green"
          context="entrega confirmada"
        />
        <StatCard
          icon={ShieldAlert}
          label="Problemas"
          value={obs.kpis.problemas}
          accent={obs.kpis.problemas > 0 ? "red" : "green"}
        />
      </div>

      {/* Status das automações (visual do monitor antigo) */}
      <section className="space-y-3">
        <p className="text-eyebrow text-primary">Status das Automações</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {monitor.automacoes.map((automacao) => (
            <AutomacaoCard key={automacao.nome} automacao={automacao} />
          ))}
        </div>
      </section>

      {/* Verificações (motor novo) */}
      <section className="space-y-3">
        <p className="text-eyebrow text-primary">Verificações</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {obs.checks.map((check) => (
            <CheckCard key={check.id} check={check} />
          ))}
        </div>
      </section>

      {/* Alertas com detalhe por lead (visual do monitor antigo) */}
      {monitor.leadsTrancados.length > 0 && (
        <Card variant="plain" padding="lg" accent="red" className="space-y-3">
          <div className="flex items-center gap-2">
            <XCircle aria-hidden className="h-4 w-4 text-sys-red" />
            <p className="text-sm font-semibold text-sys-red">
              {monitor.leadsTrancados.length} lead{monitor.leadsTrancados.length !== 1 ? "s" : ""} trancado{monitor.leadsTrancados.length !== 1 ? "s" : ""} na fila
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Leads QUENTE/MORNO qualificados há mais de 48h que não receberam WhatsApp.
            Possível falha no scheduler ou Z-API.
          </p>
          <div className="space-y-1.5">
            {monitor.leadsTrancados.slice(0, 10).map((lead) => (
              <LeadAlertRow key={lead.id} lead={lead} variant="critico" />
            ))}
            {monitor.leadsTrancados.length > 10 && (
              <p className="pt-1 text-[11px] text-label-tertiary">
                + {monitor.leadsTrancados.length - 10} mais...
              </p>
            )}
          </div>
        </Card>
      )}

      {monitor.leadsPendentesQualificacao.length > 0 && (
        <Card variant="plain" padding="lg" accent="orange" className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden className="h-4 w-4 text-sys-orange" />
            <p className="text-sm font-semibold text-sys-orange">
              {monitor.leadsPendentesQualificacao.length} lead{monitor.leadsPendentesQualificacao.length !== 1 ? "s" : ""} sem qualificação
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Leads submetidos há mais de 1 hora sem qualificação Gemini. Verificar Cloud Function qualify-lead.
          </p>
          <div className="space-y-1.5">
            {monitor.leadsPendentesQualificacao.slice(0, 10).map((lead) => (
              <LeadAlertRow key={lead.id} lead={lead} variant="atencao" />
            ))}
            {monitor.leadsPendentesQualificacao.length > 10 && (
              <p className="pt-1 text-[11px] text-label-tertiary">
                + {monitor.leadsPendentesQualificacao.length - 10} mais...
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Filas normais (dentro do prazo) */}
      <section className="space-y-3">
        <p className="text-eyebrow text-primary">Filas aguardando o próximo ciclo</p>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <FilaSection
            titulo="Fila WhatsApp Inicial"
            descricao="Qualificados QUENTE/MORNO aguardando envio (>22h)"
            icon={MessageCircle}
            items={monitor.filaWhatsappInicial}
            tone="green"
          />
          <FilaSection
            titulo="Fila Follow-up 1"
            descricao="WhatsApp enviado >48h, sem reunião agendada"
            icon={Send}
            items={monitor.filaFollowup1}
            tone="blue"
          />
          <FilaSection
            titulo="Fila Follow-up 2"
            descricao="WhatsApp enviado >7 dias, follow-up 1 já enviado"
            icon={RefreshCw}
            items={monitor.filaFollowup2}
            tone="purple"
          />
        </div>
      </section>

      {/* Fluxo visual (herdado do monitor antigo) */}
      <section className="space-y-3">
        <p className="text-eyebrow text-primary">Fluxo de Automações</p>
        <Card variant="plain" padding="lg">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            <FlowStep label="Formulário" sublabel="Lead submete" icon={Zap} active />
            <FlowArrow />
            <FlowStep label="Qualificação" sublabel="Gemini IA" icon={Bot} active={metrics.qualificadosHoje > 0} />
            <FlowArrow />
            <FlowStep label="WhatsApp 22h" sublabel="Envio inicial" icon={MessageCircle} active={metrics.whatsappEnviadosHoje > 0} />
            <FlowArrow />
            <FlowStep label="Follow-up 48h" sublabel="Sem reunião" icon={Send} active={metrics.followupsEnviadosHoje > 0} />
            <FlowArrow />
            <FlowStep label="Follow-up 7d" sublabel="Último contato" icon={RefreshCw} active />
            <FlowArrow />
            <FlowStep label="Reunião" sublabel="Calendar webhook" icon={Calendar} active={metrics.reunioesDetectadas > 0} />
          </div>
        </Card>
      </section>
    </div>
  );
}

// ─── Aba 2 — Observabilidade geral ───────────────────────────────────────────

async function GeralTab() {
  const geral = await runChecksGeral();
  const todos = [...geral.conexoes, ...geral.fluxos];
  const statusGeral = statusGeralDe(todos);
  const geralStyle = CHECK_STYLE[statusGeral];
  const f = geral.funil24h;

  return (
    <div className="space-y-5">
      <ObservabilidadeTabNav />

      <PageHeader
        dense
        eyebrow="Sistema"
        title="Observabilidade geral"
        description={`Verificação executada às ${fmtHorario(geral.verificadoEm)} — conexões e fluxos ponta a ponta do sistema`}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={geralStyle.tone} className="px-3 py-1.5">
              <geralStyle.icon aria-hidden className="h-3.5 w-3.5" />
              <span>{STATUS_GERAL_LABEL[statusGeral]}</span>
            </Badge>
            <RefreshButton />
          </div>
        }
      />

      {/* Funil das últimas 24h — o fluxo vivo, etapa a etapa */}
      <section className="space-y-3">
        <p className="text-eyebrow text-primary">Fluxo das últimas 24h</p>
        <Card variant="plain" padding="lg">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            <FunilStep label="Leads" sublabel="formulário" valor={f.leads} icon={ListChecks} />
            <FunilArrow />
            <FunilStep label="Qualificados" sublabel="Gemini" valor={f.qualificados} icon={Radar} />
            <FunilArrow />
            <FunilStep label="Envios marcados" sublabel="schedulers" valor={f.whatsappMarcado} icon={Send} />
            <FunilArrow />
            <FunilStep
              label="Entregas espelhadas"
              sublabel="confirmação real"
              valor={f.espelhadas}
              icon={MessageCircle}
              alerta={f.whatsappMarcado > 0 && f.espelhadas === 0}
            />
            <FunilArrow />
            <FunilStep label="Reuniões" sublabel="calendar" valor={f.reunioes} icon={Activity} />
          </div>
          {f.whatsappMarcado > 0 && f.espelhadas === 0 && (
            <p className="mt-3 text-xs font-medium text-sys-red">
              Envios foram marcados nas últimas 24h mas NENHUMA entrega foi espelhada — forte indício de conexão caída.
            </p>
          )}
        </Card>
      </section>

      {/* Conexões */}
      <section className="space-y-3">
        <p className="text-eyebrow text-primary">Conexões</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {geral.conexoes.map((check) => (
            <CheckCard key={check.id} check={check} compacto />
          ))}
        </div>
      </section>

      {/* Fluxos */}
      <section className="space-y-3">
        <p className="text-eyebrow text-primary">Fluxos</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {geral.fluxos.map((check) => (
            <CheckCard key={check.id} check={check} />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Componentes ─────────────────────────────────────────────────────────────

function CheckCard({ check, compacto = false }: { check: CheckResult; compacto?: boolean }) {
  const style = CHECK_STYLE[check.status];
  const StatusIcon = style.icon;

  return (
    <Card variant="plain" padding="md" accent={style.accent} className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Plug aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="truncate text-xs font-semibold text-foreground">{check.titulo}</p>
        </div>
        <Badge tone={style.tone} size="sm" className="shrink-0">
          <StatusIcon aria-hidden className="h-3 w-3" />
          {style.label}
        </Badge>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">{check.resumo}</p>
      {!compacto && check.detalhes.length > 0 && (
        <ul className="space-y-1 border-t border-border pt-2">
          {check.detalhes.map((d, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[10px] leading-relaxed text-label-tertiary">
              <span aria-hidden className="mt-1 h-1 w-1 shrink-0 rounded-full bg-current" />
              <span>{d}</span>
            </li>
          ))}
        </ul>
      )}
      {typeof check.latenciaMs === "number" && (
        <p className="text-[10px] text-label-tertiary">{check.latenciaMs}ms</p>
      )}
    </Card>
  );
}

function FilaSection({
  titulo,
  descricao,
  icon: Icon,
  items,
  tone,
}: {
  titulo: string;
  descricao: string;
  icon: typeof Send;
  items: FilaItem[];
  tone: BadgeTone;
}) {
  return (
    <Card variant="plain" padding="none" className="flex h-[20rem] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
        <Icon aria-hidden className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">{titulo}</p>
          <p className="text-[10px] text-label-tertiary">{descricao}</p>
        </div>
        <Badge tone={items.length > 0 ? tone : "neutral"} size="sm" className="min-w-5 justify-center font-bold">
          {items.length}
        </Badge>
      </div>

      <ScrollList gutter={false}>
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <p className="text-xs text-label-tertiary">Fila vazia</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.slice(0, 15).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{lead.athlete_name}</p>
                  <p className="truncate text-[10px] text-label-tertiary">{lead.email}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      lead.classification === "QUENTE"
                        ? "bg-lead-hot/15 text-lead-hot"
                        : "bg-lead-warm/15 text-lead-warm",
                    )}
                  >
                    {lead.classification}
                  </span>
                  <p className="text-[10px] text-label-tertiary">
                    {lead.qualified_at ? formatRelativeTime(lead.qualified_at) : "—"}
                  </p>
                </div>
              </div>
            ))}
            {items.length > 15 && (
              <div className="px-4 py-2 text-center">
                <p className="text-[10px] text-label-tertiary">+ {items.length - 15} mais na fila</p>
              </div>
            )}
          </div>
        )}
      </ScrollList>
    </Card>
  );
}

function FunilStep({
  label,
  sublabel,
  valor,
  icon: Icon,
  alerta = false,
}: {
  label: string;
  sublabel: string;
  valor: number;
  icon: typeof Send;
  alerta?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[110px] flex-col items-center gap-1 rounded-lg border px-4 py-3",
        alerta ? "border-sys-red/40 bg-sys-red/5" : valor > 0 ? "border-primary/30 bg-primary/5" : "border-border bg-background",
      )}
    >
      <Icon
        aria-hidden
        className={cn("h-4 w-4", alerta ? "text-sys-red" : valor > 0 ? "text-primary" : "text-label-tertiary")}
      />
      <p className={cn("text-lg font-bold tabular-nums", alerta ? "text-sys-red" : "text-foreground")}>{valor}</p>
      <p className="text-[11px] font-semibold text-foreground">{label}</p>
      <p className="text-[9px] text-label-tertiary">{sublabel}</p>
    </div>
  );
}

function FunilArrow() {
  return (
    <div aria-hidden className="flex flex-shrink-0 items-center text-label-tertiary">
      <div className="h-px w-4 bg-border" />
      <span className="text-[10px]">&rarr;</span>
      <div className="h-px w-4 bg-border" />
    </div>
  );
}

// ─── Componentes herdados do monitor antigo (visual preservado) ──────────────

function AutomacaoCard({ automacao }: { automacao: AutomacaoStatus }) {
  const config = AUTOMACAO_STATUS_CONFIG[automacao.status];
  const AutomacaoIcon = AUTOMACAO_ICONS[automacao.nome] ?? Activity;

  return (
    <Card variant="plain" padding="md" accent={config.accent} className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <AutomacaoIcon aria-hidden className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-foreground">{automacao.nome}</p>
        </div>
        <Badge tone={config.tone} size="sm">
          <span
            aria-hidden
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              AUTOMACAO_DOT[automacao.status],
              automacao.status === "operacional" && "animate-pulse",
            )}
          />
          {config.label}
        </Badge>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">{automacao.detalhes}</p>

      <div className="mt-auto flex items-center justify-between border-t border-border pt-2">
        <div className="flex items-center gap-1">
          <Clock aria-hidden className="h-3 w-3 text-label-tertiary" />
          <p className="text-[10px] text-label-tertiary">
            {automacao.ultimaExecucao ? tempoDesde(automacao.ultimaExecucao) : "Nunca"}
          </p>
        </div>
        <Badge tone={config.tone} size="sm">
          <span className="font-bold">{automacao.metrica}</span>
          <span className="font-normal opacity-70">{automacao.metricaLabel}</span>
        </Badge>
      </div>
    </Card>
  );
}

function LeadAlertRow({ lead, variant }: { lead: FilaItem; variant: "critico" | "atencao" }) {
  const isCritico = variant === "critico";
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg px-3 py-2",
        isCritico ? "bg-sys-red/5" : "bg-sys-orange/5",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", isCritico ? "bg-sys-red" : "bg-sys-orange")}
        />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{lead.athlete_name}</p>
          <p className="truncate text-[10px] text-muted-foreground">{lead.email}</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">
        {lead.classification !== "N/A" && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[9px] font-semibold",
              classificationBadgeClass(lead.classification),
            )}
          >
            {lead.classification}
          </span>
        )}
        <p className="text-[10px] text-label-tertiary">{formatRelativeTime(lead.created_at)}</p>
      </div>
    </div>
  );
}

function FlowStep({
  label,
  sublabel,
  icon: Icon,
  active,
}: {
  label: string;
  sublabel: string;
  icon: typeof Zap;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-[100px] flex-col items-center gap-1.5 rounded-lg border px-4 py-3",
        active ? "border-primary/30 bg-primary/5" : "border-border bg-background",
      )}
    >
      <Icon aria-hidden className={cn("h-4 w-4", active ? "text-primary" : "text-label-tertiary")} />
      <p className={cn("text-[11px] font-semibold", active ? "text-foreground" : "text-label-tertiary")}>{label}</p>
      <p className="text-[9px] text-label-tertiary">{sublabel}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div aria-hidden className="flex flex-shrink-0 items-center text-label-tertiary">
      <div className="h-px w-4 bg-border" />
      <span className="text-[10px]">&rarr;</span>
      <div className="h-px w-4 bg-border" />
    </div>
  );
}
