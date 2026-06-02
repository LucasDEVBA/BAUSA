"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Loader2,
  Phone,
  X,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import {
  JOURNEY_STAGE_CONFIG,
  FAMILY_STATUS_CONFIG,
  FAMILY_JOURNEY_STAGES,
  TEMPERATURE_CONFIG,
  type FamilyJourneyStage,
  type FamilyStatus,
  type RiskDimension,
} from "@/types/family";
import {
  atualizarExperiencia,
  registrarContato,
  escalonarCEO,
} from "@/lib/actions/experiencia";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

export interface FamilyDrawerData {
  id: string;
  athlete_name: string;
  guardian_name: string;
  whatsapp: string;
  plano: string;
  esporte: string | null;
  fase: FamilyJourneyStage;
  status: FamilyStatus;
  temperatura: "verde" | "amarelo" | "vermelho";
  ansiedade: number;
  satisfacao: number;
  risco_percebido: number;
  tipos_risco: RiskDimension[];
  descricao_problema?: string | null;
  acao_em_andamento?: string | null;
  tipo_crise?: string | null;
  nivel_crise?: string | null;
  psicologa_acionada?: boolean;
  data_prevista_embarque?: string | null;
  proximo_contato?: string | null;
  data_ultimo_contato?: string | null;
}

interface FamilyEditDrawerProps {
  family: FamilyDrawerData;
  onClose: () => void;
  onSaved?: () => void;
}

export function FamilyEditDrawer({
  family,
  onClose,
  onSaved,
}: FamilyEditDrawerProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"editar" | "contato" | "escalonar">(
    "editar",
  );
  const [isPending, startTransition] = useTransition();

  // Form state — editar
  const [fase, setFase] = useState<FamilyJourneyStage>(family.fase);
  const [ansiedade, setAnsiedade] = useState(family.ansiedade);
  const [satisfacao, setSatisfacao] = useState(family.satisfacao);
  const [riscoPercebido, setRiscoPercebido] = useState(family.risco_percebido);
  const [tipos, setTipos] = useState<RiskDimension[]>(family.tipos_risco);
  const [status, setStatus] = useState<FamilyStatus>(family.status);
  const [descricao, setDescricao] = useState(family.descricao_problema ?? "");
  const [acao, setAcao] = useState(family.acao_em_andamento ?? "");
  const [proximaAcao, setProximaAcao] = useState("");
  const [tipoCrise, setTipoCrise] = useState<string>(family.tipo_crise ?? "");
  const [nivelCrise, setNivelCrise] = useState<string>(family.nivel_crise ?? "");
  const [psicologa, setPsicologa] = useState(!!family.psicologa_acionada);
  const [embarque, setEmbarque] = useState(
    family.data_prevista_embarque
      ? new Date(family.data_prevista_embarque).toISOString().split("T")[0]
      : "",
  );

  // Form state — registrar contato
  const [canalContato, setCanalContato] = useState<
    "whatsapp" | "email" | "ligacao" | "presencial"
  >("whatsapp");
  const [resumoContato, setResumoContato] = useState("");
  const [proximoContato, setProximoContato] = useState(
    () => new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
  );

  // Form state — escalonar
  const [contextoEscalonar, setContextoEscalonar] = useState("");

  const toggleTipo = (t: RiskDimension) => {
    setTipos((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const handleSaveEdit = () => {
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
        toast.success("Família atualizada", {
          description: family.athlete_name,
        });
        onSaved?.();
        router.refresh();
        onClose();
      } else {
        toast.error(result.error ?? "Falha ao salvar", {
          description: family.athlete_name,
        });
      }
    });
  };

  const handleSaveContato = () => {
    if (!resumoContato.trim()) {
      toast.error("Resumo do contato é obrigatório");
      return;
    }
    startTransition(async () => {
      const result = await registrarContato(family.id, {
        tipo: canalContato,
        resumo: resumoContato,
        proximo_contato: new Date(proximoContato).toISOString(),
      });
      if (result.success) {
        toast.success("Contato registrado", {
          description: family.athlete_name,
        });
        setResumoContato("");
        onSaved?.();
        router.refresh();
      } else {
        toast.error(result.error ?? "Falha ao registrar");
      }
    });
  };

  const handleEscalonar = () => {
    if (!contextoEscalonar.trim()) {
      toast.error("Descreva o contexto");
      return;
    }
    startTransition(async () => {
      const result = await escalonarCEO(family.id, contextoEscalonar);
      if (result.success) {
        toast.success("Escalonamento enviado ao CEO", {
          description: family.athlete_name,
        });
        setContextoEscalonar("");
        onClose();
      } else {
        toast.error(result.error ?? "Falha ao escalonar");
      }
    });
  };

  const requireProblema = status === "atencao" || status === "crise";
  const statusCfg = FAMILY_STATUS_CONFIG[family.status];
  const tempCfg = TEMPERATURE_CONFIG[family.temperatura];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[#1e2130] bg-[#0f1117] overflow-y-auto max-h-[92vh] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[#1e2130] bg-[#0f1117] px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{tempCfg.icon}</span>
                <p className="text-base font-bold text-white">
                  {family.athlete_name}
                </p>
              </div>
              <p className="text-xs text-zinc-500">
                {family.guardian_name} · Plano {family.plano}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-3 flex gap-1 rounded-lg border border-[#1e2130] bg-[#141720] p-1">
            <button
              onClick={() => setTab("editar")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "editar"
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
            <button
              onClick={() => setTab("contato")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "contato"
                  ? "bg-emerald-600/20 text-emerald-300"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <Phone className="h-3 w-3" /> Contato
            </button>
            <button
              onClick={() => setTab("escalonar")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "escalonar"
                  ? "bg-red-600/20 text-red-300"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              <ArrowUpRight className="h-3 w-3" /> Escalonar
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {tab === "editar" && (
            <>
              {/* Status atual badge */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold",
                    statusCfg.bg,
                    statusCfg.color,
                  )}
                >
                  {statusCfg.label}
                </span>
                <span className="text-xs text-zinc-500">
                  {JOURNEY_STAGE_CONFIG[family.fase].label}
                </span>
              </div>

              {/* Fase */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Fase da Jornada
                </label>
                <select
                  value={fase}
                  onChange={(e) =>
                    setFase(e.target.value as FamilyJourneyStage)
                  }
                  className="w-full rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500/40"
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
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
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
                    <div className="flex justify-between text-xs text-zinc-400 mb-1">
                      <span>{it.label}</span>
                      <span className="text-zinc-500">
                        {it.v}/5{it.hint ? ` — ${it.hint}` : ""}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={it.v}
                      onChange={(e) => it.set(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                ))}
              </div>

              {/* Tipos de risco */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
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
                            ? "border-red-500/40 bg-red-500/10 text-red-300"
                            : "border-[#1e2130] bg-[#141720] text-zinc-500 hover:text-zinc-300",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Data embarque */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Data prevista de embarque
                </label>
                <input
                  type="date"
                  value={embarque}
                  onChange={(e) => setEmbarque(e.target.value)}
                  className="w-full rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500/40"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
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
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : opt.color === "amber"
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                              : "border-red-500/40 bg-red-500/10 text-red-300"
                          : "border-[#1e2130] bg-[#141720] text-zinc-500",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {requireProblema && (
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                    <AlertTriangle className="h-3 w-3" />
                    {status === "crise"
                      ? "Protocolo de Crise"
                      : "Registro de Atenção"}
                  </p>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">
                      Descrição do problema *
                    </label>
                    <textarea
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/40"
                      placeholder="O que está acontecendo..."
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1">
                      Ação em andamento *
                    </label>
                    <textarea
                      value={acao}
                      onChange={(e) => setAcao(e.target.value)}
                      rows={2}
                      className="w-full rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/40"
                      placeholder="O que está sendo feito agora..."
                    />
                  </div>
                  {status === "atencao" && (
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">
                        Próxima ação
                      </label>
                      <input
                        type="text"
                        value={proximaAcao}
                        onChange={(e) => setProximaAcao(e.target.value)}
                        className="w-full rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-amber-500/40"
                        placeholder="O que será feito a seguir..."
                      />
                    </div>
                  )}
                  {status === "crise" && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-zinc-400 mb-1">
                            Tipo *
                          </label>
                          <select
                            value={tipoCrise}
                            onChange={(e) => setTipoCrise(e.target.value)}
                            className="w-full rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-2 text-xs text-zinc-200 outline-none focus:border-red-500/40"
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
                          <label className="block text-[10px] text-zinc-400 mb-1">
                            Nível *
                          </label>
                          <select
                            value={nivelCrise}
                            onChange={(e) => setNivelCrise(e.target.value)}
                            className="w-full rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-2 text-xs text-zinc-200 outline-none focus:border-red-500/40"
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
                      <label className="flex items-center gap-2 text-xs text-zinc-300">
                        <input
                          type="checkbox"
                          checked={psicologa}
                          onChange={(e) => setPsicologa(e.target.checked)}
                          className="accent-red-500"
                        />
                        Psicóloga acionada
                      </label>
                    </>
                  )}
                  <p className="text-[10px] text-amber-300/80">
                    Ao salvar, o CEO será notificado automaticamente.
                  </p>
                </div>
              )}

              <button
                onClick={handleSaveEdit}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Salvar alterações
              </button>
            </>
          )}

          {tab === "contato" && (
            <>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Canal
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    ["whatsapp", "email", "ligacao", "presencial"] as const
                  ).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCanalContato(t)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-[10px] font-medium capitalize",
                        canalContato === t
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : "border-[#1e2130] bg-[#141720] text-zinc-500",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Resumo *
                </label>
                <textarea
                  value={resumoContato}
                  onChange={(e) => setResumoContato(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/40"
                  placeholder="O que foi discutido..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Próximo contato *
                </label>
                <input
                  type="date"
                  value={proximoContato}
                  onChange={(e) => setProximoContato(e.target.value)}
                  className="w-full rounded-md border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-emerald-500/40"
                />
              </div>

              <button
                onClick={handleSaveContato}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Registrar contato
              </button>
            </>
          )}

          {tab === "escalonar" && (
            <>
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                <p className="text-[11px] text-red-300/90">
                  Cria tarefa crítica (prazo 2h) + notificação imediata ao CEO.
                </p>
              </div>
              <textarea
                value={contextoEscalonar}
                onChange={(e) => setContextoEscalonar(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-red-500/40"
                placeholder="Contexto detalhado do escalonamento..."
              />
              <button
                onClick={handleEscalonar}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Escalonar agora
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
