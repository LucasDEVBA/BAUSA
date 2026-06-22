"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Loader2,
  Phone,
  AlertTriangle,
  ArrowUpRight,
  FileText,
  History,
  ClipboardList,
  Heart,
  StickyNote,
  Pencil,
  Upload,
  CheckCircle2,
  Clock,
  Sparkles as SparklesIcon,
  Video as VideoIcon,
} from "lucide-react";
import {
  JOURNEY_STAGE_CONFIG,
  FAMILY_STATUS_CONFIG,
  FAMILY_JOURNEY_STAGES,
  TEMPERATURE_CONFIG,
  RISK_DIMENSION_LABELS,
  type FamilyJourneyStage,
  type FamilyStatus,
  type RiskDimension,
} from "@/types/family";
import {
  atualizarExperiencia,
  registrarContato,
  escalonarCEO,
  listarContatosExperiencia,
  listarHistoricoFase,
  type HistoricoFase,
} from "@/lib/actions/experiencia";
import {
  listarDocumentos,
  adicionarDocumento,
  atualizarStatusDocumento,
} from "@/lib/actions/documentos";
import { getFileSignedUrl } from "@/lib/actions/uploads";
import { criarNota, listarNotas } from "@/lib/actions/notas";
import type { NotaInterna } from "@/types/crm";
import { QuickActionsBar } from "./QuickActionsBar";
import { FileUploader, AttachmentList, type UploadedFile } from "./FileUploader";
import { HealthScoreCard } from "./HealthBadge";
import { OnboardingTab } from "./OnboardingTab";
import { ReunioesTab } from "./ReunioesTab";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const TIPO_CRISE_OPTIONS = [
  { value: "emocional", label: "Emocional" },
  { value: "academica", label: "Acadêmica" },
  { value: "financeira", label: "Financeira" },
  { value: "familiar", label: "Familiar" },
  { value: "bullying", label: "Bullying" },
  { value: "saude", label: "Saúde" },
] as const;

const NIVEL_CRISE_OPTIONS = [
  { value: "baixo", label: "1 — Baixo" },
  { value: "medio", label: "2 — Médio" },
  { value: "alto", label: "3 — Alto" },
  { value: "critico", label: "4 — Crítico" },
] as const;

const TIPO_RISCO_OPTIONS: { value: RiskDimension; label: string }[] = [
  { value: "academico", label: "Acadêmico" },
  { value: "esportivo", label: "Esportivo" },
  { value: "emocional", label: "Emocional" },
  { value: "financeiro", label: "Financeiro" },
  { value: "relacional", label: "Relacional" },
  { value: "comunicacao", label: "Comunicação" },
];

const TIPOS_DOC_PRESET = [
  "Passaporte",
  "Histórico escolar",
  "Boletim atual",
  "Carta de recomendação",
  "Visto",
  "Comprovante de residência",
  "Foto 3x4",
  "TOEFL/SAT",
  "Outro",
];

const STATUS_DOC_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pendente: { label: "Pendente", bg: "bg-secondary", color: "text-muted-foreground" },
  enviado_atleta: {
    label: "Enviado pelo atleta",
    bg: "bg-sys-blue/15",
    color: "text-sys-blue",
  },
  revisado: { label: "Revisado", bg: "bg-sys-orange/15", color: "text-sys-orange" },
  enviado_escola: {
    label: "Enviado à escola",
    bg: "bg-primary/15",
    color: "text-primary",
  },
  aprovado: {
    label: "Aprovado",
    bg: "bg-sys-green/15",
    color: "text-sys-green",
  },
};

export interface FamilyModalData {
  // Identificadores
  experiencia_id: string;
  atleta_id: string;
  // Display
  athlete_name: string;
  guardian_name: string;
  whatsapp: string;
  whatsapp_atleta?: string | null;
  whatsapp_responsavel?: string | null;
  email?: string | null;
  email_responsavel?: string | null;
  plano: string;
  esporte: string | null;
  // Fase/status
  fase: FamilyJourneyStage;
  status: FamilyStatus;
  temperatura: "verde" | "amarelo" | "vermelho";
  // Indicadores
  ansiedade: number;
  satisfacao: number;
  risco_percebido: number;
  tipos_risco: RiskDimension[];
  // Crise
  descricao_problema?: string | null;
  acao_em_andamento?: string | null;
  tipo_crise?: string | null;
  nivel_crise?: string | null;
  psicologa_acionada?: boolean;
  // Contato
  data_prevista_embarque?: string | null;
  proximo_contato?: string | null;
  data_ultimo_contato?: string | null;
  dias_sem_contato?: number | null;
}

interface FamilyDetailModalProps {
  family: FamilyModalData;
  onClose: () => void;
  onChanged?: () => void;
}

type Tab =
  | "geral"
  | "onboarding"
  | "reunioes"
  | "indicadores"
  | "etapas"
  | "registros"
  | "documentos"
  | "status"
  | "notas"
  | "escalonar";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "geral", label: "Visão geral", icon: ClipboardList },
  { id: "onboarding", label: "Onboarding", icon: SparklesIcon },
  { id: "reunioes", label: "Reuniões", icon: VideoIcon },
  { id: "indicadores", label: "Indicadores", icon: Heart },
  { id: "etapas", label: "Etapas", icon: History },
  { id: "registros", label: "Registros", icon: Phone },
  { id: "documentos", label: "Documentos", icon: FileText },
  { id: "status", label: "Status", icon: Pencil },
  { id: "notas", label: "Notas", icon: StickyNote },
  { id: "escalonar", label: "Escalonar", icon: ArrowUpRight },
];

export function FamilyDetailModal({
  family,
  onClose,
  onChanged,
}: FamilyDetailModalProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("geral");
  const statusCfg = FAMILY_STATUS_CONFIG[family.status];
  const tempCfg = TEMPERATURE_CONFIG[family.temperatura];
  const stageCfg = JOURNEY_STAGE_CONFIG[family.fase];

  const handleSaved = () => {
    onChanged?.();
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] rounded-2xl flex flex-col overflow-hidden liquid-glass"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header com gradient sutil */}
        <div className="relative border-b border-border bg-gradient-to-br from-primary/5 via-popover to-plan-legacy/5 px-6 py-5">
          {/* Decorative gradient orb */}
          <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              {/* Avatar com temperatura */}
              <div className="relative">
                <div
                  className={cn(
                    "flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-bold shadow-lg",
                    "bg-gradient-to-br",
                    family.temperatura === "verde" &&
                      "from-sys-green/30 to-sys-green/20 text-sys-green ring-2 ring-sys-green/30",
                    family.temperatura === "amarelo" &&
                      "from-sys-orange/30 to-sys-orange/20 text-sys-orange ring-2 ring-sys-orange/30",
                    family.temperatura === "vermelho" &&
                      "from-sys-red/30 to-sys-red/20 text-sys-red ring-2 ring-sys-red/30",
                  )}
                >
                  {getInitials(family.athlete_name)}
                </div>
                <span className="absolute -bottom-1 -right-1 text-base">
                  {tempCfg.icon}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold text-foreground tracking-tight">
                  {family.athlete_name}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Responsável:{" "}
                  <span className="font-medium text-foreground/80">
                    {family.guardian_name}
                  </span>
                </p>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                      statusCfg.bg,
                      statusCfg.color,
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dot)} />
                    {statusCfg.label}
                  </span>
                  <span className="rounded-full bg-primary/10 border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {stageCfg.label}
                  </span>
                  <span className="rounded-full bg-card border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    Plano {family.plano}
                  </span>
                  {family.esporte && (
                    <span className="rounded-full bg-card border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {family.esporte}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-md p-2 text-muted-foreground hover:bg-fill-4 hover:text-foreground transition-colors flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="relative mt-4">
            <QuickActionsBar
              athleteName={family.athlete_name}
              guardianName={family.guardian_name}
              whatsapp_responsavel={
                family.whatsapp_responsavel ??
                (family.whatsapp || null)
              }
              whatsapp_atleta={family.whatsapp_atleta ?? null}
              email={family.email ?? null}
              email_responsavel={family.email_responsavel ?? null}
              plano={family.plano}
              esporte={family.esporte}
              data_embarque={family.data_prevista_embarque ?? null}
              dias_sem_contato={family.dias_sem_contato ?? null}
            />
          </div>

          {/* Tabs */}
          <div className="relative mt-4 flex gap-0.5 overflow-x-auto rounded-xl border border-border bg-card/80 backdrop-blur p-1">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                  tab === id
                    ? "bg-primary/15 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-fill-4",
                )}
              >
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 bg-popover">
          {tab === "geral" && <TabGeral family={family} />}
          {tab === "onboarding" && (
            <OnboardingTab
              experienciaId={family.experiencia_id}
              athleteName={family.athlete_name}
            />
          )}
          {tab === "reunioes" && (
            <ReunioesTab
              experienciaId={family.experiencia_id}
              athleteName={family.athlete_name}
            />
          )}
          {tab === "indicadores" && (
            <TabIndicadores family={family} onSaved={handleSaved} />
          )}
          {tab === "etapas" && (
            <TabEtapas experienciaId={family.experiencia_id} />
          )}
          {tab === "registros" && (
            <TabRegistros
              experienciaId={family.experiencia_id}
              athleteName={family.athlete_name}
              onSaved={handleSaved}
            />
          )}
          {tab === "documentos" && (
            <TabDocumentos
              atletaId={family.atleta_id}
              onSaved={handleSaved}
            />
          )}
          {tab === "status" && (
            <TabStatus family={family} onSaved={handleSaved} />
          )}
          {tab === "notas" && (
            <TabNotas experienciaId={family.experiencia_id} />
          )}
          {tab === "escalonar" && (
            <TabEscalonar
              experienciaId={family.experiencia_id}
              athleteName={family.athlete_name}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab Geral ───────────────────────────────────────────────────
function TabGeral({ family }: { family: FamilyModalData }) {
  // Card grande com indicadores (destaque)
  const indicadores = [
    {
      label: "Ansiedade",
      value: family.ansiedade,
      color: family.ansiedade >= 4 ? "red" : family.ansiedade >= 3 ? "amber" : "blue",
    },
    {
      label: "Satisfação",
      value: family.satisfacao,
      color: family.satisfacao >= 4 ? "emerald" : family.satisfacao <= 2 ? "red" : "amber",
    },
    {
      label: "Risco percebido",
      value: family.risco_percebido,
      color:
        family.risco_percebido >= 4
          ? "red"
          : family.risco_percebido >= 3
            ? "amber"
            : "emerald",
    },
  ] as const;

  // Cards de info secundária
  const infoCards = [
    {
      label: "WhatsApp principal",
      value: family.whatsapp || "—",
      icon: "📱",
    },
    {
      label: "Email",
      value: family.email || family.email_responsavel || "—",
      icon: "✉️",
    },
    {
      label: "Plano",
      value: family.plano,
      icon: "💼",
    },
    {
      label: "Esporte",
      value: family.esporte || "—",
      icon: "⚽",
    },
    {
      label: "Data prevista de embarque",
      value: family.data_prevista_embarque
        ? new Date(family.data_prevista_embarque).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "Não definida",
      icon: "✈️",
    },
    {
      label: "Último contato",
      value: family.data_ultimo_contato
        ? `${new Date(family.data_ultimo_contato).toLocaleDateString("pt-BR")} (há ${family.dias_sem_contato ?? 0}d)`
        : "Sem registro",
      icon: "🕒",
    },
    {
      label: "Próximo contato",
      value: family.proximo_contato
        ? new Date(family.proximo_contato).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "—",
      icon: "📅",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Health Score */}
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Saúde da família
        </p>
        <HealthScoreCard
          ansiedade={family.ansiedade}
          satisfacao={family.satisfacao}
          risco_percebido={family.risco_percebido}
          status={family.status}
          temperatura={family.temperatura}
          dias_sem_contato={family.dias_sem_contato ?? null}
        />
      </div>

      {/* Indicadores em destaque */}
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Indicadores principais
        </p>
        <div className="grid grid-cols-3 gap-3">
          {indicadores.map((ind) => (
            <div
              key={ind.label}
              className={cn(
                "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4",
                ind.color === "emerald" &&
                  "border-sys-green/30 from-sys-green/15 to-sys-green/5",
                ind.color === "amber" &&
                  "border-sys-orange/30 from-sys-orange/15 to-sys-orange/5",
                ind.color === "red" &&
                  "border-sys-red/30 from-sys-red/15 to-sys-red/5",
                ind.color === "blue" &&
                  "border-sys-blue/30 from-sys-blue/15 to-sys-blue/5",
              )}
            >
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {ind.label}
              </p>
              <div className="mt-1 flex items-baseline gap-1">
                <span
                  className={cn(
                    "text-base font-semibold",
                    ind.color === "emerald" && "text-sys-green",
                    ind.color === "amber" && "text-sys-orange",
                    ind.color === "red" && "text-sys-red",
                    ind.color === "blue" && "text-sys-blue",
                  )}
                >
                  {ind.value}
                </span>
                <span className="text-xs text-muted-foreground">/5</span>
              </div>
              <div className="mt-2 flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className={cn(
                      "h-1 flex-1 rounded-full",
                      n <= ind.value
                        ? ind.color === "emerald"
                          ? "bg-sys-green"
                          : ind.color === "amber"
                            ? "bg-sys-orange"
                            : ind.color === "red"
                              ? "bg-sys-red"
                              : "bg-sys-blue"
                        : "bg-fill-4",
                    )}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info secundária */}
      <div>
        <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Informações da família
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {infoCards.map((it) => (
            <div
              key={it.label}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:shadow-md transition-all border border-border/70 bg-card/60"
            >
              <span className="text-lg">{it.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground">{it.label}</p>
                <p className="text-xs font-medium text-foreground truncate">
                  {it.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {family.tipos_risco.length > 0 && (
        <div>
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tipos de risco sinalizados
          </p>
          <div className="flex flex-wrap gap-1.5">
            {family.tipos_risco.map((t) => (
              <span
                key={t}
                className="rounded-lg border border-sys-red/30 bg-sys-red/15 px-2.5 py-1 text-[11px] font-semibold text-sys-red"
              >
                {RISK_DIMENSION_LABELS[t]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab Indicadores ─────────────────────────────────────────────
function TabIndicadores({
  family,
  onSaved,
}: {
  family: FamilyModalData;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [ansiedade, setAnsiedade] = useState(family.ansiedade);
  const [satisfacao, setSatisfacao] = useState(family.satisfacao);
  const [risco, setRisco] = useState(family.risco_percebido);
  const [tipos, setTipos] = useState<RiskDimension[]>(family.tipos_risco);

  const toggleTipo = (t: RiskDimension) =>
    setTipos((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );

  const handleSave = () => {
    startTransition(async () => {
      const result = await atualizarExperiencia(family.experiencia_id, {
        ansiedade,
        satisfacao,
        risco_percebido: risco,
        tipos_risco: tipos,
      });
      if (result.success) {
        toast.success("Indicadores atualizados", {
          description: family.athlete_name,
        });
        onSaved();
      } else {
        toast.error(result.error ?? "Falha ao salvar");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
          Indicadores (1–5)
        </p>
        {[
          {
            label: "Ansiedade",
            v: ansiedade,
            set: setAnsiedade,
            hint: "≥4 → vermelho automático",
          },
          {
            label: "Satisfação",
            v: satisfacao,
            set: setSatisfacao,
            hint: "≤2 → vermelho automático",
          },
          { label: "Risco percebido", v: risco, set: setRisco },
        ].map((it) => (
          <div key={it.label} className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{it.label}</span>
              <span className="text-muted-foreground">
                {it.v}/5{it.hint ? ` — ${it.hint}` : ""}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              value={it.v}
              onChange={(e) => it.set(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
          Tipos de Risco
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-1.5">
          {TIPO_RISCO_OPTIONS.map((opt) => {
            const active = tipos.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleTipo(opt.value)}
                className={cn(
                  "rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors text-left",
                  active
                    ? "border-sys-red/40 bg-sys-red/15 text-sys-red"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Salvar indicadores
      </button>
    </div>
  );
}

// ─── Tab Etapas (histórico) ──────────────────────────────────────
function TabEtapas({ experienciaId }: { experienciaId: string }) {
  const [historico, setHistorico] = useState<HistoricoFase[]>([]);
  const [loadPending, startLoadTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    startLoadTransition(async () => {
      const data = await listarHistoricoFase(experienciaId);
      if (!cancelled) setHistorico(data);
    });
    return () => {
      cancelled = true;
    };
  }, [experienciaId]);

  if (loadPending) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Carregando histórico...
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center">
        <p className="text-xs text-muted-foreground">
          Nenhuma alteração registrada ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
        Timeline de alterações (últimas 50)
      </p>
      {historico.map((h) => {
        const old = (h.dados_anteriores ?? {}) as Record<string, unknown>;
        const novo = (h.dados_novos ?? {}) as Record<string, unknown>;
        return (
          <div
            key={h.id}
            className="rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-primary">
                {h.user_papel ?? "sistema"}
              </span>
              <span className="text-[10px] text-label-tertiary">
                {new Date(h.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {h.campos_alterados.map((c) => {
                const oldVal = old[c];
                const newVal = novo[c];
                return (
                  <span
                    key={c}
                    className="rounded-md bg-background border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                  >
                    <span className="text-label-tertiary">{c}:</span>{" "}
                    <span className="text-foreground/80">
                      {String(oldVal ?? "—")} → {String(newVal ?? "—")}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab Registros (contatos) ────────────────────────────────────
type ContatoRow = {
  id: string;
  tipo: string;
  resumo: string;
  proximo_contato: string | null;
  anexos?: UploadedFile[] | null;
  created_at: string;
};

function TabRegistros({
  experienciaId,
  athleteName,
  onSaved,
}: {
  experienciaId: string;
  athleteName: string;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [loadPending, startLoadTransition] = useTransition();
  const [contatos, setContatos] = useState<ContatoRow[]>([]);
  const [tipo, setTipo] = useState<"whatsapp" | "email" | "ligacao" | "presencial">("whatsapp");
  const [resumo, setResumo] = useState("");
  const [proximo, setProximo] = useState(
    () => new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  );
  const [anexos, setAnexos] = useState<UploadedFile[]>([]);

  useEffect(() => {
    let cancelled = false;
    startLoadTransition(async () => {
      const data = await listarContatosExperiencia(experienciaId);
      if (!cancelled) setContatos(data as ContatoRow[]);
    });
    return () => {
      cancelled = true;
    };
  }, [experienciaId]);

  const reload = () => {
    startLoadTransition(async () => {
      const data = await listarContatosExperiencia(experienciaId);
      setContatos(data as ContatoRow[]);
    });
  };

  const handleSubmit = () => {
    if (!resumo.trim()) {
      toast.error("Resumo é obrigatório");
      return;
    }
    startTransition(async () => {
      const result = await registrarContato(experienciaId, {
        tipo,
        resumo,
        proximo_contato: new Date(proximo).toISOString(),
        anexos,
      });
      if (result.success) {
        toast.success("Contato registrado", { description: athleteName });
        setResumo("");
        setAnexos([]);
        onSaved();
        reload();
      } else {
        toast.error(result.error ?? "Falha ao registrar");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="rounded-xl border border-sys-green/20 bg-sys-green/5 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sys-green">
          Novo registro de contato
        </p>
        <div>
          <p className="mb-1.5 text-[10px] text-muted-foreground">Canal</p>
          <div className="grid grid-cols-4 gap-1.5">
            {(["whatsapp", "email", "ligacao", "presencial"] as const).map(
              (t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cn(
                    "rounded-md border px-2 py-1.5 text-[10px] font-medium capitalize",
                    tipo === t
                      ? "border-sys-green/40 bg-sys-green/15 text-sys-green"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  {t}
                </button>
              ),
            )}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[10px] text-muted-foreground">Resumo *</p>
          <textarea
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-sys-green/40"
            placeholder="O que foi discutido..."
          />
        </div>
        <div>
          <p className="mb-1.5 text-[10px] text-muted-foreground">Próximo contato *</p>
          <input
            type="date"
            value={proximo}
            onChange={(e) => setProximo(e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-sys-green/40"
          />
        </div>
        <div>
          <p className="mb-1.5 text-[10px] text-muted-foreground">
            Anexar prints / arquivos (opcional)
          </p>
          <FileUploader
            scope="contatos"
            scopeId={experienciaId}
            attachments={anexos}
            onAttachmentsChange={setAnexos}
            compact
            label="Anexar prints da conversa"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-sys-green px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Registrar contato
        </button>
      </div>

      {/* Lista */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
          Histórico de contatos
        </p>
        {loadPending ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin mr-2" />
            Carregando...
          </div>
        ) : contatos.length === 0 ? (
          <p className="text-[11px] text-label-tertiary italic">
            Nenhum contato registrado ainda.
          </p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {contatos.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-border bg-card px-3 py-2"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="rounded-md bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {c.tipo}
                  </span>
                  <p className="text-[10px] text-label-tertiary">
                    {new Date(c.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="text-xs text-foreground/80">{c.resumo}</p>
                {Array.isArray(c.anexos) && c.anexos.length > 0 && (
                  <AttachmentList attachments={c.anexos} />
                )}
                {c.proximo_contato && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Próximo:{" "}
                    {new Date(c.proximo_contato).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DocumentOpenButton: abre URL externa OU path de storage ────
function DocumentOpenButton({ url }: { url: string }) {
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();
  const isExternal = url.startsWith("http://") || url.startsWith("https://");

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExternal) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setLoading(true);
    startTransition(async () => {
      const result = await getFileSignedUrl(url);
      setLoading(false);
      if (result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Não foi possível abrir", { description: result.error });
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      disabled={loading}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[10px] text-primary hover:bg-primary/10 disabled:opacity-50"
    >
      {loading && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      Abrir arquivo
    </button>
  );
}

// ─── Tab Documentos ──────────────────────────────────────────────
type DocumentoRow = {
  id: string;
  tipo: string;
  status: string;
  arquivo_url: string | null;
  arquivo_nome: string | null;
  deadline: string | null;
  observacao: string | null;
  data_upload: string | null;
};

function TabDocumentos({
  atletaId,
  onSaved,
}: {
  atletaId: string;
  onSaved: () => void;
}) {
  const [docs, setDocs] = useState<DocumentoRow[]>([]);
  const [loadPending, startLoadTransition] = useTransition();
  const [savePending, startSaveTransition] = useTransition();

  const [novoTipo, setNovoTipo] = useState(TIPOS_DOC_PRESET[0]);
  const [novoTipoCustom, setNovoTipoCustom] = useState("");
  const [novoArquivos, setNovoArquivos] = useState<UploadedFile[]>([]);
  const [novoDeadline, setNovoDeadline] = useState("");
  const [novoObs, setNovoObs] = useState("");

  useEffect(() => {
    let cancelled = false;
    startLoadTransition(async () => {
      const data = (await listarDocumentos(atletaId)) as DocumentoRow[];
      if (!cancelled) setDocs(data);
    });
    return () => {
      cancelled = true;
    };
  }, [atletaId]);

  const reload = () => {
    startLoadTransition(async () => {
      const data = (await listarDocumentos(atletaId)) as DocumentoRow[];
      setDocs(data);
    });
  };

  const handleAdd = () => {
    const tipoFinal =
      novoTipo === "Outro" && novoTipoCustom.trim()
        ? novoTipoCustom.trim()
        : novoTipo;
    if (!tipoFinal || tipoFinal === "Outro") {
      toast.error("Informe o tipo do documento");
      return;
    }
    // Se houver pelo menos 1 arquivo anexado, usamos o primeiro como principal.
    // Arquivos adicionais ficam acessíveis como anexos.
    const principal = novoArquivos[0];
    startSaveTransition(async () => {
      const result = await adicionarDocumento(atletaId, {
        tipo: tipoFinal,
        arquivo_url: principal?.path,
        arquivo_nome: principal?.name,
        deadline: novoDeadline || undefined,
        observacao: novoObs || undefined,
      });
      if (result.success) {
        toast.success("Documento adicionado");
        setNovoTipoCustom("");
        setNovoArquivos([]);
        setNovoDeadline("");
        setNovoObs("");
        onSaved();
        reload();
      } else {
        toast.error(result.error ?? "Falha ao adicionar");
      }
    });
  };

  const handleStatus = (docId: string, status: string) => {
    startSaveTransition(async () => {
      const result = await atualizarStatusDocumento(docId, status);
      if (result.success) {
        toast.success("Status atualizado");
        reload();
      } else {
        toast.error(result.error ?? "Falha");
      }
    });
  };

  return (
    <div className="space-y-5">
      {/* Form de novo doc */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
          Adicionar documento
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="mb-1 text-[10px] text-muted-foreground">Tipo *</p>
            <select
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/40"
            >
              {TIPOS_DOC_PRESET.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-[10px] text-muted-foreground">Deadline (opcional)</p>
            <input
              type="date"
              value={novoDeadline}
              onChange={(e) => setNovoDeadline(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/40"
            />
          </div>
        </div>
        {novoTipo === "Outro" && (
          <div>
            <p className="mb-1 text-[10px] text-muted-foreground">Especifique o tipo *</p>
            <input
              type="text"
              value={novoTipoCustom}
              onChange={(e) => setNovoTipoCustom(e.target.value)}
              placeholder="Ex: Comprovante de vacinação"
              className="w-full rounded-md border border-input bg-card px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/40"
            />
          </div>
        )}
        <div>
          <p className="mb-1 text-[10px] text-muted-foreground">Arquivo (opcional)</p>
          <FileUploader
            scope="documentos"
            scopeId={atletaId}
            attachments={novoArquivos}
            onAttachmentsChange={setNovoArquivos}
            multiple={false}
            compact
            label="Arraste o documento ou clique"
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] text-muted-foreground">Observação</p>
          <textarea
            value={novoObs}
            onChange={(e) => setNovoObs(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-input bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-primary/40"
            placeholder="Observações sobre este documento..."
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={savePending}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {savePending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Adicionar documento
        </button>
      </div>

      {/* Lista */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
          Documentos do atleta ({docs.length})
        </p>
        {loadPending ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin mr-2" />
            Carregando...
          </div>
        ) : docs.length === 0 ? (
          <p className="text-[11px] text-label-tertiary italic">
            Nenhum documento cadastrado.
          </p>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => {
              const statusCfg =
                STATUS_DOC_LABELS[d.status] ?? STATUS_DOC_LABELS.pendente;
              return (
                <div
                  key={d.id}
                  className="rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {d.tipo}
                      </p>
                      {d.arquivo_nome && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {d.arquivo_nome}
                        </p>
                      )}
                      {d.observacao && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {d.observacao}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-label-tertiary">
                        {d.deadline && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            Deadline:{" "}
                            {new Date(d.deadline).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {d.data_upload && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            Upload:{" "}
                            {new Date(d.data_upload).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap",
                        statusCfg.bg,
                        statusCfg.color,
                      )}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {d.arquivo_url && (
                      <DocumentOpenButton url={d.arquivo_url} />
                    )}
                    <select
                      value={d.status}
                      onChange={(e) => handleStatus(d.id, e.target.value)}
                      disabled={savePending}
                      className="rounded-md border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground outline-none focus:border-primary/40"
                    >
                      {Object.entries(STATUS_DOC_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab Status (Satisfeita/Atenção/Crise) ───────────────────────
function TabStatus({
  family,
  onSaved,
}: {
  family: FamilyModalData;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [fase, setFase] = useState<FamilyJourneyStage>(family.fase);
  const [status, setStatus] = useState<FamilyStatus>(family.status);
  const [descricao, setDescricao] = useState(family.descricao_problema ?? "");
  const [acao, setAcao] = useState(family.acao_em_andamento ?? "");
  const [proximaAcao, setProximaAcao] = useState("");
  const [tipoCrise, setTipoCrise] = useState(family.tipo_crise ?? "");
  const [nivelCrise, setNivelCrise] = useState(family.nivel_crise ?? "");
  const [psicologa, setPsicologa] = useState(!!family.psicologa_acionada);
  const [embarque, setEmbarque] = useState(
    family.data_prevista_embarque
      ? new Date(family.data_prevista_embarque).toISOString().split("T")[0]
      : "",
  );

  const handleSave = () => {
    startTransition(async () => {
      const result = await atualizarExperiencia(family.experiencia_id, {
        fase,
        status,
        descricao_problema: descricao,
        acao_em_andamento: acao,
        proxima_acao: proximaAcao || undefined,
        tipo_crise:
          status === "crise" && tipoCrise
            ? (tipoCrise as
                | "emocional"
                | "academica"
                | "financeira"
                | "familiar"
                | "bullying"
                | "saude")
            : null,
        nivel_crise:
          status === "crise" && nivelCrise
            ? (nivelCrise as "baixo" | "medio" | "alto" | "critico")
            : null,
        psicologa_acionada: status === "crise" ? psicologa : undefined,
        data_prevista_embarque: embarque || null,
      });
      if (result.success) {
        toast.success("Status atualizado", { description: family.athlete_name });
        onSaved();
      } else {
        toast.error(result.error ?? "Falha ao salvar");
      }
    });
  };

  const requireProblema = status === "atencao" || status === "crise";

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary mb-1.5">
          Fase da Jornada
        </label>
        <select
          value={fase}
          onChange={(e) => setFase(e.target.value as FamilyJourneyStage)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary/40"
        >
          {FAMILY_JOURNEY_STAGES.map((f) => (
            <option key={f} value={f}>
              {JOURNEY_STAGE_CONFIG[f].label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary mb-1.5">
          Data prevista de embarque
        </label>
        <input
          type="date"
          value={embarque}
          onChange={(e) => setEmbarque(e.target.value)}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary/40"
        />
      </div>

      <div>
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary mb-1.5">
          Status da Família
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              { v: "satisfeita", label: "Satisfeita", color: "emerald" },
              { v: "atencao", label: "Atenção", color: "amber" },
              { v: "crise", label: "Crise", color: "red" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setStatus(opt.v)}
              className={cn(
                "rounded-md border px-2 py-2 text-[11px] font-semibold",
                status === opt.v
                  ? opt.color === "emerald"
                    ? "border-sys-green/40 bg-sys-green/15 text-sys-green"
                    : opt.color === "amber"
                      ? "border-sys-orange/40 bg-sys-orange/15 text-sys-orange"
                      : "border-sys-red/40 bg-sys-red/15 text-sys-red"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {requireProblema && (
        <div className="rounded-xl border border-sys-orange/20 bg-sys-orange/5 p-3 space-y-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-sys-orange">
            <AlertTriangle className="h-3 w-3" />
            {status === "crise" ? "Protocolo de Crise" : "Registro de Atenção"}
          </p>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1">
              Descrição do problema *
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-sys-orange/40"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1">
              Ação em andamento *
            </label>
            <textarea
              value={acao}
              onChange={(e) => setAcao(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-sys-orange/40"
            />
          </div>
          {status === "atencao" && (
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1">
                Próxima ação
              </label>
              <input
                type="text"
                value={proximaAcao}
                onChange={(e) => setProximaAcao(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-sys-orange/40"
              />
            </div>
          )}
          {status === "crise" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">
                    Tipo *
                  </label>
                  <select
                    value={tipoCrise}
                    onChange={(e) => setTipoCrise(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-sys-red/40"
                  >
                    <option value="">Selecione</option>
                    {TIPO_CRISE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground mb-1">
                    Nível *
                  </label>
                  <select
                    value={nivelCrise}
                    onChange={(e) => setNivelCrise(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-sys-red/40"
                  >
                    <option value="">Selecione</option>
                    {NIVEL_CRISE_OPTIONS.map((n) => (
                      <option key={n.value} value={n.value}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-foreground/80">
                <input
                  type="checkbox"
                  checked={psicologa}
                  onChange={(e) => setPsicologa(e.target.checked)}
                  className="accent-destructive"
                />
                Psicóloga acionada
              </label>
            </>
          )}
          <p className="text-[10px] text-sys-orange/80">
            Ao salvar, o CEO será notificado automaticamente.
          </p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Salvar status
      </button>
    </div>
  );
}

// ─── Tab Notas internas ──────────────────────────────────────────
function TabNotas({ experienciaId }: { experienciaId: string }) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState<NotaInterna[]>([]);
  const [newNote, setNewNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const data = await listarNotas({ experiencia_id: experienciaId });
      if (!cancelled) setNotes(data);
    });
    return () => {
      cancelled = true;
    };
  }, [experienciaId]);

  const handleSubmit = () => {
    if (!newNote.trim()) return;
    startTransition(async () => {
      const result = await criarNota({
        conteudo: newNote,
        experiencia_id: experienciaId,
      });
      if (result.success) {
        setNewNote("");
        toast.success("Nota adicionada");
        const data = await listarNotas({ experiencia_id: experienciaId });
        setNotes(data);
      } else {
        toast.error(result.error ?? "Erro ao criar nota");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Escrever nota interna..."
          className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-primary/40"
        />
        <button
          onClick={handleSubmit}
          disabled={isPending || !newNote.trim()}
          className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "Adicionar"
          )}
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-[11px] text-label-tertiary italic">Nenhuma nota ainda.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-xl border border-border bg-card px-3 py-2"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-primary">
                  {(n.autor as unknown as { nome?: string })?.nome ?? "Usuário"}
                </p>
                <p className="text-[10px] text-label-tertiary">
                  {new Date(n.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <p className="text-xs text-foreground/80">{n.conteudo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab Escalonar ───────────────────────────────────────────────
function TabEscalonar({
  experienciaId,
  athleteName,
  onClose,
}: {
  experienciaId: string;
  athleteName: string;
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [contexto, setContexto] = useState("");

  const handleSubmit = () => {
    if (!contexto.trim()) {
      toast.error("Descreva o contexto");
      return;
    }
    startTransition(async () => {
      const result = await escalonarCEO(experienciaId, contexto);
      if (result.success) {
        toast.success("Escalonamento enviado ao CEO", {
          description: athleteName,
        });
        setContexto("");
        onClose();
      } else {
        toast.error(result.error ?? "Falha");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-sys-red/30 bg-sys-red/5 p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-sys-red flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-sys-red/80">
          Cria <strong>tarefa crítica</strong> com prazo de 2h + notificação
          imediata ao CEO. Use para situações que exigem decisão executiva.
        </p>
      </div>

      <textarea
        value={contexto}
        onChange={(e) => setContexto(e.target.value)}
        rows={6}
        className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-sys-red/40"
        placeholder="Contexto detalhado do escalonamento — o que aconteceu, o que tentou, por que precisa do CEO..."
      />

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2.5 text-xs font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Escalonar ao CEO agora
      </button>
    </div>
  );
}
