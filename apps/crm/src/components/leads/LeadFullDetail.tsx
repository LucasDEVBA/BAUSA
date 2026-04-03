"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  X,
  ArrowLeft,
  Mail,
  MessageCircle,
  Instagram,
  Video,
  Calendar,
  Check,
  Clock,
  Send,
  User,
  GraduationCap,
  Trophy,
  Globe,
  MapPin,
  Phone,
  FileText,
  Sparkles,
  Target,
  ArrowRight,
  ChevronRight,
  Info,
  Shield,
  Loader2,
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
import { cn } from "@/lib/utils";
import { criarNota, listarNotas } from "@/lib/actions/notas";
import { getAuditLogsForDeal } from "@/lib/actions/audit";
import type { NotaInterna, AuditLog } from "@/types/crm";
import { DealDocumentsTab } from "@/components/pipeline/DealDocumentsTab";
import { DealContratoTab } from "@/components/pipeline/DealContratoTab";
import { toast } from "sonner";

interface LeadFullDetailProps {
  lead: Lead;
  onClose: () => void;
}

type TabId = "resumo" | "dados" | "comunicacao" | "documentos" | "contrato" | "historico" | "notas";

const TABS: { id: TabId; label: string }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "dados", label: "Dados" },
  { id: "comunicacao", label: "Comunicacao" },
  { id: "documentos", label: "Documentos" },
  { id: "contrato", label: "Contrato" },
  { id: "historico", label: "Historico" },
  { id: "notas", label: "Notas" },
];

const CLASSIFICATION_COLORS = {
  QUENTE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  MORNO: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  FRIO: "bg-blue-500/10 text-blue-400 border-blue-500/20",
} as const;

const LEAD_SCORE_INFO =
  "O Lead Score e calculado automaticamente com base nos dados preenchidos do atleta. Quanto mais completos os dados, mais preciso o score. Criterios: Investimento (25%), Timing (20%), Ingles (15%), Academico (15%), Competitivo (10%), Comprometimento (10%), Video (5%)";

const TEAM_MEMBERS = [
  { nome: "Leandro (CEO)" },
  { nome: "Fernanda (Head)" },
];

const AUDIT_FIELD_LABELS: Record<string, string> = {
  etapa: "Etapa",
  valor_estimado: "Valor estimado",
  next_action: "Proxima acao",
  data_proxima_acao: "Data proxima acao",
  notas_reuniao: "Notas reuniao",
  motivo_perda: "Motivo perda",
  lead_score: "Lead Score",
  lead_classificacao: "Classificacao",
  nivel_competitivo: "Nivel competitivo",
  nivel_ingles: "Nivel de ingles",
  esporte: "Esporte",
  serie_escolar: "Serie escolar",
  nome_completo: "Nome",
  faixa_investimento: "Faixa investimento",
};

// ─── Helper Components ───────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
      {children}
    </h4>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="flex-shrink-0 text-zinc-500">{label}</span>
      <span className="text-right text-zinc-200">{value}</span>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-medium text-zinc-200 mt-1">{value ?? "---"}</p>
    </div>
  );
}

function CommunicationStep({
  icon,
  label,
  date,
  done,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  date: string | null | undefined;
  done: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border px-5 py-4",
        done
          ? "border-emerald-500/20 bg-emerald-500/5"
          : disabled
            ? "border-[#1e2130] bg-zinc-900/30 opacity-50"
            : "border-[#1e2130] bg-[#141720]",
      )}
    >
      <div className="flex items-center gap-3 text-sm">
        <span className={done ? "text-emerald-400" : "text-zinc-500"}>
          {icon}
        </span>
        <span className={done ? "text-zinc-200 font-medium" : "text-zinc-400"}>
          {label}
        </span>
      </div>
      {done ? (
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
          <Check className="h-4 w-4" />
          {date ? formatDate(date) : "Enviado"}
        </div>
      ) : (
        <span className="text-xs text-zinc-600">
          {disabled ? "---" : "Pendente"}
        </span>
      )}
    </div>
  );
}

function TimelineEvent({
  icon: Icon,
  label,
  date,
  detail,
  active = true,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  date?: string | null;
  detail?: string;
  active?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full",
            active ? "bg-indigo-500/20" : "bg-[#1e2130]",
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              active ? "text-indigo-400" : "text-zinc-600",
            )}
          />
        </div>
        <div className="w-px flex-1 bg-[#1e2130]" />
      </div>
      <div className="pb-6">
        <p
          className={cn(
            "text-sm font-medium",
            active ? "text-zinc-200" : "text-zinc-500",
          )}
        >
          {label}
        </p>
        {date && (
          <p className="text-xs text-zinc-500 mt-0.5">
            {formatDateTime(date)}
          </p>
        )}
        {detail && (
          <p className="text-xs text-zinc-400 mt-1 inline-block rounded-md bg-[#141720] px-2 py-1">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-emerald-500"
      : score >= 60
        ? "bg-amber-500"
        : score >= 40
          ? "bg-orange-500"
          : "bg-red-500";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 rounded-full bg-[#1e2130] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            color,
          )}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-sm font-bold text-zinc-100 tabular-nums w-8 text-right">
        {score}
      </span>
    </div>
  );
}

function renderNoteWithMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\w[\w\s()]*?\b)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className="font-semibold text-indigo-400">
          {part}
        </span>
      );
    }
    return part;
  });
}

function getAuditColor(log: AuditLog): string {
  const campos = log.campos_alterados ?? [];
  if (campos.some((c) => c === "etapa" || c === "etapa_anterior"))
    return "text-indigo-400";
  if (
    campos.some(
      (c) =>
        c.includes("valor") ||
        c.includes("financ") ||
        c.includes("pago") ||
        c.includes("sinal"),
    )
  )
    return "text-emerald-400";
  return "text-blue-400";
}

function getAuditBg(log: AuditLog): string {
  const campos = log.campos_alterados ?? [];
  if (campos.some((c) => c === "etapa" || c === "etapa_anterior"))
    return "bg-indigo-500/20";
  if (
    campos.some(
      (c) =>
        c.includes("valor") ||
        c.includes("financ") ||
        c.includes("pago") ||
        c.includes("sinal"),
    )
  )
    return "bg-emerald-500/20";
  return "bg-blue-500/20";
}

// ─── Sub-sections ────────────────────────────────────────────────

function NotesSection({ dealId }: { dealId: string }) {
  const [isPendingNotes, startNotesTransition] = useTransition();
  const [notes, setNotes] = useState<NotaInterna[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");

  const loadNotes = () => {
    startNotesTransition(async () => {
      const data = await listarNotas({ deal_id: dealId });
      setNotes(data);
      setLoaded(true);
    });
  };

  const handleSubmit = () => {
    if (!newNote.trim()) return;
    startNotesTransition(async () => {
      const result = await criarNota({ conteudo: newNote, deal_id: dealId });
      if (result.success) {
        setNewNote("");
        toast.success("Nota adicionada");
        const data = await listarNotas({ deal_id: dealId });
        setNotes(data);
      } else {
        toast.error(result.error ?? "Erro ao criar nota");
      }
    });
  };

  if (!loaded) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <MessageCircle className="h-8 w-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">Notas internas do deal</p>
        <button
          onClick={loadNotes}
          disabled={isPendingNotes}
          className="flex items-center gap-2 rounded-lg bg-indigo-600/20 px-4 py-2 text-xs font-medium text-indigo-300 hover:bg-indigo-600/30 transition-colors"
        >
          {isPendingNotes ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageCircle className="h-3.5 w-3.5" />
          )}
          Carregar notas
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Input with @mention support */}
      <div className="space-y-2 relative">
        <textarea
          value={newNote}
          onChange={(e) => {
            const val = e.target.value;
            setNewNote(val);
            const cursorPos = e.target.selectionStart;
            const textBeforeCursor = val.slice(0, cursorPos);
            const atMatch = textBeforeCursor.match(/@(\w*)$/);
            if (atMatch) {
              setShowMentionDropdown(true);
              setMentionFilter(atMatch[1].toLowerCase());
            } else {
              setShowMentionDropdown(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowMentionDropdown(false);
          }}
          placeholder="Escrever nota interna... (use @ para mencionar)"
          rows={3}
          className="w-full rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/40 resize-none"
        />
        {showMentionDropdown && (
          <div className="absolute left-0 bottom-full mb-1 z-10 w-56 rounded-lg border border-[#1e2130] bg-[#0f1117] shadow-xl overflow-hidden">
            {TEAM_MEMBERS.filter((m) =>
              m.nome.toLowerCase().includes(mentionFilter),
            ).map((member) => (
              <button
                key={member.nome}
                onClick={() => {
                  const cursorText = newNote;
                  const atIdx = cursorText.lastIndexOf("@");
                  if (atIdx >= 0) {
                    const before = cursorText.slice(0, atIdx);
                    const after = cursorText
                      .slice(atIdx)
                      .replace(/@\w*/, "");
                    setNewNote(`${before}@${member.nome}${after} `);
                  }
                  setShowMentionDropdown(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-indigo-600/20 hover:text-indigo-300 transition-colors"
              >
                <User className="h-3.5 w-3.5 text-zinc-500" />
                {member.nome}
              </button>
            ))}
            {TEAM_MEMBERS.filter((m) =>
              m.nome.toLowerCase().includes(mentionFilter),
            ).length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-600">
                Nenhum usuario encontrado
              </p>
            )}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={isPendingNotes || !newNote.trim()}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPendingNotes ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Adicionar nota
        </button>
      </div>

      {/* List */}
      {notes.length === 0 ? (
        <p className="text-sm text-zinc-600 text-center py-4">
          Nenhuma nota ainda.
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-xl border border-[#1e2130] bg-[#141720] px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-indigo-400">
                  {(n.autor as unknown as { nome: string })?.nome ?? "Usuario"}
                </p>
                <p className="text-[10px] text-zinc-600">
                  {new Date(n.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                {renderNoteWithMentions(n.conteudo)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditTrailSection({
  dealId,
  atletaId,
}: {
  dealId: string;
  atletaId?: string;
}) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPendingAudit, startAuditTransition] = useTransition();

  const loadAuditLogs = () => {
    startAuditTransition(async () => {
      const data = await getAuditLogsForDeal(dealId, atletaId);
      setLogs(data);
      setLoaded(true);
    });
  };

  if (!loaded) {
    return (
      <div className="border-t border-[#1e2130] pt-5 mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-3">
          Alteracoes registradas (Audit Trail)
        </p>
        <button
          onClick={loadAuditLogs}
          disabled={isPendingAudit}
          className="flex items-center gap-2 rounded-lg bg-blue-600/20 px-4 py-2 text-xs font-medium text-blue-300 hover:bg-blue-600/30 transition-colors"
        >
          {isPendingAudit ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Shield className="h-3.5 w-3.5" />
          )}
          Carregar audit trail
        </button>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="border-t border-[#1e2130] pt-5 mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-3">
          Alteracoes registradas
        </p>
        <p className="text-xs text-zinc-600 text-center py-4">
          Nenhuma alteracao registrada.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-[#1e2130] pt-5 mt-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-600 mb-3">
        Alteracoes registradas ({logs.length})
      </p>
      <div className="space-y-2">
        {logs.map((log) => {
          const campos = log.campos_alterados ?? [];
          const color = getAuditColor(log);
          const bg = getAuditBg(log);

          return (
            <div
              key={log.id}
              className="rounded-xl border border-[#1e2130] bg-[#141720] px-4 py-3"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full",
                      bg,
                    )}
                  >
                    <Shield className={cn("h-3 w-3", color)} />
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase",
                      color,
                    )}
                  >
                    {log.operacao}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {log.tabela}
                  </span>
                </div>
                <span className="text-[10px] text-zinc-600">
                  {new Date(log.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {campos.length > 0 && log.operacao === "UPDATE" && (
                <div className="space-y-0.5">
                  {campos.map((campo) => {
                    const anterior = log.dados_anteriores?.[campo];
                    const novo = log.dados_novos?.[campo];
                    const fieldLabel =
                      AUDIT_FIELD_LABELS[campo] ?? campo;
                    return (
                      <p key={campo} className="text-xs text-zinc-400">
                        <span className="font-medium text-zinc-300">
                          {fieldLabel}
                        </span>
                        {anterior != null && (
                          <span className="text-zinc-600">
                            {" "}
                            de{" "}
                            <span className="text-red-400/70">
                              {String(anterior)}
                            </span>
                          </span>
                        )}
                        <span className="text-zinc-600"> para </span>
                        <span className={color}>
                          {String(novo ?? "---")}
                        </span>
                      </p>
                    );
                  })}
                </div>
              )}
              {log.operacao === "INSERT" && (
                <p className="text-xs text-zinc-500">Registro criado</p>
              )}
              {log.operacao === "DELETE" && (
                <p className="text-xs text-zinc-500">
                  Registro removido (soft delete)
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export function LeadFullDetail({ lead, onClose }: LeadFullDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>("resumo");

  const whatsappUrl = lead.guardian_whatsapp
    ? `https://wa.me/${lead.guardian_whatsapp.replace(/\D/g, "")}`
    : null;

  const classColors = lead.qualification_classification
    ? CLASSIFICATION_COLORS[lead.qualification_classification]
    : "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";

  // Lock body scroll when the modal is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 flex flex-col w-full max-w-5xl h-[90vh] rounded-2xl border border-[#1e2130] bg-[#0c0e14] shadow-2xl overflow-hidden">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 flex-shrink-0 border-b border-[#1e2130] bg-[#0c0e14] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          {/* Back button */}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          {/* Avatar + Name + Badge */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
              {getInitials(lead.athlete_name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="truncate text-lg font-semibold text-zinc-100">
                  {lead.athlete_name}
                </h1>
                <LeadStatusBadge
                  classification={lead.qualification_classification}
                />
                {lead.is_in_pipeline && lead.pipeline_stage && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        DEAL_STAGE_CONFIG[lead.pipeline_stage as DealStage]
                          ?.dotColor ?? "bg-zinc-500",
                      )}
                    />
                    {DEAL_STAGE_CONFIG[lead.pipeline_stage as DealStage]
                      ?.shortLabel ?? "Pipeline"}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500">
                {lead.position || "---"}{" "}
                {lead.age ? `| ${lead.age} anos` : ""}{" "}
                {lead.school_year ? `| ${lead.school_year}` : ""}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="hidden items-center gap-2 md:flex">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600/20 border border-emerald-600/30 px-3 py-2 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            )}
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600/20 border border-indigo-600/30 px-3 py-2 text-xs font-medium text-indigo-400 transition-colors hover:bg-indigo-600/30"
            >
              <Mail className="h-3.5 w-3.5" />
              E-mail
            </a>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-300"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="sticky top-[73px] z-10 flex-shrink-0 border-b border-[#1e2130] bg-[#0c0e14]">
        <div className="mx-auto flex max-w-6xl gap-1 px-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "whitespace-nowrap px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">
          {/* ══════ TAB: RESUMO ══════ */}
          {activeTab === "resumo" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
              {/* Left column (3/5) */}
              <div className="space-y-6 lg:col-span-3">
                {/* Qualificacao IA */}
                {lead.qualification_reason && (
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="h-4 w-4 text-indigo-400" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                        Analise da IA
                      </span>
                      {lead.qualification_confidence && (
                        <span className="ml-auto text-[10px] text-zinc-500">
                          Confianca: {lead.qualification_confidence}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {lead.qualification_reason}
                    </p>
                    {lead.qualified_at && (
                      <p className="mt-2 text-xs text-zinc-500">
                        Qualificado em {formatDateTime(lead.qualified_at)}
                      </p>
                    )}
                  </div>
                )}

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <InfoCard
                    label="Investimento"
                    value={
                      lead.investment_range
                        ? formatInvestmentRange(lead.investment_range)
                        : "---"
                    }
                  />
                  <InfoCard
                    label="Local"
                    value={
                      lead.school_city_state ||
                      lead.address_state ||
                      "---"
                    }
                  />
                  <InfoCard
                    label="Escola"
                    value={lead.current_school || "---"}
                  />
                  <InfoCard
                    label="Serie"
                    value={lead.school_year || "---"}
                  />
                  <InfoCard
                    label="Ingles"
                    value={lead.english_level || "---"}
                  />
                  <InfoCard
                    label="Esporte / Posicao"
                    value={lead.position || "---"}
                  />
                </div>

                {/* Responsavel card */}
                <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
                  <SectionTitle>Responsavel Financeiro</SectionTitle>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-zinc-500">Nome</p>
                      <p className="text-zinc-200 mt-0.5">
                        {lead.guardian_name || "---"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">Profissao</p>
                      <p className="text-zinc-200 mt-0.5">
                        {lead.guardian_profession || "---"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">E-mail</p>
                      <p className="text-zinc-200 mt-0.5">
                        {lead.guardian_email || "---"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">WhatsApp</p>
                      <p className="text-zinc-200 mt-0.5">
                        {lead.guardian_whatsapp
                          ? formatPhone(lead.guardian_whatsapp)
                          : "---"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Siblings */}
                {lead.siblings && lead.siblings.length > 0 && (
                  <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
                    <SectionTitle>
                      Familia ({lead.guardian_name})
                    </SectionTitle>
                    <div className="space-y-2">
                      {lead.siblings.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg border border-[#1e2130] bg-[#0c0e14] px-3 py-2"
                        >
                          <div>
                            <p className="text-sm text-zinc-200">{s.nome}</p>
                            {s.esporte && (
                              <p className="text-xs text-zinc-500">
                                {s.esporte}
                              </p>
                            )}
                          </div>
                          {s.classificacao && (
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                s.classificacao === "hot"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : s.classificacao === "warm"
                                    ? "bg-amber-500/15 text-amber-400"
                                    : "bg-blue-500/15 text-blue-400",
                              )}
                            >
                              {s.classificacao === "hot"
                                ? "HOT"
                                : s.classificacao === "warm"
                                  ? "WARM"
                                  : "COLD"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right column (2/5) */}
              <div className="space-y-6 lg:col-span-2">
                {/* Pipeline status card */}
                {lead.is_in_pipeline && (
                  <Link
                    href="/pipeline"
                    className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-5 py-4 transition-colors hover:bg-indigo-500/15"
                  >
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-indigo-400" />
                      <span className="text-sm font-medium text-indigo-400">
                        Ver no Pipeline
                      </span>
                      <span className="text-sm text-zinc-300">
                        {lead.pipeline_stage
                          ? DEAL_STAGE_CONFIG[
                              lead.pipeline_stage as DealStage
                            ]?.label
                          : ""}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-indigo-400" />
                  </Link>
                )}

                {/* Quick actions (mobile) */}
                <div className="flex gap-2 md:hidden">
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600/20 border border-emerald-600/30 py-2.5 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </a>
                  )}
                  <a
                    href={`mailto:${lead.email}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600/20 border border-indigo-600/30 py-2.5 text-sm font-medium text-indigo-400 transition-colors hover:bg-indigo-600/30"
                  >
                    <Mail className="h-4 w-4" />
                    E-mail
                  </a>
                </div>

                {/* Communication summary */}
                <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
                  <SectionTitle>Comunicacao</SectionTitle>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">WhatsApp Inicial</span>
                      {lead.whatsapp_sent_at ? (
                        <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {formatDate(lead.whatsapp_sent_at)}
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs">Pendente</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Follow-up 1</span>
                      {lead.followup_1_sent_at ? (
                        <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {formatDate(lead.followup_1_sent_at)}
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs">---</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Follow-up 2</span>
                      {lead.followup_2_sent_at ? (
                        <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {formatDate(lead.followup_2_sent_at)}
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs">---</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-500">Reuniao</span>
                      {lead.meeting_scheduled ? (
                        <span className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {lead.meeting_scheduled_at
                            ? formatDate(lead.meeting_scheduled_at)
                            : "Sim"}
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs">
                          Aguardando
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Received date */}
                <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
                  <SectionTitle>Detalhes</SectionTitle>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">Recebido em</span>
                      <span className="text-zinc-200">
                        {lead.submitted_at
                          ? formatDateTime(lead.submitted_at)
                          : "---"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500">E-mail</span>
                      <span className="text-zinc-200">{lead.email}</span>
                    </div>
                    {lead.address_country &&
                      lead.address_country !== "BR" && (
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Pais</span>
                          <span className="text-zinc-200">
                            {lead.address_country}
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════ TAB: DADOS ══════ */}
          {activeTab === "dados" && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
                  <SectionTitle>Atleta</SectionTitle>
                  <div className="divide-y divide-[#1e2130]">
                    <DataRow label="Nome" value={lead.athlete_name} />
                    <DataRow label="E-mail" value={lead.email} />
                    <DataRow
                      label="WhatsApp"
                      value={
                        lead.athlete_whatsapp
                          ? formatPhone(lead.athlete_whatsapp)
                          : null
                      }
                    />
                    <DataRow
                      label="Nascimento"
                      value={
                        lead.birth_date ? formatDate(lead.birth_date) : null
                      }
                    />
                    <DataRow
                      label="Esporte / Posicao"
                      value={lead.position}
                    />
                    <DataRow label="Historico" value={lead.club_history} />
                    <DataRow label="Conquistas" value={lead.achievements} />
                    {lead.instagram && (
                      <div className="flex items-center justify-between gap-4 py-2 text-sm">
                        <span className="text-zinc-500">Instagram</span>
                        <a
                          href={`https://instagram.com/${lead.instagram.replace("@", "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                        >
                          <Instagram className="h-3.5 w-3.5" />
                          {lead.instagram}
                        </a>
                      </div>
                    )}
                    {lead.video_highlights && (
                      <div className="flex items-center justify-between gap-4 py-2 text-sm">
                        <span className="text-zinc-500">Video</span>
                        <a
                          href={lead.video_highlights}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
                        >
                          <Video className="h-3.5 w-3.5" />
                          Ver highlights
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
                  <SectionTitle>Educacao</SectionTitle>
                  <div className="divide-y divide-[#1e2130]">
                    <DataRow label="Serie" value={lead.school_year} />
                    <DataRow label="Escola" value={lead.current_school} />
                    <DataRow
                      label="Cidade / Estado"
                      value={lead.school_city_state}
                    />
                    <DataRow label="Modelo" value={lead.education_model} />
                    <DataRow label="Ingles" value={lead.english_level} />
                    <DataRow
                      label="Desempenho"
                      value={lead.academic_performance}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
                  <SectionTitle>Responsavel Financeiro</SectionTitle>
                  <div className="divide-y divide-[#1e2130]">
                    <DataRow label="Nome" value={lead.guardian_name} />
                    <DataRow
                      label="Profissao"
                      value={lead.guardian_profession}
                    />
                    <DataRow label="E-mail" value={lead.guardian_email} />
                    <DataRow
                      label="WhatsApp"
                      value={
                        lead.guardian_whatsapp
                          ? formatPhone(lead.guardian_whatsapp)
                          : null
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
                  <SectionTitle>Projeto</SectionTitle>
                  <div className="divide-y divide-[#1e2130]">
                    <DataRow
                      label="Inicio pretendido"
                      value={lead.start_timing}
                    />
                    <DataRow
                      label="Direcao"
                      value={lead.project_direction}
                    />
                    <DataRow
                      label="Investimento"
                      value={
                        lead.investment_range
                          ? formatInvestmentRange(lead.investment_range)
                          : null
                      }
                    />
                    <DataRow
                      label="Perfil comportamental"
                      value={lead.behavioral_profile}
                    />
                    <DataRow
                      label="Comprometimento"
                      value={lead.youth_commitment}
                    />
                    <DataRow
                      label="Decisao familiar"
                      value={lead.family_decision_structure}
                    />
                  </div>
                </div>

                {(lead.address_city || lead.address_state) && (
                  <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
                    <SectionTitle>Endereco</SectionTitle>
                    <div className="divide-y divide-[#1e2130]">
                      <DataRow
                        label="Logradouro"
                        value={
                          lead.address_street
                            ? `${lead.address_street}, ${lead.address_number}${lead.address_complement ? ` - ${lead.address_complement}` : ""}`
                            : null
                        }
                      />
                      <DataRow
                        label="Bairro"
                        value={lead.address_neighborhood}
                      />
                      <DataRow
                        label="Cidade / UF"
                        value={
                          lead.address_city
                            ? `${lead.address_city} - ${lead.address_state}`
                            : lead.address_state
                        }
                      />
                      <DataRow label="CEP" value={lead.address_cep} />
                      <DataRow
                        label="Pais"
                        value={
                          lead.address_country &&
                          lead.address_country !== "BR"
                            ? lead.address_country
                            : null
                        }
                      />
                    </div>
                  </div>
                )}

                {lead.notes && (
                  <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
                    <SectionTitle>Notas Internas</SectionTitle>
                    <div className="rounded-lg border border-[#1e2130] bg-[#0c0e14] p-3 text-sm text-zinc-300 whitespace-pre-wrap">
                      {lead.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════ TAB: COMUNICACAO ══════ */}
          {activeTab === "comunicacao" && (
            <div className="max-w-2xl space-y-6">
              <div className="space-y-3">
                <SectionTitle>Pipeline de Comunicacao</SectionTitle>

                <CommunicationStep
                  icon={<Send className="h-4 w-4" />}
                  label="WhatsApp Inicial"
                  date={lead.whatsapp_sent_at}
                  done={!!lead.whatsapp_sent_at}
                />

                <CommunicationStep
                  icon={<MessageCircle className="h-4 w-4" />}
                  label="Follow-up 1 (48h)"
                  date={lead.followup_1_sent_at}
                  done={!!lead.followup_1_sent_at}
                  disabled={!lead.whatsapp_sent_at}
                />

                <CommunicationStep
                  icon={<MessageCircle className="h-4 w-4" />}
                  label="Follow-up 2 (7 dias)"
                  date={lead.followup_2_sent_at}
                  done={!!lead.followup_2_sent_at}
                  disabled={!lead.followup_1_sent_at}
                />

                <div
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-5 py-4",
                    lead.meeting_scheduled
                      ? "border-emerald-500/20 bg-emerald-500/10"
                      : "border-[#1e2130] bg-[#141720]",
                  )}
                >
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar
                      className={cn(
                        "h-4 w-4",
                        lead.meeting_scheduled
                          ? "text-emerald-400"
                          : "text-zinc-500",
                      )}
                    />
                    <span
                      className={
                        lead.meeting_scheduled
                          ? "text-emerald-400 font-medium"
                          : "text-zinc-400"
                      }
                    >
                      Reuniao Agendada
                    </span>
                  </div>
                  {lead.meeting_scheduled ? (
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-medium">
                      <Check className="h-4 w-4" />
                      {lead.meeting_scheduled_at
                        ? formatDate(lead.meeting_scheduled_at)
                        : "Sim"}
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-600">Aguardando</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <SectionTitle>Acoes Rapidas</SectionTitle>
                <div className="flex gap-3">
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600/20 border border-emerald-600/30 py-3 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Abrir WhatsApp do Responsavel
                    </a>
                  )}
                  <a
                    href={`mailto:${lead.email}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600/20 border border-indigo-600/30 py-3 text-sm font-medium text-indigo-400 transition-colors hover:bg-indigo-600/30"
                  >
                    <Mail className="h-4 w-4" />
                    Enviar E-mail
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* ══════ TAB: DOCUMENTOS ══════ */}
          {activeTab === "documentos" && (
            <div className="max-w-2xl">
              {lead.is_in_pipeline && lead.pipeline_atleta_id ? (
                <DealDocumentsTab atletaId={lead.pipeline_atleta_id} />
              ) : (
                <div className="flex flex-col items-center gap-4 py-12">
                  <FileText className="h-10 w-10 text-zinc-600" />
                  <p className="text-sm text-zinc-500">
                    Lead precisa estar no pipeline para gerenciar documentos.
                  </p>
                  {!lead.is_in_pipeline && (
                    <p className="text-xs text-zinc-600">
                      Promova o lead para o pipeline para acessar documentos.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════ TAB: CONTRATO ══════ */}
          {activeTab === "contrato" && (
            <div className="max-w-2xl">
              {lead.is_in_pipeline && lead.pipeline_deal_id ? (
                <DealContratoTab
                  dealId={lead.pipeline_deal_id}
                  atletaId={lead.pipeline_atleta_id ?? undefined}
                />
              ) : (
                <div className="flex flex-col items-center gap-4 py-12">
                  <FileText className="h-10 w-10 text-zinc-600" />
                  <p className="text-sm text-zinc-500">
                    Lead precisa estar no pipeline para criar contrato.
                  </p>
                  {!lead.is_in_pipeline && (
                    <p className="text-xs text-zinc-600">
                      Promova o lead para o pipeline para acessar contratos.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════ TAB: HISTORICO ══════ */}
          {activeTab === "historico" && (
            <div className="max-w-2xl space-y-0">
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
                  detail={
                    lead.qualification_classification
                      ? `Classificacao: ${lead.qualification_classification}`
                      : undefined
                  }
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
                label="Reuniao agendada"
                date={lead.meeting_scheduled_at}
                detail={
                  lead.meeting_scheduled
                    ? "Detectada via Google Calendar"
                    : undefined
                }
                active={!!lead.meeting_scheduled}
              />

              {lead.is_in_pipeline && (
                <TimelineEvent
                  icon={Target}
                  label={`Promovido para Pipeline — ${
                    lead.pipeline_stage
                      ? DEAL_STAGE_CONFIG[lead.pipeline_stage as DealStage]
                          ?.label
                      : "Lead"
                  }`}
                  active
                />
              )}

              {/* Audit trail for pipeline leads */}
              {lead.is_in_pipeline &&
                lead.pipeline_deal_id &&
                lead.pipeline_atleta_id && (
                  <AuditTrailSection
                    dealId={lead.pipeline_deal_id}
                    atletaId={lead.pipeline_atleta_id}
                  />
                )}
            </div>
          )}

          {/* ══════ TAB: NOTAS ══════ */}
          {activeTab === "notas" && (
            <div className="max-w-2xl">
              {lead.is_in_pipeline && lead.pipeline_deal_id ? (
                <NotesSection dealId={lead.pipeline_deal_id} />
              ) : (
                <div className="flex flex-col items-center gap-4 py-12">
                  <MessageCircle className="h-10 w-10 text-zinc-600" />
                  <p className="text-sm text-zinc-500">
                    Notas disponiveis apos entrada no pipeline.
                  </p>
                  {!lead.is_in_pipeline && (
                    <p className="text-xs text-zinc-600">
                      Promova o lead para o pipeline para adicionar notas.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
