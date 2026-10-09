"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { PIPELINE_STAGE_ORDER, type Deal, type DealStage } from "@/types/deal";
import {
  isDealStage,
  orderedKanbanStages,
  type DealStageConfigMap,
} from "@/lib/etapas-deal";
import { PipelineColumn } from "./PipelineColumn";
import { DealCard } from "./DealCard";
import { DealDetailModal, type DealDetailSection } from "./DealDetailModal";
import { CustomizarValorModal } from "./CustomizarValorModal";
import { explicarOrigemValor } from "@/lib/valor-deal";
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
import {
  PlanoEscolhidoModal,
  type PlanoEscolhidoResultado,
} from "@/components/financeiro/contrato/PlanoEscolhidoModal";
import { deveAbrirShortlist, isRetrocessoEtapa } from "@/lib/etapas-ordem";
import { colunaPedePlano } from "@/lib/plano-integracao";
import { moverDeal, type StructuredLossData } from "@/lib/actions/deals";
import { GAMIFICACAO_TIPO_LABEL } from "@/lib/gamificacao-labels";
import { celebrar } from "@/lib/gamificacao-store";
import { reordenarEtapasPipeline } from "@/lib/actions/etapas-pipeline";
import { EtapaColunaModal } from "./EtapaColunaModal";
import { AprovacaoColumn } from "./AprovacaoColumn";
import { FriosColumn } from "./FriosColumn";
import { IncompletosColumn } from "./IncompletosColumn";
import { NovaColunaModal } from "./NovaColunaModal";
import { AprovacaoLeadsModal } from "@/components/leads/AprovacoesLeads";
import { DossieLeadView, useDossieLead } from "@/components/leads/DossieLead";
import {
  listarLeadsFriosCards,
  listarLeadsIncompletosCards,
  listarLeadsPendentesCards,
  type LeadFrioCard,
  type LeadIncompletoCard,
  type LeadPendenteCard,
} from "@/lib/actions/leads";
import { type CadastroEncontrado } from "@/lib/actions/leads-busca";
import { normalizarTermoBusca, type PaginaRevisao } from "@/lib/revisao-leads";
import { ForaDoPipelineFaixa, type ModoRevisao, type MotivoForaDaTela } from "./ForaDoPipelineFaixa";
import { useBuscaCadastros } from "./useBuscaCadastros";
import { usePaginaRevisao } from "./usePaginaRevisao";
import { labelEtapa, type MoveDealAction } from "@/lib/move-deal-result";
import { excluirLeadPorDeal } from "@/lib/actions/leads-excluir";
import { Plus, Trash2 } from "lucide-react";
import type { StatusDeal } from "@/types/crm";
import { toast } from "sonner";

interface PipelineBoardProps {
  deals: Deal[];
  currentUserId?: string;
  /** Config MESCLADA das colunas (overrides + regras) — fonte única do board,
   *  do editor do deal e do dossiê. Obrigatória (nada de default estático). */
  stageConfig: DealStageConfigMap;
  /** Probabilidade por etapa (exibida/editável no modal da coluna). */
  probabilidadePorEtapa?: Record<string, number>;
  /** Só nível CEO edita colunas (o board é read-only para os demais). */
  podeEditarColunas?: boolean;
  /** Só nível CEO edita o valor do deal pelo card (customizarValorDeal exige ceo). */
  podeEditarValor?: boolean;
  /** Leads na fila de aprovação — primeira coluna do board (sem deal ainda). */
  leadsPendentes?: PaginaRevisao<LeadPendenteCard>;
  /** FRIOs recentes p/ revisão — coluna própria, read-only + resgate. */
  leadsFrios?: PaginaRevisao<LeadFrioCard>;
  /** INCOMPLETOs recentes p/ revisão — coluna própria, read-only + resgate. */
  leadsIncompletos?: PaginaRevisao<LeadIncompletoCard>;
}

const PAGINA_VAZIA = { itens: [], total: 0, erro: null };

/**
 * Busca local sem acento e por palavras (T13): "joao silva" acha
 * "João da Silva". Mesma normalização da busca no servidor.
 */
function casaBusca(termoNormalizado: string, ...campos: Array<string | null | undefined>): boolean {
  if (!termoNormalizado) return true;
  const hay = normalizarTermoBusca(campos.filter(Boolean).join(" "));
  return termoNormalizado.split(" ").every((t) => hay.includes(t));
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
  /** Destino pede o plano (T10): a justificativa vem ANTES do modal do plano. */
  pedirPlanoDepois?: boolean;
};

type GanhoPendente = { atletaId: string; athleteName: string };

/** Card solto numa coluna que pede o plano (T10): o move espera a escolha. */
type PlanoPendente = {
  dealId: string;
  novaEtapa: StatusDeal;
  fromStage: DealStage;
  athleteName: string;
  /** Justificativa do retrocesso já coletada (arraste para trás). */
  motivo?: string;
};

function applyFilters(
  deals: Deal[],
  f: PipelineFiltersState,
  currentUserId?: string,
): Deal[] {
  const search = normalizarTermoBusca(f.search);
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
    if (!casaBusca(search, d.athlete_name, d.guardian_name, d.esporte, d.email, d.guardian_email)) return false;
    return true;
  });
}

export function PipelineBoard({
  deals: initialDeals,
  currentUserId,
  stageConfig,
  probabilidadePorEtapa = {},
  podeEditarColunas = false,
  podeEditarValor = false,
  leadsPendentes = PAGINA_VAZIA,
  leadsFrios = PAGINA_VAZIA,
  leadsIncompletos = PAGINA_VAZIA,
}: PipelineBoardProps) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  // O deal aberto no modal é DERIVADO por id (não uma cópia em estado): assim
  // customizar o valor (router.refresh → initialDeals novos) repinta o modal
  // na hora, sem fechar e reabrir (2026-09-11).
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  // Seção em que o modal abre (clique no valor de deal COM contrato → aba do
  // contrato). Clique comum no card abre na Visão Executiva (padrão).
  const [secaoInicialDeal, setSecaoInicialDeal] = useState<DealDetailSection | undefined>(undefined);
  const setSelectedDeal = (deal: Deal | null, secao?: DealDetailSection) => {
    setSecaoInicialDeal(secao);
    setSelectedDealId(deal?.id ?? null);
  };
  // Valor em edição pelo card (T3) — derivado por id, como o deal aberto.
  const [valorEmEdicaoId, setValorEmEdicaoId] = useState<string | null>(null);
  const abrirValorDoDeal = (deal: Deal) => {
    if (deal.valor_origem === "contratado") {
      setSelectedDeal(deal, "financeiro");
      return;
    }
    setValorEmEdicaoId(deal.id);
  };
  // Reconcilia com o servidor: quando a page revalida (ex.: vincular reunião
  // move o deal de etapa), a verdade do servidor vence a cópia local — sem
  // isto o card fica na coluna antiga até um F5 (CEO reportou, 2026-08-26).
  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  // Excluir lead direto do card (mesmo padrão da tabela de /leads):
  // confirmação fora do card, setter estável dentro do render.
  const [dealParaExcluir, setDealParaExcluir] = useState<Deal | null>(null);
  const [excluindoLead, startExcluirLead] = useTransition();
  const cancelarExclusaoRef = useRef<HTMLButtonElement>(null);
  const confirmarExclusaoRef = useRef<HTMLButtonElement>(null);
  // Esc e Tab no WINDOW: com o foco fora do diálogo (clique no texto, botão
  // desabilitado durante a exclusão) o onKeyDown do próprio diálogo não
  // dispara — o Esc morria e o Tab andava pelo board atrás do overlay.
  useEffect(() => {
    if (!dealParaExcluir) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!excluindoLead) setDealParaExcluir(null);
        return;
      }
      if (e.key !== "Tab") return;
      e.preventDefault();
      const botoes = [cancelarExclusaoRef.current, confirmarExclusaoRef.current].filter(
        (b): b is HTMLButtonElement => b !== null && !b.disabled,
      );
      if (botoes.length === 0) return;
      const atual = botoes.findIndex((b) => b === document.activeElement);
      const proximo = e.shiftKey ? (atual <= 0 ? botoes.length - 1 : atual - 1) : (atual + 1) % botoes.length;
      botoes[proximo].focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dealParaExcluir, excluindoLead]);
  // Exclusão que falha mantém o diálogo aberto: o botão clicado ficou
  // desabilitado e o foco caiu no body — devolve ao Cancelar.
  useEffect(() => {
    if (dealParaExcluir && !excluindoLead) cancelarExclusaoRef.current?.focus();
  }, [dealParaExcluir, excluindoLead]);
  // Ganho fechado: a shortlist de escolas é o 1º entregável da jornada da
  // família, então o modal abre logo após o move (que já aconteceu).
  const [ganho, setGanho] = useState<GanhoPendente | null>(null);
  const [planoPendente, setPlanoPendente] = useState<PlanoPendente | null>(null);
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

  // Colunas de revisão PAGINADAS (T7): total real do banco + "Mostrar mais".
  const pendentes = usePaginaRevisao(
    leadsPendentes,
    (offset, limite) => listarLeadsPendentesCards({ offset, limite }),
    false,
  );
  const frios = usePaginaRevisao(leadsFrios, (offset, limite) => listarLeadsFriosCards({ offset, limite }), true);
  const incompletos = usePaginaRevisao(
    leadsIncompletos,
    (offset, limite) => listarLeadsIncompletosCards({ offset, limite }),
    true,
  );

  // Filtros também valem para as colunas de revisão (pedido do CEO,
  // 2026-09-23): busca casa por nome do atleta, do RESPONSÁVEL (T13),
  // posição e cidade, sem acento; classificação casa com a classe do card
  // (Frios = FRIO, Incompletos = nenhuma das três); plano e "com atraso" são
  // conceitos de DEAL — qualquer um ativo esvazia as revisões. Coluna sem
  // card filtrado simplesmente não renderiza.
  const applyFiltersLeadCard = (
    card: { athlete_name: string; guardian_name: string | null; position: string | null; city_state: string | null },
    classe: string | null,
    f: PipelineFiltersState,
  ): boolean => {
    if (f.plano !== "TODOS" || f.comAtraso) return false;
    if (f.classificacao !== "TODAS" && classe !== f.classificacao) return false;
    return casaBusca(normalizarTermoBusca(f.search), card.athlete_name, card.guardian_name, card.position, card.city_state);
  };
  const pendentesFiltrados = useMemo(
    () => pendentes.itens.filter((l) => applyFiltersLeadCard(l, l.qualification_classification, filters)),
    [pendentes.itens, filters],
  );
  const friosFiltrados = useMemo(
    () => frios.itens.filter((l) => applyFiltersLeadCard(l, "FRIO", filters)),
    [frios.itens, filters],
  );
  const incompletosFiltrados = useMemo(
    () => incompletos.itens.filter((l) => applyFiltersLeadCard(l, "INCOMPLETO", filters)),
    [incompletos.itens, filters],
  );

  // Busca de apoio no SERVIDOR (T13): acha quem não está na tela e diz onde
  // está. Só CEO/CTO (podeEditarColunas = nível CEO); a action também barra.
  const busca = useBuscaCadastros(filters.search, podeEditarColunas);
  const dossie = useDossieLead();
  const idsVisiveis = useMemo(() => {
    // Tabela mostra todos os deals filtrados; o Kanban só as etapas do board
    // (+ projeto_futuro na seção Leads Futuros). Revisões existem só no Kanban.
    const etapasNaTela = new Set<string>([...PIPELINE_STAGE_ORDER, "projeto_futuro"]);
    const deals = new Set(
      filteredDeals.filter((d) => view === "tabela" || etapasNaTela.has(d.stage)).map((d) => d.id),
    );
    const cards = new Set(
      view === "kanban"
        ? [...pendentesFiltrados, ...friosFiltrados, ...incompletosFiltrados].map((l) => l.id)
        : [],
    );
    return { deals, cards };
  }, [view, filteredDeals, pendentesFiltrados, friosFiltrados, incompletosFiltrados]);
  const estaVisivel = (item: CadastroEncontrado): boolean =>
    (item.deal_id !== null && idsVisiveis.deals.has(item.deal_id)) || idsVisiveis.cards.has(item.id);
  // Card de revisão fora da tela: a faixa diz POR QUÊ (não carregado ≠ filtrado ≠ visão Tabela).
  const idsCarregados = useMemo(
    () => new Set([...pendentes.itens, ...frios.itens, ...incompletos.itens].map((l) => l.id)),
    [pendentes.itens, frios.itens, incompletos.itens],
  );
  const motivoForaDaTela = (item: CadastroEncontrado): MotivoForaDaTela =>
    view !== "kanban" ? "so_kanban" : idsCarregados.has(item.id) ? "filtrado" : "nao_carregado";
  const rotuloEtapa = (etapa: string): string =>
    isDealStage(etapa) ? stageConfig[etapa].label : labelEtapa(etapa);
  const abrirRevisao = (modo: ModoRevisao, leadId: string, aoDecidir?: () => void) => {
    setRevisaoForaDaColuna(aoDecidir ? { id: leadId, aoDecidir } : null);
    if (modo === "aprovacao") setLeadAprovacao(leadId);
    else if (modo === "frios") setFrioAberto(leadId);
    else setIncompletoAberto(leadId);
  };
  const errosRevisao = [pendentes.erro, frios.erro, incompletos.erro].filter((e): e is string => e !== null);

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null;
  const selectedDeal = selectedDealId
    ? (deals.find((d) => d.id === selectedDealId) ?? null)
    : null;
  const valorEmEdicao = valorEmEdicaoId
    ? (deals.find((d) => d.id === valorEmEdicaoId) ?? null)
    : null;

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
  const [frioAberto, setFrioAberto] = useState<string | null>(null);
  const [incompletoAberto, setIncompletoAberto] = useState<string | null>(null);
  // Lead aberto pela faixa FORA da coluna (FRIO/INCOMPLETO além da janela):
  // decidido no modal, a faixa atualiza — tirar "da coluna" descontaria do
  // total um lead que nunca contou nela.
  const [revisaoForaDaColuna, setRevisaoForaDaColuna] = useState<{ id: string; aoDecidir: () => void } | null>(null);
  const [muitoCedoAberto, setMuitoCedoAberto] = useState<string | null>(null);
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
        // T17: nome da COLUNA (rótulo do CEO), nunca o código interno.
        toast.success(`Movido para ${labelEtapa(novaEtapa, stageConfig)}`, {
          description: result.proximaAcao
            ? `${deal.athlete_name} · Próxima ação: ${result.proximaAcao}`
            : deal.athlete_name,
        });
        celebrar(result.gamificacao, GAMIFICACAO_TIPO_LABEL.deal_avancado);
        router.refresh();
        // Ganho: puxa a escolha das escolas na sequência. Não bloqueia o
        // move — se o CEO fechar, monta a shortlist depois em Matching.
        if (deveAbrirShortlist(previousStage, novaEtapa, stageConfig) && deal.atleta_id) {
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

    // T10: coluna que pede o plano → o modal do financeiro decide (criar /
    // escolher / manter ou alterar) ANTES de mover. Sem update otimista:
    // cancelar deixa o card onde estava.
    if (colunaPedePlano(stageConfig[newStage])) {
      // Para trás: a justificativa vem PRIMEIRO (como no editor lateral) —
      // senão o plano era gravado e, ao cancelar o motivo, o card não movia.
      if (isRetrocessoEtapa(deal.stage, newStage, stageConfig)) {
        setPendingMove({
          dealId,
          novaEtapa: newStage as StatusDeal,
          fromStage: deal.stage as StatusDeal,
          athleteName: deal.athlete_name,
          kind: "retrocesso",
          pedirPlanoDepois: true,
        });
        return;
      }
      setPlanoPendente({
        dealId,
        novaEtapa: newStage as StatusDeal,
        fromStage: deal.stage,
        athleteName: deal.athlete_name,
      });
      return;
    }

    performMove(dealId, newStage as StatusDeal, deal.stage);
  };

  const concluirPlanoPendente = (resultado: PlanoEscolhidoResultado) => {
    const pendente = planoPendente;
    setPlanoPendente(null);
    if (!pendente) return;
    // O sinal confirmado agora já levou o deal a "Sinal pago" no servidor: é
    // para lá que o card volta se o move falhar.
    const origemReal: DealStage = resultado.movidoParaSinalPago ? "sinal_pago" : pendente.fromStage;
    performMove(
      pendente.dealId,
      pendente.novaEtapa,
      origemReal,
      pendente.motivo !== undefined ? { motivo: pendente.motivo } : undefined,
    );
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

      {podeEditarColunas && errosRevisao.length > 0 && (
        <p role="alert" className="mb-2 rounded-lg border border-sys-red/25 bg-sys-red/5 px-2.5 py-1.5 text-[11px] text-sys-red">
          Parte das colunas de revisão não carregou ({errosRevisao[0]}). Recarregue a página — nenhum lead foi alterado.
        </p>
      )}

      {/* Busca no servidor: quem não está na tela e por quê (T13) */}
      {podeEditarColunas && (
        <ForaDoPipelineFaixa
          estado={busca.estado}
          estaVisivel={estaVisivel}
          motivoForaDaTela={motivoForaDaTela}
          rotuloEtapa={rotuloEtapa}
          onAbrirDossie={(id) => void dossie.abrir(id)}
          onAbrirRevisao={abrirRevisao}
          onAtualizado={(item) => {
            // "Enviar p/ fila" pela faixa (ou decisão no modal de um lead fora
            // da janela): o card sai da coluna de revisão na hora (mesmo de
            // página não carregada — desconta do total); fora da coluna, só
            // refaz a busca e o board.
            if (item.local.tipo === "coluna_frios") frios.remover(item.id);
            else if (item.local.tipo === "coluna_incompletos") incompletos.remover(item.id);
            busca.recarregar();
            router.refresh();
          }}
          onTentarDeNovo={busca.recarregar}
        />
      )}

      {view === "kanban" ? (
        <DndContext
          id="pipeline-board"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-4">
            {/* Fila de aprovação: primeira coluna, antes de qualquer etapa —
                o lead só vira deal (coluna seguinte) depois do OK do CEO. */}
            {podeEditarColunas && pendentesFiltrados.length > 0 && (
              <AprovacaoColumn
                leads={pendentesFiltrados}
                total={pendentes.total}
                maisRestantes={Math.max(0, pendentes.total - pendentes.itens.length)}
                carregandoMais={pendentes.carregandoMais}
                onCarregarMais={pendentes.carregarMais}
                onLeadClick={setLeadAprovacao}
              />
            )}
            {/* Frios p/ revisão: visível, mas fora de métrica/automação/outreach */}
            {podeEditarColunas && friosFiltrados.length > 0 && (
              <FriosColumn
                leads={friosFiltrados}
                total={frios.total}
                maisRestantes={Math.max(0, frios.total - frios.itens.length)}
                carregandoMais={frios.carregandoMais}
                onCarregarMais={frios.carregarMais}
                onResgatado={(id) => {
                  frios.remover(id);
                  router.refresh();
                }}
                onLeadClick={setFrioAberto}
              />
            )}
            {/* Incompletos p/ revisão: dados obrigatórios ausentes (2026-09-23) */}
            {podeEditarColunas && incompletosFiltrados.length > 0 && (
              <IncompletosColumn
                leads={incompletosFiltrados}
                total={incompletos.total}
                maisRestantes={Math.max(0, incompletos.total - incompletos.itens.length)}
                carregandoMais={incompletos.carregandoMais}
                onCarregarMais={incompletos.carregarMais}
                onResgatado={(id) => {
                  incompletos.remover(id);
                  router.refresh();
                }}
                onLeadClick={setIncompletoAberto}
              />
            )}
            {visibleStages.map((stage) => (
              <PipelineColumn
                key={stage}
                stage={stage}
                deals={dealsByStage[stage] ?? []}
                onDealClick={(deal) =>
                  // Card estacionado por timing: clique abre o dossiê de
                  // revisão (dados + conversa + e-mail), como nos Frios.
                  // O deal completo continua acessível na visão de tabela.
                  stage === "aguardando_timing" &&
                  deal.timing_status === "muito_cedo" &&
                  deal.form_submission_id
                    ? setMuitoCedoAberto(deal.form_submission_id)
                    : setSelectedDeal(deal)
                }
                stageConfig={stageConfig}
                onHeaderClick={podeEditarColunas ? setColunaAberta : undefined}
                onColumnDragStart={podeEditarColunas ? setArrastandoColuna : undefined}
                onColumnDrop={podeEditarColunas ? soltarColuna : undefined}
                onColumnDragEnd={() => setArrastandoColuna(null)}
                arrastandoColuna={arrastandoColuna}
                sort={sortMap[stage] ?? DEFAULT_PIPELINE_SORT}
                onSortChange={handleColumnSortChange}
                onExcluirDeal={podeEditarColunas ? setDealParaExcluir : undefined}
                onValorClick={podeEditarValor ? abrirValorDoDeal : undefined}
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
        stageConfig={stageConfig}
        onCancel={() => setPendingMove(null)}
        onConfirm={(motivo) => {
          if (!pendingMove) return;
          const previousStage = pendingMove.fromStage as DealStage;
          const move = pendingMove;
          setPendingMove(null);
          if (move.pedirPlanoDepois) {
            setPlanoPendente({
              dealId: move.dealId,
              novaEtapa: move.novaEtapa,
              fromStage: previousStage,
              athleteName: move.athleteName,
              motivo,
            });
            return;
          }
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

      {/* Escolha do plano antes de entrar numa coluna que pede plano (T10) */}
      {planoPendente && (
        <PlanoEscolhidoModal
          dealId={planoPendente.dealId}
          athleteName={planoPendente.athleteName}
          origem="mover_coluna"
          destinoLabel={labelEtapa(planoPendente.novaEtapa, stageConfig)}
          onCancel={() => setPlanoPendente(null)}
          onConfirmed={concluirPlanoPendente}
        />
      )}

      {/* Shortlist de escolas logo após o ganho */}
      {ganho && (
        <GanhoEscolasModal
          atletaId={ganho.atletaId}
          athleteName={ganho.athleteName}
          onClose={() => setGanho(null)}
        />
      )}

      {/* Dossiê do lead FRIO (modal em modo frios: dados + conversa + e-mail) */}
      {frioAberto && (
        <AprovacaoLeadsModal
          modo="frios"
          stageConfig={stageConfig}
          leadIdInicial={frioAberto}
          onClose={() => {
            setFrioAberto(null);
            setRevisaoForaDaColuna(null);
          }}
          onDecidido={(id) => {
            if (revisaoForaDaColuna?.id === id) {
              revisaoForaDaColuna.aoDecidir();
              return;
            }
            // Decidido no modal sai da coluna mesmo se veio do "Mostrar mais";
            // a faixa refaz a busca (senão oferece ação sobre lead já decidido).
            frios.remover(id);
            busca.recarregar();
            router.refresh();
          }}
        />
      )}

      {/* Dossiê do lead INCOMPLETO (modal em modo incompletos) */}
      {incompletoAberto && (
        <AprovacaoLeadsModal
          modo="incompletos"
          stageConfig={stageConfig}
          leadIdInicial={incompletoAberto}
          onClose={() => {
            setIncompletoAberto(null);
            setRevisaoForaDaColuna(null);
          }}
          onDecidido={(id) => {
            if (revisaoForaDaColuna?.id === id) {
              revisaoForaDaColuna.aoDecidir();
              return;
            }
            incompletos.remover(id);
            busca.recarregar();
            router.refresh();
          }}
        />
      )}

      {/* Dossiê do lead MUITO CEDO (card da coluna Aguardando timing) */}
      {muitoCedoAberto && (
        <AprovacaoLeadsModal
          modo="muito_cedo"
          stageConfig={stageConfig}
          leadIdInicial={muitoCedoAberto}
          onClose={() => setMuitoCedoAberto(null)}
          onDecidido={() => {
            busca.recarregar();
            router.refresh();
          }}
        />
      )}

      {/* Fila de aprovação aberta pelo card da primeira coluna */}
      {leadAprovacao && (
        <AprovacaoLeadsModal
          stageConfig={stageConfig}
          leadIdInicial={leadAprovacao}
          onClose={() => setLeadAprovacao(null)}
          onDecidido={(id) => {
            pendentes.remover(id);
            busca.recarregar();
            router.refresh();
          }}
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

      {/* Dossiê aberto pela faixa "Fora do pipeline" (lead ou deal) — o
          editor do deal usa a MESMA config de colunas do board. */}
      <DossieLeadView
        estado={dossie.estado}
        stageConfig={stageConfig}
        podeEditarValor={podeEditarValor}
        onClose={() => {
          // O dossiê tem ações (mover etapa, aprovar…): a faixa não pode ficar velha.
          dossie.fechar();
          busca.recarregar();
        }}
      />

      {/* Modal central super-completo (CEO) */}
      {selectedDeal && (
        <DealDetailModal
          key={selectedDeal.id}
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
          stageConfig={stageConfig}
          initialSection={secaoInicialDeal}
          podeEditarValor={podeEditarValor}
        />
      )}

      {/* Valor do deal direto do card (T3): estimado/negociado → customização
          com justificativa (Regra 3). Contrato → recusa e abre a aba dele. */}
      {valorEmEdicao && (
        <CustomizarValorModal
          key={valorEmEdicao.id}
          dealId={valorEmEdicao.id}
          athleteName={valorEmEdicao.athlete_name}
          valorAtual={valorEmEdicao.deal_value_brl}
          jaCustomizado={valorEmEdicao.flag_valores_customizados}
          origem={valorEmEdicao.valor_origem}
          explicacaoOrigem={explicarOrigemValor(valorEmEdicao)}
          onClose={() => setValorEmEdicaoId(null)}
          onTemContrato={() => {
            setValorEmEdicaoId(null);
            setSelectedDeal(valorEmEdicao, "financeiro");
          }}
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
            aria-describedby="excluir-deal-descricao"
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
                <p id="excluir-deal-descricao" className="mt-1 text-xs text-muted-foreground">
                  Exclui o lead inteiro: some do pipeline, das listas e de
                  todas as mensagens automáticas. Tarefas abertas são
                  canceladas e grupos de WhatsApp desvinculados (a conversa
                  fica). Nada é apagado de verdade — reversível pelo suporte.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                ref={cancelarExclusaoRef}
                autoFocus
                onClick={() => setDealParaExcluir(null)}
                disabled={excluindoLead}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                ref={confirmarExclusaoRef}
                onClick={() => {
                  const alvo = dealParaExcluir;
                  startExcluirLead(async () => {
                    const r = await excluirLeadPorDeal(alvo.id);
                    // Falha = NADA mudou (função atômica): modal aberto, card fica.
                    if (!r.success) {
                      toast.error(r.error);
                      return;
                    }
                    // O card só sai com a exclusão do deal CONFIRMADA pelo banco.
                    if (r.dealAlvoExcluido !== true) {
                      toast.error("A exclusão não confirmou a saída deste deal — o card continua. Recarregue a página e tente de novo.");
                      router.refresh();
                      return;
                    }
                    setDeals((prev) => prev.filter((d) => d.id !== alvo.id));
                    setDealParaExcluir(null);
                    toast.success(
                      r.jaExcluido
                        ? `Exclusão de ${alvo.athlete_name} concluída.`
                        : `Lead ${alvo.athlete_name} excluído.`,
                    );
                    if (r.aviso) toast.warning(r.aviso);
                    router.refresh();
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
