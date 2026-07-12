"use client";

import {
  AlertTriangle,
  Clock,
  Phone,
  Calendar,
  ChevronRight,
  Users,
  Flame,
  Activity,
  BarChart3,
  FileText,
  GraduationCap,
  Sparkles,
  Video,
} from "lucide-react";
import {
  JOURNEY_STAGE_CONFIG,
  FAMILY_STATUS_CONFIG,
  TEMPERATURE_CONFIG,
  type Family,
} from "@/types/family";
import { type JourneyConfigMap } from "@/lib/fases-familia";
import type { Tarefa } from "@/types/crm";
import type { OnboardingResumo } from "@/lib/actions/onboarding";
import { Card, EmptyState, PageHeader, ScrollList, StatCard } from "@/components/ui";
import { cn } from "@/lib/utils";
import { MinhaAreaTabNav } from "./MinhaAreaTabNav";
import type { MinhaAreaTab } from "./tabs";

// --- Tipos ---

interface PerformanceMetrics {
  totalFamilias: number;
  mediaSatisfacao: number;
  mediaAnsiedade: number;
  contatosSemana: number;
}

interface ProximaReuniao {
  id: string;
  experiencia_id: string;
  titulo: string;
  data_hora: string;
  link_reuniao: string | null;
  assuntos: string[];
  experiencia: { atleta: { nome_completo: string } | null } | null;
}

interface StatusCounts {
  satisfeitas: number;
  atencao: number;
  crise: number;
  total: number;
}

interface MinhaAreaClientProps {
  /** Aba ativa (resolvida da URL `/minha-area/<slug>` no server). */
  activeTab: MinhaAreaTab;
  families: Family[];
  tarefas: Tarefa[];
  userName: string;
  performance: PerformanceMetrics;
  onboardings: OnboardingResumo[];
  proximasReunioes: ProximaReuniao[];
  /** Config das fases (rótulo/ordem/alerta configurados pelo CEO). Default: estático. */
  journeyConfig?: JourneyConfigMap;
}

interface UpcomingContact {
  familyId: string;
  athleteName: string;
  date: string;
  status: Family["family_status"];
}

// --- Estilos compartilhados (padrão war-room: linha leve dentro de card glass) ---

const ROW_NEUTRAL =
  "flex w-full items-center gap-3 rounded-lg border border-border bg-popover px-3 py-2.5 text-left transition-colors hover:bg-accent";

// Lista rolável só quando passa do teto — abaixo disso o card encolhe (sem vão).
const LIST_MAX = "space-y-2 max-h-[22rem]";

// --- Helpers ---

const STATUS_PRIORITY: Record<Family["family_status"], number> = {
  crise: 0,
  atencao: 1,
  satisfeita: 2,
};

function sortFamilies(a: Family, b: Family): number {
  const statusDiff = STATUS_PRIORITY[a.family_status] - STATUS_PRIORITY[b.family_status];
  if (statusDiff !== 0) return statusDiff;
  return b.days_without_contact - a.days_without_contact;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function isOverdue(prazo: string): boolean {
  return new Date(prazo).getTime() < Date.now();
}

/** Cabeçalho denso de card: caixinha colorida + título + subtítulo. */
function SectionHeader({
  icon: Icon,
  iconWrap,
  iconColor,
  title,
  subtitle,
}: {
  icon: typeof Flame;
  iconWrap: string;
  iconColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4 flex shrink-0 items-center gap-2">
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", iconWrap)}>
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function ScoreBar({
  value,
  max = 5,
  color,
  label,
}: {
  value: number;
  max?: number;
  color: string;
  label: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground w-4 text-right">{value}</span>
    </div>
  );
}

// --- Sub-Components ---

function UrgentActionsSection({
  urgentFamilies,
  overdueTasks,
  onFamilyClick,
}: {
  urgentFamilies: Family[];
  overdueTasks: Tarefa[];
  onFamilyClick: (id: string) => void;
}) {
  const totalUrgent = urgentFamilies.length + overdueTasks.length;

  return (
    <Card className="flex flex-col">
      <SectionHeader
        icon={Flame}
        iconWrap="bg-sys-red/10"
        iconColor="text-sys-red"
        title="Fazer Agora"
        subtitle={
          totalUrgent === 0
            ? "Nenhuma ação urgente"
            : `${totalUrgent} ${totalUrgent === 1 ? "item requer" : "itens requerem"} atenção`
        }
      />

      {totalUrgent === 0 ? (
        <EmptyState icon={Flame} title="Tudo em dia! Nenhuma ação urgente." className="py-8" />
      ) : (
        <ScrollList className={LIST_MAX}>
          {urgentFamilies.map((f) => {
            const statusCfg = FAMILY_STATUS_CONFIG[f.family_status];
            return (
              <button key={`fam-${f.id}`} onClick={() => onFamilyClick(f.id)} className={ROW_NEUTRAL}>
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", statusCfg.bg)}>
                  <AlertTriangle className={cn("h-4 w-4", statusCfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.athlete_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {statusCfg.label} — {f.days_without_contact}d sem contato
                  </p>
                </div>
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
                    f.family_status === "crise"
                      ? "bg-sys-red/15 text-sys-red"
                      : "bg-sys-orange/15 text-sys-orange"
                  )}
                >
                  {statusCfg.label}
                </span>
                <ChevronRight className="h-4 w-4 text-label-tertiary" />
              </button>
            );
          })}

          {overdueTasks.map((t) => (
            <div
              key={`task-${t.id}`}
              className="flex items-center gap-3 rounded-lg border border-sys-red/20 bg-sys-red/5 px-3 py-2.5"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-red/10">
                <Clock className="h-4 w-4 text-sys-red" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.titulo}</p>
                <p className="text-[11px] text-muted-foreground">
                  Venceu em {formatDate(t.prazo)} —{" "}
                  {t.prioridade === "critica" ? "Prioridade crítica" : `Prioridade ${t.prioridade}`}
                </p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sys-red/15 text-sys-red">
                atrasada
              </span>
            </div>
          ))}
        </ScrollList>
      )}
    </Card>
  );
}

function FamilyCard({
  family,
  journeyConfig,
  onClick,
}: {
  family: Family;
  journeyConfig: JourneyConfigMap;
  onClick: () => void;
}) {
  const tempCfg = TEMPERATURE_CONFIG[family.temperature];
  const statusCfg = FAMILY_STATUS_CONFIG[family.family_status];
  const stageCfg = journeyConfig[family.journey_stage];

  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-border bg-popover p-3.5 text-left shadow-sm transition-all hover:bg-accent hover:shadow-md"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base" title={tempCfg.label}>
            {tempCfg.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {family.athlete_name}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {family.guardian_name}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0",
            statusCfg.bg,
            statusCfg.color
          )}
        >
          {statusCfg.label}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">
          {stageCfg?.label ?? family.journey_stage}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {family.days_without_contact}d sem contato
        </span>
      </div>

      <div className="space-y-1.5">
        <ScoreBar
          value={family.satisfaction_level}
          color="bg-sys-green"
          label="Satisf."
        />
        <ScoreBar
          value={family.anxiety_level}
          color="bg-sys-orange"
          label="Ansied."
        />
      </div>
    </button>
  );
}

function MyFamiliesSection({
  families,
  journeyConfig,
  onFamilyClick,
}: {
  families: Family[];
  journeyConfig: JourneyConfigMap;
  onFamilyClick: (id: string) => void;
}) {
  const sorted = [...families].sort(sortFamilies);

  return (
    <Card className="flex flex-col">
      <SectionHeader
        icon={Users}
        iconWrap="bg-primary/10"
        iconColor="text-primary"
        title="Minhas Famílias"
        subtitle={`${families.length} ${families.length === 1 ? "família" : "famílias"} ativas`}
      />

      {families.length === 0 ? (
        <EmptyState icon={Users} title="Nenhuma família atribuída ainda." className="py-8" />
      ) : (
        <ScrollList className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[26rem]">
          {sorted.map((f) => (
            <FamilyCard
              key={f.id}
              family={f}
              journeyConfig={journeyConfig}
              onClick={() => onFamilyClick(f.id)}
            />
          ))}
        </ScrollList>
      )}
    </Card>
  );
}

function OnboardingsSection({
  onboardings,
}: {
  onboardings: OnboardingResumo[];
}) {
  return (
    <Card className="flex flex-col">
      <SectionHeader
        icon={Sparkles}
        iconWrap="bg-primary/10"
        iconColor="text-primary"
        title="Onboardings Ativos"
        subtitle={
          onboardings.length === 0
            ? "Nenhum onboarding em andamento"
            : `${onboardings.length} família${onboardings.length === 1 ? "" : "s"} em onboarding`
        }
      />

      {onboardings.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nenhum onboarding em andamento"
          description="Famílias entrarão aqui quando o deal atingir admission_process."
          className="py-8"
        />
      ) : (
        <ScrollList className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[26rem]">
          {onboardings.map((o) => {
            const atrasada = o.atrasadas > 0;
            const proximaPrazo = o.proxima_prazo
              ? new Date(o.proxima_prazo).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "short",
                })
              : null;
            return (
              <a
                key={o.instancia_id}
                href={`/familias-crm/onboarding/${o.experiencia_id}`}
                className="block rounded-2xl border border-border bg-popover p-3.5 shadow-sm transition-all hover:bg-accent hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {o.atleta_nome}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {o.responsavel_nome}
                    </p>
                  </div>
                  {atrasada && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sys-red/15 text-sys-red shrink-0">
                      {o.atrasadas} atrasada{o.atrasadas > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Progresso</span>
                    <span className="font-semibold text-foreground">
                      {o.concluidas}/{o.total}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-fill-4 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        o.percent === 100
                          ? "bg-sys-green"
                          : atrasada
                            ? "bg-sys-red"
                            : "bg-primary",
                      )}
                      style={{ width: `${o.percent}%` }}
                    />
                  </div>
                </div>

                {o.proxima_titulo && (
                  <div className="rounded-md bg-card border border-border px-2.5 py-1.5">
                    <p className="text-[10px] text-muted-foreground">
                      Próxima etapa
                    </p>
                    <p className="text-xs font-medium text-foreground truncate">
                      {o.proxima_titulo}
                    </p>
                    {proximaPrazo && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Prazo: {proximaPrazo}
                      </p>
                    )}
                  </div>
                )}
              </a>
            );
          })}
        </ScrollList>
      )}
    </Card>
  );
}

function ProximasReunioesSection({
  reunioes,
}: {
  reunioes: ProximaReuniao[];
}) {
  return (
    <Card className="flex flex-col">
      <SectionHeader
        icon={Video}
        iconWrap="bg-sys-blue/10"
        iconColor="text-sys-blue"
        title="Próximas Reuniões"
        subtitle={
          reunioes.length === 0
            ? "Nenhuma reunião agendada"
            : `${reunioes.length} reunião${reunioes.length === 1 ? "" : "ões"} agendada${reunioes.length === 1 ? "" : "s"}`
        }
      />

      {reunioes.length === 0 ? (
        <EmptyState icon={Video} title="Nenhuma reunião agendada nos próximos dias." className="py-8" />
      ) : (
        <ScrollList className={LIST_MAX}>
          {reunioes.map((r) => {
            const data = new Date(r.data_hora);
            const isToday = data.toDateString() === new Date().toDateString();
            const atleta = r.experiencia?.atleta?.nome_completo ?? "Atleta";
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-popover px-3 py-2.5 transition-colors hover:bg-accent"
              >
                <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-sys-blue/10 text-sys-blue">
                  <span className="text-[10px] font-semibold uppercase">
                    {data.toLocaleDateString("pt-BR", { month: "short" })}
                  </span>
                  <span className="text-sm font-bold leading-none">
                    {data.getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {r.titulo}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {atleta} ·{" "}
                    {data.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {r.assuntos.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      Assuntos: {r.assuntos.slice(0, 3).join(", ")}
                      {r.assuntos.length > 3 ? "..." : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {isToday && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sys-orange/15 text-sys-orange">
                      Hoje
                    </span>
                  )}
                  {r.link_reuniao && (
                    <a
                      href={r.link_reuniao}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] font-semibold text-sys-blue hover:underline"
                    >
                      Abrir link
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </ScrollList>
      )}
    </Card>
  );
}

function WeekSection({ contacts }: { contacts: UpcomingContact[] }) {
  return (
    <Card className="flex flex-col">
      <SectionHeader
        icon={Calendar}
        iconWrap="bg-plan-legacy/10"
        iconColor="text-plan-legacy"
        title="Minha Semana"
        subtitle={
          contacts.length === 0
            ? "Nenhum contato agendado"
            : `${contacts.length} ${contacts.length === 1 ? "contato" : "contatos"} nos próximos 7 dias`
        }
      />

      {contacts.length === 0 ? (
        <EmptyState icon={Calendar} title="Nenhum contato agendado para os próximos 7 dias." className="py-8" />
      ) : (
        <ScrollList className={LIST_MAX}>
          {contacts.map((c, i) => {
            const statusCfg = FAMILY_STATUS_CONFIG[c.status];
            const dateObj = new Date(c.date);
            const isToday =
              dateObj.toDateString() === new Date().toDateString();
            // eslint-disable-next-line react-hooks/purity
            const tomorrowDate = new Date(Date.now() + 86400000).toDateString();
            const isTomorrow = dateObj.toDateString() === tomorrowDate;
            const dateLabel = isToday
              ? "Hoje"
              : isTomorrow
                ? "Amanhã"
                : dateObj.toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                  });

            return (
              <div
                key={`wk-${c.familyId}-${i}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-popover px-3 py-2.5 transition-colors hover:bg-accent"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    isToday ? "bg-primary/10" : "bg-secondary"
                  )}
                >
                  <Phone
                    className={cn(
                      "h-4 w-4",
                      isToday ? "text-primary" : "text-muted-foreground"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {c.athleteName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
                </div>
                <div
                  className={cn(
                    "h-2 w-2 rounded-full shrink-0",
                    statusCfg.dot
                  )}
                  title={statusCfg.label}
                />
              </div>
            );
          })}
        </ScrollList>
      )}
    </Card>
  );
}

// --- Inatividade: threshold por fase vem do config (alertDays) ---

function inactivityThreshold(
  journeyConfig: JourneyConfigMap,
  stage: Family["journey_stage"],
): number {
  const alertDays = journeyConfig[stage]?.alertDays ?? 7;
  // alertDays <= 0 (ex.: encerrado) = fase sem alerta de inatividade
  return alertDays > 0 ? alertDays : Number.POSITIVE_INFINITY;
}

function NeedContactSection({
  families,
  journeyConfig,
  onFamilyClick,
}: {
  families: Family[];
  journeyConfig: JourneyConfigMap;
  onFamilyClick: (id: string) => void;
}) {
  const needContact = [...families]
    .filter((f) => {
      const threshold = inactivityThreshold(journeyConfig, f.journey_stage);
      return f.days_without_contact >= threshold && f.journey_stage !== "encerrado";
    })
    .sort((a, b) => b.days_without_contact - a.days_without_contact);

  return (
    <Card className="flex flex-col">
      <SectionHeader
        icon={Phone}
        iconWrap="bg-sys-orange/10"
        iconColor="text-sys-orange"
        title="Famílias que precisam de contato"
        subtitle={
          needContact.length === 0
            ? "Todas em dia"
            : `${needContact.length} ${needContact.length === 1 ? "família" : "famílias"} acima do limite de inatividade`
        }
      />

      {needContact.length === 0 ? (
        <EmptyState icon={Phone} title="Todas as famílias estão dentro do prazo de contato." className="py-8" />
      ) : (
        <ScrollList className={LIST_MAX}>
          {needContact.map((f) => {
            const threshold = inactivityThreshold(journeyConfig, f.journey_stage);
            const isOverThreshold = f.days_without_contact >= threshold;
            const tempCfg = TEMPERATURE_CONFIG[f.temperature];
            const stageCfg = journeyConfig[f.journey_stage];

            return (
              <button key={`nc-${f.id}`} onClick={() => onFamilyClick(f.id)} className={ROW_NEUTRAL}>
                <span className="text-base" title={tempCfg.label}>
                  {tempCfg.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {f.athlete_name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {stageCfg?.label ?? f.journey_stage}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs font-bold tabular-nums",
                    isOverThreshold ? "text-sys-red" : "text-muted-foreground"
                  )}
                >
                  {f.days_without_contact}d
                </span>
                <ChevronRight className="h-4 w-4 text-label-tertiary" />
              </button>
            );
          })}
        </ScrollList>
      )}
    </Card>
  );
}

function AdmissaoSection({
  families,
  journeyConfig,
  onFamilyClick,
}: {
  families: Family[];
  journeyConfig: JourneyConfigMap;
  onFamilyClick: (id: string) => void;
}) {
  const admissaoFamilies = families.filter(
    (f) => f.journey_stage === "admissao" || f.journey_stage === "aprovado"
  );

  return (
    <Card className="flex flex-col">
      <SectionHeader
        icon={GraduationCap}
        iconWrap="bg-sys-blue/15"
        iconColor="text-sys-blue"
        title="Processos de admissão ativos"
        subtitle={
          admissaoFamilies.length === 0
            ? "Nenhum processo ativo"
            : `${admissaoFamilies.length} ${admissaoFamilies.length === 1 ? "processo" : "processos"}`
        }
      />

      {admissaoFamilies.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Nenhum processo de admissão ativo no momento." className="py-8" />
      ) : (
        <ScrollList className={LIST_MAX}>
          {admissaoFamilies.map((f) => {
            const stageCfg = journeyConfig[f.journey_stage];
            const hasSchool = Boolean(f.escola_confirmada_id);

            return (
              <button key={`adm-${f.id}`} onClick={() => onFamilyClick(f.id)} className={ROW_NEUTRAL}>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-blue/15">
                  <FileText className="h-4 w-4 text-sys-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {f.athlete_name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                      {stageCfg?.label ?? f.journey_stage}
                    </span>
                    {hasSchool && (
                      <span className="text-[10px] text-sys-green bg-sys-green/15 px-2 py-0.5 rounded">
                        Escola confirmada
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-label-tertiary" />
              </button>
            );
          })}
        </ScrollList>
      )}
    </Card>
  );
}

function PerformanceSection({ performance }: { performance: PerformanceMetrics }) {
  return (
    <Card className="flex flex-col">
      <SectionHeader
        icon={BarChart3}
        iconWrap="bg-sys-green/15"
        iconColor="text-sys-green"
        title="Meu desempenho"
        subtitle="Resumo da semana"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Total famílias"
          value={performance.totalFamilias}
          icon={Users}
          accent="brand"
        />
        <StatCard
          label="Média satisfação"
          value={performance.mediaSatisfacao}
          icon={Activity}
          accent="green"
        />
        <StatCard
          label="Média ansiedade"
          value={performance.mediaAnsiedade}
          icon={AlertTriangle}
          accent="orange"
        />
        <StatCard
          label="Contatos semana"
          value={performance.contatosSemana}
          icon={Phone}
          accent="blue"
        />
      </div>
    </Card>
  );
}

/** Distribuição da carteira por situação — reusa os counts já calculados (sem dado novo). */
function StatusDistributionSection({ counts }: { counts: StatusCounts }) {
  const rows = [
    { key: "satisfeitas", label: "Satisfeitas", value: counts.satisfeitas, bar: "bg-sys-green", tint: "text-sys-green" },
    { key: "atencao", label: "Atenção", value: counts.atencao, bar: "bg-sys-orange", tint: "text-sys-orange" },
    { key: "crise", label: "Crise", value: counts.crise, bar: "bg-sys-red", tint: "text-sys-red" },
  ];

  return (
    <Card className="flex flex-col">
      <SectionHeader
        icon={Users}
        iconWrap="bg-primary/10"
        iconColor="text-primary"
        title="Distribuição da carteira"
        subtitle={
          counts.total === 0
            ? "Sem famílias na carteira"
            : `${counts.total} ${counts.total === 1 ? "família" : "famílias"} por situação`
        }
      />

      <div className="space-y-3">
        {rows.map((r) => {
          const pct = counts.total > 0 ? Math.round((r.value / counts.total) * 100) : 0;
          return (
            <div key={r.key} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{r.label}</span>
                <span className={cn("font-semibold tabular-nums", r.tint)}>
                  {r.value} · {pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn("h-full rounded-full transition-all", r.bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// --- Main Component ---

export function MinhaAreaClient({
  activeTab,
  families,
  tarefas,
  userName,
  performance,
  onboardings,
  proximasReunioes,
  journeyConfig = JOURNEY_STAGE_CONFIG,
}: MinhaAreaClientProps) {
  // Familias urgentes: crise ou atencao
  const urgentFamilies = families
    .filter((f) => f.family_status === "crise" || f.family_status === "atencao")
    .sort(sortFamilies);

  // Tarefas atrasadas
  const overdueTasks = tarefas.filter((t) => isOverdue(t.prazo));

  // Contatos nos proximos 7 dias
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const sevenDaysMs = 7 * 86400000;
  const upcomingContacts: UpcomingContact[] = families
    .filter((f) => {
      const nextDate = new Date(f.next_contact_date).getTime();
      return nextDate >= now && nextDate <= now + sevenDaysMs;
    })
    .sort(
      (a, b) =>
        new Date(a.next_contact_date).getTime() -
        new Date(b.next_contact_date).getTime()
    )
    .map((f) => ({
      familyId: f.id,
      athleteName: f.athlete_name,
      date: f.next_contact_date,
      status: f.family_status,
    }));

  const handleFamilyClick = (id: string) => {
    // Navega para familias-crm com a familia selecionada
    window.location.href = `/familias-crm?familia=${id}`;
  };

  // Greeting baseado na hora do dia
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // Metricas rapidas
  const criseCount = families.filter((f) => f.family_status === "crise").length;
  const atencaoCount = families.filter(
    (f) => f.family_status === "atencao"
  ).length;
  const satisfeitaCount = families.filter(
    (f) => f.family_status === "satisfeita"
  ).length;

  const statusCounts: StatusCounts = {
    satisfeitas: satisfeitaCount,
    atencao: atencaoCount,
    crise: criseCount,
    total: families.length,
  };

  return (
    <div>
      {/* Sub-nav sticky — cada aba é uma sub-rota real (subpágina no sidebar). */}
      <MinhaAreaTabNav />

      <div className="space-y-5 pt-4">
        {/* Header + Quick Stats — sempre visíveis (contexto em toda aba) */}
        <PageHeader dense
          eyebrow={`${greeting}, ${userName.split(" ")[0]}`}
          title="Sua Área"
          description={`Você tem ${families.length} ${
            families.length === 1 ? "família" : "famílias"
          } sob seu acompanhamento`}
        />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total" value={families.length} icon={Users} accent="brand" />
          <StatCard
            label="Satisfeitas"
            value={satisfeitaCount}
            icon={Activity}
            accent="green"
          />
          <StatCard
            label="Atenção"
            value={atencaoCount}
            icon={Clock}
            accent="orange"
          />
          <StatCard
            label="Crise"
            value={criseCount}
            icon={AlertTriangle}
            accent="red"
          />
        </div>

        {/* Aba HOJE — o dia a dia: o que fazer agora, reuniões e a semana.
            Grid de cards content-sized, topo alinhado (items-start) — sem vãos. */}
        {activeTab === "hoje" && (
          <div className="grid gap-4 lg:grid-cols-3 items-start">
            <UrgentActionsSection
              urgentFamilies={urgentFamilies}
              overdueTasks={overdueTasks}
              onFamilyClick={handleFamilyClick}
            />
            <ProximasReunioesSection reunioes={proximasReunioes} />
            <WeekSection contacts={upcomingContacts} />
          </div>
        )}

        {/* Aba FAMÍLIAS — carteira + quem precisa de contato */}
        {activeTab === "familias" && (
          <div className="space-y-4">
            <NeedContactSection
              families={families}
              journeyConfig={journeyConfig}
              onFamilyClick={handleFamilyClick}
            />
            <MyFamiliesSection
              families={families}
              journeyConfig={journeyConfig}
              onFamilyClick={handleFamilyClick}
            />
          </div>
        )}

        {/* Aba ONBOARDING — onboardings ativos + processos de admissão */}
        {activeTab === "onboarding" && (
          <div className="space-y-4">
            <OnboardingsSection onboardings={onboardings} />
            <AdmissaoSection
              families={families}
              journeyConfig={journeyConfig}
              onFamilyClick={handleFamilyClick}
            />
          </div>
        )}

        {/* Aba DESEMPENHO — métricas da Head + distribuição da carteira */}
        {activeTab === "desempenho" && (
          <div className="space-y-4">
            <PerformanceSection performance={performance} />
            <StatusDistributionSection counts={statusCounts} />
          </div>
        )}
      </div>
    </div>
  );
}
