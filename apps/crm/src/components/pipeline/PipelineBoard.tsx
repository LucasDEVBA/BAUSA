"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { type Deal, type DealStage, PIPELINE_STAGE_ORDER } from "@/types/deal";
import { PipelineColumn } from "./PipelineColumn";
import { DealCard } from "./DealCard";
import { DealDetailSheet } from "./DealDetailSheet";
import { PipelineFilterToggle } from "./PipelineFilterToggle";
import { moverDeal } from "@/lib/actions/deals";
import { toast } from "sonner";

interface PipelineBoardProps {
  deals: Deal[];
  currentUserId?: string;
}

function getDealsByStage(deals: Deal[]) {
  return deals.reduce<Record<string, Deal[]>>((acc, deal) => {
    if (!acc[deal.stage]) acc[deal.stage] = [];
    acc[deal.stage].push(deal);
    return acc;
  }, {});
}

export function PipelineBoard({ deals: initialDeals, currentUserId }: PipelineBoardProps) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filterMode, setFilterMode] = useState<"todos" | "meus">("todos");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const filteredDeals =
    filterMode === "meus" && currentUserId
      ? deals.filter((d) => d.responsavel_id === currentUserId)
      : deals;

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;
  const dealsByStage = getDealsByStage(filteredDeals);

  // Mapeamento stage do frontend → etapa do Supabase
  const stageToEtapa: Record<string, string> = {
    lead: "lead",
    reuniao_marcada: "reuniao_marcada",
    reuniao_realizada: "reuniao_realizada",
    diagnostico_fit: "diagnostico_fit",
    alinhamento_estrategico: "alinhamento_estrategico",
    proposta_enviada: "proposta_enviada",
    followup_proposta: "followup_proposta",
    negociacao: "negociacao",
    contrato_enviado: "contrato_enviado",
    contrato_assinado: "contrato_assinado",
    sinal_pago: "sinal_pago",
    admission_process: "admission_process",
    concluido: "concluido",
    perdido: "perdido",
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const newStage = over.id as DealStage;
    const deal = deals.find((d) => d.id === dealId);

    if (!deal || deal.stage === newStage) return;

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)),
    );

    const novaEtapa = stageToEtapa[newStage] || newStage;

    startTransition(async () => {
      const result = await moverDeal(dealId, novaEtapa as any);
      if (!result.success) {
        // Rollback
        setDeals((prev) =>
          prev.map((d) => (d.id === dealId ? { ...d, stage: deal.stage } : d)),
        );
        toast.error(result.error || "Erro ao mover deal");
      } else {
        toast.success(`Deal movido para ${newStage.replace(/_/g, " ")}`);
        router.refresh();
      }
    });
  };

  return (
    <>
      <div className="mb-3">
        <PipelineFilterToggle
          filterMode={filterMode}
          onFilterChange={setFilterMode}
          totalCount={deals.length}
          filteredCount={currentUserId ? deals.filter((d) => d.responsavel_id === currentUserId).length : deals.length}
        />
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 h-full">
          {PIPELINE_STAGE_ORDER.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              deals={dealsByStage[stage] ?? []}
              onDealClick={(deal) => setSelectedDeal(deal)}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDeal ? <DealCard deal={activeDeal} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      {/* Deal Detail Sheet — key forces remount on deal change */}
      {selectedDeal && (
        <DealDetailSheet
          key={selectedDeal.id}
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
        />
      )}
    </>
  );
}
