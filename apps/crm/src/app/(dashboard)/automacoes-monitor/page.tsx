import {
  Activity,
  AlertTriangle,
  Bot,
  Calendar,
  CheckCircle,
  Clock,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  XCircle,
  Zap,
} from "lucide-react";
import { requirePapel } from "@/lib/auth";
import { fetchMonitorData, tempoDesde } from "@/lib/automacoes-queries";
import type { AutomacaoStatus, FilaItem } from "@/lib/automacoes-queries";
import { cn, formatRelativeTime } from "@/lib/utils";

export const metadata = {
  title: "Monitor de Automacoes — BAUSA Engine",
};

// ─── Icones por automacao ────────────────────────────────────────────────────

const AUTOMACAO_ICONS: Record<string, typeof Bot> = {
  "Qualificacao Gemini": Bot,
  "WhatsApp Inicial (22h)": MessageCircle,
  "Follow-up 1 (48h)": Send,
  "Follow-up 2 (7 dias)": RefreshCw,
  "Calendar Webhook": Calendar,
};

const STATUS_CONFIG = {
  operacional: {
    label: "Operacional",
    color: "text-sys-green",
    bg: "bg-sys-green/10",
    border: "border-sys-green/20",
    icon: CheckCircle,
    dot: "bg-sys-green",
  },
  atencao: {
    label: "Atencao",
    color: "text-sys-orange",
    bg: "bg-sys-orange/10",
    border: "border-sys-orange/20",
    icon: AlertTriangle,
    dot: "bg-sys-orange",
  },
  critico: {
    label: "Critico",
    color: "text-sys-red",
    bg: "bg-sys-red/10",
    border: "border-sys-red/20",
    icon: XCircle,
    dot: "bg-sys-red",
  },
  inativo: {
    label: "Inativo",
    color: "text-muted-foreground",
    bg: "bg-secondary",
    border: "border-border",
    icon: Clock,
    dot: "bg-muted-foreground",
  },
} as const;

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function AutomacoesMonitorPage() {
  await requirePapel("ceo");

  const data = await fetchMonitorData();
  const { metrics, automacoes } = data;

  const statusGeral = automacoes.some((a) => a.status === "critico")
    ? "critico"
    : automacoes.some((a) => a.status === "atencao")
      ? "atencao"
      : "operacional";

  const statusGeralConfig = STATUS_CONFIG[statusGeral];
  const StatusGeralIcon = statusGeralConfig.icon;

  return (
    <div className="flex h-full flex-col gap-5 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Activity className="h-5 w-5 text-primary" />
            <h1 className="text-title-2 text-foreground">Monitor de Automacoes</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Acompanhe a saude das filas de qualificacao, envio de WhatsApp e deteccao de reunioes
          </p>
        </div>
        <div className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5", statusGeralConfig.border, statusGeralConfig.bg)}>
          <StatusGeralIcon className={cn("h-3.5 w-3.5", statusGeralConfig.color)} />
          <span className={cn("text-[11px] font-semibold", statusGeralConfig.color)}>
            {statusGeral === "operacional"
              ? "Todas operacionais"
              : statusGeral === "atencao"
                ? "Requer atencao"
                : "Problema critico"}
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <KpiCard
          icon={Zap}
          label="Total leads"
          value={metrics.totalLeads}
          color="indigo"
        />
        <KpiCard
          icon={Bot}
          label="Qualificados hoje"
          value={metrics.qualificadosHoje}
          color="purple"
        />
        <KpiCard
          icon={MessageCircle}
          label="WhatsApp hoje"
          value={metrics.whatsappEnviadosHoje}
          color="emerald"
        />
        <KpiCard
          icon={Send}
          label="Follow-ups hoje"
          value={metrics.followupsEnviadosHoje}
          color="blue"
        />
        <KpiCard
          icon={Calendar}
          label="Reunioes total"
          value={metrics.reunioesDetectadas}
          color="amber"
        />
        <KpiCard
          icon={ShieldAlert}
          label="Com problema"
          value={metrics.leadsComProblema}
          color={metrics.leadsComProblema > 0 ? "red" : "emerald"}
          highlight={metrics.leadsComProblema > 0}
        />
      </div>

      {/* Status das automacoes */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
          Status das Automacoes
        </p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {automacoes.map((automacao) => (
            <AutomacaoCard key={automacao.nome} automacao={automacao} />
          ))}
        </div>
      </section>

      {/* Alertas criticos */}
      {data.leadsTrancados.length > 0 && (
        <div className="rounded-xl border border-sys-red/20 bg-sys-red/5 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="h-4 w-4 text-sys-red" />
            <p className="text-sm font-semibold text-sys-red">
              {data.leadsTrancados.length} lead{data.leadsTrancados.length !== 1 ? "s" : ""} trancado{data.leadsTrancados.length !== 1 ? "s" : ""} na fila
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Leads QUENTE/MORNO qualificados ha mais de 48h que nao receberam WhatsApp.
            Possivel falha no scheduler ou Z-API.
          </p>
          <div className="space-y-1.5">
            {data.leadsTrancados.slice(0, 10).map((lead) => (
              <LeadAlertRow key={lead.id} lead={lead} variant="critico" />
            ))}
            {data.leadsTrancados.length > 10 && (
              <p className="text-[11px] text-label-tertiary pt-1">
                + {data.leadsTrancados.length - 10} mais...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Pendentes de qualificacao */}
      {data.leadsPendentesQualificacao.length > 0 && (
        <div className="rounded-xl border border-sys-orange/20 bg-sys-orange/5 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-sys-orange" />
            <p className="text-sm font-semibold text-sys-orange">
              {data.leadsPendentesQualificacao.length} lead{data.leadsPendentesQualificacao.length !== 1 ? "s" : ""} sem qualificacao
            </p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Leads submetidos ha mais de 1 hora sem qualificacao Gemini. Verificar Cloud Function qualify-lead.
          </p>
          <div className="space-y-1.5">
            {data.leadsPendentesQualificacao.slice(0, 10).map((lead) => (
              <LeadAlertRow key={lead.id} lead={lead} variant="atencao" />
            ))}
            {data.leadsPendentesQualificacao.length > 10 && (
              <p className="text-[11px] text-label-tertiary pt-1">
                + {data.leadsPendentesQualificacao.length - 10} mais...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Sem problemas */}
      {data.leadsTrancados.length === 0 && data.leadsPendentesQualificacao.length === 0 && (
        <div className="rounded-xl border border-sys-green/20 bg-sys-green/5 px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-sys-green" />
            <p className="text-sm font-semibold text-sys-green">
              Nenhum problema detectado
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Todos os leads estao progredindo normalmente nas filas de automacao.
          </p>
        </div>
      )}

      {/* Filas detalhadas */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <FilaSection
          titulo="Fila WhatsApp Inicial"
          descricao="Leads qualificados QUENTE/MORNO aguardando envio (>22h)"
          icon={MessageCircle}
          items={data.filaWhatsappInicial}
          color="emerald"
        />
        <FilaSection
          titulo="Fila Follow-up 1"
          descricao="WhatsApp enviado >48h, sem reuniao agendada"
          icon={Send}
          items={data.filaFollowup1}
          color="blue"
        />
        <FilaSection
          titulo="Fila Follow-up 2"
          descricao="WhatsApp enviado >7 dias, follow-up 1 ja enviado"
          icon={RefreshCw}
          items={data.filaFollowup2}
          color="purple"
        />
      </div>

      {/* Fluxo visual */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
          Fluxo de Automacoes
        </p>
        <div className="glass-card rounded-xl px-5 py-4">
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            <FlowStep label="Formulario" sublabel="Lead submete" icon={Zap} active />
            <FlowArrow />
            <FlowStep label="Qualificacao" sublabel="Gemini IA" icon={Bot} active={metrics.qualificadosHoje > 0} />
            <FlowArrow />
            <FlowStep label="WhatsApp 22h" sublabel="Envio inicial" icon={MessageCircle} active={metrics.whatsappEnviadosHoje > 0} />
            <FlowArrow />
            <FlowStep label="Follow-up 48h" sublabel="Sem reuniao" icon={Send} active={metrics.followupsEnviadosHoje > 0} />
            <FlowArrow />
            <FlowStep label="Follow-up 7d" sublabel="Ultimo contato" icon={RefreshCw} active />
            <FlowArrow />
            <FlowStep label="Reuniao" sublabel="Calendar webhook" icon={Calendar} active={metrics.reunioesDetectadas > 0} />
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Color maps (classes estaticas para Tailwind) ────────────────────────────

const COLOR_BG: Record<string, string> = {
  indigo: "bg-primary/10",
  purple: "bg-plan-legacy/10",
  emerald: "bg-sys-green/10",
  blue: "bg-sys-blue/10",
  amber: "bg-sys-orange/10",
  red: "bg-sys-red/10",
};

const COLOR_TEXT: Record<string, string> = {
  indigo: "text-primary",
  purple: "text-plan-legacy",
  emerald: "text-sys-green",
  blue: "text-sys-blue",
  amber: "text-sys-orange",
  red: "text-sys-red",
};

const COLOR_BADGE_BG: Record<string, string> = {
  indigo: "bg-primary/20",
  purple: "bg-plan-legacy/20",
  emerald: "bg-sys-green/20",
  blue: "bg-sys-blue/20",
  amber: "bg-sys-orange/20",
  red: "bg-sys-red/20",
};

// ─── Componentes ─────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: typeof Zap;
  label: string;
  value: number;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "glass-card flex items-center gap-3 rounded-xl px-4 py-3",
      highlight ? "border-sys-red/30" : "border-border",
    )}>
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", COLOR_BG[color])}>
        <Icon className={cn("h-4 w-4", COLOR_TEXT[color])} />
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className={cn(
          "text-sm font-bold",
          highlight ? "text-sys-red" : "text-foreground",
        )}>
          {value}
        </p>
      </div>
    </div>
  );
}

function AutomacaoCard({ automacao }: { automacao: AutomacaoStatus }) {
  const config = STATUS_CONFIG[automacao.status];
  const StatusIcon = config.icon;
  const AutomacaoIcon = AUTOMACAO_ICONS[automacao.nome] ?? Activity;

  return (
    <div className={cn(
      "glass-card rounded-xl px-4 py-4 flex flex-col gap-3",
      config.border,
    )}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <AutomacaoIcon className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-foreground">{automacao.nome}</p>
        </div>
        <div className={cn("flex items-center gap-1.5 rounded-full px-2 py-0.5", config.bg)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", config.dot, automacao.status === "operacional" && "animate-pulse")} />
          <span className={cn("text-[10px] font-medium", config.color)}>{config.label}</span>
        </div>
      </div>

      {/* Detalhes */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">{automacao.detalhes}</p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3 text-label-tertiary" />
          <p className="text-[10px] text-label-tertiary">
            {automacao.ultimaExecucao ? tempoDesde(automacao.ultimaExecucao) : "Nunca"}
          </p>
        </div>
        <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5", config.bg)}>
          <span className={cn("text-[10px] font-bold", config.color)}>{automacao.metrica}</span>
          <span className="text-[9px] text-label-tertiary">{automacao.metricaLabel}</span>
        </div>
      </div>
    </div>
  );
}

function LeadAlertRow({ lead, variant }: { lead: FilaItem; variant: "critico" | "atencao" }) {
  const isCritico = variant === "critico";
  return (
    <div className={cn(
      "flex items-center justify-between rounded-lg px-3 py-2",
      isCritico ? "bg-sys-red/5" : "bg-sys-orange/5",
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <span className={cn(
          "h-1.5 w-1.5 flex-shrink-0 rounded-full",
          isCritico ? "bg-sys-red" : "bg-sys-orange",
        )} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{lead.athlete_name}</p>
          <p className="text-[10px] text-muted-foreground truncate">{lead.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {lead.classification !== "N/A" && (
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[9px] font-semibold",
            lead.classification === "QUENTE"
              ? "bg-lead-hot/15 text-lead-hot"
              : lead.classification === "MORNO"
                ? "bg-lead-warm/15 text-lead-warm"
                : "bg-lead-cold/15 text-lead-cold",
          )}>
            {lead.classification}
          </span>
        )}
        <p className="text-[10px] text-label-tertiary">
          {formatRelativeTime(lead.created_at)}
        </p>
      </div>
    </div>
  );
}

function FilaSection({
  titulo,
  descricao,
  icon: Icon,
  items,
  color,
}: {
  titulo: string;
  descricao: string;
  icon: typeof Zap;
  items: FilaItem[];
  color: string;
}) {
  return (
    <div className="glass-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <Icon className={cn("h-4 w-4", COLOR_TEXT[color])} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{titulo}</p>
          <p className="text-[10px] text-label-tertiary">{descricao}</p>
        </div>
        <span className={cn(
          "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
          items.length > 0
            ? cn(COLOR_BADGE_BG[color], COLOR_TEXT[color])
            : "bg-secondary text-label-tertiary",
        )}>
          {items.length}
        </span>
      </div>

      {/* Lista */}
      <div className="max-h-64 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs text-label-tertiary">Fila vazia</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.slice(0, 15).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-accent">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{lead.athlete_name}</p>
                  <p className="text-[10px] text-label-tertiary truncate">{lead.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn(
                    "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                    lead.classification === "QUENTE"
                      ? "bg-lead-hot/15 text-lead-hot"
                      : "bg-lead-warm/15 text-lead-warm",
                  )}>
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
    <div className={cn(
      "flex flex-col items-center gap-1.5 rounded-lg border px-4 py-3 min-w-[100px]",
      active
        ? "border-primary/30 bg-primary/5"
        : "border-border bg-background",
    )}>
      <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-label-tertiary")} />
      <p className={cn("text-[11px] font-semibold", active ? "text-foreground" : "text-label-tertiary")}>{label}</p>
      <p className="text-[9px] text-label-tertiary">{sublabel}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center text-label-tertiary flex-shrink-0">
      <div className="h-px w-4 bg-border" />
      <span className="text-[10px]">&rarr;</span>
      <div className="h-px w-4 bg-border" />
    </div>
  );
}
