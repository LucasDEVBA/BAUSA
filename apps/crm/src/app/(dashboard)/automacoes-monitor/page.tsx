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
import { Badge, Card, PageHeader, ScrollList, StatCard } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import type { CardAccent } from "@/components/ui/Card";
import { requirePapel } from "@/lib/auth";
import { fetchMonitorData, tempoDesde } from "@/lib/automacoes-queries";
import type { AutomacaoStatus, FilaItem } from "@/lib/automacoes-queries";
import { cn, formatRelativeTime } from "@/lib/utils";

export const metadata = {
  title: "Monitor de Automacoes — BAU Global",
};

// ─── Icones por automacao ────────────────────────────────────────────────────

const AUTOMACAO_ICONS: Record<string, typeof Bot> = {
  "Qualificacao Gemini": Bot,
  "WhatsApp Inicial (22h)": MessageCircle,
  "Follow-up 1 (48h)": Send,
  "Follow-up 2 (7 dias)": RefreshCw,
  "Calendar Webhook": Calendar,
};

type StatusKey = AutomacaoStatus["status"];

const STATUS_CONFIG: Record<
  StatusKey,
  { label: string; tone: BadgeTone; accent: CardAccent; icon: typeof CheckCircle }
> = {
  operacional: { label: "Operacional", tone: "green", accent: "green", icon: CheckCircle },
  atencao: { label: "Atencao", tone: "orange", accent: "orange", icon: AlertTriangle },
  critico: { label: "Critico", tone: "red", accent: "red", icon: XCircle },
  inativo: { label: "Inativo", tone: "neutral", accent: "neutral", icon: Clock },
} as const;

// Dot pulsante por status (fill sólido — literais p/ Tailwind v4).
const STATUS_DOT: Record<StatusKey, string> = {
  operacional: "bg-sys-green",
  atencao: "bg-sys-orange",
  critico: "bg-sys-red",
  inativo: "bg-muted-foreground",
};

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
  const statusGeralLabel =
    statusGeral === "operacional"
      ? "Todas operacionais"
      : statusGeral === "atencao"
        ? "Requer atencao"
        : "Problema critico";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operacoes"
        title="Monitor de Automacoes"
        description="Acompanhe a saude das filas de qualificacao, envio de WhatsApp e deteccao de reunioes"
        actions={<StatusBadge status={statusGeral} label={statusGeralLabel} icon={statusGeralConfig.icon} />}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard icon={Zap} label="Total leads" value={metrics.totalLeads} accent="brand" />
        <StatCard icon={Bot} label="Qualificados hoje" value={metrics.qualificadosHoje} accent="purple" />
        <StatCard icon={MessageCircle} label="WhatsApp hoje" value={metrics.whatsappEnviadosHoje} accent="green" />
        <StatCard icon={Send} label="Follow-ups hoje" value={metrics.followupsEnviadosHoje} accent="blue" />
        <StatCard icon={Calendar} label="Reunioes total" value={metrics.reunioesDetectadas} accent="orange" />
        <StatCard
          icon={ShieldAlert}
          label="Com problema"
          value={metrics.leadsComProblema}
          accent={metrics.leadsComProblema > 0 ? "red" : "green"}
        />
      </div>

      {/* Status das automacoes */}
      <section className="space-y-3">
        <p className="text-eyebrow text-primary">Status das Automacoes</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          {automacoes.map((automacao) => (
            <AutomacaoCard key={automacao.nome} automacao={automacao} />
          ))}
        </div>
      </section>

      {/* Alertas criticos */}
      {data.leadsTrancados.length > 0 && (
        <Card variant="plain" padding="lg" accent="red" className="space-y-3">
          <div className="flex items-center gap-2">
            <XCircle aria-hidden className="h-4 w-4 text-sys-red" />
            <p className="text-sm font-semibold text-sys-red">
              {data.leadsTrancados.length} lead{data.leadsTrancados.length !== 1 ? "s" : ""} trancado{data.leadsTrancados.length !== 1 ? "s" : ""} na fila
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Leads QUENTE/MORNO qualificados ha mais de 48h que nao receberam WhatsApp.
            Possivel falha no scheduler ou Z-API.
          </p>
          <div className="space-y-1.5">
            {data.leadsTrancados.slice(0, 10).map((lead) => (
              <LeadAlertRow key={lead.id} lead={lead} variant="critico" />
            ))}
            {data.leadsTrancados.length > 10 && (
              <p className="pt-1 text-[11px] text-label-tertiary">
                + {data.leadsTrancados.length - 10} mais...
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Pendentes de qualificacao */}
      {data.leadsPendentesQualificacao.length > 0 && (
        <Card variant="plain" padding="lg" accent="orange" className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle aria-hidden className="h-4 w-4 text-sys-orange" />
            <p className="text-sm font-semibold text-sys-orange">
              {data.leadsPendentesQualificacao.length} lead{data.leadsPendentesQualificacao.length !== 1 ? "s" : ""} sem qualificacao
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Leads submetidos ha mais de 1 hora sem qualificacao Gemini. Verificar Cloud Function qualify-lead.
          </p>
          <div className="space-y-1.5">
            {data.leadsPendentesQualificacao.slice(0, 10).map((lead) => (
              <LeadAlertRow key={lead.id} lead={lead} variant="atencao" />
            ))}
            {data.leadsPendentesQualificacao.length > 10 && (
              <p className="pt-1 text-[11px] text-label-tertiary">
                + {data.leadsPendentesQualificacao.length - 10} mais...
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Sem problemas */}
      {data.leadsTrancados.length === 0 && data.leadsPendentesQualificacao.length === 0 && (
        <Card variant="plain" padding="lg" accent="green" className="space-y-1">
          <div className="flex items-center gap-2">
            <CheckCircle aria-hidden className="h-4 w-4 text-sys-green" />
            <p className="text-sm font-semibold text-sys-green">
              Nenhum problema detectado
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Todos os leads estao progredindo normalmente nas filas de automacao.
          </p>
        </Card>
      )}

      {/* Filas detalhadas */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <FilaSection
          titulo="Fila WhatsApp Inicial"
          descricao="Leads qualificados QUENTE/MORNO aguardando envio (>22h)"
          icon={MessageCircle}
          items={data.filaWhatsappInicial}
          tone="green"
        />
        <FilaSection
          titulo="Fila Follow-up 1"
          descricao="WhatsApp enviado >48h, sem reuniao agendada"
          icon={Send}
          items={data.filaFollowup1}
          tone="blue"
        />
        <FilaSection
          titulo="Fila Follow-up 2"
          descricao="WhatsApp enviado >7 dias, follow-up 1 ja enviado"
          icon={RefreshCw}
          items={data.filaFollowup2}
          tone="purple"
        />
      </div>

      {/* Fluxo visual */}
      <section className="space-y-3">
        <p className="text-eyebrow text-primary">Fluxo de Automacoes</p>
        <Card variant="plain" padding="lg">
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
        </Card>
      </section>
    </div>
  );
}

// ─── Tom de classificacao de lead (literais p/ Tailwind v4) ──────────────────

function classificationBadgeClass(classification: string): string {
  if (classification === "QUENTE") return "bg-lead-hot/15 text-lead-hot";
  if (classification === "MORNO") return "bg-lead-warm/15 text-lead-warm";
  return "bg-lead-cold/15 text-lead-cold";
}

// ─── Componentes ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  label,
  icon: Icon,
}: {
  status: StatusKey;
  label: string;
  icon: typeof CheckCircle;
}) {
  return (
    <Badge tone={STATUS_CONFIG[status].tone} className="px-3 py-1.5">
      <Icon aria-hidden className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Badge>
  );
}

function AutomacaoCard({ automacao }: { automacao: AutomacaoStatus }) {
  const config = STATUS_CONFIG[automacao.status];
  const AutomacaoIcon = AUTOMACAO_ICONS[automacao.nome] ?? Activity;

  return (
    <Card variant="plain" padding="md" accent={config.accent} className="flex flex-col gap-3">
      {/* Header */}
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
              STATUS_DOT[automacao.status],
              automacao.status === "operacional" && "animate-pulse",
            )}
          />
          {config.label}
        </Badge>
      </div>

      {/* Detalhes */}
      <p className="text-[11px] leading-relaxed text-muted-foreground">{automacao.detalhes}</p>

      {/* Footer */}
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
    <div className={cn(
      "flex items-center justify-between rounded-lg px-3 py-2",
      isCritico ? "bg-sys-red/5" : "bg-sys-orange/5",
    )}>
      <div className="flex min-w-0 items-center gap-3">
        <span aria-hidden className={cn(
          "h-1.5 w-1.5 flex-shrink-0 rounded-full",
          isCritico ? "bg-sys-red" : "bg-sys-orange",
        )} />
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{lead.athlete_name}</p>
          <p className="truncate text-[10px] text-muted-foreground">{lead.email}</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-3">
        {lead.classification !== "N/A" && (
          <span className={cn(
            "rounded-full px-2 py-0.5 text-[9px] font-semibold",
            classificationBadgeClass(lead.classification),
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
  tone,
}: {
  titulo: string;
  descricao: string;
  icon: typeof Zap;
  items: FilaItem[];
  tone: BadgeTone;
}) {
  return (
    <Card variant="plain" padding="none" className="flex h-[20rem] flex-col overflow-hidden">
      {/* Header */}
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

      {/* Lista */}
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
      </ScrollList>
    </Card>
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
      "flex min-w-[100px] flex-col items-center gap-1.5 rounded-lg border px-4 py-3",
      active
        ? "border-primary/30 bg-primary/5"
        : "border-border bg-background",
    )}>
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
