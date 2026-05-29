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
import { RetrocessoModal } from "./RetrocessoModal";
import { LossModal, type LossPayload } from "./LossModal";
import { moverDeal, type StructuredLossData } from "@/lib/actions/deals";
import { labelEtapa, type MoveDealAction } from "@/lib/move-deal-result";
import type { StatusDeal } from "@/types/crm";
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

type PendingMove = {
  dealId: string;
  novaEtapa: StatusDeal;
  fromStage: StatusDeal;
  athleteName: string;
  kind: "retrocesso" | "perdido";
};

export function PipelineBoard({
  deals: initialDeals,
  currentUserId,
}: PipelineBoardProps) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [, startTransition] = useTransition();
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

  // Reage a `action` retornado pelo moverDeal
  const handleAction = (action: MoveDealAction, deal: Deal) => {
    switch (action.type) {
      case "open_deal":
        setSelectedDeal(deal);
        break;
      case "create_contract":
        setSelectedDeal(deal);
        break;
      case "open_retrocesso_modal":
        setPendingMove({
          dealId: action.dealId,
          novaEtapa: action.toStage,
          fromStage: action.fromStage,
          athleteName: deal.athlete_name,
          kind: "retrocesso",
        });
        break;
      case "open_lost_modal":
        setPendingMove({
          dealId: action.dealId,
          novaEtapa: action.toStage,
          fromStage: deal.stage as StatusDeal,
          athleteName: deal.athlete_name,
          kind: "perdido",
        });
        break;
      case "reload":
        router.refresh();
        break;
    }
  };

  // Executa o moverDeal e trata sucesso/erro com toast rico
  const performMove = (
    dealId: string,
    novaEtapa: StatusDeal,
    previousStage: DealStage,
    options?: { motivo?: string; lossData?: StructuredLossData },
  ) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, stage: novaEtapa as DealStage } : d,
      ),
    );

    startTransition(async () => {
      const result = await moverDeal(
        dealId,
        novaEtapa,
        options?.motivo,
        options?.lossData,
      );
      if (result.success) {
        toast.success(`Movido para ${labelEtapa(novaEtapa)}`, {
          description: deal.athlete_name,
        });
        router.refresh();
      } else {
        // Rollback visual
        setDeals((prev) =>
          prev.map((d) =>
            d.id === dealId ? { ...d, stage: previousStage } : d,
          ),
        );

        // Erros que abrem modais não devem mostrar toast (UX dupla)
        const opensModal =
          result.action?.type === "open_retrocesso_modal" ||
          result.action?.type === "open_lost_modal";

        if (opensModal) {
          if (result.action) handleAction(result.action, deal);
        } else {
          // Toast com action (quando aplicável)
          if (result.action && result.action.type !== "reload") {
            const actionLabel =
              result.action.type === "open_deal"
                ? "Abrir deal"
                : result.action.type === "create_contract"
                  ? "Criar contrato"
                  : "Abrir";
            toast.error(result.error, {
              description: `[${result.code}] ${deal.athlete_name}`,
              action: {
                label: actionLabel,
                onClick: () => handleAction(result.action!, deal),
              },
              duration: 10000,
            });
          } else if (result.action?.type === "reload") {
            toast.error(result.error, {
              description: deal.athlete_name,
              action: {
                label: "Recarregar",
                onClick: () => router.refresh(),
              },
            });
          } else {
            toast.error(result.error, {
              description: `[${result.code}] ${deal.athlete_name}`,
            });
          }
        }
      }
    });
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

    performMove(dealId, newStage as StatusDeal, deal.stage);
  };

  return (
    <>
      <div className="mb-3">
        <PipelineFilterToggle
          filterMode={filterMode}
          onFilterChange={setFilterMode}
          totalCount={deals.length}
          filteredCount={
            currentUserId
              ? deals.filter((d) => d.responsavel_id === currentUserId).length
              : deals.length
          }
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

      {/* Modal de retrocesso */}
      <RetrocessoModal
        open={pendingMove?.kind === "retrocesso"}
        athleteName={pendingMove?.athleteName ?? ""}
        fromStage={(pendingMove?.fromStage ?? "lead") as StatusDeal}
        toStage={(pendingMove?.novaEtapa ?? "lead") as StatusDeal}
        isPending={false}
        onCancel={() => setPendingMove(null)}
        onConfirm={(motivo) => {
          if (!pendingMove) return;
          const previousStage = pendingMove.fromStage as DealStage;
          const move = pendingMove;
          setPendingMove(null);
          performMove(move.dealId, move.novaEtapa, previousStage, { motivo });
        }}
      />

      {/* Modal de perdido */}
      <LossModal
        open={pendingMove?.kind === "perdido"}
        athleteName={pendingMove?.athleteName ?? ""}
        isPending={false}
        onCancel={() => setPendingMove(null)}
        onConfirm={(payload: LossPayload) => {
          if (!pendingMove) return;
          const previousStage = pendingMove.fromStage as DealStage;
          const move = pendingMove;
          setPendingMove(null);
          performMove(move.dealId, move.novaEtapa, previousStage, {
            lossData: payload,
          });
        }}
      />

      {/* Deal Detail Sheet */}
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
