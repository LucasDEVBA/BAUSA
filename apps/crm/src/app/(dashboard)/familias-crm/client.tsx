"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Award,
  Loader2,
  MessageSquare,
  Send,
  Star,
  User,
  ArrowUpRight,
  Bell,
  Pencil,
  Phone,
  X,
} from "lucide-react";
import {
  JOURNEY_STAGE_CONFIG,
  FAMILY_STATUS_CONFIG,
  TEMPERATURE_CONFIG,
  RISK_DIMENSION_LABELS,
  FAMILY_JOURNEY_STAGES,
  type Family,
  type FamilyJourneyStage,
  type FamilyStatus,
  type RiskDimension,
} from "@/types/family";
import type { NotaInterna } from "@/types/crm";
import { criarNota, listarNotas } from "@/lib/actions/notas";
import {
  atualizarExperiencia,
  registrarContato,
  escalonarCEO,
  listarContatosExperiencia,
  type AlertaInatividade,
} from "@/lib/actions/experiencia";
import { NovaFamiliaModal } from "@/components/familias-shared/NovaFamiliaModal";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FamiliasCrmClientProps {
  families: Family[];
  tiposRiscoByFamilia: Record<string, RiskDimension[]>;
  metrics: {
    total: number;
    satisfeita: number;
    atencao: number;
    crise: number;
    avg_satisfaction: number;
    avg_anxiety: number;
    temperatura_verde: number;
    temperatura_amarelo: number;
    temperatura_vermelho: number;
    em_alerta: number;
  };
  alertas: AlertaInatividade[];
}

const TIPO_CRISE_OPTIONS = [
  { value: "emocional", label: "Emocional" },
  { value: "academica", label: "Academica" },
  { value: "financeira", label: "Financeira" },
  { value: "familiar", label: "Familiar" },
  { value: "bullying", label: "Bullying" },
  { value: "saude", label: "Saude" },
] as const;

const NIVEL_CRISE_OPTIONS = [
  { value: "baixo", label: "1 — Baixo" },
  { value: "medio", label: "2 — Medio" },
  { value: "alto", label: "3 — Alto" },
  { value: "critico", label: "4 — Critico" },
] as const;

const TIPO_RISCO_OPTIONS: { value: RiskDimension; label: string }[] = [
  { value: "academico", label: "Acadêmico" },
  { value: "esportivo", label: "Esportivo" },
  { value: "emocional", label: "Emocional" },
  { value: "financeiro", label: "Financeiro" },
  { value: "relacional", label: "Relacional" },
  { value: "comunicacao", label: "Comunicação" },
];

function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  return `há ${diff}d`;
}

function ScoreBar({
  value,
  max = 5,
  color,
}: {
  value: number;
  max?: number;
  color: string;
}) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-foreground w-4 text-right">
        {value}
      </span>
    </div>
  );
}

function FamilyCard({
  family,
  onSelect,
}: {
  family: Family;
  onSelect: (f: Family) => void;
}) {
  const statusCfg = FAMILY_STATUS_CONFIG[family.family_status];
  const tempCfg = TEMPERATURE_CONFIG[family.temperature];
  const stageCfg = JOURNEY_STAGE_CONFIG[family.journey_stage];

  return (
    <div
      className={cn(
        "glass-card rounded-xl p-5 cursor-pointer transition-all hover:shadow-md hover:border-primary/30",
        family.family_status === "crise"
          ? "border-sys-red/40"
          : family.family_status === "atencao"
            ? "border-sys-orange/30"
            : ""
      )}
      onClick={() => onSelect(family)}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold",
              tempCfg.bg,
              tempCfg.color
            )}
          >
            {family.athlete_name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {family.athlete_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {family.guardian_name}
              {family.address_state ? ` · ${family.address_state}` : ""}
            </p>
          </div>
        </div>
        <span className="text-lg">{tempCfg.icon}</span>
      </div>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
            statusCfg.bg,
            statusCfg.color
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dot)} />
          {statusCfg.label}
        </span>
        <span className="inline-flex rounded-md bg-background border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
          {stageCfg.label}
        </span>
        <span className="inline-flex rounded-md bg-background border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
          {family.plan}
        </span>
      </div>

      <div className="mb-3 space-y-2">
        <div>
          <p className="text-[10px] text-label-tertiary mb-1">Satisfacao</p>
          <ScoreBar value={family.satisfaction_level} color="bg-sys-green" />
        </div>
        <div>
          <p className="text-[10px] text-label-tertiary mb-1">Ansiedade</p>
          <ScoreBar
            value={family.anxiety_level}
            color={
              family.anxiety_level >= 4
                ? "bg-sys-red"
                : family.anxiety_level >= 3
                  ? "bg-sys-orange"
                  : "bg-sys-blue"
            }
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Último contato:{" "}
          <span className="text-foreground/80">
            {formatRelative(family.last_contact_at)}
          </span>
        </span>
        <span
          className={cn(
            "font-medium",
            family.days_without_contact >= stageCfg.alertDays &&
              stageCfg.alertDays > 0
              ? "text-sys-orange"
              : "text-muted-foreground"
          )}
        >
          {family.days_without_contact}d sem contato
        </span>
      </div>

      {family.family_status === "crise" && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-sys-red/10 border border-sys-red/20 px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-sys-red flex-shrink-0" />
          <p className="text-[10px] font-medium text-sys-red">
            Crise{" "}
            {family.psicologa_acionada
              ? "— psicóloga acionada"
              : "— acionar protocolo"}
          </p>
        </div>
      )}
      {family.family_status === "atencao" && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-sys-orange/10 border border-sys-orange/20 px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-sys-orange flex-shrink-0" />
          <p className="text-[10px] font-medium text-sys-orange">
            Atenção registrada
          </p>
        </div>
      )}
    </div>
  );
}

function NotesSection({ experienciaId }: { experienciaId: string }) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState<NotaInterna[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loaded, setLoaded] = useState(false);

  const loadNotes = () => {
    startTransition(async () => {
      const data = await listarNotas({ experiencia_id: experienciaId });
      setNotes(data);
      setLoaded(true);
    });
  };

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

  if (!loaded) {
    return (
      <button
        onClick={loadNotes}
        className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Carregar notas internas
      </button>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-label-tertiary">
        Notas Internas
      </p>

      <div className="flex gap-2 mb-3">
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
          placeholder="Escrever nota..."
          className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-primary/40"
        />
        <button
          onClick={handleSubmit}
          disabled={isPending || !newNote.trim()}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="text-[11px] text-label-tertiary">Nenhuma nota ainda.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-xl border border-border bg-card px-3 py-2"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-primary">
                  {(n.autor as unknown as { nome?: string })?.nome ?? "Usuario"}
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

type ContatoRow = {
  id: string;
  tipo: string;
  resumo: string;
  proximo_contato: string | null;
  created_at: string;
};

function ContactsTimeline({ experienciaId }: { experienciaId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [contatos, setContatos] = useState<ContatoRow[]>([]);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const data = await listarContatosExperiencia(experienciaId);
      setContatos(data as ContatoRow[]);
      setLoaded(true);
    });
  };

  if (!loaded) {
    return (
      <button
        onClick={load}
        className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        <Phone className="h-3.5 w-3.5" />
        {isPending ? "Carregando..." : "Ver timeline de contatos"}
      </button>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-label-tertiary">
        Timeline de Contatos
      </p>
      {contatos.length === 0 ? (
        <p className="text-[11px] text-label-tertiary">Nenhum contato registrado.</p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto">
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
  );
}

// ─── Form de edição ──────────────────────────────────────────
function FamilyEditForm({
  family,
  tiposRisco,
  onSaved,
  onCancel,
}: {
  family: Family;
  tiposRisco: RiskDimension[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [fase, setFase] = useState<FamilyJourneyStage>(family.journey_stage);
  const [ansiedade, setAnsiedade] = useState(family.anxiety_level);
  const [satisfacao, setSatisfacao] = useState(family.satisfaction_level);
  const [riscoPercebido, setRiscoPercebido] = useState(family.perceived_risk);
  const [tipos, setTipos] = useState<RiskDimension[]>(tiposRisco);
  const [status, setStatus] = useState<FamilyStatus>(family.family_status);
  const [descricao, setDescricao] = useState(
    family.attention_records[0]?.problem_description ??
      family.crisis_records[0]?.description ??
      ""
  );
  const [acao, setAcao] = useState(
    family.attention_records[0]?.action_ongoing ??
      family.crisis_records[0]?.action_taken ??
      ""
  );
  const [proximaAcao, setProximaAcao] = useState(
    family.attention_records[0]?.next_action ?? ""
  );
  const [tipoCrise, setTipoCrise] = useState<string>(family.tipo_crise ?? "");
  const [nivelCrise, setNivelCrise] = useState<string>(family.nivel_crise ?? "");
  const [psicologa, setPsicologa] = useState(!!family.psicologa_acionada);
  const [embarque, setEmbarque] = useState(
    family.expected_departure_date
      ? new Date(family.expected_departure_date).toISOString().split("T")[0]
      : ""
  );

  const toggleTipo = (t: RiskDimension) => {
    setTipos((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await atualizarExperiencia(family.id, {
        fase,
        ansiedade,
        satisfacao,
        risco_percebido: riscoPercebido,
        tipos_risco: tipos,
        status,
        descricao_problema: descricao,
        acao_em_andamento: acao,
        proxima_acao: proximaAcao,
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
        toast.success("Família atualizada");
        onSaved();
      } else {
        toast.error(result.error ?? "Falha ao salvar");
      }
    });
  };

  const requireProblema = status === "atencao" || status === "crise";

  return (
    <div className="space-y-5">
      {/* Fase */}
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

      {/* Indicadores */}
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
          {
            label: "Risco percebido",
            v: riscoPercebido,
            set: setRiscoPercebido,
          },
        ].map((it) => (
          <div key={it.label} className="mb-3">
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

      {/* Tipos de risco */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
          Tipos de Risco
        </p>
        <div className="grid grid-cols-2 gap-1.5">
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
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Data prevista de embarque */}
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

      {/* Status */}
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
                  : "border-border bg-card text-muted-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Formulário condicional Atenção/Crise */}
      {requireProblema && (
        <div className="rounded-xl border border-sys-orange/20 bg-sys-orange/5 p-3 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sys-orange">
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
              className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-sys-orange/40"
              placeholder="Descreva o que está acontecendo..."
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
              className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-sys-orange/40"
              placeholder="O que está sendo feito agora..."
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
                className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-placeholder outline-none focus:border-sys-orange/40"
                placeholder="O que será feito a seguir..."
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

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="flex-1 flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Salvar alterações
        </button>
        <button
          onClick={onCancel}
          className="rounded-md border border-border bg-card px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Modal: Registrar Contato ────────────────────────────────
function RegistrarContatoModal({
  experienciaId,
  onClose,
  onSaved,
}: {
  experienciaId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<"whatsapp" | "email" | "ligacao" | "presencial">(
    "whatsapp"
  );
  const [resumo, setResumo] = useState("");
  const [proximo, setProximo] = useState(
    () => new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );
  const [isPending, startTransition] = useTransition();

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
      });
      if (result.success) {
        toast.success("Contato registrado");
        onSaved();
        onClose();
      } else {
        toast.error(result.error ?? "Falha ao registrar");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="liquid-glass w-full max-w-md rounded-2xl p-5 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-foreground">Registrar Contato</p>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary mb-1.5">
            Canal
          </label>
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
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {t}
                </button>
              )
            )}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary mb-1.5">
            Resumo *
          </label>
          <textarea
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary/40"
            placeholder="O que foi discutido..."
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary mb-1.5">
            Próximo contato *
          </label>
          <input
            type="date"
            value={proximo}
            onChange={(e) => setProximo(e.target.value)}
            className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary/40"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Registrar
        </button>
      </div>
    </div>
  );
}

// ─── Modal: Escalonar CEO ────────────────────────────────────
function EscalonarCEOModal({
  experienciaId,
  onClose,
}: {
  experienciaId: string;
  onClose: () => void;
}) {
  const [contexto, setContexto] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!contexto.trim()) {
      toast.error("Descreva o contexto");
      return;
    }
    startTransition(async () => {
      const result = await escalonarCEO(experienciaId, contexto);
      if (result.success) {
        toast.success("Escalonamento enviado ao CEO");
        onClose();
      } else {
        toast.error(result.error ?? "Falha ao escalonar");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="liquid-glass w-full max-w-md rounded-2xl border-sys-red/30 p-5 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-sys-red flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4" /> Escalonar ao CEO
          </p>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Cria tarefa crítica (prazo 2h) + notificação imediata ao CEO.
        </p>

        <textarea
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-sys-red/40"
          placeholder="Contexto detalhado do escalonamento..."
        />

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2.5 text-xs font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Escalonar agora
        </button>
      </div>
    </div>
  );
}

// ─── Detail Sheet ────────────────────────────────────────────
function FamilyDetail({
  family,
  tiposRisco,
  onClose,
  onChanged,
}: {
  family: Family;
  tiposRisco: RiskDimension[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showContato, setShowContato] = useState(false);
  const [showEscalonar, setShowEscalonar] = useState(false);

  const statusCfg = FAMILY_STATUS_CONFIG[family.family_status];
  const tempCfg = TEMPERATURE_CONFIG[family.temperature];
  const stageCfg = JOURNEY_STAGE_CONFIG[family.journey_stage];
  const showPostBoarding =
    family.journey_stage === "acompanhamento" ||
    family.journey_stage === "encerrado";

  const handleSaved = () => {
    setMode("view");
    onChanged();
    router.refresh();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="liquid-glass w-full max-w-lg rounded-2xl overflow-y-auto max-h-[90vh] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-border bg-popover px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{tempCfg.icon}</span>
                <p className="text-base font-bold text-foreground">
                  {family.athlete_name}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold",
                    statusCfg.bg,
                    statusCfg.color
                  )}
                >
                  {statusCfg.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {stageCfg.label} · Plano {family.plan}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-fill-4 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {mode === "view" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setMode("edit")}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20"
              >
                <Pencil className="h-3 w-3" /> Editar
              </button>
              <button
                onClick={() => setShowContato(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-sys-green/30 bg-sys-green/15 px-2.5 py-1 text-[10px] font-semibold text-sys-green hover:bg-sys-green/20"
              >
                <Phone className="h-3 w-3" /> Registrar contato
              </button>
              <button
                onClick={() => setShowEscalonar(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-sys-red/30 bg-sys-red/15 px-2.5 py-1 text-[10px] font-semibold text-sys-red hover:bg-sys-red/20"
              >
                <ArrowUpRight className="h-3 w-3" /> Escalonar ao CEO
              </button>
            </div>
          )}
        </div>

        <div className="p-5 space-y-5">
          {mode === "edit" ? (
            <FamilyEditForm
              family={family}
              tiposRisco={tiposRisco}
              onSaved={handleSaved}
              onCancel={() => setMode("view")}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Responsavel", value: family.guardian_name },
                  { label: "WhatsApp", value: family.whatsapp || "—" },
                  {
                    label: "Ultimo contato",
                    value: formatRelative(family.last_contact_at),
                  },
                  {
                    label: "Proximo contato",
                    value: new Date(family.next_contact_date).toLocaleDateString(
                      "pt-BR"
                    ),
                  },
                  {
                    label: "Plano",
                    value: family.plan,
                  },
                  {
                    label: "Data embarque",
                    value: family.expected_departure_date
                      ? new Date(
                          family.expected_departure_date
                        ).toLocaleDateString("pt-BR")
                      : "Não definida",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border bg-card px-3 py-2.5"
                  >
                    <p className="text-[10px] text-label-tertiary">{item.label}</p>
                    <p className="text-xs font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-label-tertiary">
                  Indicadores de Experiência
                </p>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Satisfação</p>
                      <p className="text-xs text-muted-foreground">
                        {family.satisfaction_level}/5
                      </p>
                    </div>
                    <ScoreBar
                      value={family.satisfaction_level}
                      color="bg-sys-green"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Ansiedade</p>
                      <p className="text-xs text-muted-foreground">
                        {family.anxiety_level}/5
                      </p>
                    </div>
                    <ScoreBar
                      value={family.anxiety_level}
                      color={
                        family.anxiety_level >= 4
                          ? "bg-sys-red"
                          : "bg-sys-orange"
                      }
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Risco Percebido</p>
                      <p className="text-xs text-muted-foreground">
                        {family.perceived_risk}/5
                      </p>
                    </div>
                    <ScoreBar
                      value={family.perceived_risk}
                      color={
                        family.perceived_risk >= 4
                          ? "bg-sys-red"
                          : "bg-sys-orange"
                      }
                    />
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-label-tertiary">
                  Perfil de Risco
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {family.risk_profile.map((r) => (
                    <div
                      key={r.dimension}
                      className="rounded-xl border border-border bg-card px-3 py-2"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] text-muted-foreground">
                          {RISK_DIMENSION_LABELS[r.dimension]}
                        </p>
                        <span
                          className={cn(
                            "text-[10px] font-bold",
                            r.score >= 4
                              ? "text-sys-red"
                              : r.score >= 3
                                ? "text-sys-orange"
                                : "text-sys-green"
                          )}
                        >
                          {r.score}/5
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-secondary">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            r.score >= 4
                              ? "bg-sys-red"
                              : r.score >= 3
                                ? "bg-sys-orange"
                                : "bg-sys-green"
                          )}
                          style={{ width: `${(r.score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {family.family_status === "crise" && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sys-red">
                    Detalhes da Crise
                  </p>
                  <div className="rounded-xl border border-sys-red/30 bg-sys-red/5 p-4 space-y-2">
                    <p className="text-xs text-foreground/80">
                      <span className="font-semibold text-sys-red">Tipo: </span>
                      {family.tipo_crise ?? "—"}
                    </p>
                    <p className="text-xs text-foreground/80">
                      <span className="font-semibold text-sys-red">Nível: </span>
                      {family.nivel_crise ?? "—"}
                    </p>
                    <p className="text-xs text-foreground/80">
                      <span className="font-semibold text-sys-red">
                        Psicóloga:{" "}
                      </span>
                      {family.psicologa_acionada ? "Sim" : "Não"}
                    </p>
                    {family.crisis_records.map((cr) => (
                      <div key={cr.id} className="pt-2 border-t border-sys-red/20">
                        <p className="text-xs text-foreground/80">{cr.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ação: {cr.action_taken}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {family.family_status === "atencao" &&
                family.attention_records.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-sys-orange">
                      Registro de Atenção
                    </p>
                    {family.attention_records.map((ar) => (
                      <div
                        key={ar.id}
                        className="rounded-xl border border-sys-orange/20 bg-sys-orange/5 p-3 space-y-2"
                      >
                        <p className="text-xs text-foreground/80">
                          <span className="font-semibold text-sys-orange">
                            Problema:{" "}
                          </span>
                          {ar.problem_description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold">Ação: </span>
                          {ar.action_ongoing}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

              {showPostBoarding && (
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-label-tertiary">
                    Indicadores Pós-Embarque
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
                      <p className="text-[10px] text-label-tertiary mb-1">
                        Reteve para 2º ano?
                      </p>
                      <p className="text-xs font-medium text-foreground">
                        {family.retencao_segundo_ano === true
                          ? "Sim"
                          : family.retencao_segundo_ano === false
                            ? "Não"
                            : "Pendente"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-card px-3 py-2.5">
                      <p className="text-[10px] text-label-tertiary mb-1">NPS 6 meses</p>
                      {family.nps_6meses != null ? (
                        <div className="flex items-center gap-1.5">
                          <Star
                            className={cn(
                              "h-3.5 w-3.5",
                              family.nps_6meses >= 9
                                ? "text-sys-green"
                                : family.nps_6meses >= 7
                                  ? "text-sys-orange"
                                  : "text-sys-red"
                            )}
                          />
                          <span className="text-xs font-bold text-foreground">
                            {family.nps_6meses}/10
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {family.nps_enviado_at ? "Aguardando" : "Não enviado"}
                        </span>
                      )}
                    </div>
                    <div className="rounded-xl border border-border bg-card px-3 py-2.5 col-span-2">
                      <p className="text-[10px] text-label-tertiary mb-1">
                        Indicações geradas
                      </p>
                      <div className="flex items-center gap-1.5">
                        <Award className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-bold text-foreground">
                          {family.indicacoes_geradas ?? 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <ContactsTimeline experienciaId={family.id} />
              <NotesSection experienciaId={family.id} />
            </>
          )}
        </div>
      </div>

      {showContato && (
        <RegistrarContatoModal
          experienciaId={family.id}
          onClose={() => setShowContato(false)}
          onSaved={onChanged}
        />
      )}
      {showEscalonar && (
        <EscalonarCEOModal
          experienciaId={family.id}
          onClose={() => setShowEscalonar(false)}
        />
      )}
    </div>
  );
}

// ─── Painel principal ────────────────────────────────────────
export function FamiliasCrmClient({
  families,
  tiposRiscoByFamilia,
  metrics,
  alertas,
}: FamiliasCrmClientProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Family | null>(null);
  const [showNovaModal, setShowNovaModal] = useState(false);
  const [filter, setFilter] = useState<
    "todas" | "satisfeita" | "atencao" | "crise"
  >("todas");

  const filtered =
    filter === "todas"
      ? families
      : families.filter((f) => f.family_status === filter);

  const alertasByExperiencia = new Map(alertas.map((a) => [a.experiencia_id, a]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-title-2 text-foreground">
            CRM de Experiência da Família
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Acompanhamento pós-venda e suporte à jornada
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNovaModal(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-colors"
          >
            <User className="h-4 w-4" />
            Nova Família
          </button>
          <a
            href="/familias-pipeline"
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:border-primary/30 hover:text-primary"
          >
            Pipeline da Família
          </a>
        </div>
      </div>

      <NovaFamiliaModal
        open={showNovaModal}
        onClose={() => setShowNovaModal(false)}
      />


      {/* Banner de alertas */}
      {alertas.length > 0 && (
        <div className="glass-card rounded-xl border-sys-orange/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="h-4 w-4 text-sys-orange" />
            <p className="text-xs font-semibold text-sys-orange">
              {alertas.length} família{alertas.length > 1 ? "s" : ""} em alerta
              de inatividade
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {alertas.slice(0, 8).map((a) => (
              <div
                key={a.experiencia_id}
                className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-1.5"
              >
                <p className="text-xs text-foreground/80 truncate">
                  {a.atleta_nome}
                </p>
                <span className="text-[10px] font-semibold text-sys-orange whitespace-nowrap ml-2">
                  {a.dias}d / {a.threshold}d ({a.fase})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {[
          {
            label: "Famílias",
            value: metrics.total.toString(),
            color: "text-foreground",
            bg: "bg-secondary border-border",
          },
          {
            label: "Satisfeitas",
            value: metrics.satisfeita.toString(),
            color: "text-sys-green",
            bg: "bg-sys-green/15 border-sys-green/20",
          },
          {
            label: "Atenção",
            value: metrics.atencao.toString(),
            color: "text-sys-orange",
            bg: "bg-sys-orange/15 border-sys-orange/20",
          },
          {
            label: "Crise",
            value: metrics.crise.toString(),
            color: "text-sys-red",
            bg: "bg-sys-red/15 border-sys-red/20",
          },
          {
            label: "Em alerta",
            value: metrics.em_alerta.toString(),
            color: "text-sys-orange",
            bg: "bg-sys-orange/15 border-sys-orange/20",
          },
          {
            label: "Satisfação média",
            value: `${metrics.avg_satisfaction}/5`,
            color: "text-sys-blue",
            bg: "bg-sys-blue/15 border-sys-blue/20",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={cn(
              "rounded-xl border px-4 py-3 text-center",
              kpi.bg,
              !kpi.bg.includes("border-") && "border-border"
            )}
          >
            <p className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <p className="text-xs text-label-tertiary">Temperatura:</p>
        {[
          { key: "verde", label: "Verde", count: metrics.temperatura_verde },
          {
            key: "amarelo",
            label: "Amarelo",
            count: metrics.temperatura_amarelo,
          },
          {
            key: "vermelho",
            label: "Vermelho",
            count: metrics.temperatura_vermelho,
          },
        ].map((t) => (
          <div
            key={t.key}
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5"
          >
            <span className="text-xs text-foreground/80">{t.label}</span>
            <span className="rounded-full bg-secondary px-1.5 text-[10px] font-semibold text-muted-foreground">
              {t.count}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["todas", "satisfeita", "atencao", "crise"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {f === "todas"
              ? "Todas"
              : f === "satisfeita"
                ? "Satisfeitas"
                : f === "atencao"
                  ? "Atenção"
                  : "Crise"}
            {f !== "todas" && (
              <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[10px] text-muted-foreground">
                {f === "satisfeita"
                  ? metrics.satisfeita
                  : f === "atencao"
                    ? metrics.atencao
                    : metrics.crise}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((family) => (
          <div key={family.id} className="relative">
            <FamilyCard family={family} onSelect={setSelected} />
            {alertasByExperiencia.has(family.id) && (
              <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-sys-orange/15 border border-sys-orange/30 px-1.5 py-0.5 text-[10px] font-bold text-sys-orange">
                <Bell className="h-2.5 w-2.5" />
                Inativa
              </span>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <User className="h-10 w-10 mx-auto text-label-tertiary mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma família encontrada.</p>
        </div>
      )}

      {selected && (
        <FamilyDetail
          family={selected}
          tiposRisco={tiposRiscoByFamilia[selected.id] ?? []}
          onClose={() => setSelected(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}
