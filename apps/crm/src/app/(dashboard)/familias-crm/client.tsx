"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  Phone,
  AlertTriangle,
  CheckCircle,
  Clock,
  MessageSquare,
  TrendingDown,
  Activity,
  Zap,
  User,
  Send,
  Star,
  Award,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  JOURNEY_STAGE_CONFIG,
  FAMILY_STATUS_CONFIG,
  TEMPERATURE_CONFIG,
  RISK_DIMENSION_LABELS,
  type Family,
} from "@/types/family";
import type { NotaInterna } from "@/types/crm";
import { criarNota, listarNotas } from "@/lib/actions/notas";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FamiliasCrmClientProps {
  families: Family[];
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
  };
}

function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  return `ha ${diff}d`;
}

function ScoreBar({ value, max = 5, color }: { value: number; max?: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[#1e2130]">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-white w-4 text-right">{value}</span>
    </div>
  );
}

function FamilyCard({ family, onSelect }: { family: Family; onSelect: (f: Family) => void }) {
  const statusCfg = FAMILY_STATUS_CONFIG[family.family_status];
  const tempCfg = TEMPERATURE_CONFIG[family.temperature];
  const stageCfg = JOURNEY_STAGE_CONFIG[family.journey_stage];

  return (
    <div
      className={cn(
        "rounded-xl border bg-[#141720] p-5 cursor-pointer transition-all hover:border-indigo-500/30 hover:bg-[#161b28]",
        family.family_status === "crise"
          ? "border-red-500/40"
          : family.family_status === "atencao"
          ? "border-amber-500/30"
          : "border-[#1e2130]"
      )}
      onClick={() => onSelect(family)}
    >
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold", tempCfg.bg, tempCfg.color)}>
            {family.athlete_name.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{family.athlete_name}</p>
            <p className="text-xs text-zinc-500">{family.guardian_name} {family.address_state ? `· ${family.address_state}` : ""}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-lg">{tempCfg.icon}</span>
        </div>
      </div>

      {/* Status + stage */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold", statusCfg.bg, statusCfg.color)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.dot)} />
          {statusCfg.label}
        </span>
        <span className="inline-flex rounded-md bg-[#0c0e16] border border-[#1e2130] px-2 py-0.5 text-[10px] text-zinc-400">
          {stageCfg.label}
        </span>
        <span className="inline-flex rounded-md bg-[#0c0e16] border border-[#1e2130] px-2 py-0.5 text-[10px] text-zinc-400">
          {family.plan}
        </span>
      </div>

      {/* Indicadores */}
      <div className="mb-3 space-y-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-zinc-600">Satisfacao</p>
          </div>
          <ScoreBar value={family.satisfaction_level} color="bg-emerald-500" />
        </div>
        <div>
          <p className="text-[10px] text-zinc-600 mb-1">Ansiedade</p>
          <ScoreBar
            value={family.anxiety_level}
            color={family.anxiety_level >= 4 ? "bg-red-500" : family.anxiety_level >= 3 ? "bg-amber-500" : "bg-blue-500"}
          />
        </div>
      </div>

      {/* Contato */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          Ultimo contato: <span className="text-zinc-300">{formatRelative(family.last_contact_at)}</span>
        </span>
        <span className={cn(
          "font-medium",
          family.days_without_contact >= stageCfg.alertDays && stageCfg.alertDays > 0
            ? "text-amber-400"
            : "text-zinc-500"
        )}>
          {family.days_without_contact}d sem contato
        </span>
      </div>

      {/* Alertas criticos */}
      {family.crisis_records.length > 0 && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
          <p className="text-[10px] font-medium text-red-400">Crise em andamento — psicologa acionada</p>
        </div>
      )}
      {family.attention_records.length > 0 && family.crisis_records.length === 0 && (
        <div className="mt-3 flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
          <p className="text-[10px] font-medium text-amber-400">{family.attention_records[0].problem_description.slice(0, 60)}...</p>
        </div>
      )}
    </div>
  );
}

const TIPO_CRISE_LABELS: Record<string, string> = {
  emocional: "Emocional",
  academica: "Academica",
  financeira: "Financeira",
  familiar: "Familiar",
  bullying: "Bullying",
  saude: "Saude",
};

const NIVEL_CRISE_LABELS: Record<string, string> = {
  baixo: "1 - Baixo",
  medio: "2 - Medio",
  alto: "3 - Alto",
  critico: "4 - Critico",
};

function NotesSection({ experienciaId }: { experienciaId: string }) {
  const router = useRouter();
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
      <div>
        <button
          onClick={loadNotes}
          className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Carregar notas internas
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-600">
        Notas Internas
      </p>

      {/* Input */}
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
          className="flex-1 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/40"
        />
        <button
          onClick={handleSubmit}
          disabled={isPending || !newNote.trim()}
          className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* List */}
      {notes.length === 0 ? (
        <p className="text-[11px] text-zinc-600">Nenhuma nota ainda.</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-indigo-400">
                  {(n.autor as unknown as { nome: string })?.nome ?? "Usuario"}
                </p>
                <p className="text-[10px] text-zinc-600">
                  {new Date(n.created_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              <p className="text-xs text-zinc-300">{n.conteudo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FamilyDetail({ family, onClose }: { family: Family; onClose: () => void }) {
  const statusCfg = FAMILY_STATUS_CONFIG[family.family_status];
  const tempCfg = TEMPERATURE_CONFIG[family.temperature];
  const stageCfg = JOURNEY_STAGE_CONFIG[family.journey_stage];

  const showPostBoarding =
    family.journey_stage === "acompanhamento" || family.journey_stage === "encerrado";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-[#1e2130] bg-[#0f1117] overflow-y-auto max-h-[90vh] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[#1e2130] bg-[#0f1117] px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{tempCfg.icon}</span>
                <p className="text-base font-bold text-white">{family.athlete_name}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold", statusCfg.bg, statusCfg.color)}>
                  {statusCfg.label}
                </span>
                <span className="text-xs text-zinc-500">{stageCfg.label} - Plano {family.plan}</span>
              </div>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300">X</button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Contatos */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Responsavel", value: family.guardian_name },
              { label: "WhatsApp", value: family.whatsapp },
              { label: "Ultimo contato", value: formatRelative(family.last_contact_at) },
              { label: "Proximo contato", value: new Date(family.next_contact_date).toLocaleDateString("pt-BR") },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2.5">
                <p className="text-[10px] text-zinc-600">{item.label}</p>
                <p className="text-xs font-medium text-white">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Indicadores */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-600">Indicadores de Experiencia</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <p className="text-xs text-zinc-400">Satisfacao</p>
                  <p className="text-xs text-zinc-500">{family.satisfaction_level}/5</p>
                </div>
                <ScoreBar value={family.satisfaction_level} color="bg-emerald-500" />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <p className="text-xs text-zinc-400">Ansiedade</p>
                  <p className="text-xs text-zinc-500">{family.anxiety_level}/5</p>
                </div>
                <ScoreBar value={family.anxiety_level} color={family.anxiety_level >= 4 ? "bg-red-500" : "bg-amber-500"} />
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <p className="text-xs text-zinc-400">Risco Percebido</p>
                  <p className="text-xs text-zinc-500">{family.perceived_risk}/5</p>
                </div>
                <ScoreBar value={family.perceived_risk} color={family.perceived_risk >= 4 ? "bg-red-500" : "bg-orange-500"} />
              </div>
            </div>
          </div>

          {/* Perfil de risco por dimensao */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-600">Perfil de Risco por Dimensao</p>
            <div className="grid grid-cols-2 gap-2">
              {family.risk_profile.map((r) => (
                <div key={r.dimension} className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] text-zinc-500">{RISK_DIMENSION_LABELS[r.dimension]}</p>
                    <span className={cn(
                      "text-[10px] font-bold",
                      r.score >= 4 ? "text-red-400" : r.score >= 3 ? "text-amber-400" : "text-emerald-400"
                    )}>{r.score}/5</span>
                  </div>
                  <div className="h-1 rounded-full bg-[#1e2130]">
                    <div
                      className={cn("h-full rounded-full", r.score >= 4 ? "bg-red-500" : r.score >= 3 ? "bg-amber-500" : "bg-emerald-500")}
                      style={{ width: `${(r.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Proximo milestone */}
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 mb-1">Proximo Milestone</p>
            <p className="text-sm font-medium text-white">{family.next_milestone}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{new Date(family.next_milestone_date).toLocaleDateString("pt-BR")}</p>
          </div>

          {/* Crise detalhada */}
          {family.family_status === "crise" && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                Detalhes da Crise
              </p>
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-1">Tipo de crise</p>
                    <p className="text-xs font-medium text-red-300">
                      {family.tipo_crise
                        ? TIPO_CRISE_LABELS[family.tipo_crise] ?? family.tipo_crise
                        : "Nao informado"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-1">Nivel da crise</p>
                    <p className="text-xs font-medium text-red-300">
                      {family.nivel_crise
                        ? NIVEL_CRISE_LABELS[family.nivel_crise] ?? family.nivel_crise
                        : "Nao informado"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold",
                      family.psicologa_acionada
                        ? "bg-purple-500/20 border border-purple-500/30 text-purple-400"
                        : "bg-zinc-800 border border-zinc-700 text-zinc-500"
                    )}
                  >
                    {family.psicologa_acionada ? (
                      <>
                        <CheckCircle className="h-3 w-3" />
                        Psicologa acionada
                      </>
                    ) : (
                      "Psicologa nao acionada"
                    )}
                  </div>
                  {family.psicologa_acionada && family.psicologa_acionada_at && (
                    <p className="text-[10px] text-zinc-500">
                      em{" "}
                      {new Date(family.psicologa_acionada_at).toLocaleDateString(
                        "pt-BR"
                      )}
                    </p>
                  )}
                </div>
                {family.crisis_records.length > 0 && (
                  <div className="border-t border-red-500/20 pt-3 space-y-2">
                    {family.crisis_records.map((cr) => (
                      <div key={cr.id}>
                        <p className="text-xs text-zinc-300">{cr.description}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          Acao: {cr.action_taken}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ocorrencias de atencao */}
          {family.attention_records.length > 0 && family.family_status !== "crise" && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">Registros de Atencao</p>
              {family.attention_records.map((ar) => (
                <div key={ar.id} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                  <p className="text-xs text-zinc-300"><span className="font-semibold text-amber-400">Problema: </span>{ar.problem_description}</p>
                  <p className="text-xs text-zinc-400"><span className="font-semibold">Acao: </span>{ar.action_ongoing}</p>
                  <p className="text-xs text-zinc-400"><span className="font-semibold">Proxima: </span>{ar.next_action}</p>
                </div>
              ))}
            </div>
          )}

          {/* Indicadores Pos-Embarque */}
          {showPostBoarding && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                Indicadores Pos-Embarque
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2.5">
                  <p className="text-[10px] text-zinc-600 mb-1">Reteve para 2o ano?</p>
                  <p className="text-xs font-medium text-white">
                    {family.retencao_segundo_ano === true
                      ? "Sim"
                      : family.retencao_segundo_ano === false
                        ? "Nao"
                        : "Pendente"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2.5">
                  <p className="text-[10px] text-zinc-600 mb-1">NPS 6 meses</p>
                  <div className="flex items-center gap-1.5">
                    {family.nps_6meses != null ? (
                      <>
                        <Star
                          className={cn(
                            "h-3.5 w-3.5",
                            family.nps_6meses >= 9
                              ? "text-emerald-400"
                              : family.nps_6meses >= 7
                                ? "text-amber-400"
                                : "text-red-400"
                          )}
                        />
                        <span className="text-xs font-bold text-white">
                          {family.nps_6meses}/10
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-500">
                        {family.nps_enviado_at ? "Aguardando resposta" : "Nao enviado"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2.5 col-span-2">
                  <p className="text-[10px] text-zinc-600 mb-1">Indicacoes geradas</p>
                  <div className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-xs font-bold text-white">
                      {family.indicacoes_geradas ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notas Internas */}
          <NotesSection experienciaId={family.id} />
        </div>
      </div>
    </div>
  );
}

export function FamiliasCrmClient({ families, metrics }: FamiliasCrmClientProps) {
  const [selected, setSelected] = useState<Family | null>(null);
  const [filter, setFilter] = useState<"todas" | "satisfeita" | "atencao" | "crise">("todas");

  const filtered = filter === "todas" ? families : families.filter((f) => f.family_status === filter);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">CRM de Experiencia da Familia</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Acompanhamento pos-venda e suporte a jornada</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
          <User className="h-4 w-4" />
          Nova familia
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Familias ativas", value: metrics.total.toString(), color: "text-white", bg: "bg-zinc-800" },
          { label: "Satisfeitas", value: metrics.satisfeita.toString(), color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
          { label: "Atencao", value: metrics.atencao.toString(), color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
          { label: "Crise", value: metrics.crise.toString(), color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
          { label: "Satisfacao media", value: `${metrics.avg_satisfaction}/5`, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
        ].map((kpi) => (
          <div key={kpi.label} className={cn("rounded-xl border px-4 py-3 text-center", kpi.bg, !kpi.bg.includes("border-") && "border-[#1e2130]")}>
            <p className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Temperatura */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-zinc-600">Temperatura:</p>
        {[
          { key: "verde", label: "Verde", count: metrics.temperatura_verde },
          { key: "amarelo", label: "Amarelo", count: metrics.temperatura_amarelo },
          { key: "vermelho", label: "Vermelho", count: metrics.temperatura_vermelho },
        ].map((t) => (
          <div key={t.key} className="flex items-center gap-1.5 rounded-md border border-[#1e2130] bg-[#141720] px-3 py-1.5">
            <span className="text-xs">{t.label}</span>
            <span className="rounded-full bg-zinc-800 px-1.5 text-[10px] font-semibold text-white">{t.count}</span>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        {(["todas", "satisfeita", "atencao", "crise"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f
                ? "border-indigo-500/40 bg-indigo-500/20 text-indigo-300"
                : "border-[#1e2130] bg-[#141720] text-zinc-500 hover:text-zinc-300"
            )}
          >
            {f === "todas" ? "Todas" : f === "satisfeita" ? "Satisfeitas" : f === "atencao" ? "Atencao" : "Crise"}
            {f !== "todas" && (
              <span className="ml-1.5 rounded-full bg-zinc-800 px-1.5 text-[10px] text-zinc-400">
                {f === "satisfeita" ? metrics.satisfeita : f === "atencao" ? metrics.atencao : metrics.crise}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((family) => (
          <FamilyCard key={family.id} family={family} onSelect={setSelected} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <User className="h-10 w-10 mx-auto text-zinc-600 mb-3" />
          <p className="text-sm text-zinc-500">Nenhuma familia encontrada.</p>
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <FamilyDetail family={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
