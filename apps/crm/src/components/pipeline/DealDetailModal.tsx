"use client";

import { useState } from "react";
import {
  X,
  Sparkles,
  HeartPulse,
  User,
  Users,
  Briefcase,
  Calendar,
  MessageSquare,
  FileText,
  History,
  Award,
  Phone,
  Mail,
  Instagram,
  Video,
  Globe,
  MapPin,
  GraduationCap,
  Trophy,
  Target,
  CheckCircle2,
  ExternalLink,
  PenSquare,
  Clock,
  Send,
} from "lucide-react";
import { type Deal, DEAL_STAGE_CONFIG } from "@/types/deal";
import { cn } from "@/lib/utils";
import { DealDetailSheet } from "./DealDetailSheet";
import { DealDocumentsTab } from "./DealDocumentsTab";
import { DealContratoTab } from "./DealContratoTab";
import { VisaoExecutivaPanel } from "./panels/VisaoExecutivaPanel";
import { AcompanhamentoHeadPanel } from "./panels/AcompanhamentoHeadPanel";

interface DealDetailModalProps {
  deal: Deal | null;
  onClose: () => void;
}

type TabId =
  | "executiva"
  | "acompanhamento"
  | "atleta"
  | "familia"
  | "comercial"
  | "reuniao"
  | "comunicacoes"
  | "financeiro"
  | "documentos"
  | "historico";

const TABS: { id: TabId; label: string; icon: typeof Sparkles }[] = [
  { id: "executiva", label: "Visão Executiva", icon: Sparkles },
  { id: "acompanhamento", label: "Acompanhamento Head", icon: HeartPulse },
  { id: "atleta", label: "Atleta", icon: User },
  { id: "familia", label: "Família", icon: Users },
  { id: "comercial", label: "Comercial", icon: Briefcase },
  { id: "reuniao", label: "Reunião", icon: Calendar },
  { id: "comunicacoes", label: "Comunicações", icon: MessageSquare },
  { id: "financeiro", label: "Financeiro", icon: Award },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "historico", label: "Histórico", icon: History },
];

const CLASSIFICATION_BADGE: Record<string, string> = {
  QUENTE: "bg-sys-green/15 text-sys-green border-sys-green/30",
  MORNO: "bg-sys-orange/15 text-sys-orange border-sys-orange/30",
  FRIO: "bg-sys-blue/15 text-sys-blue border-sys-blue/30",
};

function fmtBRL(v?: number) {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

function diasAtras(iso?: string) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof User;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  if (!value) {
    return (
      <div className="flex items-start gap-3 py-2">
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground/70">—</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="mt-0.5 h-4 w-4 text-sys-blue" />
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {href ? (
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
          <p className="mt-0.5 text-sm text-foreground">{value}</p>
        )}
      </div>
    </div>
  );
}

export function DealDetailModal({ deal, onClose }: DealDetailModalProps) {
  const [tab, setTab] = useState<TabId>("executiva");
  const [showLateralEditor, setShowLateralEditor] = useState(false);

  if (!deal) return null;

  const stageCfg = DEAL_STAGE_CONFIG[deal.stage];
  const diasEtapa = diasAtras(deal.stage_updated_at) ?? 0;

  // Sheet de edição lateral pode coexistir
  if (showLateralEditor) {
    return (
      <DealDetailSheet
        deal={deal}
        onClose={() => {
          setShowLateralEditor(false);
          onClose();
        }}
      />
    );
  }

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
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold text-foreground">
                  {deal.athlete_name}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                    CLASSIFICATION_BADGE[deal.classification] ??
                      "border-border text-muted-foreground",
                  )}
                >
                  {deal.classification}
                </span>
                {deal.product_tier && (
                  <span className="inline-flex items-center rounded-md border border-plan-legacy/30 bg-plan-legacy/10 px-2 py-0.5 text-xs font-medium text-plan-legacy">
                    {deal.product_tier}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", stageCfg.dotColor)}
                  />
                  {stageCfg.label}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {diasEtapa}d na etapa
                </span>
                <span>·</span>
                <span>{fmtBRL(deal.deal_value_brl)}</span>
                {deal.lead_score != null && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      Score {deal.lead_score}/100
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowLateralEditor(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
              title="Abrir editor comercial completo"
            >
              <PenSquare className="h-3.5 w-3.5" />
              Editor completo
            </button>
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
            {tab === "executiva" && <VisaoExecutivaPanel deal={deal} />}

            {tab === "acompanhamento" && (
              <AcompanhamentoHeadPanel atletaId={deal.atleta_id} />
            )}

            {tab === "atleta" && <AtletaTab deal={deal} />}
            {tab === "familia" && <FamiliaTab deal={deal} />}
            {tab === "comercial" && <ComercialTab deal={deal} />}
            {tab === "reuniao" && <ReuniaoTab deal={deal} />}
            {tab === "comunicacoes" && <ComunicacoesTab deal={deal} />}

            {tab === "financeiro" && (
              <DealContratoTab dealId={deal.id} atletaId={deal.atleta_id} />
            )}
            {tab === "documentos" &&
              (deal.atleta_id ? (
                <DealDocumentsTab atletaId={deal.atleta_id} />
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Atleta ainda não vinculado ao deal.
                </p>
              ))}

            {tab === "historico" && <HistoricoTab deal={deal} />}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────

function AtletaTab({ deal }: { deal: Deal }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Perfil do atleta
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow icon={User} label="Nome" value={deal.athlete_name} />
          <InfoRow
            icon={Calendar}
            label="Data de nascimento"
            value={
              deal.data_nascimento
                ? new Date(deal.data_nascimento).toLocaleDateString("pt-BR")
                : null
            }
          />
          <InfoRow icon={Phone} label="WhatsApp" value={deal.whatsapp} />
          <InfoRow icon={Mail} label="E-mail" value={deal.email} />
          <InfoRow icon={MapPin} label="Cidade/Estado" value={deal.cidade_estado} />
          <InfoRow
            icon={Globe}
            label="Endereço (estado)"
            value={deal.address_state}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Esporte</h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow icon={Trophy} label="Esporte" value={deal.esporte} />
          <InfoRow icon={Target} label="Posição" value={deal.athlete_position} />
          <InfoRow
            icon={Award}
            label="Nível competitivo"
            value={deal.nivel_competitivo}
          />
          <InfoRow
            icon={Instagram}
            label="Instagram"
            value={deal.instagram ? `@${deal.instagram.replace(/^@/, "")}` : null}
            href={
              deal.instagram
                ? `https://instagram.com/${deal.instagram.replace(/^@/, "")}`
                : undefined
            }
          />
          <InfoRow
            icon={Video}
            label="Vídeo highlights"
            value={deal.video_highlights_url ? "Ver vídeo" : null}
            href={deal.video_highlights_url}
          />
        </div>
        {deal.historico_clubes && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Histórico de clubes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {deal.historico_clubes}
            </p>
          </div>
        )}
        {deal.conquistas && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Conquistas
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
              {deal.conquistas}
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Acadêmico</h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow
            icon={GraduationCap}
            label="Escola atual"
            value={deal.escola_atual}
          />
          <InfoRow
            icon={GraduationCap}
            label="Série"
            value={deal.serie_escolar}
          />
          <InfoRow
            icon={Globe}
            label="Inglês"
            value={deal.nivel_ingles}
          />
          <InfoRow
            icon={Award}
            label="Desempenho acadêmico"
            value={deal.desempenho_academico}
          />
          <InfoRow
            icon={CheckCircle2}
            label="Modelo educacional"
            value={deal.modelo_educacional}
          />
          <InfoRow
            icon={Clock}
            label="Momento de início"
            value={deal.momento_inicio}
          />
        </div>
      </div>
    </div>
  );
}

function FamiliaTab({ deal }: { deal: Deal }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Responsável financeiro
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow icon={User} label="Nome" value={deal.guardian_name} />
          <InfoRow
            icon={Briefcase}
            label="Profissão"
            value={deal.guardian_profession}
          />
          <InfoRow
            icon={Mail}
            label="E-mail"
            value={deal.guardian_email}
            href={deal.guardian_email ? `mailto:${deal.guardian_email}` : undefined}
          />
          <InfoRow icon={Phone} label="WhatsApp" value={deal.whatsapp} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Investimento e decisão
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow
            icon={Target}
            label="Faixa de investimento"
            value={deal.investment_range}
          />
          <InfoRow
            icon={Users}
            label="Decisão familiar"
            value={deal.decisao_familiar}
          />
          <InfoRow
            icon={CheckCircle2}
            label="Comprometimento"
            value={deal.comprometimento}
          />
          <InfoRow
            icon={Award}
            label="Plano"
            value={deal.product_tier ?? "—"}
          />
        </div>
      </div>

      {deal.siblings && deal.siblings.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Irmãos no programa
          </h3>
          <ul className="space-y-2">
            {deal.siblings.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{s.nome}</span>
                {s.esporte && (
                  <span className="text-xs text-muted-foreground">
                    · {s.esporte}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(deal.consentimento_lgpd != null ||
        deal.aceite_whatsapp != null ||
        deal.aceite_email != null) && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Consentimentos (LGPD)
          </h3>
          <ul className="space-y-1 text-sm">
            <li className="flex items-center gap-2 text-foreground">
              <CheckCircle2
                className={cn(
                  "h-4 w-4",
                  deal.consentimento_lgpd
                    ? "text-sys-green"
                    : "text-muted-foreground/40",
                )}
              />
              Consentimento LGPD
            </li>
            <li className="flex items-center gap-2 text-foreground">
              <CheckCircle2
                className={cn(
                  "h-4 w-4",
                  deal.aceite_whatsapp
                    ? "text-sys-green"
                    : "text-muted-foreground/40",
                )}
              />
              Aceite WhatsApp
            </li>
            <li className="flex items-center gap-2 text-foreground">
              <CheckCircle2
                className={cn(
                  "h-4 w-4",
                  deal.aceite_email
                    ? "text-sys-green"
                    : "text-muted-foreground/40",
                )}
              />
              Aceite e-mail
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

function ComercialTab({ deal }: { deal: Deal }) {
  const stageCfg = DEAL_STAGE_CONFIG[deal.stage];
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Posicionamento
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow
            icon={Briefcase}
            label="Etapa atual"
            value={stageCfg.label}
          />
          <InfoRow
            icon={Award}
            label="Plano"
            value={deal.product_tier ?? "—"}
          />
          <InfoRow
            icon={Target}
            label="Valor BRL"
            value={fmtBRL(deal.deal_value_brl)}
          />
          <InfoRow
            icon={Target}
            label="Sinal BRL"
            value={fmtBRL(deal.signal_value_brl)}
          />
          <InfoRow
            icon={Target}
            label="Saldo BRL"
            value={fmtBRL(deal.remaining_value_brl)}
          />
          <InfoRow
            icon={Sparkles}
            label="Desconto?"
            value={
              deal.has_discount
                ? `${deal.discount_pct ?? 0}%`
                : "Sem desconto"
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Próxima ação
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow
            icon={CheckCircle2}
            label="Ação"
            value={deal.next_action}
          />
          <InfoRow
            icon={Calendar}
            label="Quando"
            value={
              deal.next_action_date
                ? new Date(deal.next_action_date).toLocaleDateString("pt-BR")
                : null
            }
          />
          <InfoRow
            icon={User}
            label="Responsável"
            value={deal.consultant}
          />
        </div>
      </div>

      {(deal.flag_retrocedido || deal.lost_reason) && (
        <div className="rounded-xl border border-sys-orange/30 bg-sys-orange/5 p-5">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Sinais de atenção
          </h3>
          <ul className="space-y-1 text-sm text-foreground/90">
            {deal.flag_retrocedido && (
              <li>
                · Retrocesso registrado
                {deal.motivo_retrocesso && `: ${deal.motivo_retrocesso}`}
              </li>
            )}
            {deal.lost_reason && (
              <li>
                · Motivo de perda: {deal.lost_reason_category}{" "}
                {deal.lost_detail && `(${deal.lost_detail})`}
              </li>
            )}
            {deal.can_reactivate && (
              <li>
                · Pode ser reativado
                {deal.reactivation_date &&
                  ` em ${new Date(deal.reactivation_date).toLocaleDateString("pt-BR")}`}
              </li>
            )}
          </ul>
        </div>
      )}

      {deal.is_future_lead && (
        <div className="rounded-xl border border-plan-legacy/30 bg-plan-legacy/5 p-5">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            Lead futuro
          </h3>
          <p className="text-sm text-foreground/90">
            Projeto previsto para {deal.future_project_year ?? "—"}.
            {deal.future_reactivation_date &&
              ` Reativar em ${new Date(deal.future_reactivation_date).toLocaleDateString("pt-BR")}.`}
          </p>
        </div>
      )}
    </div>
  );
}

function ReuniaoTab({ deal }: { deal: Deal }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Reunião comercial
        </h3>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <InfoRow
            icon={Calendar}
            label="Data/hora agendada"
            value={
              deal.reuniao_agendada_at
                ? new Date(deal.reuniao_agendada_at).toLocaleString("pt-BR")
                : null
            }
          />
          <InfoRow
            icon={Calendar}
            label="Data realizada"
            value={
              deal.reuniao_data
                ? new Date(deal.reuniao_data).toLocaleString("pt-BR")
                : null
            }
          />
          <InfoRow
            icon={Video}
            label="Link"
            value={deal.reuniao_link ? "Acessar reunião" : null}
            href={deal.reuniao_link}
          />
        </div>
      </div>
    </div>
  );
}

function ComunicacoesTab({ deal }: { deal: Deal }) {
  type Evento = {
    label: string;
    quando?: string;
    descricao?: string;
    ok: boolean;
  };
  const eventos: Evento[] = [
    {
      label: "Formulário enviado",
      quando: deal.submitted_at,
      ok: !!deal.submitted_at,
    },
    {
      label: "Qualificação Gemini",
      quando: deal.qualificado_gemini_at,
      descricao: deal.motivo_gemini?.slice(0, 120),
      ok: !!deal.qualificado_gemini_at,
    },
    {
      label: "WhatsApp inicial",
      quando: deal.whatsapp_sent_at,
      ok: !!deal.whatsapp_sent_at,
    },
    {
      label: "Follow-up 1 (48h)",
      quando: deal.followup_1_sent_at,
      ok: !!deal.followup_1_sent_at,
    },
    {
      label: "Follow-up 2 (7d)",
      quando: deal.followup_2_sent_at,
      ok: !!deal.followup_2_sent_at,
    },
    {
      label: "Reunião agendada",
      quando: deal.reuniao_agendada_at,
      ok: !!deal.reuniao_agendada_at,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Histórico de comunicações
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
                  {e.quando && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.quando).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
                {e.descricao && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {e.descricao}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Ações rápidas
        </h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {deal.whatsapp && (
            <a
              href={`https://wa.me/${deal.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-sys-green/30 bg-sys-green/10 px-3 py-2 text-sm font-medium text-sys-green transition-colors hover:bg-sys-green/20"
            >
              <Send className="h-4 w-4" />
              WhatsApp
            </a>
          )}
          {(deal.guardian_email || deal.email) && (
            <a
              href={`mailto:${deal.guardian_email ?? deal.email}`}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-sys-blue/30 bg-sys-blue/10 px-3 py-2 text-sm font-medium text-sys-blue transition-colors hover:bg-sys-blue/20"
            >
              <Mail className="h-4 w-4" />
              E-mail
            </a>
          )}
          {deal.reuniao_link && (
            <a
              href={deal.reuniao_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Video className="h-4 w-4" />
              Entrar na reunião
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoricoTab({ deal }: { deal: Deal }) {
  const eventos: { label: string; quando?: string; tipo: string }[] = [
    {
      label: "Lead criado",
      quando: deal.created_at,
      tipo: "criacao",
    },
    {
      label: `Mudança para ${DEAL_STAGE_CONFIG[deal.stage].label}`,
      quando: deal.stage_updated_at,
      tipo: "etapa",
    },
    deal.qualificado_gemini_at && {
      label: `Qualificação Gemini ${deal.classificacao_gemini ?? ""}`,
      quando: deal.qualificado_gemini_at,
      tipo: "ia",
    },
    deal.contract_signed_at && {
      label: "Contrato assinado",
      quando: deal.contract_signed_at,
      tipo: "financeiro",
    },
    deal.signal_paid_at && {
      label: "Sinal pago",
      quando: deal.signal_paid_at,
      tipo: "financeiro",
    },
    deal.enrollment_confirmed_at && {
      label: "Matrícula confirmada",
      quando: deal.enrollment_confirmed_at,
      tipo: "financeiro",
    },
    deal.remaining_paid_at && {
      label: "Saldo pago",
      quando: deal.remaining_paid_at,
      tipo: "financeiro",
    },
    deal.closed_at && {
      label: "Deal encerrado",
      quando: deal.closed_at,
      tipo: "etapa",
    },
  ].filter(Boolean) as { label: string; quando?: string; tipo: string }[];

  // Ordem cronológica
  eventos.sort((a, b) => {
    const ta = a.quando ? new Date(a.quando).getTime() : 0;
    const tb = b.quando ? new Date(b.quando).getTime() : 0;
    return tb - ta;
  });

  return (
    <div className="space-y-4">
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
                  {e.quando && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.quando).toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Para histórico completo de auditoria (com diffs), use o{" "}
        <span className="font-medium text-primary">Editor completo</span> no
        canto superior.
      </p>
    </div>
  );
}
