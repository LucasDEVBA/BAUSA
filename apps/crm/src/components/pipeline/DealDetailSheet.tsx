"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Save,
  Calendar,
  XCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Send,
  Info,
  ExternalLink,
  Clock,
  CheckCircle2,
  Zap,
  MessageCircle,
  User,
  FileText,
  Trophy,
  GraduationCap,
  Globe,
  Video,
  Instagram,
  MapPin,
  Phone,
  Sparkles,
  Target,
  Link2,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Shield,
} from "lucide-react";
import { type Deal, DEAL_STAGE_CONFIG, PIPELINE_STAGE_ORDER, type DealStage } from "@/types/deal";
import { atualizarDeal, moverDeal, customizarValorDeal, type StructuredLossData } from "@/lib/actions/deals";
import { criarNota, listarNotas } from "@/lib/actions/notas";
import { getAuditLogsForDeal } from "@/lib/actions/audit";
import type { NotaInterna, AuditLog } from "@/types/crm";
import { formatInvestmentRange, getInitials, formatDateTime, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DocumentosChecklist,
  DocumentosUrgentesBadge,
  useDocumentosAtleta,
} from "@/components/documentos/DocumentosChecklist";
import { DealContratoTab } from "./DealContratoTab";

interface DealDetailSheetProps {
  deal: Deal | null;
  onClose: () => void;
}

type TabId = "resumo" | "reuniao" | "dados" | "historico" | "notas" | "documentos" | "contrato";

const TABS: { id: TabId; label: string }[] = [
  { id: "resumo", label: "Resumo" },
  { id: "reuniao", label: "Reuniao" },
  { id: "dados", label: "Dados" },
  { id: "historico", label: "Historico" },
  { id: "notas", label: "Notas" },
  { id: "documentos", label: "Docs" },
  { id: "contrato", label: "Contrato" },
];

const CLASSIFICATION_COLORS = {
  QUENTE: "bg-sys-green/15 text-sys-green border-sys-green/20",
  MORNO: "bg-sys-orange/15 text-sys-orange border-sys-orange/20",
  FRIO: "bg-sys-blue/15 text-sys-blue border-sys-blue/20",
} as const;

const NIVEL_COMPETITIVO_OPTIONS = [
  { value: "iniciante", label: "Iniciante" },
  { value: "intermediario", label: "Intermediario" },
  { value: "avancado", label: "Avancado" },
  { value: "elite", label: "Elite" },
  { value: "profissional", label: "Profissional" },
];

const SERIE_ESCOLAR_OPTIONS = [
  { value: "6_ano", label: "6o Ano" },
  { value: "7_ano", label: "7o Ano" },
  { value: "8_ano", label: "8o Ano" },
  { value: "9_ano", label: "9o Ano" },
  { value: "1_em", label: "1o EM" },
  { value: "2_em", label: "2o EM" },
  { value: "3_em", label: "3o EM" },
];

const NIVEL_INGLES_OPTIONS = [
  { value: "nenhum", label: "Nenhum" },
  { value: "basico", label: "Basico" },
  { value: "intermediario", label: "Intermediario" },
  { value: "avancado", label: "Avancado" },
  { value: "fluente", label: "Fluente" },
];

const DESEMPENHO_ACADEMICO_OPTIONS = [
  { value: "abaixo_media", label: "Abaixo da media" },
  { value: "media", label: "Na media" },
  { value: "acima_media", label: "Acima da media" },
  { value: "excelente", label: "Excelente" },
];

const LOSS_REASON_OPTIONS = [
  { value: "financeiro", label: "Financeiro" },
  { value: "timing", label: "Timing" },
  { value: "desistencia_familia", label: "Desistencia da familia" },
  { value: "atleta_nao_qualificado", label: "Atleta nao qualificado" },
  { value: "concorrencia", label: "Concorrencia" },
  { value: "outro", label: "Outro" },
];

const SERVICOS_AVULSOS = [
  { nome: "Preparacao TOEFL", valor: 2500, valorFormatado: "R$ 2.500" },
  { nome: "Aula particular ingles (3 meses)", valor: 3600, valorFormatado: "R$ 3.600" },
  { nome: "Acompanhamento psicologico extra", valor: 1200, valorFormatado: "R$ 1.200" },
  { nome: "Traducao juramentada", valor: 800, valorFormatado: "R$ 800" },
];

const LEAD_SCORE_INFO =
  "O Lead Score e calculado automaticamente com base nos dados preenchidos do atleta. Quanto mais completos os dados, mais preciso o score. Criterios: Investimento (25%), Timing (20%), Ingles (15%), Academico (15%), Competitivo (10%), Comprometimento (10%), Video (5%)";

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-sys-green"
      : score >= 60
        ? "bg-sys-orange"
        : score >= 40
          ? "bg-sys-yellow"
          : "bg-sys-red";

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
      <span className="text-sm font-bold text-foreground tabular-nums w-8 text-right">
        {score}
      </span>
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
  date?: string;
  detail?: string;
  active?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full",
            active ? "bg-primary/20" : "bg-secondary",
          )}
        >
          <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-label-tertiary")} />
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>
      <div className="pb-6">
        <p className={cn("text-sm font-medium", active ? "text-foreground" : "text-muted-foreground")}>
          {label}
        </p>
        {date && (
          <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(date)}</p>
        )}
        {detail && (
          <p className="text-xs text-foreground mt-1 bg-card rounded-md px-2 py-1 inline-block">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

const TEAM_MEMBERS = [
  { nome: "Leandro (CEO)" },
  { nome: "Fernanda (Head)" },
];

function renderNoteWithMentions(text: string): React.ReactNode {
  const parts = text.split(/(@\w[\w\s()]*?\b)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span key={i} className="font-semibold text-primary">
          {part}
        </span>
      );
    }
    return part;
  });
}

function DealNotesSection({ dealId }: { dealId: string }) {
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
        <MessageCircle className="h-8 w-8 text-label-tertiary" />
        <p className="text-sm text-muted-foreground">Notas internas do deal</p>
        <button
          onClick={loadNotes}
          disabled={isPendingNotes}
          className="flex items-center gap-2 rounded-md bg-primary/15 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/25 transition-colors"
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
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary/40 resize-none"
        />
        {showMentionDropdown && (
          <div className="absolute left-0 bottom-full mb-1 z-10 w-56 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
            {TEAM_MEMBERS
              .filter((m) => m.nome.toLowerCase().includes(mentionFilter))
              .map((member) => (
                <button
                  key={member.nome}
                  onClick={() => {
                    const cursorText = newNote;
                    const atIdx = cursorText.lastIndexOf("@");
                    if (atIdx >= 0) {
                      const before = cursorText.slice(0, atIdx);
                      const after = cursorText.slice(atIdx).replace(/@\w*/, "");
                      setNewNote(`${before}@${member.nome}${after} `);
                    }
                    setShowMentionDropdown(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-primary/15 hover:text-primary transition-colors"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  {member.nome}
                </button>
              ))}
            {TEAM_MEMBERS.filter((m) => m.nome.toLowerCase().includes(mentionFilter)).length === 0 && (
              <p className="px-3 py-2 text-xs text-label-tertiary">Nenhum usuario encontrado</p>
            )}
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={isPendingNotes || !newNote.trim()}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
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
        <p className="text-sm text-label-tertiary text-center py-4">Nenhuma nota ainda.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-primary">
                  {(n.autor as unknown as { nome: string })?.nome ?? "Usuario"}
                </p>
                <p className="text-[10px] text-label-tertiary">
                  {new Date(n.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap">{renderNoteWithMentions(n.conteudo)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

function getAuditColor(log: AuditLog): string {
  const campos = log.campos_alterados ?? [];
  if (campos.some((c) => c === "etapa" || c === "etapa_anterior")) return "text-primary";
  if (campos.some((c) => c.includes("valor") || c.includes("financ") || c.includes("pago") || c.includes("sinal"))) return "text-sys-green";
  return "text-sys-blue";
}

function getAuditBg(log: AuditLog): string {
  const campos = log.campos_alterados ?? [];
  if (campos.some((c) => c === "etapa" || c === "etapa_anterior")) return "bg-primary/20";
  if (campos.some((c) => c.includes("valor") || c.includes("financ") || c.includes("pago") || c.includes("sinal"))) return "bg-sys-green/20";
  return "bg-sys-blue/20";
}

function AuditTrailSection({ dealId, atletaId }: { dealId: string; atletaId?: string }) {
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
      <div className="mt-6 border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-label-tertiary mb-3">
          Alteracoes registradas (Audit Trail)
        </p>
        <button
          onClick={loadAuditLogs}
          disabled={isPendingAudit}
          className="flex items-center gap-2 rounded-md bg-sys-blue/15 px-4 py-2 text-xs font-medium text-sys-blue hover:bg-sys-blue/25 transition-colors"
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
      <div className="mt-6 border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-label-tertiary mb-3">
          Alteracoes registradas
        </p>
        <p className="text-xs text-label-tertiary text-center py-4">Nenhuma alteracao registrada.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-label-tertiary mb-3">
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
              className="rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={cn("flex h-5 w-5 items-center justify-center rounded-full", bg)}>
                    <Shield className={cn("h-3 w-3", color)} />
                  </div>
                  <span className={cn("text-[10px] font-bold uppercase", color)}>
                    {log.operacao}
                  </span>
                  <span className="text-[10px] text-label-tertiary">{log.tabela}</span>
                </div>
                <span className="text-[10px] text-label-tertiary">
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
                    const label = AUDIT_FIELD_LABELS[campo] ?? campo;
                    return (
                      <p key={campo} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{label}</span>
                        {anterior != null && (
                          <span className="text-label-tertiary"> de <span className="text-sys-red">{String(anterior)}</span></span>
                        )}
                        <span className="text-label-tertiary"> para </span>
                        <span className={color}>{String(novo ?? "—")}</span>
                      </p>
                    );
                  })}
                </div>
              )}
              {log.operacao === "INSERT" && (
                <p className="text-xs text-muted-foreground">Registro criado</p>
              )}
              {log.operacao === "DELETE" && (
                <p className="text-xs text-muted-foreground">Registro removido (soft delete)</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DealDetailSheet({ deal, onClose }: DealDetailSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<TabId>("resumo");
  const documentos = useDocumentosAtleta(deal?.atleta_id);

  // Resumo tab state
  const [nextAction, setNextAction] = useState(deal?.next_action ?? "");
  const [nextDate, setNextDate] = useState(deal?.next_action_date ?? "");
  const [notes, setNotes] = useState(deal?.notes ?? "");

  // Reuniao tab state
  const [manualLink, setManualLink] = useState("");
  const [manualDate, setManualDate] = useState("");

  // Dados tab state
  const [atletaEsporte, setAtletaEsporte] = useState(deal?.esporte ?? "");
  const [atletaPosicao, setAtletaPosicao] = useState(deal?.athlete_position ?? "");
  const [atletaNivelComp, setAtletaNivelComp] = useState(deal?.nivel_competitivo ?? "");
  const [atletaSerie, setAtletaSerie] = useState(deal?.serie_escolar ?? "");
  const [atletaIngles, setAtletaIngles] = useState(deal?.nivel_ingles ?? "");
  const [atletaDesempenho, setAtletaDesempenho] = useState(deal?.desempenho_academico ?? "");
  const [atletaEscola, setAtletaEscola] = useState(deal?.escola_atual ?? "");
  const [atletaCidadeEstado, setAtletaCidadeEstado] = useState(deal?.cidade_estado ?? "");
  const [atletaWhatsapp, setAtletaWhatsapp] = useState(deal?.whatsapp ?? "");
  const [atletaInstagram, setAtletaInstagram] = useState(deal?.instagram ?? "");

  // Lost form state (structured)
  const [showLostForm, setShowLostForm] = useState(false);
  const [lostReasonCategory, setLostReasonCategory] = useState("");
  const [lostDetail, setLostDetail] = useState("");
  const [canReactivate, setCanReactivate] = useState(false);
  const [reactivationDate, setReactivationDate] = useState("");

  // Retroceder form state
  const [showRetrocederForm, setShowRetrocederForm] = useState(false);
  const [retrocederStage, setRetrocederStage] = useState("");
  const [retrocederMotivo, setRetrocederMotivo] = useState("");

  // Lead score info
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  // Customizar valor
  const [showCustomizarValor, setShowCustomizarValor] = useState(false);
  const [customValor, setCustomValor] = useState(deal?.deal_value_brl ?? 0);
  const [customJustificativa, setCustomJustificativa] = useState("");

  if (!deal) return null;

  const stageConfig = DEAL_STAGE_CONFIG[deal.stage];
  const currentIdx = PIPELINE_STAGE_ORDER.indexOf(deal.stage);
  const nextStage =
    currentIdx < PIPELINE_STAGE_ORDER.length - 1
      ? PIPELINE_STAGE_ORDER[currentIdx + 1]
      : null;
  const nextStageLabel = nextStage ? DEAL_STAGE_CONFIG[nextStage]?.label : null;
  const classColors =
    CLASSIFICATION_COLORS[deal.classification] ?? CLASSIFICATION_COLORS.FRIO;

  // Etapas anteriores para retrocesso
  const previousStages = PIPELINE_STAGE_ORDER.slice(0, currentIdx).filter(
    (s) => s !== "perdido",
  );

  const hasReuniao = Boolean(deal.reuniao_data || deal.reuniao_agendada_at);

  // Verificar se pode avancar (next_action e next_date obrigatorios)
  const canAdvance = Boolean(nextAction.trim()) && Boolean(nextDate.trim());

  const handleSave = () => {
    startTransition(async () => {
      const result = await atualizarDeal(deal.id, {
        next_action: nextAction || undefined,
        data_proxima_acao: nextDate || undefined,
        notas_reuniao: notes || undefined,
      });
      if (result.success) {
        toast.success("Deal atualizado!");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao salvar");
      }
    });
  };

  const handleSaveReuniao = () => {
    startTransition(async () => {
      const updates: Record<string, string | undefined> = {};
      if (manualLink) {
        updates.notas_reuniao = [notes, `Reuniao: ${manualLink} em ${manualDate}`]
          .filter(Boolean)
          .join("\n");
      }
      const result = await atualizarDeal(deal.id, {
        notas_reuniao: updates.notas_reuniao ?? notes ?? undefined,
      });
      if (result.success) {
        toast.success("Dados de reuniao salvos!");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao salvar reuniao");
      }
    });
  };

  const handleSaveDados = () => {
    startTransition(async () => {
      const result = await atualizarDeal(deal.id, {
        notas_reuniao: notes || undefined,
      });
      if (result.success) {
        toast.success("Dados do atleta salvos!");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao salvar dados");
      }
    });
  };

  const handleAdvance = () => {
    if (!nextStage) return;
    if (!canAdvance) {
      toast.error("Preencha a Proxima Acao e Data para avancar");
      return;
    }
    startTransition(async () => {
      const result = await moverDeal(deal.id, nextStage as never);
      if (result.success) {
        toast.success(`Avancado para ${nextStageLabel}`);
        router.refresh();
        onClose();
      } else {
        toast.error(result.error ?? "Erro ao avancar");
      }
    });
  };

  const handleRetroceder = () => {
    if (!retrocederStage) {
      toast.error("Selecione a etapa de destino");
      return;
    }
    if (!retrocederMotivo.trim()) {
      toast.error("Informe a justificativa do retrocesso");
      return;
    }
    startTransition(async () => {
      const result = await moverDeal(
        deal.id,
        retrocederStage as never,
        retrocederMotivo,
      );
      if (result.success) {
        toast.success(`Retrocedido para ${DEAL_STAGE_CONFIG[retrocederStage as DealStage]?.label}`);
        router.refresh();
        onClose();
      } else {
        toast.error(result.error ?? "Erro ao retroceder");
      }
    });
  };

  const handleLost = () => {
    if (!lostReasonCategory) {
      toast.error("Selecione a categoria do motivo da perda");
      return;
    }
    if (!lostDetail.trim()) {
      toast.error("Informe os detalhes do motivo da perda");
      return;
    }
    if (canReactivate && !reactivationDate) {
      toast.error("Informe a data de reativacao");
      return;
    }
    startTransition(async () => {
      const lossData: StructuredLossData = {
        motivo_perda: lostReasonCategory,
        detalhe_perda: lostDetail,
        pode_reativar: canReactivate,
        data_reativacao: canReactivate ? reactivationDate : undefined,
      };
      const result = await moverDeal(deal.id, "perdido" as never, undefined, lossData);
      if (result.success) {
        toast.success("Deal marcado como perdido");
        router.refresh();
        onClose();
      } else {
        toast.error(result.error ?? "Erro");
      }
    });
  };

  const inputClass =
    "w-full rounded-md border border-border bg-card py-2.5 px-3 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary focus:ring-1 focus:ring-primary/30";
  const selectClass =
    "w-full rounded-md border border-border bg-card py-2.5 px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 appearance-none";
  const labelClass = "text-xs font-medium text-muted-foreground";
  const cardClass = "rounded-lg border border-border/70 bg-card/60 p-3";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border liquid-glass shadow-2xl">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-brand text-base font-bold text-white">
              {getInitials(deal.athlete_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="truncate text-base font-semibold text-foreground">
                  {deal.athlete_name}
                </h2>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold",
                    classColors,
                  )}
                >
                  {deal.classification}
                </span>
                {deal.qualificado_gemini && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-plan-legacy/20 bg-plan-legacy/15 px-2 py-0.5 text-[10px] font-bold text-plan-legacy">
                    <Sparkles className="h-3 w-3" />
                    Qualificado
                  </span>
                )}
                {deal.flag_retrocedido && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sys-orange/20 bg-sys-orange/15 px-2 py-0.5 text-[10px] font-bold text-sys-orange">
                    <ArrowLeft className="h-3 w-3" />
                    Retrocedido
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {deal.guardian_name || deal.esporte || "Sem responsavel"}
              </p>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className={cn("h-2 w-2 rounded-full", stageConfig.dotColor)} />
                <span className="text-xs text-muted-foreground">{stageConfig.label}</span>
                <span className="text-xs text-label-tertiary">&middot;</span>
                <span className="text-xs font-semibold text-sys-green">
                  R$ {deal.deal_value_brl.toLocaleString("pt-BR")}
                </span>
                {deal.flag_valores_customizados && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-sys-orange/20 bg-sys-orange/15 px-1.5 py-0.5 text-[9px] font-semibold text-sys-orange">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Customizado
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-fill-4 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-md px-3 py-2 text-xs font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-fill-4",
                )}
              >
                {tab.label}
                {tab.id === "documentos" && (
                  <DocumentosUrgentesBadge count={documentos.urgentes} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* TAB: RESUMO */}
          {activeTab === "resumo" && (
            <>
              {/* Gemini Qualification Card */}
              <div className={cardClass}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-plan-legacy" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Qualificacao Gemini
                  </h3>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold",
                      deal.qualificado_gemini
                        ? "border-sys-green/20 bg-sys-green/15 text-sys-green"
                        : "border-border bg-secondary text-muted-foreground",
                    )}
                  >
                    {deal.qualificado_gemini ? "Qualificado" : "Nao Qualificado"}
                  </span>
                  {deal.classificacao_gemini && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold",
                        CLASSIFICATION_COLORS[
                          deal.classificacao_gemini as keyof typeof CLASSIFICATION_COLORS
                        ] ?? "bg-secondary text-muted-foreground border-border",
                      )}
                    >
                      {deal.classificacao_gemini}
                    </span>
                  )}
                </div>
                {deal.motivo_gemini && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {deal.motivo_gemini}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-4 text-[10px] text-label-tertiary">
                  {deal.confianca_gemini && (
                    <span>Confianca: {deal.confianca_gemini}</span>
                  )}
                  {deal.qualificado_gemini_at && (
                    <span>em {formatDate(deal.qualificado_gemini_at)}</span>
                  )}
                </div>
              </div>

              {/* Lead Score Card */}
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Lead Score</h3>
                  </div>
                  <button
                    onClick={() => setShowScoreInfo(!showScoreInfo)}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
                    aria-label="Informacoes sobre o Lead Score"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ScoreBar score={deal.lead_score ?? 0} />
                {showScoreInfo && (
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground bg-popover rounded-lg p-3 border border-border">
                    {LEAD_SCORE_INFO}
                  </p>
                )}
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Investimento</p>
                  <p className="text-foreground">
                    {formatInvestmentRange(deal.investment_range)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Estado</p>
                  <p className="text-foreground">{deal.address_state || "---"}</p>
                </div>
                {deal.guardian_profession && (
                  <div>
                    <p className="text-xs text-muted-foreground">Profissao</p>
                    <p className="text-foreground">{deal.guardian_profession}</p>
                  </div>
                )}
                {deal.esporte && (
                  <div>
                    <p className="text-xs text-muted-foreground">Esporte</p>
                    <p className="text-foreground">{deal.esporte}</p>
                  </div>
                )}
                {deal.athlete_position && (
                  <div>
                    <p className="text-xs text-muted-foreground">Posicao</p>
                    <p className="text-foreground">{deal.athlete_position}</p>
                  </div>
                )}
              </div>

              {/* Customizar valor do deal */}
              <div className={cardClass}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Valor estimado</span>
                    <span className="text-sm font-bold text-sys-green">
                      R$ {deal.deal_value_brl.toLocaleString("pt-BR")}
                    </span>
                    {deal.flag_valores_customizados && (
                      <span className="text-[9px] font-semibold text-sys-orange">(customizado)</span>
                    )}
                  </div>
                  {!showCustomizarValor && (
                    <button
                      onClick={() => setShowCustomizarValor(true)}
                      className="text-[10px] font-medium text-primary hover:text-primary transition-colors"
                    >
                      Customizar valor
                    </button>
                  )}
                </div>

                {showCustomizarValor && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-border">
                    <div className="space-y-1.5">
                      <label className={labelClass}>Novo valor (R$)</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={customValor}
                        onChange={(e) => setCustomValor(Number(e.target.value))}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelClass}>Justificativa *</label>
                      <textarea
                        value={customJustificativa}
                        onChange={(e) => setCustomJustificativa(e.target.value)}
                        rows={2}
                        placeholder="Motivo da customizacao do valor..."
                        className={cn(inputClass, "resize-none")}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setShowCustomizarValor(false);
                          setCustomValor(deal.deal_value_brl);
                          setCustomJustificativa("");
                        }}
                        className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-fill-4"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => {
                          if (!customJustificativa.trim()) {
                            toast.error("Informe a justificativa");
                            return;
                          }
                          startTransition(async () => {
                            const result = await customizarValorDeal(deal.id, customValor, customJustificativa);
                            if (result.success) {
                              toast.success("Valor customizado com sucesso");
                              setShowCustomizarValor(false);
                              router.refresh();
                            } else {
                              toast.error(result.error ?? "Erro ao customizar valor");
                            }
                          });
                        }}
                        disabled={isPending}
                        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                      >
                        {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                        Salvar
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Servicos Adicionais - catalogo de referencia */}
              <div className={cardClass}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-sys-orange" />
                  <p className="text-xs font-semibold text-foreground">
                    Servicos Adicionais
                  </p>
                </div>
                <div className="space-y-2">
                  {SERVICOS_AVULSOS.map((servico) => (
                    <div
                      key={servico.nome}
                      className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <p className="text-xs text-foreground">{servico.nome}</p>
                      <p className="text-xs font-semibold text-sys-green">
                        {servico.valorFormatado}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-label-tertiary">
                  Tabela de referencia. Para adicionar ao contrato, use &quot;Customizar valor&quot; acima.
                </p>
              </div>

              {/* Editable fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className={labelClass}>Proxima Acao</label>
                  <input
                    value={nextAction}
                    onChange={(e) => setNextAction(e.target.value)}
                    placeholder="Ex: Ligar para agendar reuniao..."
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Data Proxima Acao</label>
                  <input
                    type="date"
                    value={nextDate}
                    onChange={(e) => setNextDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Notas</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Observacoes sobre o deal..."
                    className={cn(inputClass, "resize-none")}
                  />
                  {currentIdx >= PIPELINE_STAGE_ORDER.indexOf("reuniao_realizada") && !notes.trim() && (
                    <div className={cn(
                      "flex items-start gap-2 rounded-lg px-3 py-2",
                      deal.stage === "reuniao_realizada"
                        ? "border-2 border-sys-orange/40 bg-sys-orange/15"
                        : "border border-sys-orange/20 bg-sys-orange/5"
                    )}>
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-sys-orange mt-0.5" />
                      <p className="text-xs text-sys-orange leading-relaxed">
                        {deal.stage === "reuniao_realizada"
                          ? "Obrigatorio: preencha as notas da reuniao antes de avancar para Diagnostico/Fit."
                          : "Preencha as notas da reuniao para manter o historico completo."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar
              </button>
            </>
          )}

          {/* TAB: REUNIAO */}
          {activeTab === "reuniao" && (
            <>
              {/* Status */}
              <div className={cardClass}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-sys-blue" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Status da Reuniao
                  </h3>
                </div>

                {hasReuniao ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-sys-green" />
                      <span className="text-sm font-medium text-sys-green">
                        Agendada
                      </span>
                    </div>
                    {deal.reuniao_data && (
                      <div>
                        <p className="text-xs text-muted-foreground">Data / Hora</p>
                        <p className="text-sm text-foreground">
                          {formatDateTime(deal.reuniao_data)}
                        </p>
                      </div>
                    )}
                    {deal.reuniao_link && (
                      <div>
                        <p className="text-xs text-muted-foreground">Link</p>
                        <a
                          href={deal.reuniao_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Abrir reuniao
                        </a>
                      </div>
                    )}
                    {deal.reuniao_agendada_at && (
                      <div>
                        <p className="text-xs text-muted-foreground">Detectada em</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(deal.reuniao_agendada_at)}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Nao agendada</span>
                  </div>
                )}
              </div>

              {/* Google Calendar */}
              {hasReuniao && (
                <a
                  href={
                    deal.reuniao_link?.includes("calendar.google.com")
                      ? deal.reuniao_link
                      : `https://calendar.google.com`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  <Calendar className="h-4 w-4" />
                  Abrir no Google Calendar
                </a>
              )}

              {/* Register meeting manually */}
              <div className={cardClass}>
                <div className="flex items-center gap-2 mb-3">
                  <Link2 className="h-4 w-4 text-sys-orange" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Registrar Reuniao Manualmente
                  </h3>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Link da reuniao</label>
                    <input
                      value={manualLink}
                      onChange={(e) => setManualLink(e.target.value)}
                      placeholder="https://meet.google.com/..."
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Data e hora</label>
                    <input
                      type="datetime-local"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <button
                    onClick={handleSaveReuniao}
                    disabled={isPending || (!manualLink && !manualDate)}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar Reuniao
                  </button>
                </div>
              </div>

              {/* WhatsApp actions */}
              <div className={cardClass}>
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="h-4 w-4 text-sys-green" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Acoes WhatsApp
                  </h3>
                </div>
                <div className="space-y-2">
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-sys-green/20 bg-sys-green/15 py-2.5 text-sm font-medium text-sys-green hover:bg-sys-green/25 transition-colors"
                    onClick={() => {
                      if (deal.whatsapp) {
                        const phone = deal.whatsapp.replace(/\D/g, "");
                        window.open(
                          `https://wa.me/${phone}?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20uma%20reuni%C3%A3o%20sobre%20a%20bolsa%20esportiva.`,
                          "_blank",
                        );
                      } else {
                        toast.error("WhatsApp nao disponivel");
                      }
                    }}
                  >
                    <Send className="h-4 w-4" />
                    Enviar Convite de Reuniao
                  </button>
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                    onClick={() => {
                      if (deal.whatsapp) {
                        const phone = deal.whatsapp.replace(/\D/g, "");
                        window.open(`https://wa.me/${phone}`, "_blank");
                      } else {
                        toast.error("WhatsApp nao disponivel");
                      }
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Enviar Mensagem Manual
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB: DADOS */}
          {activeTab === "dados" && (
            <>
              <p className="text-[11px] text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg px-3 py-2">
                Preencher estes dados melhora o Lead Score automaticamente.
              </p>

              <div className="space-y-4">
                {/* Esporte */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    <Trophy className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    Esporte
                  </label>
                  <input
                    value={atletaEsporte}
                    onChange={(e) => setAtletaEsporte(e.target.value)}
                    placeholder="Ex: Futebol, Basquete..."
                    className={inputClass}
                  />
                </div>

                {/* Posicao */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Posicao</label>
                  <input
                    value={atletaPosicao}
                    onChange={(e) => setAtletaPosicao(e.target.value)}
                    placeholder="Ex: Atacante, Point Guard..."
                    className={inputClass}
                  />
                </div>

                {/* Nivel Competitivo */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Nivel Competitivo</label>
                  <select
                    value={atletaNivelComp}
                    onChange={(e) => setAtletaNivelComp(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Selecione...</option>
                    {NIVEL_COMPETITIVO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Serie Escolar */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    <GraduationCap className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    Serie Escolar
                  </label>
                  <select
                    value={atletaSerie}
                    onChange={(e) => setAtletaSerie(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Selecione...</option>
                    {SERIE_ESCOLAR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ingles */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    <Globe className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    Nivel de Ingles
                  </label>
                  <select
                    value={atletaIngles}
                    onChange={(e) => setAtletaIngles(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Selecione...</option>
                    {NIVEL_INGLES_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Desempenho Academico */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Desempenho Academico</label>
                  <select
                    value={atletaDesempenho}
                    onChange={(e) => setAtletaDesempenho(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Selecione...</option>
                    {DESEMPENHO_ACADEMICO_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Escola */}
                <div className="space-y-1.5">
                  <label className={labelClass}>Escola Atual</label>
                  <input
                    value={atletaEscola}
                    onChange={(e) => setAtletaEscola(e.target.value)}
                    placeholder="Nome da escola..."
                    className={inputClass}
                  />
                </div>

                {/* Cidade / Estado */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    <MapPin className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    Cidade / Estado
                  </label>
                  <input
                    value={atletaCidadeEstado}
                    onChange={(e) => setAtletaCidadeEstado(e.target.value)}
                    placeholder="Ex: Sao Paulo - SP"
                    className={inputClass}
                  />
                </div>

                {/* WhatsApp */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    <Phone className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    WhatsApp
                  </label>
                  <input
                    value={atletaWhatsapp}
                    onChange={(e) => setAtletaWhatsapp(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className={inputClass}
                  />
                </div>

                {/* Instagram */}
                <div className="space-y-1.5">
                  <label className={labelClass}>
                    <Instagram className="inline h-3.5 w-3.5 mr-1 text-muted-foreground" />
                    Instagram
                  </label>
                  <input
                    value={atletaInstagram}
                    onChange={(e) => setAtletaInstagram(e.target.value)}
                    placeholder="@usuario"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* LGPD */}
              <div className={cn(cardClass, "mt-4")}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">LGPD</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Consentimento LGPD</span>
                    <span className={deal.consentimento_lgpd ? "text-sys-green" : "text-muted-foreground"}>
                      {deal.consentimento_lgpd ? "Sim" : "Nao"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Aceite WhatsApp</span>
                    <span className={deal.aceite_whatsapp ? "text-sys-green" : "text-muted-foreground"}>
                      {deal.aceite_whatsapp ? "Sim" : "Nao"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Aceite Email</span>
                    <span className={deal.aceite_email ? "text-sys-green" : "text-muted-foreground"}>
                      {deal.aceite_email ? "Sim" : "Nao"}
                    </span>
                  </div>
                  {deal.consentimento_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Data do consentimento</span>
                      <span className="text-foreground">{formatDate(deal.consentimento_at)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Família (siblings) */}
              {deal.siblings && deal.siblings.length > 0 && (
                <div className={cn(cardClass, "mt-4")}>
                  <div className="flex items-center gap-2 mb-3">
                    <User className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Outros atletas desta familia
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {deal.siblings.map((sibling) => (
                      <div
                        key={sibling.id}
                        className="flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2"
                      >
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                          {sibling.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{sibling.nome}</p>
                          {sibling.esporte && (
                            <p className="text-xs text-muted-foreground">{sibling.esporte}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleSaveDados}
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar Dados
              </button>
            </>
          )}

          {/* TAB: HISTORICO */}
          {activeTab === "historico" && (
            <>
            <div className="space-y-0">
              <TimelineEvent
                icon={User}
                label="Lead recebido"
                date={deal.submitted_at ?? deal.created_at}
                active
              />

              <TimelineEvent
                icon={Sparkles}
                label="Qualificado pela IA"
                date={deal.qualificado_gemini_at}
                detail={
                  deal.classificacao_gemini
                    ? `Classificacao: ${deal.classificacao_gemini}`
                    : undefined
                }
                active={Boolean(deal.qualificado_gemini_at)}
              />

              <TimelineEvent
                icon={MessageCircle}
                label="WhatsApp enviado"
                date={deal.whatsapp_sent_at}
                active={Boolean(deal.whatsapp_sent_at)}
              />

              <TimelineEvent
                icon={Send}
                label="Follow-up 1 enviado"
                date={deal.followup_1_sent_at}
                active={Boolean(deal.followup_1_sent_at)}
              />

              <TimelineEvent
                icon={Send}
                label="Follow-up 2 enviado"
                date={deal.followup_2_sent_at}
                active={Boolean(deal.followup_2_sent_at)}
              />

              <TimelineEvent
                icon={Calendar}
                label="Reuniao agendada"
                date={deal.reuniao_agendada_at}
                detail={
                  deal.reuniao_data
                    ? `Marcada para ${formatDateTime(deal.reuniao_data)}`
                    : undefined
                }
                active={Boolean(deal.reuniao_agendada_at)}
              />

              <TimelineEvent
                icon={ChevronRight}
                label={`Etapa atual: ${stageConfig.label}`}
                date={deal.stage_updated_at}
                active
              />

              {deal.flag_retrocedido && deal.motivo_retrocesso && (
                <TimelineEvent
                  icon={ArrowLeft}
                  label="Retrocedido"
                  detail={deal.motivo_retrocesso}
                  active
                />
              )}

              {deal.contract_signed_at && (
                <TimelineEvent
                  icon={FileText}
                  label="Contrato assinado"
                  date={deal.contract_signed_at}
                  active
                />
              )}

              {deal.signal_paid_at && (
                <TimelineEvent
                  icon={CheckCircle2}
                  label="Sinal pago"
                  date={deal.signal_paid_at}
                  active
                />
              )}

              {deal.lost_reason && (
                <TimelineEvent
                  icon={XCircle}
                  label="Perdido"
                  date={deal.closed_at}
                  detail={deal.lost_reason}
                  active
                />
              )}
            </div>

              {/* Audit Trail */}
              <AuditTrailSection dealId={deal.id} atletaId={deal.lead_id} />
            </>
          )}

          {/* TAB: NOTAS */}
          {activeTab === "notas" && (
            <DealNotesSection dealId={deal.id} />
          )}

          {/* TAB: DOCUMENTOS */}
          {activeTab === "documentos" && deal.atleta_id && (
            <DocumentosChecklist
              atletaId={deal.atleta_id}
              docs={documentos.docs}
              loading={documentos.loading}
              onRefetch={documentos.refetch}
            />
          )}
          {activeTab === "documentos" && !deal.atleta_id && (
            <div className="flex flex-col items-center gap-3 py-8">
              <FileText className="h-8 w-8 text-label-tertiary" />
              <p className="text-sm text-muted-foreground">
                Atleta nao vinculado a este deal.
              </p>
            </div>
          )}

          {/* TAB: CONTRATO */}
          {activeTab === "contrato" && (
            <DealContratoTab dealId={deal.id} atletaId={deal.atleta_id} />
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-6 py-4 space-y-2">
          {/* Avancar button with blocking */}
          {nextStage && nextStage !== "perdido" && (
            <div className="relative group">
              <button
                onClick={handleAdvance}
                disabled={isPending || !canAdvance}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card py-2.5 text-sm font-medium transition-colors",
                  canAdvance
                    ? "text-foreground hover:bg-secondary"
                    : "text-muted-foreground cursor-not-allowed opacity-60",
                  isPending && "opacity-50",
                )}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                Avancar para {nextStageLabel}
              </button>
              {!canAdvance && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="rounded-lg bg-popover border border-border px-3 py-2 text-xs text-sys-orange shadow-lg whitespace-nowrap">
                    <AlertTriangle className="inline h-3 w-3 mr-1" />
                    Preencha a Proxima Acao e Data para avancar
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Retroceder button */}
          {previousStages.length > 0 && !showRetrocederForm && !showLostForm && (
            <button
              onClick={() => setShowRetrocederForm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-sys-orange hover:bg-sys-orange/15 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retroceder
            </button>
          )}

          {/* Retroceder form */}
          {showRetrocederForm && (
            <div className="space-y-2 p-3 rounded-lg bg-sys-orange/15 border border-sys-orange/20">
              <label className="text-xs font-medium text-sys-orange">
                Retroceder para etapa
              </label>
              <select
                value={retrocederStage}
                onChange={(e) => setRetrocederStage(e.target.value)}
                className="w-full rounded-lg border border-sys-orange/30 bg-card py-2 px-3 text-sm text-foreground outline-none"
              >
                <option value="">Selecione a etapa...</option>
                {previousStages.map((s) => (
                  <option key={s} value={s}>
                    {DEAL_STAGE_CONFIG[s]?.label}
                  </option>
                ))}
              </select>
              <label className="text-xs font-medium text-sys-orange">
                Justificativa (obrigatoria)
              </label>
              <textarea
                value={retrocederMotivo}
                onChange={(e) => setRetrocederMotivo(e.target.value)}
                rows={2}
                placeholder="Descreva o motivo do retrocesso..."
                className="w-full rounded-lg border border-sys-orange/30 bg-card py-2 px-3 text-sm text-foreground placeholder:text-placeholder outline-none resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleRetroceder}
                  disabled={isPending}
                  className="flex-1 rounded-md bg-sys-orange py-2 text-sm font-semibold text-white hover:bg-sys-orange/80 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="inline h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  Confirmar Retrocesso
                </button>
                <button
                  onClick={() => {
                    setShowRetrocederForm(false);
                    setRetrocederStage("");
                    setRetrocederMotivo("");
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-card"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Marcar como perdido */}
          {!showLostForm && !showRetrocederForm ? (
            <button
              onClick={() => setShowLostForm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm text-sys-red hover:bg-sys-red/15 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Marcar como Perdido
            </button>
          ) : null}

          {/* Structured lost form */}
          {showLostForm && (
            <div className="space-y-3 p-3 rounded-lg bg-sys-red/15 border border-sys-red/20">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-sys-red">
                  Motivo da perda
                </label>
                <select
                  value={lostReasonCategory}
                  onChange={(e) => setLostReasonCategory(e.target.value)}
                  className="w-full rounded-lg border border-sys-red/30 bg-card py-2 px-3 text-sm text-foreground outline-none"
                >
                  <option value="">Selecione o motivo...</option>
                  {LOSS_REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-sys-red">
                  Detalhes (obrigatorio)
                </label>
                <textarea
                  value={lostDetail}
                  onChange={(e) => setLostDetail(e.target.value)}
                  rows={2}
                  placeholder="Descreva os detalhes..."
                  className="w-full rounded-lg border border-sys-red/30 bg-card py-2 px-3 text-sm text-foreground placeholder:text-placeholder outline-none resize-none"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canReactivate}
                  onChange={(e) => setCanReactivate(e.target.checked)}
                  className="h-4 w-4 rounded border-sys-red/30 bg-card text-destructive focus:ring-destructive/30"
                />
                <span className="text-xs text-foreground">Pode ser reativado?</span>
              </label>

              {canReactivate && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-sys-red">
                    Data de reativacao
                  </label>
                  <input
                    type="date"
                    value={reactivationDate}
                    onChange={(e) => setReactivationDate(e.target.value)}
                    className="w-full rounded-lg border border-sys-red/30 bg-card py-2 px-3 text-sm text-foreground outline-none"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleLost}
                  disabled={isPending}
                  className="flex-1 rounded-md bg-destructive py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="inline h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  Confirmar Perda
                </button>
                <button
                  onClick={() => {
                    setShowLostForm(false);
                    setLostReasonCategory("");
                    setLostDetail("");
                    setCanReactivate(false);
                    setReactivationDate("");
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-card"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
