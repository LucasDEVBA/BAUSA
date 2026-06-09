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
      className="fixed inset-0 z-50 flex items-end justify-end bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-popover overflow-y-auto max-h-[92vh] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border bg-popover px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">{tempCfg.icon}</span>
                <p className="text-base font-bold text-foreground">
                  {family.athlete_name}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {family.guardian_name} · Plano {family.plano}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-fill-4 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-3 flex gap-1 rounded-xl border border-border bg-card p-1">
            <button
              onClick={() => setTab("editar")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "editar"
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
            <button
              onClick={() => setTab("contato")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "contato"
                  ? "bg-sys-green/15 text-sys-green"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Phone className="h-3 w-3" /> Contato
            </button>
            <button
              onClick={() => setTab("escalonar")}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === "escalonar"
                  ? "bg-sys-red/15 text-sys-red"
                  : "text-muted-foreground hover:text-foreground",
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
                <span className="text-xs text-muted-foreground">
                  {JOURNEY_STAGE_CONFIG[family.fase].label}
                </span>
              </div>

              {/* Fase */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary mb-1.5">
                  Fase da Jornada
                </label>
                <select
                  value={fase}
                  onChange={(e) =>
                    setFase(e.target.value as FamilyJourneyStage)
                  }
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
                            : "border-border bg-card text-muted-foreground hover:text-foreground",
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
                    {status === "crise"
                      ? "Protocolo de Crise"
                      : "Registro de Atenção"}
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
                      placeholder="O que está acontecendo..."
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

              <button
                onClick={handleSaveEdit}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Salvar alterações
              </button>
            </>
          )}

          {tab === "contato" && (
            <>
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary mb-1.5">
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
                          ? "border-sys-green/40 bg-sys-green/15 text-sys-green"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary mb-1.5">
                  Resumo *
                </label>
                <textarea
                  value={resumoContato}
                  onChange={(e) => setResumoContato(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-sys-green/40"
                  placeholder="O que foi discutido..."
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary mb-1.5">
                  Próximo contato *
                </label>
                <input
                  type="date"
                  value={proximoContato}
                  onChange={(e) => setProximoContato(e.target.value)}
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-sys-green/40"
                />
              </div>

              <button
                onClick={handleSaveContato}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-sys-green px-4 py-2.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Registrar contato
              </button>
            </>
          )}

          {tab === "escalonar" && (
            <>
              <div className="rounded-xl border border-sys-red/30 bg-sys-red/5 p-3">
                <p className="text-[11px] text-sys-red/80">
                  Cria tarefa crítica (prazo 2h) + notificação imediata ao CEO.
                </p>
              </div>
              <textarea
                value={contextoEscalonar}
                onChange={(e) => setContextoEscalonar(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-sys-red/40"
                placeholder="Contexto detalhado do escalonamento..."
              />
              <button
                onClick={handleEscalonar}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2.5 text-xs font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
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
