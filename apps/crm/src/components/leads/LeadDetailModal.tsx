"use client";

import { useEffect, useState } from "react";
import {
  X,
  Sparkles,
  Brain,
  User,
  Users,
  GraduationCap,
  Target,
  MessageSquare,
  MessageCircle,
  BarChart3,
  FileText,
  History,
  Phone,
  Mail,
  AlertTriangle,
  CalendarClock,
  Hash,
  Layers,
  Trophy,
} from "lucide-react";
import { type Lead } from "@/types/lead";
import { cn } from "@/lib/utils";
import {
  MinimalCard,
  MinimalField,
  MinimalStat,
} from "@/components/shared/MinimalUI";
import {
  DocumentosChecklist,
  DocumentosUrgentesBadge,
  useDocumentosAtleta,
} from "@/components/documentos/DocumentosChecklist";
import { AcoesRapidasCard } from "@/components/mensagem/AcoesRapidasCard";
import { TranscricaoReuniaoCard } from "@/components/shared/TranscricaoReuniaoCard";
import { ConversaLeadPanel } from "@/components/whatsapp/ConversaLeadPanel";
import { MemoriaLeadSection } from "@/components/leads/MemoriaLeadSection";

interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
}

type SectionId =
  | "executiva"
  | "memoria"
  | "atleta"
  | "academico"
  | "esporte"
  | "familia"
  | "endereco"
  | "atribuicao"
  | "conversa"
  | "comunicacoes"
  | "timing"
  | "documentos"
  | "historico"
  | "sistema";

interface NavItem {
  id: SectionId;
  label: string;
  icon: typeof Sparkles;
  group: "estrategia" | "perfil" | "operacao" | "auditoria";
}

const NAV_ITEMS: NavItem[] = [
  { id: "executiva", label: "Visão Executiva", icon: Sparkles, group: "estrategia" },
  { id: "memoria", label: "Memória & Insights", icon: Brain, group: "estrategia" },
  { id: "atleta", label: "Atleta", icon: User, group: "perfil" },
  { id: "academico", label: "Acadêmico", icon: GraduationCap, group: "perfil" },
  { id: "esporte", label: "Esporte", icon: Trophy, group: "perfil" },
  { id: "familia", label: "Família", icon: Users, group: "perfil" },
  { id: "endereco", label: "Endereço", icon: Layers, group: "perfil" },
  { id: "conversa", label: "Conversa", icon: MessageCircle, group: "operacao" },
  { id: "comunicacoes", label: "Comunicações", icon: MessageSquare, group: "operacao" },
  { id: "atribuicao", label: "Atribuição & UTM", icon: BarChart3, group: "operacao" },
  { id: "timing", label: "Timing", icon: CalendarClock, group: "operacao" },
  { id: "documentos", label: "Documentos", icon: FileText, group: "operacao" },
  { id: "historico", label: "Histórico", icon: History, group: "auditoria" },
  { id: "sistema", label: "Sistema", icon: Hash, group: "auditoria" },
];

const GROUP_LABEL: Record<NavItem["group"], string> = {
  estrategia: "Estratégia",
  perfil: "Perfil",
  operacao: "Operação",
  auditoria: "Histórico",
};

const CLASSIFICATION_BADGE: Record<string, string> = {
  QUENTE: "bg-sys-green/12 text-sys-green",
  MORNO: "bg-sys-orange/12 text-sys-orange",
  FRIO: "bg-sys-blue/12 text-sys-blue",
};

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function diasAtras(iso?: string | null): number | null {
  if (!iso) return null;
  // eslint-disable-next-line react-hooks/purity
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  const [section, setSection] = useState<SectionId>("executiva");
  const documentos = useDocumentosAtleta(lead?.pipeline_atleta_id);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  if (!lead) return null;

  const diasSubmissao = diasAtras(lead.submitted_at) ?? 0;

  const groupedNav = NAV_ITEMS.reduce<Record<string, NavItem[]>>((acc, item) => {
    acc[item.group] = acc[item.group] ?? [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div className="relative flex h-full max-h-[88vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-foreground/80">
              {lead.athlete_name
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="truncate text-[11px] font-semibold leading-tight text-foreground">
                  {lead.athlete_name}
                </h1>
                {lead.qualification_classification && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-1.5 py-px text-[9px] font-semibold",
                      CLASSIFICATION_BADGE[lead.qualification_classification] ??
                        "bg-secondary text-muted-foreground",
                    )}
                  >
                    {lead.qualification_classification}
                  </span>
                )}
                {lead.possible_duplicate && (
                  <span className="inline-flex items-center gap-1 rounded bg-sys-orange/12 px-1.5 py-px text-[9px] font-semibold text-sys-orange">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Duplicata?
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                <span>Lead há {diasSubmissao}d</span>
                {lead.address_country && lead.address_country !== "BR" && (
                  <>
                    <span>·</span>
                    <span>{lead.address_country}</span>
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
            <div className="flex shrink-0 items-center gap-0.5">
              {lead.guardian_whatsapp && (
                <a
                  href={`https://wa.me/${lead.guardian_whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-sys-green transition-colors hover:bg-sys-green/10"
                  title="WhatsApp"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </a>
              )}
              {(lead.guardian_email || lead.email) && (
                <a
                  href={`mailto:${lead.guardian_email ?? lead.email}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-sys-blue transition-colors hover:bg-sys-blue/10"
                  title="E-mail"
                >
                  <Mail className="h-3.5 w-3.5" />
                </a>
              )}
              <span className="mx-1 h-4 w-px bg-border" />
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          {/* Body: sidebar + content */}
          <div className="flex min-h-0 flex-1">
            <aside className="hidden w-[184px] shrink-0 overflow-y-auto border-r border-border bg-secondary/10 px-1.5 py-2 md:block">
              {(Object.keys(groupedNav) as Array<NavItem["group"]>).map((g) => (
                <div key={g} className="mb-2 last:mb-0">
                  <p className="px-2 pb-0.5 text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                    {GROUP_LABEL[g]}
                  </p>
                  {groupedNav[g].map((it) => {
                    const Icon = it.icon;
                    const active = section === it.id;
                    return (
                      <button
                        key={it.id}
                        onClick={() => setSection(it.id)}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11px] transition-colors",
                          active
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-foreground/70 hover:bg-secondary/50 hover:text-foreground",
                        )}
                      >
                        <Icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{it.label}</span>
                        {it.id === "documentos" && (
                          <span className="ml-auto">
                            <DocumentosUrgentesBadge count={documentos.urgentes} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </aside>

            {/* Mobile tabs */}
            <div className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-border px-2 py-1.5 md:hidden">
              {NAV_ITEMS.map((it) => {
                const Icon = it.icon;
                const active = section === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => setSection(it.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {it.label}
                    {it.id === "documentos" && (
                      <DocumentosUrgentesBadge count={documentos.urgentes} />
                    )}
                  </button>
                );
              })}
            </div>

            <main className="min-w-0 flex-1 overflow-y-auto px-4 py-3">
              {section === "executiva" && <ExecutivaSection lead={lead} />}
              {section === "memoria" && (
                <MemoriaLeadSection
                  atletaId={lead.pipeline_atleta_id}
                  formSubmissionId={lead.id}
                  telefone={lead.guardian_whatsapp ?? lead.athlete_whatsapp}
                />
              )}
              {section === "atleta" && <AtletaSection lead={lead} />}
              {section === "academico" && <AcademicoSection lead={lead} />}
              {section === "esporte" && <EsporteSection lead={lead} />}
              {section === "familia" && <FamiliaSection lead={lead} />}
              {section === "endereco" && <EnderecoSection lead={lead} />}
              {section === "atribuicao" && <AtribuicaoSection lead={lead} />}
              {section === "conversa" && (
                <ConversaLeadPanel
                  telefone={lead.guardian_whatsapp ?? lead.athlete_whatsapp}
                  atletaId={lead.pipeline_atleta_id}
                  formSubmissionId={lead.id}
                />
              )}
              {section === "comunicacoes" && <ComunicacoesSection lead={lead} />}
              {section === "timing" && <TimingSection lead={lead} />}
              {section === "documentos" &&
                (lead.pipeline_atleta_id ? (
                  <DocumentosChecklist
                    atletaId={lead.pipeline_atleta_id}
                    docs={documentos.docs}
                    loading={documentos.loading}
                    onRefetch={documentos.refetch}
                  />
                ) : (
                  <DocumentosEmptySection lead={lead} />
                ))}
              {section === "historico" && <HistoricoSection lead={lead} />}
              {section === "sistema" && <SistemaSection lead={lead} />}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sections ───────────────────────────────────────────────────

function ExecutivaSection({ lead }: { lead: Lead }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MinimalStat
          label="Status CRM"
          value={lead.status}
        />
        <MinimalStat
          label="Classificação"
          value={lead.qualification_classification ?? "—"}
          tone={
            lead.qualification_classification === "QUENTE"
              ? "green"
              : lead.qualification_classification === "MORNO"
                ? "orange"
                : lead.qualification_classification === "FRIO"
                  ? "blue"
                  : "default"
          }
        />
        <MinimalStat
          label="Investimento"
          value={lead.investment_range ?? "—"}
        />
        <MinimalStat
          label="Pipeline?"
          value={lead.is_in_pipeline ? "Sim" : "Não"}
          tone={lead.is_in_pipeline ? "green" : "default"}
        />
      </div>

      {/* Ações rápidas — mensagem direta (I4). Contato re-resolvido no server. */}
      <AcoesRapidasCard
        destinatario={{
          nome: lead.athlete_name,
          responsavelNome: lead.guardian_name,
          telefone: lead.guardian_whatsapp ?? lead.athlete_whatsapp ?? null,
          email: lead.guardian_email ?? lead.email ?? null,
          classificacao: lead.qualification_classification,
          leadId: lead.id,
        }}
        highlightsUrl={lead.video_highlights}
      />

      {lead.qualification_reason && (
        <MinimalCard
          title="Justificativa Gemini"
          icon={Sparkles}
          iconColor="text-primary"
          action={
            lead.qualification_confidence && (
              <span className="text-[10px] text-muted-foreground">
                Confiança: {lead.qualification_confidence}
              </span>
            )
          }
        >
          <p className="text-xs leading-relaxed text-foreground/90">
            {lead.qualification_reason}
          </p>
          {lead.qualified_at && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Classificado em {fmtDateTime(lead.qualified_at)}
            </p>
          )}
        </MinimalCard>
      )}

      {lead.siblings && lead.siblings.length > 0 && (
        <MinimalCard
          title={`Irmãos no programa (${lead.siblings.length})`}
          icon={Users}
        >
          <ul className="space-y-1">
            {lead.siblings.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-secondary/30"
              >
                <User className="h-3 w-3 text-muted-foreground" />
                <span className="text-foreground">{s.nome}</span>
                {s.esporte && (
                  <span className="text-[10px] text-muted-foreground">
                    · {s.esporte}
                  </span>
                )}
                {s.etapa && (
                  <span className="ml-auto text-[10px] text-primary">
                    {s.etapa}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </MinimalCard>
      )}
    </div>
  );
}

function AtletaSection({ lead }: { lead: Lead }) {
  return (
    <MinimalCard title="Identidade" icon={User} iconColor="text-sys-blue">
      <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <MinimalField label="Nome" value={lead.athlete_name} copyable />
        <MinimalField label="E-mail" value={lead.email} copyable />
        <MinimalField
          label="WhatsApp atleta"
          value={lead.athlete_whatsapp}
          href={
            lead.athlete_whatsapp
              ? `https://wa.me/${lead.athlete_whatsapp.replace(/\D/g, "")}`
              : undefined
          }
        />
        <MinimalField
          label="Nascimento"
          value={fmtDate(lead.birth_date)}
        />
        <MinimalField label="Idade" value={lead.age} />
        <MinimalField
          label="Instagram"
          value={lead.instagram}
          href={
            lead.instagram
              ? `https://instagram.com/${lead.instagram.replace(/^@/, "")}`
              : undefined
          }
        />
      </dl>
    </MinimalCard>
  );
}

function AcademicoSection({ lead }: { lead: Lead }) {
  return (
    <MinimalCard title="Acadêmico" icon={GraduationCap} iconColor="text-sys-blue">
      <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <MinimalField label="Série / ano" value={lead.school_year} />
        <MinimalField label="Escola atual" value={lead.current_school} />
        <MinimalField label="Cidade da escola" value={lead.school_city_state} />
        <MinimalField label="Modelo educacional" value={lead.education_model} />
        <MinimalField label="Nível de inglês" value={lead.english_level} />
        <MinimalField
          label="Desempenho acadêmico"
          value={lead.academic_performance}
        />
        <MinimalField
          label="Perfil comportamental"
          value={lead.behavioral_profile}
        />
        <MinimalField
          label="Comprometimento"
          value={lead.youth_commitment}
        />
      </dl>
    </MinimalCard>
  );
}

function EsporteSection({ lead }: { lead: Lead }) {
  return (
    <div className="flex flex-col gap-3">
      <MinimalCard title="Modalidade" icon={Trophy} iconColor="text-sys-orange">
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <MinimalField label="Posição" value={lead.position} />
          <MinimalField
            label="Vídeo highlights"
            value={lead.video_highlights ? "Acessar" : null}
            href={lead.video_highlights ?? undefined}
          />
        </dl>
      </MinimalCard>

      {(lead.club_history || lead.achievements) && (
        <MinimalCard title="Trajetória" icon={History}>
          <div className="space-y-2">
            {lead.club_history && (
              <div>
                <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                  Histórico de clubes
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground/90">
                  {lead.club_history}
                </p>
              </div>
            )}
            {lead.achievements && (
              <div>
                <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                  Conquistas
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground/90">
                  {lead.achievements}
                </p>
              </div>
            )}
          </div>
        </MinimalCard>
      )}
    </div>
  );
}

function FamiliaSection({ lead }: { lead: Lead }) {
  return (
    <div className="flex flex-col gap-3">
      <MinimalCard title="Responsável financeiro" icon={User} iconColor="text-sys-blue">
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <MinimalField label="Nome" value={lead.guardian_name} copyable />
          <MinimalField label="Profissão" value={lead.guardian_profession} />
          <MinimalField
            label="E-mail"
            value={lead.guardian_email}
            href={
              lead.guardian_email
                ? `mailto:${lead.guardian_email}`
                : undefined
            }
            copyable
          />
          <MinimalField
            label="WhatsApp"
            value={lead.guardian_whatsapp}
            href={
              lead.guardian_whatsapp
                ? `https://wa.me/${lead.guardian_whatsapp.replace(/\D/g, "")}`
                : undefined
            }
            copyable
          />
        </dl>
      </MinimalCard>

      <MinimalCard title="Investimento" icon={Target} iconColor="text-sys-purple">
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <MinimalField
            label="Faixa de investimento"
            value={lead.investment_range}
          />
          <MinimalField label="Momento de início" value={lead.start_timing} />
          <MinimalField
            label="Direção do projeto"
            value={lead.project_direction}
          />
          <MinimalField
            label="Decisão familiar"
            value={lead.family_decision_structure}
          />
        </dl>
      </MinimalCard>
    </div>
  );
}

function EnderecoSection({ lead }: { lead: Lead }) {
  return (
    <MinimalCard title="Endereço" icon={Layers}>
      <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
        <MinimalField label="País" value={lead.address_country ?? "BR"} />
        <MinimalField label="CEP" value={lead.address_cep} />
        <MinimalField label="Rua" value={lead.address_street} />
        <MinimalField label="Número" value={lead.address_number} />
        <MinimalField label="Complemento" value={lead.address_complement} />
        <MinimalField label="Bairro" value={lead.address_neighborhood} />
        <MinimalField label="Cidade" value={lead.address_city} />
        <MinimalField label="UF" value={lead.address_state} />
      </dl>
    </MinimalCard>
  );
}

function AtribuicaoSection({ lead }: { lead: Lead }) {
  const hasAttribution =
    lead.utm_source ||
    lead.referrer_url ||
    lead.cta_source ||
    lead.device_type;

  return (
    <div className="flex flex-col gap-3">
      <MinimalCard title="UTM" icon={BarChart3} iconColor="text-sys-purple">
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <MinimalField label="Source" value={lead.utm_source} />
          <MinimalField label="Medium" value={lead.utm_medium} />
          <MinimalField label="Campaign" value={lead.utm_campaign} />
          <MinimalField label="Content" value={lead.utm_content} />
          <MinimalField label="Term" value={lead.utm_term} />
        </dl>
      </MinimalCard>

      <MinimalCard title="Jornada na landing" icon={Sparkles}>
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <MinimalField
            label="Landing"
            value={lead.landing_url}
            href={lead.landing_url ?? undefined}
          />
          <MinimalField
            label="Referrer"
            value={lead.referrer_url}
            href={lead.referrer_url ?? undefined}
          />
          <MinimalField label="CTA" value={lead.cta_source} />
          <MinimalField label="Dispositivo" value={lead.device_type} />
          <MinimalField
            label="Session ID"
            value={lead.session_id}
            mono
            copyable
          />
          <MinimalField
            label="Form iniciado em"
            value={fmtDateTime(lead.form_started_at)}
          />
        </dl>
      </MinimalCard>

      {!hasAttribution && (
        <p className="rounded-md bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
          Este lead não trouxe dados de atribuição (provavelmente anterior à
          instrumentação UTM ou veio por canal direto).
        </p>
      )}
    </div>
  );
}

function ComunicacoesSection({ lead }: { lead: Lead }) {
  const eventos = [
    { label: "Formulário recebido", quando: lead.submitted_at },
    {
      label: "Qualificação Gemini",
      quando: lead.qualified_at,
      descricao: lead.qualification_reason?.slice(0, 120),
    },
    { label: "WhatsApp inicial", quando: lead.whatsapp_sent_at },
    { label: "Follow-up 1 (48h)", quando: lead.followup_1_sent_at },
    { label: "Follow-up 2 (7d)", quando: lead.followup_2_sent_at },
    {
      label: "Reunião agendada",
      quando: lead.meeting_scheduled_at,
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <MinimalCard title="Timeline" icon={MessageSquare}>
        <ol className="space-y-1">
          {eventos.map((e, i) => {
            const ok = !!e.quando;
            return (
              <li
                key={`${e.label}-${i}`}
                className="flex items-start gap-2 rounded px-1.5 py-1.5 hover:bg-secondary/30"
              >
                <span
                  className={cn(
                    "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                    ok ? "bg-sys-green" : "bg-muted-foreground/30",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        ok ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {e.label}
                    </p>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {ok ? fmtDateTime(e.quando) : "pendente"}
                    </span>
                  </div>
                  {e.descricao && (
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                      {e.descricao}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </MinimalCard>

      {/* Transcrição do Meet (CF meeting-transcripts) — lead.id = form_submissions.id */}
      <TranscricaoReuniaoCard formSubmissionId={lead.id} />
    </div>
  );
}

function TimingSection({ lead }: { lead: Lead }) {
  return (
    <div className="flex flex-col gap-3">
      <MinimalCard
        title="Classificação por timing"
        icon={CalendarClock}
      >
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <MinimalField
            label="Status"
            value={lead.timing_status ?? "ideal"}
          />
          <MinimalField label="Série escolar" value={lead.school_year} />
          <MinimalField
            label="Início pretendido"
            value={lead.start_timing}
          />
          <MinimalField
            label="Retomada agendada"
            value={fmtDateTime(lead.scheduled_followup_at)}
          />
          <MinimalField
            label="Mensagem agendada enviada"
            value={fmtDateTime(lead.scheduled_followup_sent_at)}
          />
        </dl>
      </MinimalCard>

      {lead.timing_status === "muito_cedo" && (
        <p className="rounded-md bg-plan-legacy/10 px-3 py-2 text-[11px] text-plan-legacy">
          Lead muito cedo. Retomar contato em 1º nov do próximo ano (template{" "}
          <code>scheduled_return</code>). Deal fica em{" "}
          <strong>aguardando_timing</strong>.
        </p>
      )}
      {lead.timing_status === "tarde_demais" && (
        <p className="rounded-md bg-sys-red/10 px-3 py-2 text-[11px] text-sys-red">
          Lead tarde demais. Recebe <code>late_timing</code> e o deal é fechado
          como <strong>perdido</strong>.
        </p>
      )}
    </div>
  );
}

function HistoricoSection({ lead }: { lead: Lead }) {
  const eventos = [
    { label: "Formulário recebido", quando: lead.submitted_at },
    { label: "Última atualização", quando: lead.updated_at },
    { label: "Qualificação Gemini", quando: lead.qualified_at },
    { label: "WhatsApp inicial enviado", quando: lead.whatsapp_sent_at },
    { label: "Follow-up 1 enviado", quando: lead.followup_1_sent_at },
    { label: "Follow-up 2 enviado", quando: lead.followup_2_sent_at },
    { label: "Reunião agendada", quando: lead.meeting_scheduled_at },
    {
      label: "Mensagem agendada enviada",
      quando: lead.scheduled_followup_sent_at,
    },
  ].filter((e) => e.quando);

  eventos.sort(
    (a, b) =>
      new Date(b.quando ?? 0).getTime() - new Date(a.quando ?? 0).getTime(),
  );

  return (
    <MinimalCard title="Linha do tempo" icon={History}>
      {eventos.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sem eventos registrados.
        </p>
      ) : (
        <ol className="space-y-1">
          {eventos.map((e, i) => (
            <li
              key={`${e.label}-${i}`}
              className="flex items-center justify-between rounded px-1.5 py-1 hover:bg-secondary/30"
            >
              <p className="text-xs text-foreground">{e.label}</p>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {fmtDateTime(e.quando)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </MinimalCard>
  );
}

function DocumentosEmptySection({ lead }: { lead: Lead }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <FileText className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm font-medium text-foreground">
        Checklist de documentos indisponível
      </p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
        {lead.qualification_classification === "FRIO"
          ? "Leads FRIO não são promovidos ao pipeline, portanto não têm checklist de documentos."
          : "Este lead ainda não foi promovido ao pipeline. O checklist de documentos fica disponível quando o atleta é criado (leads QUENTE/MORNO são promovidos automaticamente na qualificação)."}
      </p>
    </div>
  );
}

function SistemaSection({ lead }: { lead: Lead }) {
  return (
    <div className="flex flex-col gap-3">
      <MinimalCard title="Status & datas" icon={Hash}>
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <MinimalField label="Status CRM" value={lead.status} />
          <MinimalField
            label="Possível duplicata"
            value={lead.possible_duplicate ? "sim" : "Não"}
          />
          <MinimalField
            label="No pipeline?"
            value={
              lead.is_in_pipeline
                ? lead.pipeline_stage ?? "Sim"
                : "Não"
            }
          />
          <MinimalField label="Confiança Gemini" value={lead.qualification_confidence} />
          <MinimalField
            label="Recebido em"
            value={fmtDateTime(lead.submitted_at)}
          />
          <MinimalField
            label="Última atualização"
            value={fmtDateTime(lead.updated_at)}
          />
        </dl>
      </MinimalCard>

      <MinimalCard title="Identificadores internos" icon={Phone}>
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <MinimalField label="Lead ID" value={lead.id} mono copyable />
          <MinimalField
            label="Submission ID"
            value={lead.submission_id}
            mono
            copyable
          />
          <MinimalField
            label="Deal ID"
            value={lead.pipeline_deal_id}
            mono
            copyable
          />
          <MinimalField
            label="Atleta ID"
            value={lead.pipeline_atleta_id}
            mono
            copyable
          />
        </dl>
      </MinimalCard>
    </div>
  );
}
