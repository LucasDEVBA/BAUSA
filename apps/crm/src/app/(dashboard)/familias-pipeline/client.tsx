"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Phone, Plane, ArrowLeftRight } from "lucide-react";
import {
  JOURNEY_STAGE_CONFIG,
  FAMILY_STATUS_CONFIG,
  FAMILY_JOURNEY_STAGES,
  TEMPERATURE_CONFIG,
  type FamilyJourneyStage,
} from "@/types/family";
import { moverFaseFamilia } from "@/lib/actions/experiencia";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface FamiliaPipelineCard {
  id: string;
  athlete_name: string;
  guardian_name: string;
  whatsapp: string;
  plano: string;
  esporte: string | null;
  fase: FamilyJourneyStage;
  status: "satisfeita" | "atencao" | "crise";
  temperatura: "verde" | "amarelo" | "vermelho";
  ansiedade: number;
  satisfacao: number;
  dias_sem_contato: number | null;
  proximo_contato: string | null;
  data_prevista_embarque: string | null;
}

function PipelineCard({
  card,
  onDragStart,
}: {
  card: FamiliaPipelineCard;
  onDragStart: (id: string) => void;
}) {
  const statusCfg = FAMILY_STATUS_CONFIG[card.status];
  const tempCfg = TEMPERATURE_CONFIG[card.temperatura];
  const stageCfg = JOURNEY_STAGE_CONFIG[card.fase];
  const isInactive =
    card.dias_sem_contato != null &&
    stageCfg.alertDays > 0 &&
    card.dias_sem_contato >= stageCfg.alertDays;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.id);
        onDragStart(card.id);
      }}
      className={cn(
        "rounded-lg border bg-[#141720] p-3 cursor-grab active:cursor-grabbing transition-colors hover:border-indigo-500/30",
        card.status === "crise"
          ? "border-red-500/40"
          : card.status === "atencao"
            ? "border-amber-500/30"
            : "border-[#1e2130]"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">
            {card.athlete_name}
          </p>
          <p className="text-[10px] text-zinc-500 truncate">
            {card.guardian_name}
          </p>
        </div>
        <span className="text-base">{tempCfg.icon}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1 mb-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold",
            statusCfg.bg,
            statusCfg.color
          )}
        >
          {statusCfg.label}
        </span>
        <span className="inline-flex rounded-md bg-[#0c0e16] border border-[#1e2130] px-1.5 py-0.5 text-[9px] text-zinc-400">
          {card.plano}
        </span>
        {card.esporte && (
          <span className="inline-flex rounded-md bg-[#0c0e16] border border-[#1e2130] px-1.5 py-0.5 text-[9px] text-zinc-500 truncate max-w-[80px]">
            {card.esporte}
          </span>
        )}
      </div>

      <div className="space-y-1 text-[10px] text-zinc-500">
        <div className="flex items-center justify-between">
          <span>Ansiedade</span>
          <span
            className={cn(
              "font-semibold",
              card.ansiedade >= 4 ? "text-red-400" : "text-zinc-300"
            )}
          >
            {card.ansiedade}/5
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Satisfação</span>
          <span
            className={cn(
              "font-semibold",
              card.satisfacao <= 2 ? "text-red-400" : "text-zinc-300"
            )}
          >
            {card.satisfacao}/5
          </span>
        </div>
        {card.data_prevista_embarque && (
          <div className="flex items-center gap-1 mt-1.5">
            <Plane className="h-3 w-3 text-blue-400" />
            <span className="text-blue-300">
              {new Date(card.data_prevista_embarque).toLocaleDateString("pt-BR")}
            </span>
          </div>
        )}
      </div>

      {(isInactive || card.status === "crise") && (
        <div
          className={cn(
            "mt-2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold",
            card.status === "crise"
              ? "bg-red-500/10 border border-red-500/30 text-red-300"
              : "bg-amber-500/10 border border-amber-500/30 text-amber-300"
          )}
        >
          <AlertTriangle className="h-2.5 w-2.5" />
          {card.status === "crise"
            ? "Crise"
            : `${card.dias_sem_contato}d sem contato`}
        </div>
      )}

      {card.proximo_contato && (
        <div className="mt-2 flex items-center gap-1 text-[9px] text-zinc-600">
          <Phone className="h-2.5 w-2.5" />
          Próximo:{" "}
          {new Date(card.proximo_contato).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })}
        </div>
      )}
    </div>
  );
}

export function FamiliasPipelineClient({
  cards: initialCards,
}: {
  cards: FamiliaPipelineCard[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cards, setCards] = useState<FamiliaPipelineCard[]>(initialCards);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverFase, setHoverFase] = useState<FamilyJourneyStage | null>(null);

  // Sincroniza state local com props após refresh
  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  const handleDrop = (fase: FamilyJourneyStage) => {
    const id = dragId;
    setDragId(null);
    setHoverFase(null);
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.fase === fase) return;

    const previousFase = card.fase;
    // Optimistic UI — atualiza imediatamente, qualquer direção
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, fase } : c))
    );

    startTransition(async () => {
      const result = await moverFaseFamilia(id, fase);
      if (result.success) {
        toast.success(`Movida para ${JOURNEY_STAGE_CONFIG[fase].label}`, {
          description: card.athlete_name,
        });
        router.refresh();
      } else {
        // Rollback
        setCards((prev) =>
          prev.map((c) => (c.id === id ? { ...c, fase: previousFase } : c))
        );
        toast.error(result.error ?? "Falha ao mover família", {
          description: card.athlete_name,
          duration: 8000,
        });
      }
    });
  };

  const byFase = FAMILY_JOURNEY_STAGES.reduce(
    (acc, fase) => {
      acc[fase] = cards.filter((c) => c.fase === fase);
      return acc;
    },
    {} as Record<FamilyJourneyStage, FamiliaPipelineCard[]>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            Pipeline da Família
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 flex items-center gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5 text-zinc-600" />
            Arraste cards entre fases em qualquer direção. Famílias entram
            automaticamente em Admissão ao deal chegar em admission_process.
          </p>
        </div>
        <a
          href="/familias-crm"
          className="rounded-lg border border-[#1e2130] bg-[#141720] px-4 py-2 text-sm font-medium text-zinc-300 hover:border-indigo-500/30 hover:text-indigo-300"
        >
          Voltar à lista
        </a>
      </div>

      {isPending && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Atualizando...
        </div>
      )}

      <div className="grid grid-flow-col auto-cols-[260px] gap-3 overflow-x-auto pb-3">
        {FAMILY_JOURNEY_STAGES.map((fase) => {
          const cfg = JOURNEY_STAGE_CONFIG[fase];
          const list = byFase[fase];
          const isHovering = hoverFase === fase;
          return (
            <div
              key={fase}
              className={cn(
                "rounded-xl border bg-[#0f1117] p-3 transition-colors flex flex-col min-h-[360px]",
                isHovering
                  ? "border-indigo-500/50 bg-indigo-500/5"
                  : "border-[#1e2130]"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setHoverFase(fase);
              }}
              onDragLeave={() => {
                if (hoverFase === fase) setHoverFase(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(fase);
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                  {cfg.label}
                </p>
                <span className="rounded-full bg-zinc-800 px-2 text-[10px] font-bold text-zinc-300">
                  {list.length}
                </span>
              </div>
              <p className="mb-3 text-[10px] text-zinc-600">
                Alerta: {cfg.alertDays} dia(s) sem contato
              </p>
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {list.map((c) => (
                  <PipelineCard
                    key={c.id}
                    card={c}
                    onDragStart={(id) => setDragId(id)}
                  />
                ))}
                {list.length === 0 && (
                  <div className="rounded-md border border-dashed border-[#1e2130] py-6 text-center text-[10px] text-zinc-600">
                    Vazio
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
