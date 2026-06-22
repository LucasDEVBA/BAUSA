"use client";

import { useState } from "react";
import {
  X,
  Sparkles,
  User,
  Users,
  GraduationCap,
  Target,
  MessageSquare,
  BarChart3,
  History,
  Phone,
  Mail,
  Instagram,
  Video,
  Globe,
  MapPin,
  Trophy,
  CheckCircle2,
  Clock,
  ExternalLink,
  Send,
  AlertTriangle,
  Smartphone,
  Layers,
  CalendarClock,
} from "lucide-react";
import { type Lead } from "@/types/lead";
import { cn } from "@/lib/utils";

interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
}

type TabId =
  | "resumo"
  | "atleta"
  | "academico"
  | "familia"
  | "atribuicao"
  | "comunicacoes"
  | "timing"
  | "historico";

const TABS: { id: TabId; label: string; icon: typeof Sparkles }[] = [
  { id: "resumo", label: "Visão Executiva", icon: Sparkles },
  { id: "atleta", label: "Atleta", icon: User },
  { id: "academico", label: "Acadêmico & Esporte", icon: GraduationCap },
  { id: "familia", label: "Família", icon: Users },
  { id: "atribuicao", label: "Atribuição & UTM", icon: BarChart3 },
  { id: "comunicacoes", label: "Comunicações", icon: MessageSquare },
  { id: "timing", label: "Timing & Follow-ups", icon: CalendarClock },
  { id: "historico", label: "Histórico", icon: History },
];

const CLASSIFICATION_BADGE: Record<string, string> = {
  QUENTE: "bg-sys-green/15 text-sys-green border-sys-green/30",
  MORNO: "bg-sys-orange/15 text-sys-orange border-sys-orange/30",
  FRIO: "bg-sys-blue/15 text-sys-blue border-sys-blue/30",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diasAtras(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  highlight,
}: {
  icon: typeof User;
  label: string;
  value: string | null | undefined;
  href?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          value ? (highlight ? "text-primary" : "text-sys-blue") : "text-muted-foreground/50",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {!value ? (
          <p className="mt-0.5 text-sm text-muted-foreground/70">—</p>
        ) : href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {value}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <p className="mt-0.5 break-words text-sm text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}

export function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  const [tab, setTab] = useState<TabId>("resumo");
  if (!lead) return null;

  const diasSubmissao = diasAtras(lead.submitted_at);

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Fechar modal"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div className="relative flex h-full max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border liquid-glass shadow-2xl">
          {/* Header */}
          <div className="flex items-start gap-4 border-b border-border bg-card/60 px-6 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold text-foreground">
                  {lead.athlete_name}
                </h1>
                {lead.qualification_classification && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                      CLASSIFICATION_BADGE[lead.qualification_classification] ??
                        "border-border text-muted-foreground",
                    )}
                  >
                    <Sparkles className="h-3 w-3" />
                    {lead.qualification_classification}
                  </span>
                )}
                {lead.is_in_pipeline && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    No pipeline
                    {lead.pipeline_stage && ` · ${lead.pipeline_stage}`}
                  </span>
                )}
                {lead.possible_duplicate && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-sys-orange/30 bg-sys-orange/10 px-2 py-0.5 text-xs font-medium text-sys-orange">
                    <AlertTriangle className="h-3 w-3" />
                    Possível duplicata
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Lead há {diasSubmissao ?? 0}d</span>
                {lead.address_country && lead.address_country !== "BR" && (
                  <>
                    <span>·</span>
                    <span>🌎 {lead.address_country}</span>
                  </>
                )}
                {lead.email && (
                  <>
                    <span>·</span>
                    <span className="truncate">{lead.email}</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-card/40 px-3 py-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {tab === "resumo" && <ResumoTab lead={lead} />}
            {tab === "atleta" && <AtletaTab lead={lead} />}
            {tab === "academico" && <AcademicoTab lead={lead} />}
            {tab === "familia" && <FamiliaTab lead={lead} />}
            {tab === "atribuicao" && <AtribuicaoTab lead={lead} />}
            {tab === "comunicacoes" && <ComunicacoesTab lead={lead} />}
            {tab === "timing" && <TimingTab lead={lead} />}
            {tab === "historico" && <HistoricoTab lead={lead} />}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────

function ResumoTab({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-card to-card/60 p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Visão Executiva
        </p>
        <h2 className="mt-0.5 text-base font-semibold text-foreground">
          {lead.athlete_name}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPI
            label="Status"
            value={lead.status}
            color="text-foreground"
          />
          <KPI
            label="Classificação"
            value={lead.qualification_classification ?? "—"}
            color={
              lead.qualification_classification === "QUENTE"
                ? "text-sys-green"
                : lead.qualification_classification === "MORNO"
                  ? "text-sys-orange"
                  : "text-sys-blue"
            }
          />
          <KPI
            label="Investimento"
            value={lead.investment_range ?? "—"}
            color="text-foreground"
          />
          <KPI
            label="Pipeline?"
            value={lead.is_in_pipeline ? "Sim" : "Não"}
            color={lead.is_in_pipeline ? "text-sys-green" : "text-muted-foreground"}
          />
        </div>
      </div>

      {lead.qualification_reason && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">
              Justificativa Gemini
            </h3>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {lead.qualification_reason}
          </p>
          {lead.qualified_at && (
            <p className="mt-2 text-xs text-muted-foreground">
              Classificado em {fmtDate(lead.qualified_at)}
            </p>
          )}
        </div>
      )}

      {/* Contato direto */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Contato direto
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(lead.guardian_whatsapp || lead.athlete_whatsapp) && (
            <a
              href={`https://wa.me/${(lead.guardian_whatsapp ?? lead.athlete_whatsapp ?? "").replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-sys-green/30 bg-sys-green/10 px-3 py-2 text-sm font-medium text-sys-green transition-colors hover:bg-sys-green/20"
            >
              <Send className="h-4 w-4" />
              WhatsApp responsável
            </a>
          )}
          {lead.guardian_email && (
            <a
              href={`mailto:${lead.guardian_email}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-sys-blue/30 bg-sys-blue/10 px-3 py-2 text-sm font-medium text-sys-blue transition-colors hover:bg-sys-blue/20"
            >
              <Mail className="h-4 w-4" />
              E-mail
            </a>
          )}
          {lead.video_highlights && (
            <a
              href={lead.video_highlights}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Video className="h-4 w-4" />
              Ver highlights
            </a>
          )}
        </div>
      </div>

      {/* Siblings */}
      {lead.siblings && lead.siblings.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Irmãos com mesmo responsável
          </h3>
          <ul className="space-y-1.5">
            {lead.siblings.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-sm"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground">{s.nome}</span>
                {s.esporte && (
                  <span className="text-xs text-muted-foreground">
                    · {s.esporte}
                  </span>
                )}
                {s.etapa && (
                  <span className="ml-auto text-xs text-primary">{s.etapa}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AtletaTab({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Identidade
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow icon={User} label="Nome completo" value={lead.athlete_name} />
          <InfoRow icon={Mail} label="E-mail" value={lead.email} />
          <InfoRow
            icon={CalendarClock}
            label="Data de nascimento"
            value={
              lead.birth_date
                ? new Date(lead.birth_date).toLocaleDateString("pt-BR")
                : null
            }
          />
          <InfoRow icon={User} label="Idade" value={lead.age} />
          <InfoRow
            icon={Phone}
            label="WhatsApp atleta"
            value={lead.athlete_whatsapp}
            href={
              lead.athlete_whatsapp
                ? `https://wa.me/${lead.athlete_whatsapp.replace(/\D/g, "")}`
                : undefined
            }
          />
          <InfoRow
            icon={Instagram}
            label="Instagram"
            value={lead.instagram}
            href={
              lead.instagram
                ? `https://instagram.com/${lead.instagram.replace(/^@/, "")}`
                : undefined
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Endereço</h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow
            icon={Globe}
            label="País"
            value={lead.address_country ?? "BR"}
          />
          <InfoRow icon={MapPin} label="CEP" value={lead.address_cep} />
          <InfoRow icon={MapPin} label="Rua" value={lead.address_street} />
          <InfoRow icon={MapPin} label="Número" value={lead.address_number} />
          <InfoRow
            icon={MapPin}
            label="Bairro"
            value={lead.address_neighborhood}
          />
          <InfoRow
            icon={MapPin}
            label="Cidade"
            value={lead.address_city}
          />
          <InfoRow icon={MapPin} label="UF" value={lead.address_state} />
          <InfoRow
            icon={MapPin}
            label="Complemento"
            value={lead.address_complement}
          />
        </div>
      </div>
    </div>
  );
}

function AcademicoTab({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Esporte
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow icon={Trophy} label="Posição" value={lead.position} />
          <InfoRow
            icon={Video}
            label="Vídeo highlights"
            value={lead.video_highlights ? "Acessar" : null}
            href={lead.video_highlights ?? undefined}
          />
        </div>
        {lead.club_history && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Histórico de clubes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {lead.club_history}
            </p>
          </div>
        )}
        {lead.achievements && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Conquistas
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {lead.achievements}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Acadêmico
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow
            icon={GraduationCap}
            label="Série / ano escolar"
            value={lead.school_year}
          />
          <InfoRow
            icon={GraduationCap}
            label="Escola atual"
            value={lead.current_school}
          />
          <InfoRow
            icon={MapPin}
            label="Cidade da escola"
            value={lead.school_city_state}
          />
          <InfoRow
            icon={GraduationCap}
            label="Modelo educacional"
            value={lead.education_model}
          />
          <InfoRow
            icon={Globe}
            label="Nível de inglês"
            value={lead.english_level}
          />
          <InfoRow
            icon={Trophy}
            label="Desempenho acadêmico"
            value={lead.academic_performance}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Perfil comportamental
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow
            icon={Sparkles}
            label="Perfil comportamental"
            value={lead.behavioral_profile}
          />
          <InfoRow
            icon={CheckCircle2}
            label="Comprometimento do jovem"
            value={lead.youth_commitment}
          />
          <InfoRow
            icon={Users}
            label="Decisão familiar"
            value={lead.family_decision_structure}
          />
          <InfoRow
            icon={Target}
            label="Direção do projeto"
            value={lead.project_direction}
          />
        </div>
      </div>
    </div>
  );
}

function FamiliaTab({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Responsável financeiro
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow icon={User} label="Nome" value={lead.guardian_name} />
          <InfoRow
            icon={Mail}
            label="E-mail"
            value={lead.guardian_email}
            href={
              lead.guardian_email
                ? `mailto:${lead.guardian_email}`
                : undefined
            }
          />
          <InfoRow
            icon={Phone}
            label="WhatsApp"
            value={lead.guardian_whatsapp}
            href={
              lead.guardian_whatsapp
                ? `https://wa.me/${lead.guardian_whatsapp.replace(/\D/g, "")}`
                : undefined
            }
          />
          <InfoRow
            icon={Layers}
            label="Profissão"
            value={lead.guardian_profession}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Investimento e decisão
        </h3>
        <InfoRow
          icon={Target}
          label="Faixa de investimento"
          value={lead.investment_range}
          highlight
        />
        <InfoRow
          icon={Clock}
          label="Momento de início"
          value={lead.start_timing}
        />
      </div>
    </div>
  );
}

function AtribuicaoTab({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">UTM</h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow icon={BarChart3} label="Fonte" value={lead.utm_source} />
          <InfoRow icon={BarChart3} label="Meio" value={lead.utm_medium} />
          <InfoRow
            icon={BarChart3}
            label="Campanha"
            value={lead.utm_campaign}
          />
          <InfoRow
            icon={BarChart3}
            label="Conteúdo"
            value={lead.utm_content}
          />
          <InfoRow icon={BarChart3} label="Termo" value={lead.utm_term} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Jornada na landing
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow
            icon={ExternalLink}
            label="Landing"
            value={lead.landing_url}
            href={lead.landing_url ?? undefined}
          />
          <InfoRow
            icon={ExternalLink}
            label="Referrer"
            value={lead.referrer_url}
            href={lead.referrer_url ?? undefined}
          />
          <InfoRow icon={Target} label="CTA" value={lead.cta_source} />
          <InfoRow
            icon={Smartphone}
            label="Dispositivo"
            value={lead.device_type}
          />
          <InfoRow icon={Layers} label="Session ID" value={lead.session_id} />
          <InfoRow
            icon={Clock}
            label="Form iniciado em"
            value={lead.form_started_at ? fmtDate(lead.form_started_at) : null}
          />
        </div>
      </div>
    </div>
  );
}

function ComunicacoesTab({ lead }: { lead: Lead }) {
  const eventos = [
    { label: "Formulário recebido", quando: lead.submitted_at, ok: true },
    {
      label: "Qualificação Gemini",
      quando: lead.qualified_at,
      descricao: lead.qualification_reason?.slice(0, 120),
      ok: !!lead.qualified_at,
    },
    {
      label: "WhatsApp inicial",
      quando: lead.whatsapp_sent_at,
      ok: !!lead.whatsapp_sent_at,
    },
    {
      label: "Follow-up 1 (48h)",
      quando: lead.followup_1_sent_at,
      ok: !!lead.followup_1_sent_at,
    },
    {
      label: "Follow-up 2 (7d)",
      quando: lead.followup_2_sent_at,
      ok: !!lead.followup_2_sent_at,
    },
    {
      label: "Reunião agendada",
      quando: lead.meeting_scheduled_at,
      ok: !!lead.meeting_scheduled,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Linha de comunicações
        </h3>
        <ul className="space-y-2">
          {eventos.map((e, idx) => (
            <li
              key={`${e.label}-${idx}`}
              className="flex items-start gap-3 rounded-md border border-border bg-background/60 px-3 py-2.5"
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full",
                  e.ok
                    ? "bg-sys-green/15 text-sys-green"
                    : "bg-secondary text-muted-foreground/50",
                )}
              >
                {e.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      e.ok ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {e.label}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(e.quando)}
                  </span>
                </div>
                {"descricao" in e && e.descricao && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {e.descricao}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TimingTab({ lead }: { lead: Lead }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Classificação por timing
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow
            icon={CalendarClock}
            label="Timing status"
            value={lead.timing_status ?? "ideal"}
            highlight={
              lead.timing_status === "muito_cedo" ||
              lead.timing_status === "tarde_demais"
            }
          />
          <InfoRow
            icon={CalendarClock}
            label="Retomada agendada"
            value={
              lead.scheduled_followup_at
                ? fmtDate(lead.scheduled_followup_at)
                : null
            }
          />
          <InfoRow
            icon={Clock}
            label="Mensagem agendada enviada em"
            value={
              lead.scheduled_followup_sent_at
                ? fmtDate(lead.scheduled_followup_sent_at)
                : null
            }
          />
        </div>
        {lead.timing_status === "muito_cedo" && (
          <p className="mt-3 rounded-md bg-plan-legacy/10 px-3 py-2 text-xs text-plan-legacy">
            Lead muito cedo. Retomar contato na data agendada (template{" "}
            <code>scheduled_return</code>).
          </p>
        )}
        {lead.timing_status === "tarde_demais" && (
          <p className="mt-3 rounded-md bg-sys-red/10 px-3 py-2 text-xs text-sys-red">
            Lead tarde demais. Tratado pelo template <code>late_timing</code>;
            deal será fechado como perdido por timing.
          </p>
        )}
      </div>
    </div>
  );
}

function HistoricoTab({ lead }: { lead: Lead }) {
  type EventoHist = { label: string; quando: string | null | undefined };
  const eventos: EventoHist[] = [
    { label: "Formulário recebido", quando: lead.submitted_at },
    { label: "Última atualização", quando: lead.updated_at },
    { label: "Qualificação Gemini", quando: lead.qualified_at },
    { label: "WhatsApp inicial enviado", quando: lead.whatsapp_sent_at },
    { label: "Follow-up 1 enviado", quando: lead.followup_1_sent_at },
    { label: "Follow-up 2 enviado", quando: lead.followup_2_sent_at },
    { label: "Reunião agendada", quando: lead.meeting_scheduled_at },
    {
      label: "Mensagem agendada enviada",
      quando: lead.scheduled_followup_sent_at ?? null,
    },
  ].filter((e) => e.quando);

  eventos.sort(
    (a, b) =>
      new Date(b.quando ?? 0).getTime() - new Date(a.quando ?? 0).getTime(),
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">
        Linha do tempo
      </h3>
      {eventos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sem eventos registrados.
        </p>
      ) : (
        <ul className="space-y-2">
          {eventos.map((e, i) => (
            <li
              key={`${e.label}-${i}`}
              className="flex items-start gap-3 rounded-md border border-border bg-background/60 px-3 py-2.5"
            >
              <History className="mt-0.5 h-4 w-4 text-sys-blue" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {e.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmtDate(e.quando)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function KPI({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-semibold", color)}>{value}</p>
    </div>
  );
}
