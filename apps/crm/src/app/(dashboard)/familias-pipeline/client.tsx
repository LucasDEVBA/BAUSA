"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Loader2,
  Phone,
  Plane,
  ArrowLeftRight,
  UserPlus,
  Pencil,
  Inbox,
  Users,
  Flame,
  CircleAlert,
  Clock,
} from "lucide-react";
import {
  JOURNEY_STAGE_CONFIG,
  FAMILY_STATUS_CONFIG,
  TEMPERATURE_CONFIG,
  type FamilyJourneyStage,
  type RiskDimension,
} from "@/types/family";
import { orderedStages, type JourneyConfigMap } from "@/lib/fases-familia";
import { moverFaseFamilia } from "@/lib/actions/experiencia";
import {
  FamilyDetailModal,
  type FamilyModalData,
} from "@/components/familias-shared/FamilyDetailModal";
import { NovaFamiliaModal } from "@/components/familias-shared/NovaFamiliaModal";
import { HealthBadge } from "@/components/familias-shared/HealthBadge";
import { FamiliasNav } from "@/components/familias/FamiliasNav";
import { PageHeader, StatCard, Button, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FamiliasPipelineFilters,
  emptyFamiliasFilters,
  type FamiliasFiltersState,
  type FamiliasView,
} from "./FamiliasPipelineFilters";
import { FamiliasPipelineTable } from "./FamiliasPipelineTable";

export interface FamiliaPipelineCard {
  id: string;
  atleta_id: string;
  deal_id: string | null;
  athlete_name: string;
  guardian_name: string;
  whatsapp: string;
  email: string | null;
  plano: string;
  esporte: string | null;
  fase: FamilyJourneyStage;
  status: "satisfeita" | "atencao" | "crise";
  temperatura: "verde" | "amarelo" | "vermelho";
  ansiedade: number;
  satisfacao: number;
  risco_percebido: number;
  tipos_risco: RiskDimension[];
  descricao_problema: string | null;
  acao_em_andamento: string | null;
  tipo_crise: string | null;
  nivel_crise: string | null;
  psicologa_acionada: boolean;
  dias_sem_contato: number | null;
  proximo_contato: string | null;
  data_ultimo_contato: string | null;
  data_prevista_embarque: string | null;
  nps_6meses: number | null;
  nps_enviado_at: string | null;
}

function PipelineCard({
  card,
  journeyConfig,
  onDragStart,
  onClick,
}: {
  card: FamiliaPipelineCard;
  journeyConfig: JourneyConfigMap;
  onDragStart: (id: string) => void;
  onClick: () => void;
}) {
  const statusCfg = FAMILY_STATUS_CONFIG[card.status];
  const tempCfg = TEMPERATURE_CONFIG[card.temperatura];
  const stageCfg = journeyConfig[card.fase];
  const isInactive =
    card.dias_sem_contato != null &&
    stageCfg.alertDays > 0 &&
    card.dias_sem_contato >= stageCfg.alertDays;

  return (
    <div
      draggable
      role="button"
      tabIndex={0}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", card.id);
        onDragStart(card.id);
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "group relative rounded-xl border bg-card p-3 cursor-grab active:cursor-grabbing transition-colors hover:border-primary/40",
        card.status === "crise"
          ? "border-sys-red/40"
          : card.status === "atencao"
            ? "border-sys-orange/30"
            : "border-border",
      )}
    >
      {/* Indicador de "click para editar" */}
      <span className="pointer-events-none absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <Pencil className="h-3 w-3 text-primary" />
      </span>

      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">
            {card.athlete_name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {card.guardian_name}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <HealthBadge
            ansiedade={card.ansiedade}
            satisfacao={card.satisfacao}
            risco_percebido={card.risco_percebido}
            status={card.status}
            temperatura={card.temperatura}
            dias_sem_contato={card.dias_sem_contato}
          />
          <span className="text-base">{tempCfg.icon}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 mb-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold",
            statusCfg.bg,
            statusCfg.color,
          )}
        >
          {statusCfg.label}
        </span>
        <span className="inline-flex rounded-md bg-background border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground">
          {card.plano}
        </span>
        {card.esporte && (
          <span className="inline-flex rounded-md bg-background border border-border px-1.5 py-0.5 text-[9px] text-muted-foreground truncate max-w-[80px]">
            {card.esporte}
          </span>
        )}
      </div>

      <div className="space-y-1 text-[10px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Ansiedade</span>
          <span
            className={cn(
              "font-semibold",
              card.ansiedade >= 4 ? "text-sys-red" : "text-foreground/80",
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
              card.satisfacao <= 2 ? "text-sys-red" : "text-foreground/80",
            )}
          >
            {card.satisfacao}/5
          </span>
        </div>
        {card.data_prevista_embarque && (
          <div className="flex items-center gap-1 mt-1.5">
            <Plane className="h-3 w-3 text-sys-blue" />
            <span className="text-sys-blue">
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
              ? "bg-sys-red/10 border border-sys-red/30 text-sys-red"
              : "bg-sys-orange/10 border border-sys-orange/30 text-sys-orange",
          )}
        >
          <AlertTriangle className="h-2.5 w-2.5" />
          {card.status === "crise"
            ? "Crise"
            : `${card.dias_sem_contato}d sem contato`}
        </div>
      )}

      {card.proximo_contato && (
        <div className="mt-2 flex items-center gap-1 text-[9px] text-label-tertiary">
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

function cardToModalData(card: FamiliaPipelineCard): FamilyModalData {
  return {
    experiencia_id: card.id,
    atleta_id: card.atleta_id,
    athlete_name: card.athlete_name,
    guardian_name: card.guardian_name,
    whatsapp: card.whatsapp,
    whatsapp_atleta: null,
    whatsapp_responsavel: card.whatsapp || null,
    email: card.email ?? undefined,
    email_responsavel: null,
    plano: card.plano,
    esporte: card.esporte,
    fase: card.fase,
    status: card.status,
    temperatura: card.temperatura,
    ansiedade: card.ansiedade,
    satisfacao: card.satisfacao,
    risco_percebido: card.risco_percebido,
    tipos_risco: card.tipos_risco,
    descricao_problema: card.descricao_problema,
    acao_em_andamento: card.acao_em_andamento,
    tipo_crise: card.tipo_crise,
    nivel_crise: card.nivel_crise,
    psicologa_acionada: card.psicologa_acionada,
    data_prevista_embarque: card.data_prevista_embarque,
    proximo_contato: card.proximo_contato,
    data_ultimo_contato: card.data_ultimo_contato,
    dias_sem_contato: card.dias_sem_contato,
    nps_6meses: card.nps_6meses,
    nps_enviado_at: card.nps_enviado_at,
  };
}

export function FamiliasPipelineClient({
  cards: initialCards,
  journeyConfig = JOURNEY_STAGE_CONFIG,
}: {
  cards: FamiliaPipelineCard[];
  journeyConfig?: JourneyConfigMap;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cards, setCards] = useState<FamiliaPipelineCard[]>(initialCards);
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverFase, setHoverFase] = useState<FamilyJourneyStage | null>(null);
  const [selectedCard, setSelectedCard] = useState<FamiliaPipelineCard | null>(
    null,
  );
  const [showNovaModal, setShowNovaModal] = useState(false);
  const [didDrag, setDidDrag] = useState(false);
  const [view, setView] = useState<FamiliasView>("kanban");
  const [filters, setFilters] = useState<FamiliasFiltersState>(
    emptyFamiliasFilters(),
  );

  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  // Deep-link: abre a modal da família ao chegar com ?openExperiencia / ?deal /
  // ?atleta na URL (vindo de notificações ou da tela gerencial de famílias).
  // Client-only (window.location) — sem Suspense e sem reabrir após limpar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const openExp = params.get("openExperiencia");
    const openDeal = params.get("deal");
    const openAtleta = params.get("atleta");
    if (!openExp && !openDeal && !openAtleta) return;
    const match = cards.find(
      (c) =>
        (openExp && c.id === openExp) ||
        (openDeal && c.deal_id === openDeal) ||
        (openAtleta && c.atleta_id === openAtleta),
    );
    if (match) {
      setSelectedCard(match);
    } else {
      toast.error("Família não encontrada nesta visão.");
    }
    // Remove o param sem navegar (não reabre em refresh nem polui o histórico),
    // inclusive quando não há match — a URL não fica com param preso.
    window.history.replaceState(null, "", window.location.pathname);
  }, [cards]);

  const filteredCards = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return cards.filter((c) => {
      if (filters.status !== "TODOS" && c.status !== filters.status) return false;
      if (filters.temperatura !== "TODAS" && c.temperatura !== filters.temperatura)
        return false;
      if (filters.semContato && (c.dias_sem_contato ?? 0) <= 15) return false;
      if (search) {
        const hay = `${c.athlete_name} ${c.guardian_name} ${c.plano} ${c.esporte ?? ""}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }, [cards, filters]);

  const kpis = useMemo(() => {
    const total = initialCards.length;
    const crise = initialCards.filter((c) => c.status === "crise").length;
    const atencao = initialCards.filter((c) => c.status === "atencao").length;
    const semContato = initialCards.filter(
      (c) => (c.dias_sem_contato ?? 0) > 30,
    ).length;
    return { total, crise, atencao, semContato };
  }, [initialCards]);

  const handleDrop = (fase: FamilyJourneyStage) => {
    const id = dragId;
    setDragId(null);
    setHoverFase(null);
    if (!id) return;
    const card = cards.find((c) => c.id === id);
    if (!card || card.fase === fase) return;

    setDidDrag(true);
    const previousFase = card.fase;
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, fase } : c)),
    );

    startTransition(async () => {
      const result = await moverFaseFamilia(id, fase);
      if (result.success) {
        toast.success(`Movida para ${journeyConfig[fase].label}`, {
          description: card.athlete_name,
        });
        router.refresh();
      } else {
        setCards((prev) =>
          prev.map((c) => (c.id === id ? { ...c, fase: previousFase } : c)),
        );
        toast.error(result.error ?? "Falha ao mover família", {
          description: card.athlete_name,
          duration: 8000,
        });
      }
      // Reset flag de drag após um tick
      setTimeout(() => setDidDrag(false), 50);
    });
  };

  const handleCardClick = (card: FamiliaPipelineCard) => {
    // Se drag terminou recentemente, ignora o click (HTML5 drag dispara click)
    if (didDrag) return;
    setSelectedCard(card);
  };

  const stages = orderedStages(journeyConfig);

  const byFase = stages.reduce(
    (acc, fase) => {
      acc[fase] = filteredCards.filter((c) => c.fase === fase);
      return acc;
    },
    {} as Record<FamilyJourneyStage, FamiliaPipelineCard[]>,
  );

  return (
    <div className="space-y-5">
      <PageHeader dense
        eyebrow="Famílias"
        title="Pipeline da Família"
        description="Arraste cards entre fases em qualquer direção. Clique em um card para editar."
        actions={
          <>
            <Button onClick={() => setShowNovaModal(true)}>
              <UserPlus className="h-4 w-4" />
              Nova Família
            </Button>
            <Button variant="secondary" asChild>
              <a href="/familias-crm">
                <ArrowLeftRight className="h-4 w-4" />
                Voltar à lista
              </a>
            </Button>
          </>
        }
      />

      <FamiliasNav />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total de famílias"
          value={kpis.total}
          icon={Users}
          accent="brand"
        />
        <StatCard
          label="Em crise"
          value={kpis.crise}
          icon={Flame}
          accent="red"
        />
        <StatCard
          label="Em atenção"
          value={kpis.atencao}
          icon={CircleAlert}
          accent="orange"
        />
        <StatCard
          label="Sem contato > 30d"
          value={kpis.semContato}
          icon={Clock}
          accent="blue"
        />
      </div>

      {isPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Atualizando...
        </div>
      )}

      <FamiliasPipelineFilters
        view={view}
        onViewChange={setView}
        filters={filters}
        onFiltersChange={setFilters}
        total={cards.length}
        filtered={filteredCards.length}
      />

      {view === "tabela" ? (
        <FamiliasPipelineTable
          cards={filteredCards}
          journeyConfig={journeyConfig}
          onCardClick={(c) => {
            const full = cards.find((x) => x.id === c.id);
            if (full) setSelectedCard(full);
          }}
        />
      ) : (
      <div className="grid grid-flow-col auto-cols-[260px] gap-3 overflow-x-auto pb-3">
        {stages.map((fase) => {
          const cfg = journeyConfig[fase];
          const list = byFase[fase];
          const isHovering = hoverFase === fase;
          return (
            <div
              key={fase}
              className={cn(
                "liquid-glass rounded-xl p-3 transition-all flex flex-col min-h-[360px]",
                isHovering
                  ? "border-primary/50"
                  : "",
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
                <p className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
                  {cfg.label}
                </p>
                <span className="rounded-full bg-secondary px-2 text-[10px] font-bold text-muted-foreground">
                  {list.length}
                </span>
              </div>
              <p className="mb-3 text-[10px] text-label-tertiary">
                Alerta: {cfg.alertDays} dia(s) sem contato
              </p>
              <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                {list.map((c) => (
                  <PipelineCard
                    key={c.id}
                    card={c}
                    journeyConfig={journeyConfig}
                    onDragStart={(id) => setDragId(id)}
                    onClick={() => handleCardClick(c)}
                  />
                ))}
                {list.length === 0 && (
                  <EmptyState
                    icon={Inbox}
                    title="Vazio"
                    className="rounded-xl border border-dashed border-border px-3 py-6"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {selectedCard && (
        <FamilyDetailModal
          family={cardToModalData(selectedCard)}
          journeyConfig={journeyConfig}
          onClose={() => setSelectedCard(null)}
        />
      )}

      <NovaFamiliaModal
        open={showNovaModal}
        journeyConfig={journeyConfig}
        onClose={() => setShowNovaModal(false)}
      />
    </div>
  );
}
