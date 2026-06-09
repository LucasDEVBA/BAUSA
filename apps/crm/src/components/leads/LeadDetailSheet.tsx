"use client";

import { useState } from "react";
import Link from "next/link";
import {
  X, Mail, Flame, MessageCircle, Instagram, Video,
  Calendar, Check, Clock, Send, ArrowRight,
  User, GraduationCap, Trophy, Globe, MapPin, Phone,
  FileText, Sparkles, Target, ChevronRight,
} from "lucide-react";
import { type Lead } from "@/types/lead";
import { DEAL_STAGE_CONFIG, type DealStage } from "@/types/deal";
import { LeadStatusBadge } from "./LeadStatusBadge";
import {
  formatDate,
  formatDateTime,
  formatPhone,
  formatInvestmentRange,
  getInitials,
} from "@/lib/utils";

interface LeadDetailSheetProps {
  lead: Lead | null;
  onClose: () => void;
}

type TabId = "resumo" | "dados" | "comunicacao" | "historico";

const TABS: { id: TabId; label: string }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "dados", label: "Dados" },
  { id: "comunicacao", label: "Comunicação" },
  { id: "historico", label: "Histórico" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h4>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="flex-shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right text-foreground">{value}</span>
    </div>
  );
}

function CommunicationStep({ icon, label, date, done, disabled }: {
  icon: React.ReactNode;
  label: string;
  date: string | null | undefined;
  done: boolean;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
      done ? "bg-sys-green/5" : disabled ? "bg-secondary/30 opacity-50" : "bg-secondary/50"
    }`}>
      <div className="flex items-center gap-2 text-sm">
        <span className={done ? "text-sys-green" : "text-muted-foreground"}>{icon}</span>
        <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      </div>
      {done ? (
        <div className="flex items-center gap-1.5 text-sys-green text-xs font-medium">
          <Check className="h-3.5 w-3.5" />
          {date ? formatDate(date) : "Enviado"}
        </div>
      ) : (
        <span className="text-xs text-label-tertiary">
          {disabled ? "—" : "Pendente"}
        </span>
      )}
    </div>
  );
}

function TimelineEvent({ icon: Icon, label, date, detail, active }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  date?: string | null;
  detail?: string;
  active: boolean;
}) {
  return (
    <div className="flex gap-3 py-2">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
        active ? "bg-primary/15 text-primary" : "bg-secondary text-label-tertiary"
      }`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
        {date && <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(date)}</p>}
        {detail && <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}

export function LeadDetailSheet({ lead, onClose }: LeadDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<TabId>("resumo");

  if (!lead) return null;

  const whatsappUrl = lead.guardian_whatsapp
    ? `https://wa.me/${lead.guardian_whatsapp.replace(/\D/g, "")}`
    : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-popover shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-border px-6 py-5">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-base font-bold text-white">
            {getInitials(lead.athlete_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-foreground">
                {lead.athlete_name}
              </h2>
              <LeadStatusBadge classification={lead.qualification_classification} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {lead.position || "—"} {lead.age ? `• ${lead.age} anos` : ""} {lead.school_year ? `• ${lead.school_year}` : ""}
            </p>
            {lead.is_in_pipeline && lead.pipeline_stage && (
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-xs text-primary font-medium">
                  Pipeline: {DEAL_STAGE_CONFIG[lead.pipeline_stage as DealStage]?.label ?? lead.pipeline_stage}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* ══════ TAB RESUMO ══════ */}
          {activeTab === "resumo" && (
            <>
              {/* Qualificação IA */}
              {lead.qualification_reason && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Análise da IA
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {lead.qualification_reason}
                  </p>
                  {lead.qualified_at && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Qualificado em {formatDateTime(lead.qualified_at)}
                    </p>
                  )}
                </div>
              )}

              {/* Contato rápido */}
              <div className="flex gap-2">
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sys-green/15 border border-sys-green/20 py-2.5 text-sm font-medium text-sys-green transition-colors hover:bg-sys-green/25"
                  >
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </a>
                )}
                <a
                  href={`mailto:${lead.email}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary/15 border border-primary/20 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
                >
                  <Mail className="h-4 w-4" />
                  E-mail
                </a>
              </div>

              {/* Info rápida */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Investimento</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {lead.investment_range ? formatInvestmentRange(lead.investment_range) : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Local</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {lead.school_city_state || lead.address_state || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {lead.guardian_name || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-xs text-muted-foreground">Profissão</p>
                  <p className="text-sm font-medium text-foreground mt-0.5">
                    {lead.guardian_profession || "—"}
                  </p>
                </div>
              </div>

              {/* Pipeline banner */}
              {lead.is_in_pipeline && (
                <Link
                  href="/pipeline"
                  className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 transition-colors hover:bg-primary/15"
                >
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Ver no Pipeline</span>
                    <span className="text-sm text-foreground">
                      {lead.pipeline_stage
                        ? DEAL_STAGE_CONFIG[lead.pipeline_stage as DealStage]?.label
                        : ""}
                    </span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-primary" />
                </Link>
              )}

              {/* Siblings */}
              {lead.siblings && lead.siblings.length > 0 && (
                <div>
                  <SectionTitle>Família ({lead.guardian_name})</SectionTitle>
                  <div className="space-y-2">
                    {lead.siblings.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                        <div>
                          <p className="text-sm text-foreground">{s.nome}</p>
                          {s.esporte && <p className="text-xs text-muted-foreground">{s.esporte}</p>}
                        </div>
                        {s.classificacao && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            s.classificacao === "hot" ? "bg-lead-hot/15 text-lead-hot" :
                            s.classificacao === "warm" ? "bg-lead-warm/15 text-lead-warm" :
                            "bg-lead-cold/15 text-lead-cold"
                          }`}>
                            {s.classificacao === "hot" ? "HOT" : s.classificacao === "warm" ? "WARM" : "COLD"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══════ TAB DADOS ══════ */}
          {activeTab === "dados" && (
            <>
              <div>
                <SectionTitle>Atleta</SectionTitle>
                <div className="divide-y divide-border">
                  <DataRow label="E-mail" value={lead.email} />
                  <DataRow label="WhatsApp" value={lead.athlete_whatsapp ? formatPhone(lead.athlete_whatsapp) : null} />
                  <DataRow label="Nascimento" value={lead.birth_date ? formatDate(lead.birth_date) : null} />
                  <DataRow label="Esporte / Posição" value={lead.position} />
                  <DataRow label="Histórico" value={lead.club_history} />
                  <DataRow label="Conquistas" value={lead.achievements} />
                  {lead.instagram && (
                    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
                      <span className="text-muted-foreground">Instagram</span>
                      <a href={`https://instagram.com/${lead.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:text-primary/80">
                        <Instagram className="h-3.5 w-3.5" />{lead.instagram}
                      </a>
                    </div>
                  )}
                  {lead.video_highlights && (
                    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
                      <span className="text-muted-foreground">Vídeo</span>
                      <a href={lead.video_highlights} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:text-primary/80">
                        <Video className="h-3.5 w-3.5" />Ver highlights
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <SectionTitle>Educação</SectionTitle>
                <div className="divide-y divide-border">
                  <DataRow label="Série" value={lead.school_year} />
                  <DataRow label="Escola" value={lead.current_school} />
                  <DataRow label="Cidade / Estado" value={lead.school_city_state} />
                  <DataRow label="Modelo" value={lead.education_model} />
                  <DataRow label="Inglês" value={lead.english_level} />
                  <DataRow label="Desempenho" value={lead.academic_performance} />
                </div>
              </div>

              <div>
                <SectionTitle>Projeto</SectionTitle>
                <div className="divide-y divide-border">
                  <DataRow label="Início pretendido" value={lead.start_timing} />
                  <DataRow label="Direção" value={lead.project_direction} />
                  <DataRow label="Investimento" value={lead.investment_range ? formatInvestmentRange(lead.investment_range) : null} />
                  <DataRow label="Perfil comportamental" value={lead.behavioral_profile} />
                  <DataRow label="Comprometimento" value={lead.youth_commitment} />
                  <DataRow label="Decisão familiar" value={lead.family_decision_structure} />
                </div>
              </div>

              <div>
                <SectionTitle>Responsável Financeiro</SectionTitle>
                <div className="divide-y divide-border">
                  <DataRow label="Nome" value={lead.guardian_name} />
                  <DataRow label="Profissão" value={lead.guardian_profession} />
                  <DataRow label="E-mail" value={lead.guardian_email} />
                  <DataRow label="WhatsApp" value={lead.guardian_whatsapp ? formatPhone(lead.guardian_whatsapp) : null} />
                </div>
              </div>

              {(lead.address_city || lead.address_state) && (
                <div>
                  <SectionTitle>Endereço</SectionTitle>
                  <div className="divide-y divide-border">
                    <DataRow
                      label="Logradouro"
                      value={lead.address_street ? `${lead.address_street}, ${lead.address_number}${lead.address_complement ? ` - ${lead.address_complement}` : ""}` : null}
                    />
                    <DataRow label="Bairro" value={lead.address_neighborhood} />
                    <DataRow label="Cidade / UF" value={lead.address_city ? `${lead.address_city} - ${lead.address_state}` : lead.address_state} />
                    <DataRow label="CEP" value={lead.address_cep} />
                    <DataRow label="País" value={lead.address_country && lead.address_country !== "BR" ? lead.address_country : null} />
                  </div>
                </div>
              )}

              {(lead.utm_source || lead.cta_source || lead.device_type) && (
                <div>
                  <SectionTitle>Origem do Lead</SectionTitle>
                  <div className="divide-y divide-border">
                    <DataRow label="Fonte" value={lead.utm_source} />
                    <DataRow label="Meio" value={lead.utm_medium} />
                    <DataRow label="Campanha" value={lead.utm_campaign} />
                    <DataRow label="CTA" value={lead.cta_source} />
                    <DataRow label="Dispositivo" value={lead.device_type} />
                  </div>
                </div>
              )}

              {lead.notes && (
                <div>
                  <SectionTitle>Notas Internas</SectionTitle>
                  <div className="rounded-lg border border-border bg-card p-3 text-sm text-foreground whitespace-pre-wrap">
                    {lead.notes}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ══════ TAB COMUNICAÇÃO ══════ */}
          {activeTab === "comunicacao" && (
            <>
              {/* Pipeline de comunicação */}
              <div className="space-y-3">
                <SectionTitle>Pipeline de Comunicação</SectionTitle>

                <CommunicationStep
                  icon={<Send className="h-3.5 w-3.5" />}
                  label="WhatsApp Inicial"
                  date={lead.whatsapp_sent_at}
                  done={!!lead.whatsapp_sent_at}
                />

                <CommunicationStep
                  icon={<MessageCircle className="h-3.5 w-3.5" />}
                  label="Follow-up 1 (48h)"
                  date={lead.followup_1_sent_at}
                  done={!!lead.followup_1_sent_at}
                  disabled={!lead.whatsapp_sent_at}
                />

                <CommunicationStep
                  icon={<MessageCircle className="h-3.5 w-3.5" />}
                  label="Follow-up 2 (7 dias)"
                  date={lead.followup_2_sent_at}
                  done={!!lead.followup_2_sent_at}
                  disabled={!lead.followup_1_sent_at}
                />

                <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                  lead.meeting_scheduled
                    ? "bg-sys-green/10 border border-sys-green/20"
                    : "bg-secondary/50"
                }`}>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className={`h-3.5 w-3.5 ${lead.meeting_scheduled ? "text-sys-green" : "text-muted-foreground"}`} />
                    <span className={lead.meeting_scheduled ? "text-sys-green font-medium" : "text-muted-foreground"}>
                      Reunião Agendada
                    </span>
                  </div>
                  {lead.meeting_scheduled ? (
                    <div className="flex items-center gap-1.5 text-sys-green text-xs font-medium">
                      <Check className="h-3.5 w-3.5" />
                      {lead.meeting_scheduled_at ? formatDate(lead.meeting_scheduled_at) : "Sim"}
                    </div>
                  ) : (
                    <span className="text-xs text-label-tertiary">Aguardando</span>
                  )}
                </div>
              </div>

              {/* Ações rápidas */}
              <div>
                <SectionTitle>Ações Rápidas</SectionTitle>
                <div className="space-y-2">
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-sys-green/15 border border-sys-green/20 py-2.5 text-sm font-medium text-sys-green transition-colors hover:bg-sys-green/25"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Abrir WhatsApp do Responsável
                    </a>
                  )}
                  <a
                    href={`mailto:${lead.email}`}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary/15 border border-primary/20 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
                  >
                    <Mail className="h-4 w-4" />
                    Enviar E-mail
                  </a>
                </div>
              </div>
            </>
          )}

          {/* ══════ TAB HISTÓRICO ══════ */}
          {activeTab === "historico" && (
            <div className="space-y-0">
              <TimelineEvent
                icon={User}
                label="Lead recebido"
                date={lead.submitted_at}
                active
              />

              {lead.qualified_at && (
                <TimelineEvent
                  icon={Sparkles}
                  label="Qualificado pela IA"
                  date={lead.qualified_at}
                  detail={lead.qualification_classification ? `Classificação: ${lead.qualification_classification}` : undefined}
                  active
                />
              )}

              <TimelineEvent
                icon={MessageCircle}
                label="WhatsApp enviado"
                date={lead.whatsapp_sent_at}
                active={!!lead.whatsapp_sent_at}
              />

              <TimelineEvent
                icon={Send}
                label="Follow-up 1 enviado"
                date={lead.followup_1_sent_at}
                active={!!lead.followup_1_sent_at}
              />

              <TimelineEvent
                icon={Send}
                label="Follow-up 2 enviado"
                date={lead.followup_2_sent_at}
                active={!!lead.followup_2_sent_at}
              />

              <TimelineEvent
                icon={Calendar}
                label="Reunião agendada"
                date={lead.meeting_scheduled_at}
                detail={lead.meeting_scheduled ? "Detectada via Google Calendar" : undefined}
                active={!!lead.meeting_scheduled}
              />

              {lead.is_in_pipeline && (
                <TimelineEvent
                  icon={Target}
                  label={`Promovido para Pipeline — ${
                    lead.pipeline_stage
                      ? DEAL_STAGE_CONFIG[lead.pipeline_stage as DealStage]?.label
                      : "Lead"
                  }`}
                  active
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
