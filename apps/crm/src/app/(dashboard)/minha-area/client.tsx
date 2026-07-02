"use client";

import { useState } from "react";
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
import type { Tarefa } from "@/types/crm";
import type { OnboardingResumo } from "@/lib/actions/onboarding";
import { ScrollList } from "@/components/ui";
import { cn } from "@/lib/utils";

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

interface MinhaAreaClientProps {
  families: Family[];
  tarefas: Tarefa[];
  userName: string;
  performance: PerformanceMetrics;
  onboardings: OnboardingResumo[];
  proximasReunioes: ProximaReuniao[];
}

interface UpcomingContact {
  familyId: string;
  athleteName: string;
  date: string;
  status: Family["family_status"];
}

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

function formatRelative(dateStr: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 86400000
  );
  if (diff <= 0) return "hoje";
  if (diff === 1) return "ontem";
  return `ha ${diff}d`;
}

function isOverdue(prazo: string): boolean {
  return new Date(prazo).getTime() < Date.now();
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
    <section className="flex flex-col h-[24rem]">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-red/10">
          <Flame className="h-4 w-4 text-sys-red" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Fazer Agora</h2>
          <p className="text-[11px] text-muted-foreground">
            {totalUrgent === 0
              ? "Nenhuma acao urgente"
              : `${totalUrgent} ${totalUrgent === 1 ? "item requer" : "itens requerem"} atencao`}
          </p>
        </div>
      </div>

      {totalUrgent === 0 && (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-border/70 bg-card/60 p-4 text-center">
          <p className="text-sm text-muted-foreground">Tudo em dia! Nenhuma acao urgente.</p>
        </div>
      )}

      <ScrollList className="space-y-2">
        {urgentFamilies.map((f) => {
          const statusCfg = FAMILY_STATUS_CONFIG[f.family_status];
          return (
            <button
              key={`fam-${f.id}`}
              onClick={() => onFamilyClick(f.id)}
              className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-border hover:bg-accent"
            >
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg text-xs",
                  statusCfg.bg
                )}
              >
                <AlertTriangle className={cn("h-4 w-4", statusCfg.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {f.athlete_name}
                </p>
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
                {f.family_status}
              </span>
              <ChevronRight className="h-4 w-4 text-label-tertiary" />
            </button>
          );
        })}

        {overdueTasks.map((t) => (
          <div
            key={`task-${t.id}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-red/10">
              <Clock className="h-4 w-4 text-sys-red" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {t.titulo}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Venceu em {formatDate(t.prazo)} —{" "}
                {t.prioridade === "critica" ? "Prioridade critica" : `Prioridade ${t.prioridade}`}
              </p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sys-red/15 text-sys-red">
              atrasada
            </span>
          </div>
        ))}
      </ScrollList>
    </section>
  );
}

function FamilyCard({
  family,
  onClick,
}: {
  family: Family;
  onClick: () => void;
}) {
  const tempCfg = TEMPERATURE_CONFIG[family.temperature];
  const statusCfg = FAMILY_STATUS_CONFIG[family.family_status];
  const stageCfg = JOURNEY_STAGE_CONFIG[family.journey_stage];

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-border/70 bg-card/60 p-3 text-left transition-colors hover:border-border hover:bg-accent"
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
  onFamilyClick,
}: {
  families: Family[];
  onFamilyClick: (id: string) => void;
}) {
  const sorted = [...families].sort(sortFamilies);

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Users className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Minhas Familias</h2>
          <p className="text-[11px] text-muted-foreground">
            {families.length}{" "}
            {families.length === 1 ? "familia" : "familias"} ativas
          </p>
        </div>
      </div>

      {families.length === 0 ? (
        <div className="rounded-lg border border-border/70 bg-card/60 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma familia atribuida ainda.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((f) => (
            <FamilyCard
              key={f.id}
              family={f}
              onClick={() => onFamilyClick(f.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function OnboardingsSection({
  onboardings,
}: {
  onboardings: OnboardingResumo[];
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Onboardings Ativos
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {onboardings.length === 0
              ? "Nenhum onboarding em andamento"
              : `${onboardings.length} família${onboardings.length === 1 ? "" : "s"} em onboarding`}
          </p>
        </div>
      </div>

      {onboardings.length === 0 ? (
        <div className="rounded-lg border border-border/70 bg-card/60 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum onboarding em andamento. Famílias entrarão aqui quando o deal
            atingir <code>admission_process</code>.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
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
                href={`/familias-crm?familia=${o.experiencia_id}`}
                className="rounded-lg border border-border/70 bg-card/60 p-3 transition-colors hover:bg-accent block"
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
        </div>
      )}
    </section>
  );
}

function ProximasReunioesSection({
  reunioes,
}: {
  reunioes: ProximaReuniao[];
}) {
  return (
    <section className="flex flex-col h-[20rem]">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-blue/10">
          <Video className="h-4 w-4 text-sys-blue" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Próximas Reuniões
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {reunioes.length === 0
              ? "Nenhuma reunião agendada"
              : `${reunioes.length} reunião${reunioes.length === 1 ? "" : "ões"} agendada${reunioes.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      {reunioes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-border/70 bg-card/60 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma reunião agendada nos próximos dias.
          </p>
        </div>
      ) : (
        <ScrollList className="space-y-2">
          {reunioes.map((r) => {
            const data = new Date(r.data_hora);
            const isToday = data.toDateString() === new Date().toDateString();
            const atleta = r.experiencia?.atleta?.nome_completo ?? "Atleta";
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
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
    </section>
  );
}

function WeekSection({ contacts }: { contacts: UpcomingContact[] }) {
  return (
    <section className="flex flex-col h-[20rem]">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-plan-legacy/10">
          <Calendar className="h-4 w-4 text-plan-legacy" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Minha Semana</h2>
          <p className="text-[11px] text-muted-foreground">
            {contacts.length === 0
              ? "Nenhum contato agendado"
              : `${contacts.length} ${contacts.length === 1 ? "contato" : "contatos"} nos proximos 7 dias`}
          </p>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-border/70 bg-card/60 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum contato agendado para os proximos 7 dias.
          </p>
        </div>
      ) : (
        <ScrollList className="space-y-2">
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
                ? "Amanha"
                : dateObj.toLocaleDateString("pt-BR", {
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                  });

            return (
              <div
                key={`wk-${c.familyId}-${i}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
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
    </section>
  );
}

// --- Inactivity threshold per phase ---

const INACTIVITY_THRESHOLD: Record<string, number> = {
  admissao: 7,
  aprovado: 7,
  pre_embarque: 15,
  embarcado: 7,
  acompanhamento: 30,
  encerrado: 999,
};

function NeedContactSection({
  families,
  onFamilyClick,
}: {
  families: Family[];
  onFamilyClick: (id: string) => void;
}) {
  const needContact = [...families]
    .filter((f) => {
      const threshold = INACTIVITY_THRESHOLD[f.journey_stage] ?? 7;
      return f.days_without_contact >= threshold && f.journey_stage !== "encerrado";
    })
    .sort((a, b) => b.days_without_contact - a.days_without_contact);

  return (
    <section className="flex flex-col h-[24rem]">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-orange/10">
          <Phone className="h-4 w-4 text-sys-orange" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Familias que precisam de contato
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {needContact.length === 0
              ? "Todas em dia"
              : `${needContact.length} ${needContact.length === 1 ? "familia" : "familias"} acima do limite de inatividade`}
          </p>
        </div>
      </div>

      {needContact.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-border/70 bg-card/60 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Todas as familias estao dentro do prazo de contato.
          </p>
        </div>
      ) : (
        <ScrollList className="space-y-2">
          {needContact.map((f) => {
            const threshold = INACTIVITY_THRESHOLD[f.journey_stage] ?? 7;
            const isOverThreshold = f.days_without_contact >= threshold;
            const tempCfg = TEMPERATURE_CONFIG[f.temperature];
            const stageCfg = JOURNEY_STAGE_CONFIG[f.journey_stage];

            return (
              <button
                key={`nc-${f.id}`}
                onClick={() => onFamilyClick(f.id)}
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-border hover:bg-accent"
              >
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
    </section>
  );
}

function AdmissaoSection({
  families,
  onFamilyClick,
}: {
  families: Family[];
  onFamilyClick: (id: string) => void;
}) {
  const admissaoFamilies = families.filter(
    (f) => f.journey_stage === "admissao" || f.journey_stage === "aprovado"
  );

  return (
    <section className="flex flex-col h-[20rem]">
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-blue/15">
          <GraduationCap className="h-4 w-4 text-sys-blue" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Processos de admissao ativos
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {admissaoFamilies.length === 0
              ? "Nenhum processo ativo"
              : `${admissaoFamilies.length} ${admissaoFamilies.length === 1 ? "processo" : "processos"}`}
          </p>
        </div>
      </div>

      {admissaoFamilies.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-border/70 bg-card/60 p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum processo de admissao ativo no momento.
          </p>
        </div>
      ) : (
        <ScrollList className="space-y-2">
          {admissaoFamilies.map((f) => {
            const stageCfg = JOURNEY_STAGE_CONFIG[f.journey_stage];
            const hasSchool = Boolean(f.escola_confirmada_id);

            return (
              <button
                key={`adm-${f.id}`}
                onClick={() => onFamilyClick(f.id)}
                className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-border hover:bg-accent"
              >
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
    </section>
  );
}

function PerformanceSection({ performance }: { performance: PerformanceMetrics }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-green/15">
          <BarChart3 className="h-4 w-4 text-sys-green" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Meu desempenho</h2>
          <p className="text-[11px] text-muted-foreground">Resumo da semana</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/70 bg-card/60 p-3 text-center">
          <p className="text-base font-semibold text-foreground">{performance.totalFamilias}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
            Total familias
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/60 p-3 text-center">
          <p className="text-base font-semibold text-sys-green">
            {performance.mediaSatisfacao}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
            Media satisfacao
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/60 p-3 text-center">
          <p className="text-base font-semibold text-sys-orange">
            {performance.mediaAnsiedade}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
            Media ansiedade
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/60 p-3 text-center">
          <p className="text-base font-semibold text-primary">
            {performance.contatosSemana}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">
            Contatos semana
          </p>
        </div>
      </div>
    </section>
  );
}

// --- Main Component ---

export function MinhaAreaClient({
  families,
  tarefas,
  userName,
  performance,
  onboardings,
  proximasReunioes,
}: MinhaAreaClientProps) {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">
          {greeting}, {userName.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Voce tem {families.length}{" "}
          {families.length === 1 ? "familia" : "familias"} sob seu
          acompanhamento
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
            Total
          </p>
          <p className="text-base font-semibold text-foreground mt-1">
            {families.length}
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <p className="text-[11px] text-sys-green uppercase tracking-wider">
            Satisfeitas
          </p>
          <p className="text-base font-semibold text-sys-green mt-1">
            {satisfeitaCount}
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <p className="text-[11px] text-sys-orange uppercase tracking-wider">
            Atencao
          </p>
          <p className="text-base font-semibold text-sys-orange mt-1">
            {atencaoCount}
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <p className="text-[11px] text-sys-red uppercase tracking-wider">
            Crise
          </p>
          <p className="text-base font-semibold text-sys-red mt-1">{criseCount}</p>
        </div>
      </div>

      {/* Section 1: Fazer Agora */}
      <UrgentActionsSection
        urgentFamilies={urgentFamilies}
        overdueTasks={overdueTasks}
        onFamilyClick={handleFamilyClick}
      />

      {/* NEW: Onboardings ativos */}
      <OnboardingsSection onboardings={onboardings} />

      {/* NEW: Próximas reuniões */}
      <ProximasReunioesSection reunioes={proximasReunioes} />

      {/* Section 2: Familias que precisam de contato */}
      <NeedContactSection
        families={families}
        onFamilyClick={handleFamilyClick}
      />

      {/* Section 3: Processos de admissao ativos */}
      <AdmissaoSection
        families={families}
        onFamilyClick={handleFamilyClick}
      />

      {/* Section 4: Meu desempenho */}
      <PerformanceSection performance={performance} />

      {/* Section 5: Minhas Familias */}
      <MyFamiliesSection
        families={families}
        onFamilyClick={handleFamilyClick}
      />

      {/* Section 6: Minha Semana */}
      <WeekSection contacts={upcomingContacts} />
    </div>
  );
}
