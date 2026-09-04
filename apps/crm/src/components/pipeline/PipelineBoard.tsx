"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { type Deal, type DealStage } from "@/types/deal";
import {
  DEFAULT_DEAL_STAGE_DISPLAY,
  orderedKanbanStages,
  type DealStageConfigMap,
} from "@/lib/etapas-deal";
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
import {
  DEFAULT_PIPELINE_SORT,
  PIPELINE_SORT_STORAGE_KEY,
  parseStoredSortMap,
  sortDealsForDisplay,
  type PipelineSortMap,
  type PipelineSortMode,
} from "./PipelineSortMenu";
import { RetrocessoModal } from "./RetrocessoModal";
import { LossModal, type LossPayload } from "./LossModal";
import { GanhoEscolasModal } from "./GanhoEscolasModal";
import { moverDeal, type StructuredLossData } from "@/lib/actions/deals";
import { GAMIFICACAO_TIPO_LABEL } from "@/lib/gamificacao-labels";
import { celebrar } from "@/lib/gamificacao-store";
import { reordenarEtapasPipeline } from "@/lib/actions/etapas-pipeline";
import { EtapaColunaModal } from "./EtapaColunaModal";
import { AprovacaoColumn } from "./AprovacaoColumn";
import { FriosColumn } from "./FriosColumn";
import { NovaColunaModal } from "./NovaColunaModal";
import { AprovacaoLeadsModal } from "@/components/leads/AprovacoesLeads";
import type { LeadFrioCard, LeadPendenteCard } from "@/lib/actions/leads";
import { labelEtapa, type MoveDealAction } from "@/lib/move-deal-result";
import { excluirLeadPorDeal } from "@/lib/actions/leads-excluir";
import { Plus, Trash2 } from "lucide-react";
import type { StatusDeal } from "@/types/crm";
import { toast } from "sonner";

interface PipelineBoardProps {
  deals: Deal[];
  currentUserId?: string;
  /** Config de exibição das etapas (rótulo/cor/ordem/oculta) — default estático. */
  stageConfig?: DealStageConfigMap;
  /** Probabilidade por etapa (exibida/editável no modal da coluna). */
  probabilidadePorEtapa?: Record<string, number>;
  /** Só nível CEO edita colunas (o board é read-only para os demais). */
  podeEditarColunas?: boolean;
  /** Leads na fila de aprovação — primeira coluna do board (sem deal ainda). */
  leadsPendentes?: LeadPendenteCard[];
  /** FRIOs recentes p/ revisão — coluna própria, read-only + resgate. */
  leadsFrios?: LeadFrioCard[];
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

type GanhoPendente = { atletaId: string; athleteName: string };

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
  stageConfig = DEFAULT_DEAL_STAGE_DISPLAY,
  probabilidadePorEtapa = {},
  podeEditarColunas = false,
  leadsPendentes = [],
  leadsFrios = [],
}: PipelineBoardProps) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  // Reconcilia com o servidor: quando a page revalida (ex.: vincular reunião
  // move o deal de etapa), a verdade do servidor vence a cópia local — sem
  // isto o card fica na coluna antiga até um F5 (CEO reportou, 2026-08-26).
  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  // Excluir lead direto do card (mesmo padrão da tabela de /leads):
  // confirmação fora do card, setter estável dentro do render.
  const [dealParaExcluir, setDealParaExcluir] = useState<Deal | null>(null);
  const [excluindoLead, startExcluirLead] = useTransition();
  // Ganho fechado: a shortlist de escolas é o 1º entregável da jornada da
  // família, então o modal abre logo após o move (que já aconteceu).
  const [ganho, setGanho] = useState<GanhoPendente | null>(null);
  const [, startTransition] = useTransition();

  const [view, setView] = useState<PipelineView>("kanban");
  const [filters, setFilters] = useState<PipelineFiltersState>(
    emptyPipelineFilters(),
  );

  // Ordenação de exibição POR COLUNA (escolha do CEO, persistida numa chave
  // única). Começa vazio (= padrão em todas) e só lê o localStorage após
  // montar — evita mismatch de hidratação.
  const [sortMap, setSortMap] = useState<PipelineSortMap>({});
  useEffect(() => {
    try {
      setSortMap(
        parseStoredSortMap(
          window.localStorage.getItem(PIPELINE_SORT_STORAGE_KEY),
        ),
      );
    } catch {
      // localStorage indisponível (modo privado/iframe) — mantém o padrão.
    }
  }, []);

  const persistSortMap = (next: PipelineSortMap) => {
    setSortMap(next);
    try {
      window.localStorage.setItem(
        PIPELINE_SORT_STORAGE_KEY,
        JSON.stringify(next),
      );
    } catch {
      // Sem persistência disponível — a escolha ainda vale nesta sessão.
    }
  };

  const handleColumnSortChange = (stage: DealStage, mode: PipelineSortMode) => {
    const next = { ...sortMap };
    if (mode === DEFAULT_PIPELINE_SORT) delete next[stage];
    else next[stage] = mode;
    persistSortMap(next);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const filteredDeals = useMemo(
    () => applyFilters(deals, filters, currentUserId),
    [deals, filters, currentUserId],
  );

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;

  // Transform SÓ de render, aplicado coluna a coluna dentro do agrupamento.
  // Mover card entre colunas (dnd) muda `stage`, não posição — o drag-and-drop
  // continua intacto.
  const dealsByStage = useMemo(() => {
    const grouped = getDealsByStage(filteredDeals);
    for (const [stage, stageDeals] of Object.entries(grouped)) {
      const mode = sortMap[stage] ?? DEFAULT_PIPELINE_SORT;
      if (mode !== DEFAULT_PIPELINE_SORT) {
        grouped[stage] = sortDealsForDisplay(stageDeals, mode);
      }
    }
    return grouped;
  }, [filteredDeals, sortMap]);

  // Colunas na ordem configurada. Coluna OCULTA some do board SÓ quando não
  // tem deals visíveis — com deals, renderiza com badge "Oculta" (deals nunca
  // são escondidos pela configuração).
  const boardStages = useMemo(() => orderedKanbanStages(stageConfig), [stageConfig]);

  // Seletor global = "aplicar a todas": exibe o modo comum quando todas as
  // colunas coincidem (sem override = padrão) e, ao mudar, seta o modo em
  // TODAS as colunas, limpando overrides individuais.
  const sortTodas = useMemo<PipelineSortMode>(() => {
    const modes = new Set<PipelineSortMode>(
      boardStages.map((s) => sortMap[s] ?? DEFAULT_PIPELINE_SORT),
    );
    return modes.size === 1
      ? (Array.from(modes)[0] ?? DEFAULT_PIPELINE_SORT)
      : DEFAULT_PIPELINE_SORT;
  }, [boardStages, sortMap]);

  const handleSortTodasChange = (mode: PipelineSortMode) => {
    const next: PipelineSortMap = {};
    if (mode !== DEFAULT_PIPELINE_SORT) {
      for (const stage of boardStages) next[stage] = mode;
    }
    persistSortMap(next);
  };
  // Ordem local: aplica o arraste na hora e persiste em segundo plano
  // (rollback para a ordem do servidor se a gravação falhar).
  const [ordemLocal, setOrdemLocal] = useState<DealStage[] | null>(null);
  const ordemAtual = ordemLocal ?? boardStages;
  const visibleStages = ordemAtual.filter(
    (stage) =>
      !stageConfig[stage].oculta || (dealsByStage[stage]?.length ?? 0) > 0,
  );

  const [colunaAberta, setColunaAberta] = useState<DealStage | null>(null);
  const [novaColunaAberta, setNovaColunaAberta] = useState(false);
  const [leadAprovacao, setLeadAprovacao] = useState<string | null>(null);
  const [arrastandoColuna, setArrastandoColuna] = useState<DealStage | null>(null);

  // Reconcilia com o servidor: quando a config revalida, a ordem local (que
  // era só otimista) deixa de valer — senão ela venceria para sempre.
  useEffect(() => {
    setOrdemLocal(null);
  }, [stageConfig]);

  const soltarColuna = (alvo: DealStage) => {
    const origem = arrastandoColuna;
    setArrastandoColuna(null);
    if (!origem || origem === alvo) return;

    const anterior = ordemAtual;
    const proxima = anterior.filter((s) => s !== origem);
    proxima.splice(proxima.indexOf(alvo), 0, origem);
    setOrdemLocal(proxima);

    startTransition(async () => {
      const r = await reordenarEtapasPipeline(proxima);
      if (!r.success) {
        setOrdemLocal(anterior);
        toast.error(r.error);
      } else {
        router.refresh();
      }
    });
  };

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
        celebrar(result.gamificacao, GAMIFICACAO_TIPO_LABEL.deal_avancado);
        router.refresh();
        // Ganho: puxa a escolha das escolas na sequência. Não bloqueia o
        // move — se o CEO fechar, monta a shortlist depois em Matching.
        if (novaEtapa === "sinal_pago" && deal.atleta_id) {
          setGanho({ atletaId: deal.atleta_id, athleteName: deal.athlete_name });
        }
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
        sortTodas={sortTodas}
        onSortTodasChange={handleSortTodasChange}
      />

      {view === "kanban" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full gap-3 overflow-x-auto pb-4">
            {/* Fila de aprovação: primeira coluna, antes de qualquer etapa —
                o lead só vira deal (coluna seguinte) depois do OK do CEO. */}
            {podeEditarColunas && leadsPendentes.length > 0 && (
              <AprovacaoColumn leads={leadsPendentes} onLeadClick={setLeadAprovacao} />
            )}
            {/* Frios p/ revisão: visível, mas fora de métrica/automação/outreach */}
            {podeEditarColunas && leadsFrios.length > 0 && (
              <FriosColumn leads={leadsFrios} onResgatado={() => router.refresh()} />
            )}
            {visibleStages.map((stage) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                deals={dealsByStage[stage] ?? []}
                onDealClick={(deal) => setSelectedDeal(deal)}
                stageConfig={stageConfig}
                onHeaderClick={podeEditarColunas ? setColunaAberta : undefined}
                onColumnDragStart={podeEditarColunas ? setArrastandoColuna : undefined}
                onColumnDrop={podeEditarColunas ? soltarColuna : undefined}
                onColumnDragEnd={() => setArrastandoColuna(null)}
                arrastandoColuna={arrastandoColuna}
                sort={sortMap[stage] ?? DEFAULT_PIPELINE_SORT}
                onSortChange={handleColumnSortChange}
                onExcluirDeal={setDealParaExcluir}
              />
            ))}
            {podeEditarColunas && (
              <button
                type="button"
                onClick={() => setNovaColunaAberta(true)}
                className="flex h-24 w-[180px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <Plus className="size-3.5" aria-hidden />
                Nova coluna
              </button>
            )}
          </div>

          <DragOverlay>
            {activeDeal ? <DealCard deal={activeDeal} isDragging stageConfig={stageConfig} /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <PipelineTableView
          deals={filteredDeals}
          onDealClick={(deal) => setSelectedDeal(deal)}
          stageConfig={stageConfig}
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

      {/* Shortlist de escolas logo após o ganho */}
      {ganho && (
        <GanhoEscolasModal
          atletaId={ganho.atletaId}
          athleteName={ganho.athleteName}
          onClose={() => setGanho(null)}
        />
      )}

      {/* Fila de aprovação aberta pelo card da primeira coluna */}
      {leadAprovacao && (
        <AprovacaoLeadsModal
          leadIdInicial={leadAprovacao}
          onClose={() => setLeadAprovacao(null)}
          onDecidido={() => router.refresh()}
        />
      )}

      {/* Criar coluna nova (slot custom livre) */}
      {novaColunaAberta && (
        <NovaColunaModal
          onClose={() => setNovaColunaAberta(false)}
          onCriada={() => {
            setNovaColunaAberta(false);
            router.refresh();
          }}
        />
      )}

      {/* Modal da COLUNA (rótulo/cor/probabilidade + automações + agents) */}
      {colunaAberta && (
        <EtapaColunaModal
          key={colunaAberta}
          stage={colunaAberta}
          stageConfig={stageConfig}
          probabilidade={probabilidadePorEtapa[colunaAberta] ?? null}
          onClose={() => setColunaAberta(null)}
        />
      )}

      {/* Modal central super-completo (CEO) */}
      {selectedDeal && (
        <DealDetailModal
          key={selectedDeal.id}
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          stageConfig={stageConfig}
        />
      )}

      {/* Confirmação de exclusão de lead pelo card (soft delete em cascata) */}
      {dealParaExcluir && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !excluindoLead && setDealParaExcluir(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="excluir-deal-titulo"
            className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sys-red/10">
                <Trash2 className="h-4 w-4 text-sys-red" />
              </div>
              <div className="min-w-0">
                <h2 id="excluir-deal-titulo" className="text-sm font-semibold text-foreground">
                  Excluir {dealParaExcluir.athlete_name}?
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Exclui o lead inteiro: some do pipeline, das listas e de
                  todas as mensagens automáticas. Nada é apagado de verdade —
                  reversível pelo suporte.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDealParaExcluir(null)}
                disabled={excluindoLead}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const alvo = dealParaExcluir;
                  startExcluirLead(async () => {
                    const r = await excluirLeadPorDeal(alvo.id);
                    if (r.success) {
                      toast.success(`Lead ${alvo.athlete_name} excluído.`);
                      setDealParaExcluir(null);
                      router.refresh();
                    } else {
                      toast.error(r.error ?? "Erro ao excluir.");
                    }
                  });
                }}
                disabled={excluindoLead}
                className="rounded-lg bg-sys-red px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sys-red/90 disabled:opacity-60"
              >
                {excluindoLead ? "Excluindo…" : "Sim, excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
