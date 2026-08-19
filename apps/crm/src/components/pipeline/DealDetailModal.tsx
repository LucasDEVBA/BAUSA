"use client";

import { useEffect, useState, useTransition } from "react";
import {
  X,
  Sparkles,
  Brain,
  HeartPulse,
  User,
  Users,
  Briefcase,
  CalendarDays,
  MessageSquare,
  MessageCircle,
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
  BarChart3,
  Loader2,
  Copy,
  AlertTriangle,
  Shield,
  Flame,
  Smartphone,
  Layers,
  ListChecks,
  TrendingUp,
  Calendar,
  PiggyBank,
  CircleDollarSign,
  Hash,
  StickyNote,
  Pencil,
} from "lucide-react";
import { type Deal } from "@/types/deal";
import {
  DEFAULT_DEAL_STAGE_DISPLAY,
  type DealStageConfigMap,
} from "@/lib/etapas-deal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DealDetailSheet } from "./DealDetailSheet";
import {
  DocumentosChecklist,
  DocumentosUrgentesBadge,
  useDocumentosAtleta,
} from "@/components/documentos/DocumentosChecklist";
import { DealContratoTab } from "./DealContratoTab";
import { VisaoExecutivaPanel } from "./panels/VisaoExecutivaPanel";
import { AcompanhamentoHeadPanel } from "./panels/AcompanhamentoHeadPanel";
import { TranscricaoReuniaoCard } from "@/components/shared/TranscricaoReuniaoCard";
import {
  listarReunioesLead,
  relinkReuniaoDeal,
  type ReuniaoCalendar,
} from "@/lib/actions/reunioes-relink";
import {
  obterTranscricaoEvento,
  type ReuniaoTranscricao,
} from "@/lib/actions/transcricoes";
import { criarNota, listarNotas } from "@/lib/actions/notas";
import { getAuditLogsForDeal } from "@/lib/actions/audit";
import type { NotaInterna, AuditLog } from "@/types/crm";
import { ConversaLeadPanel } from "@/components/whatsapp/ConversaLeadPanel";
import { MemoriaLeadSection } from "@/components/leads/MemoriaLeadSection";
import { EmailsLeadSection } from "@/components/emails/EmailsLeadSection";

interface DealDetailModalProps {
  deal: Deal | null;
  onClose: () => void;
  /** Config de exibição das etapas (rótulos/cores) — default estático. */
  stageConfig?: DealStageConfigMap;
}

type SectionId =
  | "executiva"
  | "acompanhamento"
  | "memoria"
  | "atleta"
  | "academico"
  | "esporte"
  | "familia"
  | "comercial"
  | "reuniao"
  | "conversa"
  | "comunicacoes"
  | "emails"
  | "atribuicao"
  | "financeiro"
  | "documentos"
  | "notas"
  | "auditoria";

interface NavItem {
  id: SectionId;
  label: string;
  icon: typeof Sparkles;
  group: "estrategia" | "perfil" | "comercial" | "operacao" | "auditoria";
}

const NAV_ITEMS: NavItem[] = [
  // Estratégia
  { id: "executiva", label: "Visão Executiva", icon: Sparkles, group: "estrategia" },
  { id: "acompanhamento", label: "Acompanhamento Head", icon: HeartPulse, group: "estrategia" },
  { id: "memoria", label: "Memória & Insights", icon: Brain, group: "estrategia" },
  // Perfil
  { id: "atleta", label: "Atleta", icon: User, group: "perfil" },
  { id: "academico", label: "Acadêmico", icon: GraduationCap, group: "perfil" },
  { id: "esporte", label: "Esporte", icon: Trophy, group: "perfil" },
  { id: "familia", label: "Família", icon: Users, group: "perfil" },
  // Comercial
  { id: "comercial", label: "Comercial", icon: Briefcase, group: "comercial" },
  { id: "reuniao", label: "Reunião", icon: CalendarDays, group: "comercial" },
  { id: "financeiro", label: "Financeiro", icon: PiggyBank, group: "comercial" },
  // Operação
  { id: "conversa", label: "Conversa", icon: MessageCircle, group: "operacao" },
  { id: "comunicacoes", label: "Comunicações", icon: MessageSquare, group: "operacao" },
  { id: "emails", label: "E-mails", icon: Mail, group: "operacao" },
  { id: "atribuicao", label: "Atribuição & UTM", icon: BarChart3, group: "operacao" },
  { id: "documentos", label: "Documentos", icon: FileText, group: "operacao" },
  // Auditoria
  { id: "notas", label: "Notas internas", icon: StickyNote, group: "auditoria" },
  { id: "auditoria", label: "Auditoria", icon: History, group: "auditoria" },
];

const GROUP_LABEL: Record<NavItem["group"], string> = {
  estrategia: "Estratégia",
  perfil: "Perfil",
  comercial: "Comercial",
  operacao: "Operação",
  auditoria: "Histórico",
};

const CLASSIFICATION_BADGE: Record<string, string> = {
  QUENTE: "bg-sys-green/15 text-sys-green border-sys-green/30",
  MORNO: "bg-sys-orange/15 text-sys-orange border-sys-orange/30",
  FRIO: "bg-sys-blue/15 text-sys-blue border-sys-blue/30",
};

// ─── Helpers ────────────────────────────────────────────────────

function fmtBRL(v?: number): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

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

/** Rótulo relativo de uma reunião: "hoje" / "em N dias" / "há N dias". */
function relReuniao(iso?: string | null): { label: string; futura: boolean } | null {
  if (!iso) return null;
  const dif = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (dif === 0) return { label: "hoje", futura: new Date(iso).getTime() >= Date.now() };
  if (dif > 0) return { label: `em ${dif} dia${dif > 1 ? "s" : ""}`, futura: true };
  return { label: `há ${-dif} dia${dif < -1 ? "s" : ""}`, futura: false };
}

async function copyClipboard(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copiado`);
  } catch {
    toast.error("Não foi possível copiar");
  }
}

// ─── Field components (denso) ───────────────────────────────────

function Field({
  label,
  value,
  href,
  mono,
  copyable,
}: {
  label: string;
  value: React.ReactNode;
  href?: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const hasValue =
    value !== null && value !== undefined && value !== "" && value !== "—";
  return (
    <div className="py-1">
      <dt className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 flex items-center gap-1.5",
          mono && "font-mono text-[11px]",
          hasValue ? "text-foreground" : "text-muted-foreground/60",
        )}
      >
        {!hasValue ? (
          <span className="text-xs">—</span>
        ) : href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {value}
            <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
          </a>
        ) : (
          <span className={cn("text-xs", mono && "break-all")}>{value}</span>
        )}
        {hasValue && copyable && typeof value === "string" && (
          <button
            onClick={() => copyClipboard(value, label)}
            className="ml-auto rounded p-1 text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-foreground"
            title={`Copiar ${label.toLowerCase()}`}
          >
            <Copy className="h-3 w-3" />
          </button>
        )}
      </dd>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  iconColor,
  children,
  action,
}: {
  title: string;
  icon?: typeof Sparkles;
  iconColor?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border/70 bg-card/60 p-3">
      <header className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {Icon && (
            <Icon
              className={cn(
                "h-3 w-3",
                iconColor ?? "text-muted-foreground/60",
              )}
            />
          )}
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </h3>
        </div>
        {action}
      </header>
      <div>{children}</div>
    </section>
  );
}

function StatPill({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "default" | "green" | "orange" | "red" | "blue";
  hint?: string;
}) {
  const toneClass: Record<NonNullable<typeof tone>, string> = {
    default: "text-foreground",
    green: "text-sys-green",
    orange: "text-sys-orange",
    red: "text-sys-red",
    blue: "text-sys-blue",
  };
  return (
    <div className="rounded-md bg-secondary/40 px-2.5 py-1.5">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums leading-tight",
          toneClass[tone ?? "default"],
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="text-[9px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────

export function DealDetailModal({
  deal,
  onClose,
  stageConfig = DEFAULT_DEAL_STAGE_DISPLAY,
}: DealDetailModalProps) {
  const [section, setSection] = useState<SectionId>("executiva");
  const [showLateralEditor, setShowLateralEditor] = useState(false);
  const documentos = useDocumentosAtleta(deal?.atleta_id);

  // Body scroll lock + Esc to close
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

  if (!deal) return null;

  if (showLateralEditor) {
    return (
      <DealDetailSheet
        deal={deal}
        onClose={() => {
          setShowLateralEditor(false);
          onClose();
        }}
        stageConfig={stageConfig}
      />
    );
  }

  const stageCfg = stageConfig[deal.stage];
  const diasEtapa = diasAtras(deal.stage_updated_at) ?? 0;
  const diasNoPipeline = diasAtras(deal.created_at) ?? 0;

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
          {/* ── Header minimal ── */}
          <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-foreground/80">
              {deal.athlete_name
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0])
                .join("")
                .toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h1 className="truncate text-[11px] font-semibold leading-tight text-foreground">
                  {deal.athlete_name}
                </h1>
                <span
                  className={cn(
                    "inline-flex items-center rounded px-1.5 py-px text-[9px] font-semibold",
                    CLASSIFICATION_BADGE[deal.classification] ??
                      "bg-secondary text-muted-foreground",
                  )}
                >
                  {deal.classification}
                </span>
                {deal.product_tier && (
                  <span className="inline-flex items-center rounded bg-plan-legacy/10 px-1.5 py-px text-[9px] font-semibold text-plan-legacy">
                    {deal.product_tier}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      stageCfg.dotColor,
                    )}
                  />
                  {stageCfg.label}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                <span>{fmtBRL(deal.deal_value_brl)}</span>
                <span>·</span>
                <span>{diasEtapa}d na etapa</span>
                <span>·</span>
                <span>{diasNoPipeline}d no pipeline</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {deal.whatsapp && (
                <a
                  href={`https://wa.me/${deal.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-sys-green transition-colors hover:bg-sys-green/10"
                  title="WhatsApp"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </a>
              )}
              {(deal.guardian_email || deal.email) && (
                <a
                  href={`mailto:${deal.guardian_email ?? deal.email}`}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-sys-blue transition-colors hover:bg-sys-blue/10"
                  title="E-mail"
                >
                  <Mail className="h-3.5 w-3.5" />
                </a>
              )}
              <button
                onClick={() => setShowLateralEditor(true)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
                title="Abrir editor lateral"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
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

          {/* ── Body: sidebar + content ── */}
          <div className="flex min-h-0 flex-1">
            {/* Sidebar — estilo macOS Settings */}
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

            {/* Content */}
            <main className="min-w-0 flex-1 overflow-y-auto px-4 py-3">
              {section === "executiva" && <VisaoExecutivaPanel deal={deal} />}
              {section === "acompanhamento" && (
                <AcompanhamentoHeadPanel atletaId={deal.atleta_id} />
              )}
              {section === "memoria" && (
                <MemoriaLeadSection
                  atletaId={deal.atleta_id}
                  formSubmissionId={deal.lead_id}
                  telefone={deal.whatsapp}
                />
              )}
              {section === "atleta" && <AtletaSection deal={deal} />}
              {section === "academico" && <AcademicoSection deal={deal} />}
              {section === "esporte" && <EsporteSection deal={deal} />}
              {section === "familia" && <FamiliaSection deal={deal} />}
              {section === "comercial" && (
                <ComercialSection deal={deal} stageConfig={stageConfig} />
              )}
              {section === "reuniao" && <ReuniaoSection deal={deal} />}
              {section === "conversa" && (
                <ConversaLeadPanel
                  telefone={deal.whatsapp}
                  atletaId={deal.atleta_id}
                  formSubmissionId={deal.lead_id ?? undefined}
                />
              )}
              {section === "comunicacoes" && <ComunicacoesSection deal={deal} />}
              {section === "emails" && (
                <EmailsLeadSection
                  formSubmissionId={deal.lead_id ?? null}
                  leadNome={deal.athlete_name}
                  leadEmail={deal.guardian_email ?? deal.email ?? null}
                />
              )}
              {section === "atribuicao" && <AtribuicaoSection deal={deal} />}
              {section === "financeiro" && (
                <DealContratoTab dealId={deal.id} atletaId={deal.atleta_id} />
              )}
              {section === "documentos" &&
                (deal.atleta_id ? (
                  <DocumentosChecklist
                    atletaId={deal.atleta_id}
                    docs={documentos.docs}
                    loading={documentos.loading}
                    onRefetch={documentos.refetch}
                  />
                ) : (
                  <EmptyState text="Atleta ainda não vinculado ao deal." />
                ))}
              {section === "notas" && <NotasSection dealId={deal.id} />}
              {section === "auditoria" && (
                <AuditoriaSection dealId={deal.id} atletaId={deal.atleta_id} />
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sections ───────────────────────────────────────────────────

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center py-16 text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function AtletaSection({ deal }: { deal: Deal }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card title="Identidade" icon={User} iconColor="text-sys-blue">
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Nome completo" value={deal.athlete_name} copyable />
          <Field
            label="Data de nascimento"
            value={fmtDate(deal.data_nascimento)}
          />
          <Field
            label="E-mail"
            value={deal.email}
            href={deal.email ? `mailto:${deal.email}` : undefined}
            copyable
          />
          <Field
            label="WhatsApp atleta"
            value={deal.whatsapp}
            href={
              deal.whatsapp
                ? `https://wa.me/${deal.whatsapp.replace(/\D/g, "")}`
                : undefined
            }
            copyable
          />
          <Field label="Instagram" value={deal.instagram} />
        </dl>
      </Card>

      <Card title="Localização" icon={MapPin} iconColor="text-sys-green">
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Cidade/Estado" value={deal.cidade_estado} />
          <Field label="Estado (endereço)" value={deal.address_state} />
        </dl>
      </Card>

      <Card title="LGPD" icon={Shield} iconColor="text-sys-purple">
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field
            label="Consentimento LGPD"
            value={deal.consentimento_lgpd ? "Aceito" : "Pendente"}
          />
          <Field
            label="Aceite WhatsApp"
            value={deal.aceite_whatsapp ? "Sim" : "Não"}
          />
          <Field
            label="Aceite e-mail"
            value={deal.aceite_email ? "Sim" : "Não"}
          />
          <Field
            label="Consentido em"
            value={fmtDateTime(deal.consentimento_at)}
          />
        </dl>
      </Card>

      <Card title="Identificadores internos" icon={Hash}>
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Deal ID" value={deal.id} mono copyable />
          <Field label="Atleta ID" value={deal.atleta_id} mono copyable />
          <Field label="Lead ID" value={deal.lead_id} mono copyable />
          <Field
            label="Responsável (user)"
            value={deal.responsavel_id}
            mono
            copyable
          />
        </dl>
      </Card>
    </div>
  );
}

function AcademicoSection({ deal }: { deal: Deal }) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card title="Escola atual" icon={GraduationCap} iconColor="text-sys-blue">
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Escola" value={deal.escola_atual} />
          <Field label="Série / Ano" value={deal.serie_escolar} />
          <Field label="Modelo educacional" value={deal.modelo_educacional} />
        </dl>
      </Card>

      <Card title="Desempenho" icon={Award} iconColor="text-sys-orange">
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Inglês" value={deal.nivel_ingles} />
          <Field label="Desempenho acadêmico" value={deal.desempenho_academico} />
          <Field label="Momento de início" value={deal.momento_inicio} />
        </dl>
      </Card>
    </div>
  );
}

function EsporteSection({ deal }: { deal: Deal }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="Modalidade & nível" icon={Trophy} iconColor="text-sys-orange">
          <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field label="Esporte" value={deal.esporte} />
            <Field label="Posição" value={deal.athlete_position} />
            <Field label="Nível competitivo" value={deal.nivel_competitivo} />
            <Field
              label="Vídeo highlights"
              value={deal.video_highlights_url ? "Acessar" : null}
              href={deal.video_highlights_url}
            />
            <Field
              label="Instagram"
              value={deal.instagram}
              href={
                deal.instagram
                  ? `https://instagram.com/${deal.instagram.replace(/^@/, "")}`
                  : undefined
              }
            />
          </dl>
        </Card>
        <Card title="Comprometimento & decisão" icon={CheckCircle2}>
          <dl className="grid grid-cols-1 gap-x-4">
            <Field label="Comprometimento" value={deal.comprometimento} />
            <Field label="Decisão familiar" value={deal.decisao_familiar} />
          </dl>
        </Card>
      </div>

      {(deal.historico_clubes || deal.conquistas) && (
        <Card title="Trajetória esportiva" icon={History}>
          <div className="space-y-3">
            {deal.historico_clubes && (
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Histórico de clubes
                </p>
                <p className="whitespace-pre-wrap text-sm text-foreground/90">
                  {deal.historico_clubes}
                </p>
              </div>
            )}
            {deal.conquistas && (
              <div className="border-t border-border pt-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Conquistas
                </p>
                <p className="whitespace-pre-wrap text-sm text-foreground/90">
                  {deal.conquistas}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function FamiliaSection({ deal }: { deal: Deal }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="Responsável financeiro" icon={User} iconColor="text-sys-blue">
          <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field label="Nome" value={deal.guardian_name} copyable />
            <Field label="Profissão" value={deal.guardian_profession} />
            <Field
              label="E-mail"
              value={deal.guardian_email}
              href={deal.guardian_email ? `mailto:${deal.guardian_email}` : undefined}
              copyable
            />
            <Field
              label="WhatsApp"
              value={deal.whatsapp}
              href={
                deal.whatsapp
                  ? `https://wa.me/${deal.whatsapp.replace(/\D/g, "")}`
                  : undefined
              }
              copyable
            />
          </dl>
        </Card>

        <Card title="Investimento" icon={Target} iconColor="text-sys-purple">
          <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field
              label="Faixa investimento"
              value={deal.investment_range}
            />
            <Field label="Plano" value={deal.product_tier} />
            <Field
              label="Tem desconto?"
              value={deal.has_discount ? `${deal.discount_pct ?? 0}%` : "Não"}
            />
          </dl>
        </Card>
      </div>

      {deal.siblings && deal.siblings.length > 0 && (
        <Card title={`Irmãos no programa (${deal.siblings.length})`} icon={Users}>
          <ul className="space-y-1.5">
            {deal.siblings.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-1.5 text-sm"
              >
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-foreground">{s.nome}</span>
                {s.esporte && (
                  <span className="text-xs text-muted-foreground">· {s.esporte}</span>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ComercialSection({
  deal,
  stageConfig = DEFAULT_DEAL_STAGE_DISPLAY,
}: {
  deal: Deal;
  stageConfig?: DealStageConfigMap;
}) {
  const stageCfg = stageConfig[deal.stage];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatPill
          label="Valor BRL"
          value={fmtBRL(deal.deal_value_brl)}
        />
        <StatPill
          label="Sinal BRL"
          value={fmtBRL(deal.signal_value_brl)}
          tone="green"
        />
        <StatPill
          label="Saldo BRL"
          value={fmtBRL(deal.remaining_value_brl)}
          tone="blue"
        />
        <StatPill
          label="Desconto"
          value={
            deal.has_discount && deal.discount_pct
              ? `${deal.discount_pct}%`
              : "—"
          }
          tone={deal.has_discount ? "orange" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="Pipeline" icon={Layers} iconColor="text-sys-blue">
          <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field label="Etapa atual" value={stageCfg.label} />
            <Field
              label="Última movimentação"
              value={fmtDateTime(deal.stage_updated_at)}
            />
            <Field
              label="Classificação"
              value={deal.classification}
            />
            <Field
              label="Qualificado Gemini"
              value={
                deal.qualificado_gemini == null
                  ? "—"
                  : deal.qualificado_gemini
                    ? `Sim · ${deal.classificacao_gemini ?? ""}`
                    : "Não"
              }
            />
            <Field
              label="Confiança Gemini"
              value={deal.confianca_gemini}
            />
            <Field
              label="Qualificado em"
              value={fmtDateTime(deal.qualificado_gemini_at)}
            />
            <Field
              label="Criado em"
              value={fmtDateTime(deal.created_at)}
            />
            <Field
              label="Fechado em"
              value={fmtDateTime(deal.closed_at)}
            />
            <Field
              label="Valores customizados?"
              value={deal.flag_valores_customizados ? "Sim" : "Não"}
            />
          </dl>
        </Card>

        <Card title="Próxima ação" icon={ListChecks} iconColor="text-sys-green">
          <dl className="grid grid-cols-1 gap-x-4">
            <Field label="Ação" value={deal.next_action} />
            <Field label="Quando" value={fmtDate(deal.next_action_date)} />
            <Field label="Responsável" value={deal.consultant} />
          </dl>
        </Card>
      </div>

      {deal.motivo_gemini && (
        <Card
          title="Justificativa Gemini"
          icon={Sparkles}
          iconColor="text-primary"
        >
          <p className="text-sm leading-relaxed text-foreground/90">
            {deal.motivo_gemini}
          </p>
        </Card>
      )}

      {(deal.flag_retrocedido ||
        deal.lost_reason ||
        deal.lost_reason_category) && (
        <Card
          title="Sinais de atenção"
          icon={AlertTriangle}
          iconColor="text-sys-orange"
        >
          <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field
              label="Retrocedido?"
              value={deal.flag_retrocedido ? "Sim" : "Não"}
            />
            <Field
              label="Motivo retrocesso"
              value={deal.motivo_retrocesso}
            />
            <Field
              label="Motivo de perda"
              value={deal.lost_reason}
            />
            <Field
              label="Categoria da perda"
              value={deal.lost_reason_category}
            />
            <Field label="Detalhe" value={deal.lost_detail} />
            <Field
              label="Reativável?"
              value={deal.can_reactivate ? "Sim" : "Não"}
            />
            <Field
              label="Reativar em"
              value={fmtDate(deal.reactivation_date)}
            />
          </dl>
        </Card>
      )}

      {deal.is_future_lead && (
        <Card title="Lead futuro" icon={Calendar} iconColor="text-plan-legacy">
          <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Field
              label="Ano do projeto"
              value={deal.future_project_year?.toString()}
            />
            <Field
              label="Reativar em"
              value={fmtDate(deal.future_reactivation_date)}
            />
          </dl>
        </Card>
      )}

      <Card title="Financeiro pós-contrato" icon={CircleDollarSign}>
        <dl className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
          <Field
            label="Contrato assinado em"
            value={fmtDateTime(deal.contract_signed_at)}
          />
          <Field
            label="Sinal pago em"
            value={fmtDateTime(deal.signal_paid_at)}
          />
          <Field
            label="Matrícula em"
            value={fmtDateTime(deal.enrollment_confirmed_at)}
          />
          <Field
            label="Saldo pago em"
            value={fmtDateTime(deal.remaining_paid_at)}
          />
        </dl>
      </Card>
    </div>
  );
}

function ReuniaoSection({ deal }: { deal: Deal }) {
  const dataReuniao = deal.reuniao_data;
  const rel = relReuniao(dataReuniao);
  const temReuniao = !!(dataReuniao || deal.reuniao_agendada_at);
  const realizada = rel ? !rel.futura : false;

  const status = !temReuniao
    ? { label: "Sem reunião", cls: "bg-secondary text-muted-foreground" }
    : realizada
      ? { label: "Realizada", cls: "bg-sys-green/12 text-sys-green" }
      : { label: "Agendada", cls: "bg-sys-blue/12 text-sys-blue" };

  return (
    <div className="space-y-3">
      {/* Hero da reunião */}
      <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.05] to-transparent">
        <div className="flex items-start justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                Reunião comercial
              </p>
              <p className="text-sm font-semibold text-foreground">
                {dataReuniao ? fmtDateTime(dataReuniao) : "Não agendada"}
              </p>
              {rel && (
                <p className={cn("text-[11px] font-medium", realizada ? "text-sys-green" : "text-sys-blue")}>
                  {realizada ? "Ocorreu " : "Acontece "}
                  {rel.label}
                </p>
              )}
            </div>
          </div>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", status.cls)}>
            {status.label}
          </span>
        </div>

        {deal.reuniao_agendada_at && (
          <div className="border-t border-border/60 px-4 py-2.5">
            <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
              Detectada em
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-foreground">
              <Clock className="size-3 text-muted-foreground" />
              {fmtDateTime(deal.reuniao_agendada_at)}
            </p>
          </div>
        )}

        {deal.reuniao_link && (
          <div className="border-t border-border/60 px-4 py-3">
            <a
              href={deal.reuniao_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-sys-green/12 px-3 py-2 text-xs font-semibold text-sys-green transition-colors hover:bg-sys-green/20"
            >
              <Video className="size-4" />
              Entrar na reunião
              <ExternalLink className="size-3 opacity-70" />
            </a>
          </div>
        )}
      </div>

      {/* Todas as reuniões do lead no Calendar (relink em caso de remarcação) */}
      <ReunioesCalendarBlock deal={deal} />

      {/* Transcrição do Meet (CF meeting-transcripts) — só renderiza se capturada */}
      <TranscricaoReuniaoCard dealId={deal.id} />
    </div>
  );
}

/**
 * Lista TODAS as reuniões do lead no Calendar do CEO (via CF read-only) e
 * permite religar o deal ao evento correto — cobre remarcações passadas em
 * que o deal ficou preso no evento antigo (transcrição no evento novo).
 */
type TranscricaoEventoEstado =
  | { estado: "carregando" }
  | { estado: "ok"; data: ReuniaoTranscricao }
  | { estado: "nao_disponivel" }
  | { estado: "erro"; erro: string };

function ReunioesCalendarBlock({ deal }: { deal: Deal }) {
  const [eventos, setEventos] = useState<ReuniaoCalendar[] | null>(null);
  const [atual, setAtual] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Transcrição sob demanda por evento (clique no selo abre/puxa)
  const [transcricaoAberta, setTranscricaoAberta] = useState<string | null>(null);
  const [transcricoes, setTranscricoes] = useState<Record<string, TranscricaoEventoEstado>>({});

  const buscar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await listarReunioesLead(deal.id);
      if (r.success) {
        setEventos(r.eventos);
        setAtual(r.atual);
      } else {
        setErro(r.error);
      }
    } catch {
      setErro("Não foi possível consultar o Calendar agora.");
    } finally {
      setCarregando(false);
    }
  };

  // Auto-carrega ao abrir a aba — todas as reuniões do lead, sem clique.
  useEffect(() => {
    void buscar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id]);

  const vincular = (ev: ReuniaoCalendar) => {
    startTransition(async () => {
      const r = await relinkReuniaoDeal(deal.id, {
        id: ev.id,
        start: ev.start,
        hangoutLink: ev.hangoutLink,
        htmlLink: ev.htmlLink,
      });
      if (r.success) {
        setAtual(ev.id);
        toast.success("Reunião vinculada ao deal", {
          description: "Data, link e status do deal agora seguem este evento.",
        });
      } else {
        toast.error(r.error);
      }
    });
  };

  const toggleTranscricao = (ev: ReuniaoCalendar) => {
    if (transcricaoAberta === ev.id) {
      setTranscricaoAberta(null);
      return;
    }
    setTranscricaoAberta(ev.id);

    const jaCarregada = transcricoes[ev.id];
    if (jaCarregada && jaCarregada.estado !== "erro") return;

    setTranscricoes((prev) => ({ ...prev, [ev.id]: { estado: "carregando" } }));
    void (async () => {
      try {
        const r = await obterTranscricaoEvento({
          eventId: ev.id,
          dealId: deal.id,
          formSubmissionId: deal.lead_id ?? undefined,
        });
        setTranscricoes((prev) => ({
          ...prev,
          [ev.id]:
            r.success && r.status === "ok"
              ? { estado: "ok", data: r.transcricao }
              : r.success
                ? { estado: "nao_disponivel" }
                : { estado: "erro", erro: r.error },
        }));
      } catch {
        setTranscricoes((prev) => ({
          ...prev,
          [ev.id]: { estado: "erro", erro: "Falha ao puxar a transcrição." },
        }));
      }
    })();
  };

  return (
    <div className="rounded-xl border border-border bg-card/60">
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <Calendar className="size-3.5 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Reuniões no Calendar
          </span>
        </div>
        <button
          type="button"
          onClick={() => void buscar()}
          disabled={carregando}
          className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {carregando ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Calendar className="size-3" />
          )}
          {eventos === null ? "Buscar reuniões" : "Atualizar"}
        </button>
      </div>

      {erro && (
        <p className="border-t border-border/60 px-3 py-2 text-[11px] text-sys-red">{erro}</p>
      )}

      {eventos !== null && !erro && (
        <div className="border-t border-border/60">
          {eventos.length === 0 ? (
            <p className="px-3 py-2.5 text-[11px] text-muted-foreground">
              Nenhum evento do Calendar casa com o e-mail/telefone deste lead na janela
              (últimos 180 dias + próximos 120).
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {eventos.map((ev) => {
                const vinculada = ev.id === atual;
                const cancelada = ev.status === "cancelled";
                const aberta = transcricaoAberta === ev.id;
                const trans = transcricoes[ev.id];
                return (
                  <li key={ev.id}>
                    <div className="flex items-center gap-2 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "text-xs font-medium tabular-nums",
                              cancelada ? "text-muted-foreground line-through" : "text-foreground",
                            )}
                          >
                            {ev.start ? fmtDateTime(ev.start) : "sem data"}
                          </span>
                          {cancelada && (
                            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                              Cancelada
                            </span>
                          )}
                          {ev.temTranscricaoAnexada && (
                            <button
                              type="button"
                              onClick={() => toggleTranscricao(ev)}
                              aria-expanded={aberta}
                              className={cn(
                                "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold transition-colors",
                                aberta
                                  ? "bg-sys-green text-white"
                                  : "bg-sys-green/12 text-sys-green hover:bg-sys-green/20",
                              )}
                            >
                              {trans?.estado === "carregando" ? (
                                <Loader2 className="size-2.5 animate-spin" />
                              ) : (
                                <FileText className="size-2.5" />
                              )}
                              Transcrição
                            </button>
                          )}
                          {vinculada && (
                            <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                              <CheckCircle2 className="size-2.5" />
                              Vinculada
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground">{ev.summary}</p>
                      </div>
                      {!vinculada && !cancelada && (
                        <button
                          type="button"
                          onClick={() => vincular(ev)}
                          disabled={isPending}
                          className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                        >
                          Vincular
                        </button>
                      )}
                    </div>

                    {/* Transcrição sob demanda — expande abaixo da linha */}
                    {aberta && (
                      <div className="border-t border-border/40 bg-secondary/40 px-3 py-2.5">
                        {!trans || trans.estado === "carregando" ? (
                          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Loader2 className="size-3 animate-spin" />
                            Puxando a transcrição desta reunião…
                          </p>
                        ) : trans.estado === "nao_disponivel" ? (
                          <p className="text-[11px] text-muted-foreground">
                            A transcrição ainda não está pronta no Google (o Meet leva alguns
                            minutos para anexar o Doc). Tente de novo em instantes.
                          </p>
                        ) : trans.estado === "erro" ? (
                          <p className="text-[11px] text-sys-red">{trans.erro}</p>
                        ) : (
                          <div className="space-y-2">
                            {trans.data.resumo && (
                              <p className="text-[11px] leading-relaxed text-foreground">
                                {trans.data.resumo}
                              </p>
                            )}
                            {trans.data.transcript_text && (
                              <details className="group">
                                <summary className="cursor-pointer text-[10px] font-semibold text-primary hover:underline">
                                  Ver transcrição completa
                                </summary>
                                <pre className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/60 bg-card p-2 text-[10px] leading-relaxed text-muted-foreground">
                                  {trans.data.transcript_text}
                                </pre>
                              </details>
                            )}
                            <div className="flex items-center gap-3 text-[10px] text-label-tertiary">
                              <span>Capturada {fmtDateTime(trans.data.capturada_at)}</span>
                              {trans.data.doc_url && (
                                <a
                                  href={trans.data.doc_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                                >
                                  Abrir no Google Docs
                                  <ExternalLink className="size-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ComunicacoesSection({ deal }: { deal: Deal }) {
  type Evento = {
    label: string;
    quando?: string;
    descricao?: string;
    ok: boolean;
    icon: typeof Send;
  };
  const eventos: Evento[] = [
    {
      label: "Formulário enviado",
      quando: deal.submitted_at,
      ok: !!deal.submitted_at,
      icon: FileText,
    },
    {
      label: "Qualificação Gemini",
      quando: deal.qualificado_gemini_at,
      descricao:
        deal.motivo_gemini &&
        deal.motivo_gemini.slice(0, 140) +
          (deal.motivo_gemini.length > 140 ? "…" : ""),
      ok: !!deal.qualificado_gemini_at,
      icon: Sparkles,
    },
    {
      label: "WhatsApp inicial",
      quando: deal.whatsapp_sent_at,
      ok: !!deal.whatsapp_sent_at,
      icon: Send,
    },
    {
      label: "Follow-up 1 (48h)",
      quando: deal.followup_1_sent_at,
      ok: !!deal.followup_1_sent_at,
      icon: Send,
    },
    {
      label: "Follow-up 2 (7d)",
      quando: deal.followup_2_sent_at,
      ok: !!deal.followup_2_sent_at,
      icon: Send,
    },
    {
      label: "Reunião agendada",
      quando: deal.reuniao_agendada_at,
      ok: !!deal.reuniao_agendada_at,
      icon: CalendarDays,
    },
  ];

  return (
    <div className="space-y-3">
      <Card title="Timeline de comunicações" icon={MessageSquare}>
        <ol className="space-y-1.5">
          {eventos.map((e, i) => {
            const Icon = e.icon;
            return (
              <li
                key={`${e.label}-${i}`}
                className="flex items-start gap-2.5 rounded-md border border-border bg-background/40 px-3 py-2"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 items-center justify-center rounded-full",
                    e.ok
                      ? "bg-sys-green/15 text-sys-green"
                      : "bg-secondary text-muted-foreground/50",
                  )}
                >
                  <Icon className="h-3 w-3" />
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
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {e.quando ? fmtDateTime(e.quando) : "pendente"}
                    </span>
                  </div>
                  {e.descricao && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {e.descricao}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card title="Ações rápidas" icon={Send} iconColor="text-sys-green">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {deal.whatsapp && (
            <a
              href={`https://wa.me/${deal.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-sys-green/30 bg-sys-green/10 px-3 py-2 text-xs font-medium text-sys-green transition-colors hover:bg-sys-green/20"
            >
              <Send className="h-3.5 w-3.5" />
              WhatsApp responsável
            </a>
          )}
          {(deal.guardian_email || deal.email) && (
            <a
              href={`mailto:${deal.guardian_email ?? deal.email}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-sys-blue/30 bg-sys-blue/10 px-3 py-2 text-xs font-medium text-sys-blue transition-colors hover:bg-sys-blue/20"
            >
              <Mail className="h-3.5 w-3.5" />
              E-mail
            </a>
          )}
          {deal.reuniao_link && (
            <a
              href={deal.reuniao_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Video className="h-3.5 w-3.5" />
              Entrar na reunião
            </a>
          )}
        </div>
      </Card>
    </div>
  );
}

function AtribuicaoSection({ deal }: { deal: Deal }) {
  // Esses campos vêm do form_submissions mas não estão no tipo Deal.
  // Mostramos um aviso se vier vazio.
  return (
    <div className="space-y-3">
      <Card
        title="Atribuição & UTM"
        icon={BarChart3}
        iconColor="text-sys-purple"
      >
        <p className="text-xs text-muted-foreground">
          A atribuição (UTM, referrer, CTA, device, session) é capturada no
          formulário e fica visível no detalhamento do lead. Aqui mostramos os
          dados disponíveis no deal.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Responsável" value={deal.consultant} />
          <Field
            label="Submissão original em"
            value={fmtDateTime(deal.submitted_at)}
          />
        </div>
      </Card>
    </div>
  );
}

function NotasSection({ dealId }: { dealId: string }) {
  const [notes, setNotes] = useState<NotaInterna[] | null>(null);
  const [newNote, setNewNote] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    listarNotas({ deal_id: dealId })
      .then((d) => {
        if (!cancelled) setNotes(d as NotaInterna[]);
      })
      .catch(() => !cancelled && setNotes([]));
    return () => {
      cancelled = true;
    };
  }, [dealId]);

  const handleSubmit = () => {
    if (!newNote.trim()) return;
    startTransition(async () => {
      const res = await criarNota({ deal_id: dealId, conteudo: newNote.trim() });
      if (res?.success) {
        toast.success("Nota registrada");
        setNewNote("");
        const updated = await listarNotas({ deal_id: dealId });
        setNotes(updated as NotaInterna[]);
      } else {
        toast.error(res?.error ?? "Não foi possível salvar a nota");
      }
    });
  };

  return (
    <div className="space-y-3">
      <Card title="Nova nota" icon={StickyNote}>
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Registrar contexto, decisão ou alerta para o time…"
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isPending || !newNote.trim()}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            Adicionar
          </button>
        </div>
      </Card>

      <Card title={`Notas (${notes?.length ?? 0})`} icon={StickyNote}>
        {notes == null ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">
            Nenhuma nota ainda. Use o campo acima para registrar.
          </p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-md border border-border bg-background/40 px-3 py-2"
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-primary">
                    {(n.autor as unknown as { nome?: string })?.nome ?? "Usuário"}
                  </p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {fmtDateTime(n.created_at)}
                  </p>
                </div>
                <p className="whitespace-pre-wrap text-sm text-foreground">
                  {n.conteudo}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AuditoriaSection({
  dealId,
  atletaId,
}: {
  dealId: string;
  atletaId?: string;
}) {
  const [logs, setLogs] = useState<AuditLog[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAuditLogsForDeal(dealId, atletaId)
      .then((d) => {
        if (!cancelled) setLogs(d as AuditLog[]);
      })
      .catch(() => !cancelled && setLogs([]));
    return () => {
      cancelled = true;
    };
  }, [dealId, atletaId]);

  if (logs == null) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return <EmptyState text="Sem registros de auditoria ainda." />;
  }

  return (
    <Card title={`Auditoria (${logs.length})`} icon={History}>
      <ol className="space-y-1.5">
        {logs.slice(0, 50).map((log) => {
          const old = log.dados_anteriores as Record<string, unknown> | null;
          const next = log.dados_novos as Record<string, unknown> | null;
          const allKeys = Array.from(
            new Set([
              ...Object.keys(old ?? {}),
              ...Object.keys(next ?? {}),
            ]),
          );
          const changedKeys = allKeys.filter(
            (k) =>
              JSON.stringify(old?.[k] ?? null) !==
              JSON.stringify(next?.[k] ?? null),
          );

          const opColor =
            log.operacao === "INSERT"
              ? "text-sys-green"
              : log.operacao === "DELETE"
                ? "text-sys-red"
                : "text-sys-blue";

          return (
            <li
              key={log.id}
              className="rounded-md border border-border bg-background/40 px-3 py-2"
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold">
                  <span className={cn("uppercase", opColor)}>
                    {log.operacao}
                  </span>
                  <span className="text-muted-foreground">{log.tabela}</span>
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {fmtDateTime(log.created_at)}
                </p>
              </div>
              {log.operacao === "UPDATE" && changedKeys.length > 0 && (
                <dl className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {changedKeys.slice(0, 6).map((k) => (
                    <div
                      key={k}
                      className="rounded border border-border/40 bg-secondary/20 px-2 py-1"
                    >
                      <p className="text-[9px] font-semibold uppercase text-muted-foreground">
                        {k}
                      </p>
                      <p className="break-all text-[10px]">
                        <span className="text-sys-red line-through">
                          {String(old?.[k] ?? "—").slice(0, 40)}
                        </span>{" "}
                        →{" "}
                        <span className="text-sys-green">
                          {String(next?.[k] ?? "—").slice(0, 40)}
                        </span>
                      </p>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
