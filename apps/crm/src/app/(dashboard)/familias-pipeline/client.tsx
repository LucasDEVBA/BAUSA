"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Loader2,
  Phone,
  Plane,
  ArrowLeftRight,
  UserPlus,
  Pencil,
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
import { PageHeader, StatCard, Button } from "@/components/ui";
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

const TEMP_DOT: Record<FamiliaPipelineCard["temperatura"], string> = {
  verde: "bg-sys-green",
  amarelo: "bg-sys-orange",
  vermelho: "bg-sys-red",
};

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
      className="group relative cursor-grab rounded-xl border border-border bg-card p-2.5 shadow-xs transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
    >
      {/* Acento delicado só quando o status pede atenção */}
      {card.status !== "satisfeita" && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-0 top-3 h-4 w-[3px] rounded-r-full",
            card.status === "crise" ? "bg-sys-red" : "bg-sys-orange",
          )}
        />
      )}

      {/* Indicador de "click para editar" */}
      <span className="pointer-events-none absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
        <Pencil aria-hidden className="h-3 w-3 text-primary" />
      </span>

      {/* Identidade: hierarquia por tipografia + sinais discretos */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold leading-tight text-foreground">
            {card.athlete_name}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {card.guardian_name}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <HealthBadge
            ansiedade={card.ansiedade}
            satisfacao={card.satisfacao}
            risco_percebido={card.risco_percebido}
            status={card.status}
            temperatura={card.temperatura}
            dias_sem_contato={card.dias_sem_contato}
          />
          <span
            title={`Temperatura: ${tempCfg.label}`}
            className={cn("h-2 w-2 rounded-full", TEMP_DOT[card.temperatura])}
          >
            <span className="sr-only">Temperatura {tempCfg.label}</span>
          </span>
        </div>
      </div>

      {/* Status + plano + esporte: texto muted, cor só em atenção/crise */}
      <p className="mt-1.5 flex min-w-0 items-center gap-1 text-[10px] leading-tight">
        {card.status === "satisfeita" ? (
          <span className="text-label-tertiary">{statusCfg.label}</span>
        ) : (
          <span
            className={cn(
              "flex items-center gap-0.5 font-medium",
              card.status === "crise" ? "text-sys-red" : "text-sys-orange",
            )}
          >
            <AlertTriangle aria-hidden className="h-2.5 w-2.5 flex-shrink-0" />
            {statusCfg.label}
          </span>
        )}
        <span className="truncate text-label-tertiary">
          · {card.plano}
          {card.esporte ? ` · ${card.esporte}` : ""}
        </span>
      </p>

      {/* Scores: neutros, cor apenas quando o valor pede atenção */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          Ansiedade{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              card.ansiedade >= 4 ? "text-sys-red" : "text-foreground/80",
            )}
          >
            {card.ansiedade}/5
          </span>
        </span>
        <span>
          Satisfação{" "}
          <span
            className={cn(
              "font-semibold tabular-nums",
              card.satisfacao <= 2 ? "text-sys-red" : "text-foreground/80",
            )}
          >
            {card.satisfacao}/5
          </span>
        </span>
      </div>

      {card.data_prevista_embarque && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Plane aria-hidden className="h-2.5 w-2.5 text-label-tertiary" />
          Embarque{" "}
          {new Date(card.data_prevista_embarque).toLocaleDateString("pt-BR")}
        </p>
      )}

      {/* Inatividade: texto direto, sem caixa */}
      {isInactive && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-sys-orange">
          <Bell aria-hidden className="h-2.5 w-2.5 flex-shrink-0" />
          {card.dias_sem_contato}d sem contato
        </p>
      )}

      {card.proximo_contato && (
        <p className="mt-2 flex items-center gap-1 border-t border-border/60 pt-1.5 text-[10px] text-label-tertiary">
          <Phone aria-hidden className="h-2.5 w-2.5" />
          Próximo:{" "}
          {new Date(card.proximo_contato).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })}
        </p>
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                "flex min-h-[360px] flex-col rounded-xl border border-border/70 bg-secondary/40 transition-colors",
                isHovering && "border-primary/40 bg-primary/5",
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
              {/* Cabeçalho sutil: rótulo + contagem tabular */}
              <div className="flex items-center justify-between gap-2 px-2.5 pt-2">
                <span className="truncate text-[11px] font-semibold text-foreground">
                  {cfg.label}
                </span>
                <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-card px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {list.length}
                </span>
              </div>
              <p className="px-2.5 pb-1 pt-0.5 text-[10px] text-label-tertiary">
                Alerta: {cfg.alertDays} dia(s) sem contato
              </p>
              <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5 pt-0.5">
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
                  <div className="flex flex-1 items-center justify-center py-6">
                    <p className="text-[10px] text-muted-foreground">vazio</p>
                  </div>
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
