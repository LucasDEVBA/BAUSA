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
import { KanbanColumn } from "./KanbanColumn";
import { DealCard } from "./DealCard";
import { DealModal } from "./DealModal";
import { moverDeal } from "@/lib/crm/actions/deals";
import { PIPELINE_ETAPAS, ETAPA_LABELS, type StatusDeal } from "@/types/crm";
import { toast } from "sonner";

interface KanbanBoardProps {
  initialDeals: any[];
}

export function KanbanBoard({ initialDeals }: KanbanBoardProps) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const novaEtapa = over.id as StatusDeal;
    const deal = deals.find((d) => d.id === dealId);

    if (!deal || deal.etapa === novaEtapa) return;

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, etapa: novaEtapa } : d)),
    );

    startTransition(async () => {
      const result = await moverDeal(dealId, novaEtapa);
      if (!result.success) {
        // Rollback
        setDeals((prev) =>
          prev.map((d) => (d.id === dealId ? { ...d, etapa: deal.etapa } : d)),
        );
        toast.error(result.error);
      } else {
        toast.success(`Deal movido para ${ETAPA_LABELS[novaEtapa]}`);
        router.refresh();
      }
    });
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[70vh]">
          {PIPELINE_ETAPAS.map((etapa) => {
            const columnDeals = deals.filter((d) => d.etapa === etapa);
            const totalValue = columnDeals.reduce((s, d) => s + (Number(d.valor_estimado) || 0), 0);
            return (
              <KanbanColumn
                key={etapa}
                id={etapa}
                title={ETAPA_LABELS[etapa]}
                count={columnDeals.length}
                totalValue={totalValue}
              >
                {columnDeals.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onClick={() => setSelectedDeal(deal)}
                  />
                ))}
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeDeal ? <DealCard deal={activeDeal} isDragging /> : null}
        </DragOverlay>
      </DndContext>

      <DealModal
        deal={selectedDeal}
        open={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
      />
    </>
  );
}
