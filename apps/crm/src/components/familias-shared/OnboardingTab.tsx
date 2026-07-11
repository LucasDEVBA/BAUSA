"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CheckSquare,
  Circle,
  Clock,
  Loader2,
  Play,
  SkipForward,
  Sparkles,
  Square,
  Video,
} from "lucide-react";
import {
  getOnboardingByExperiencia,
  marcarEtapaConcluida,
  marcarEtapaEmAndamento,
  pularEtapa,
  toggleChecklistItem,
  type OnboardingEtapaEstado,
  type OnboardingInstancia,
} from "@/lib/actions/onboarding";
import {
  listarReunioesFamilia,
  type ReuniaoFamilia,
} from "@/lib/actions/reunioes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface OnboardingTabProps {
  experienciaId: string;
  athleteName: string;
}

export function OnboardingTab({ experienciaId, athleteName }: OnboardingTabProps) {
  const router = useRouter();
  const [loadPending, startLoadTransition] = useTransition();
  const [actionPending, startActionTransition] = useTransition();
  const [instancia, setInstancia] = useState<OnboardingInstancia | null>(null);
  const [etapas, setEtapas] = useState<OnboardingEtapaEstado[]>([]);
  const [observacao, setObservacao] = useState<Record<string, string>>({});
  const [showObs, setShowObs] = useState<string | null>(null);
  const [pulandoId, setPulandoId] = useState<string | null>(null);
  const [motivoPular, setMotivoPular] = useState("");
  const [reunioes, setReunioes] = useState<ReuniaoFamilia[]>([]);
  const [togglingItem, setTogglingItem] = useState<string | null>(null);

  const load = () => {
    startLoadTransition(async () => {
      const [data, reunioesData] = await Promise.all([
        getOnboardingByExperiencia(experienciaId),
        listarReunioesFamilia(experienciaId),
      ]);
      setInstancia(data.instancia);
      setEtapas(data.etapas);
      setReunioes(reunioesData);
    });
  };

  useEffect(() => {
    let cancelled = false;
    startLoadTransition(async () => {
      const [data, reunioesData] = await Promise.all([
        getOnboardingByExperiencia(experienciaId),
        listarReunioesFamilia(experienciaId),
      ]);
      if (!cancelled) {
        setInstancia(data.instancia);
        setEtapas(data.etapas);
        setReunioes(reunioesData);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [experienciaId]);

  const handleToggleItem = (etapa: OnboardingEtapaEstado, index: number) => {
    const atual = etapa.checklist_estado[index];
    if (!atual) return;
    const key = `${etapa.id}:${index}`;
    setTogglingItem(key);
    // Otimista: atualiza local antes da resposta
    setEtapas((prev) =>
      prev.map((e) =>
        e.id === etapa.id
          ? {
              ...e,
              checklist_estado: e.checklist_estado.map((c, i) =>
                i === index ? { ...c, concluido: !atual.concluido } : c,
              ),
            }
          : e,
      ),
    );
    startActionTransition(async () => {
      try {
        const result = await toggleChecklistItem(
          etapa.id,
          index,
          !atual.concluido,
        );
        if (result.success) {
          // Estado autoritativo do server (traz o concluido_at real)
          setEtapas((prev) =>
            prev.map((e) =>
              e.id === etapa.id
                ? { ...e, checklist_estado: result.checklist }
                : e,
            ),
          );
        } else {
          toast.error(result.error ?? "Falha ao atualizar o item");
          load();
        }
      } catch {
        toast.error("Falha de conexão ao atualizar o item");
        load();
      } finally {
        setTogglingItem(null);
      }
    });
  };

  const handleStart = (etapaId: string) => {
    startActionTransition(async () => {
      const result = await marcarEtapaEmAndamento(etapaId);
      if (result.success) {
        toast.success("Etapa iniciada");
        load();
        router.refresh();
      } else {
        toast.error(result.error ?? "Falha");
      }
    });
  };

  const handleComplete = (etapaId: string) => {
    startActionTransition(async () => {
      const obs = observacao[etapaId];
      const result = await marcarEtapaConcluida(etapaId, obs);
      if (result.success) {
        toast.success("Etapa concluída", { description: athleteName });
        setShowObs(null);
        setObservacao((prev) => ({ ...prev, [etapaId]: "" }));
        load();
        router.refresh();
      } else {
        toast.error(result.error ?? "Falha");
      }
    });
  };

  const handlePular = (etapaId: string) => {
    if (!motivoPular.trim()) {
      toast.error("Informe o motivo para pular");
      return;
    }
    startActionTransition(async () => {
      const result = await pularEtapa(etapaId, motivoPular);
      if (result.success) {
        toast.success("Etapa pulada");
        setPulandoId(null);
        setMotivoPular("");
        load();
        router.refresh();
      } else {
        toast.error(result.error ?? "Falha");
      }
    });
  };

  if (loadPending && etapas.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Carregando onboarding...
      </div>
    );
  }

  if (!instancia) {
    return (
      <div className="rounded-xl border border-dashed border-border py-10 text-center">
        <Sparkles className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Esta família ainda não tem onboarding criado.
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Onboardings são criados automaticamente quando o deal entra em
          admission.
        </p>
      </div>
    );
  }

  const total = etapas.length;
  const concluidas = etapas.filter((e) => e.status === "concluida").length;
  const puladas = etapas.filter((e) => e.status === "pulada").length;
  const finalizadas = concluidas + puladas;
  const percent = total === 0 ? 0 : Math.round((finalizadas / total) * 100);

  return (
    <div className="space-y-5">
      {/* Header com progresso */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Progresso do onboarding
            </p>
          </div>
          <span className="text-xs font-bold text-foreground">
            {concluidas}/{total}
          </span>
        </div>
        <div className="h-2 rounded-full bg-fill-4 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              percent === 100 ? "bg-sys-green" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          {percent}% — Iniciado em{" "}
          {new Date(instancia.iniciado_at).toLocaleDateString("pt-BR")}
          {instancia.status === "concluido" && (
            <span className="ml-2 text-sys-green font-semibold">
              ✓ Concluído
            </span>
          )}
        </p>
      </div>

      {/* Lista de etapas */}
      <div className="space-y-2">
        {etapas.map((etapa) => {
          const isConcluida = etapa.status === "concluida";
          const isPulada = etapa.status === "pulada";
          const isFinalizada = isConcluida || isPulada;
          const isAndamento = etapa.status === "em_andamento";
          const isPendente = etapa.status === "pendente";
          const prazoData = new Date(etapa.prazo);
          const isAtrasada = !isFinalizada && prazoData < new Date();

          const Icon = isConcluida
            ? CheckCircle2
            : isPulada
              ? SkipForward
              : Circle;

          return (
            <div
              key={etapa.id}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                isFinalizada
                  ? "border-border bg-card opacity-70"
                  : isAtrasada
                    ? "border-sys-red/40 bg-sys-red/5"
                    : isAndamento
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card",
              )}
            >
              <div className="flex items-start gap-3">
                <Icon
                  className={cn(
                    "h-5 w-5 flex-shrink-0 mt-0.5",
                    isConcluida && "text-sys-green",
                    isPulada && "text-muted-foreground",
                    !isFinalizada && isAtrasada && "text-sys-red",
                    !isFinalizada && !isAtrasada && isAndamento && "text-primary",
                    !isFinalizada && !isAtrasada && !isAndamento && "text-muted-foreground",
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                      Etapa {etapa.ordem}
                    </span>
                    {isAtrasada && !isFinalizada && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-sys-red/15 text-sys-red">
                        Atrasada
                      </span>
                    )}
                    {isAndamento && (
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                        Em andamento
                      </span>
                    )}
                  </div>
                  <p
                    className={cn(
                      "text-sm font-semibold text-foreground",
                      isFinalizada && "line-through opacity-60",
                    )}
                  >
                    {etapa.titulo}
                  </p>
                  {etapa.descricao && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {etapa.descricao}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      Prazo: {prazoData.toLocaleDateString("pt-BR")}
                    </span>
                    {etapa.requer_reuniao && (
                      <span className="rounded-md bg-sys-blue/15 text-sys-blue px-1.5 py-0.5 text-[9px] font-semibold">
                        Reunião
                      </span>
                    )}
                    {etapa.requer_documentos && (
                      <span className="rounded-md bg-sys-purple/15 text-sys-purple px-1.5 py-0.5 text-[9px] font-semibold">
                        Documentos
                      </span>
                    )}
                  </div>
                  {/* Checklist de sub-itens da etapa */}
                  {etapa.checklist_estado.length > 0 && (
                    <div className="mt-2.5 rounded-lg border border-border bg-card/60 p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Checklist
                        </p>
                        <span className="text-[9px] font-bold tabular-nums text-muted-foreground">
                          {etapa.checklist_estado.filter((c) => c.concluido).length}/
                          {etapa.checklist_estado.length}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {etapa.checklist_estado.map((item, idx) => {
                          const CheckIcon = item.concluido ? CheckSquare : Square;
                          const key = `${etapa.id}:${idx}`;
                          return (
                            <li key={idx}>
                              <button
                                type="button"
                                disabled={isFinalizada || togglingItem === key}
                                onClick={() => handleToggleItem(etapa, idx)}
                                className={cn(
                                  "flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left text-[11px] transition-colors",
                                  isFinalizada
                                    ? "cursor-default"
                                    : "hover:bg-accent",
                                  item.concluido
                                    ? "text-muted-foreground"
                                    : "text-foreground",
                                )}
                              >
                                <CheckIcon
                                  className={cn(
                                    "h-3.5 w-3.5 shrink-0 mt-px",
                                    item.concluido
                                      ? "text-sys-green"
                                      : "text-muted-foreground",
                                  )}
                                />
                                <span
                                  className={cn(
                                    item.concluido && "line-through opacity-70",
                                  )}
                                >
                                  {item.item}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {/* Status da reunião exigida pela etapa */}
                  {etapa.requer_reuniao && !isFinalizada && (() => {
                    const vinculadas = reunioes.filter(
                      (r) =>
                        r.etapa_estado_id === etapa.id &&
                        (r.status === "agendada" || r.status === "realizada"),
                    );
                    return vinculadas.length > 0 ? (
                      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-sys-green">
                        <Video className="h-3 w-3" />
                        Reunião vinculada: {vinculadas[0].titulo} (
                        {vinculadas[0].status})
                      </p>
                    ) : (
                      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-sys-orange">
                        <Video className="h-3 w-3" />
                        Exige reunião vinculada — agende na aba Reuniões e
                        selecione esta etapa
                      </p>
                    );
                  })()}

                  {isFinalizada && etapa.observacao && (
                    <p className="mt-2 rounded-md bg-card border border-border px-2 py-1.5 text-[10px] text-foreground">
                      <span className="font-semibold">Observação:</span>{" "}
                      {etapa.observacao}
                    </p>
                  )}
                </div>
              </div>

              {/* Ações */}
              {!isFinalizada && (
                <div className="mt-3 pt-3 border-t border-border flex flex-wrap gap-2">
                  {isPendente && (
                    <button
                      type="button"
                      onClick={() => handleStart(etapa.id)}
                      disabled={actionPending}
                      className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" />
                      Iniciar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowObs(showObs === etapa.id ? null : etapa.id)}
                    className="flex items-center gap-1 rounded-md border border-sys-green/30 bg-sys-green/10 px-2 py-1 text-[10px] font-semibold text-sys-green hover:bg-sys-green/20"
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Concluir
                  </button>
                  <button
                    type="button"
                    onClick={() => setPulandoId(pulandoId === etapa.id ? null : etapa.id)}
                    className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground hover:bg-accent"
                  >
                    <SkipForward className="h-3 w-3" />
                    Pular
                  </button>

                  {showObs === etapa.id && (
                    <div className="basis-full mt-2">
                      <textarea
                        value={observacao[etapa.id] ?? ""}
                        onChange={(e) =>
                          setObservacao((prev) => ({
                            ...prev,
                            [etapa.id]: e.target.value,
                          }))
                        }
                        rows={2}
                        placeholder="Observações sobre a conclusão (opcional)..."
                        className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
                      />
                      <button
                        type="button"
                        onClick={() => handleComplete(etapa.id)}
                        disabled={actionPending}
                        className="mt-1.5 flex items-center justify-center gap-1 rounded-md bg-sys-green px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-sys-green/90 disabled:opacity-50"
                      >
                        {actionPending && <Loader2 className="h-3 w-3 animate-spin" />}
                        Confirmar conclusão
                      </button>
                    </div>
                  )}

                  {pulandoId === etapa.id && (
                    <div className="basis-full mt-2">
                      <textarea
                        value={motivoPular}
                        onChange={(e) => setMotivoPular(e.target.value)}
                        rows={2}
                        placeholder="Por que esta etapa não se aplica? *"
                        className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-sys-orange/40"
                      />
                      <button
                        type="button"
                        onClick={() => handlePular(etapa.id)}
                        disabled={actionPending}
                        className="mt-1.5 flex items-center justify-center gap-1 rounded-md bg-sys-orange px-3 py-1.5 text-[10px] font-semibold text-white hover:bg-sys-orange/90 disabled:opacity-50"
                      >
                        {actionPending && <Loader2 className="h-3 w-3 animate-spin" />}
                        Pular etapa
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
