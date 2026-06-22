"use client";

import { useMemo, useState, useTransition } from "react";
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
import { DealDetailModal } from "./DealDetailModal";
import {
  PipelineFiltersBar,
  emptyPipelineFilters,
  type PipelineFiltersState,
  type PipelineView,
} from "./PipelineFiltersBar";
import { PipelineTableView } from "./PipelineTableView";
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

function applyFilters(
  deals: Deal[],
  f: PipelineFiltersState,
  currentUserId?: string,
): Deal[] {
  const search = f.search.trim().toLowerCase();
  const NOW = Date.now();
  return deals.filter((d) => {
    if (f.filterMode === "meus" && currentUserId && d.responsavel_id !== currentUserId)
      return false;
    if (f.classificacao !== "TODAS" && d.classification !== f.classificacao)
      return false;
    if (f.plano !== "TODOS" && d.product_tier !== f.plano) return false;
    if (f.comAtraso) {
      const stageDays = Math.floor(
        (NOW - new Date(d.stage_updated_at).getTime()) / 86400000,
      );
      const acaoAtraso = d.next_action_date
        ? Math.floor(
            (NOW - new Date(d.next_action_date).getTime()) / 86400000,
          )
        : null;
      const isAtrasado = stageDays > 14 || (acaoAtraso != null && acaoAtraso > 0) || !d.next_action;
      if (!isAtrasado) return false;
    }
    if (search) {
      const hay = `${d.athlete_name} ${d.guardian_name ?? ""} ${d.esporte ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

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

  const [view, setView] = useState<PipelineView>("kanban");
  const [filters, setFilters] = useState<PipelineFiltersState>(
    emptyPipelineFilters(),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const filteredDeals = useMemo(
    () => applyFilters(deals, filters, currentUserId),
    [deals, filters, currentUserId],
  );

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;
  const dealsByStage = getDealsByStage(filteredDeals);

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

  const performMove = (
    dealId: string,
    novaEtapa: StatusDeal,
    previousStage: DealStage,
    options?: { motivo?: string; lossData?: StructuredLossData },
  ) => {
    const deal = deals.find((d) => d.id === dealId);
    if (!deal) return;

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
        setDeals((prev) =>
          prev.map((d) =>
            d.id === dealId ? { ...d, stage: previousStage } : d,
          ),
        );

        const opensModal =
          result.action?.type === "open_retrocesso_modal" ||
          result.action?.type === "open_lost_modal";

        if (opensModal) {
          if (result.action) handleAction(result.action, deal);
        } else {
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
      <PipelineFiltersBar
        view={view}
        onViewChange={setView}
        filters={filters}
        onFiltersChange={setFilters}
        totalDeals={deals.length}
        filteredDeals={filteredDeals.length}
        hasCurrentUser={!!currentUserId}
      />

      {view === "kanban" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full gap-3 overflow-x-auto pb-4">
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
      ) : (
        <PipelineTableView
          deals={filteredDeals}
          onDealClick={(deal) => setSelectedDeal(deal)}
        />
      )}

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

      {/* Modal central super-completo (CEO) */}
      {selectedDeal && (
        <DealDetailModal
          key={selectedDeal.id}
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
        />
      )}
    </>
  );
}
