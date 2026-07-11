"use client";

import { useState, useTransition } from "react";
import {
  Users,
  Search,
  Phone,
  Briefcase,
  AlertTriangle,
  Target,
  Loader2,
  UsersRound,
  Wallet,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ETAPA_LABELS } from "@/types/crm";
import { getFamilyModalData } from "@/lib/actions/experiencia";
import {
  FamilyDetailModal,
  type FamilyModalData,
} from "@/components/familias-shared/FamilyDetailModal";
import { toast } from "sonner";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatCard,
  Input,
} from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { FamiliasNav } from "@/components/familias/FamiliasNav";
import { JOURNEY_STAGE_CONFIG } from "@/types/family";
import {
  isFamilyJourneyStage,
  type JourneyConfigMap,
} from "@/lib/fases-familia";
import type { FamiliaConsolidada } from "./page";

interface FamiliasConsolidadasClientProps {
  familias: FamiliaConsolidada[];
  /** Config das fases (rótulo configurado pelo CEO). Default: estático. */
  journeyConfig?: JourneyConfigMap;
}

const CLASSIFICATION_TONE: Record<string, BadgeTone> = {
  QUENTE: "green",
  MORNO: "orange",
  FRIO: "blue",
};

const STATUS_BADGE: Record<string, { label: string; tone: BadgeTone }> = {
  satisfeita: { label: "Satisfeita", tone: "green" },
  atencao: { label: "Atenção", tone: "orange" },
  crise: { label: "Crise", tone: "red" },
};

const TABLE_HEADERS = [
  { label: "Atleta", className: "" },
  { label: "Classe", className: "" },
  { label: "Fase", className: "" },
  { label: "Status", className: "" },
  { label: "Deal", className: "" },
  { label: "Score", className: "text-right" },
  { label: "Valor", className: "text-right" },
] as const;

const TABLE_COL_COUNT = TABLE_HEADERS.length + 1; // + coluna de ação

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export function FamiliasConsolidadasClient({
  familias,
  journeyConfig = JOURNEY_STAGE_CONFIG,
}: FamiliasConsolidadasClientProps) {
  const faseLabel = (fase: string): string =>
    isFamilyJourneyStage(fase) ? journeyConfig[fase].label : fase;
  const [search, setSearch] = useState("");
  const [modalData, setModalData] = useState<FamilyModalData | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = familias.filter(
    (f) =>
      f.responsavel_nome.toLowerCase().includes(search.toLowerCase()) ||
      f.atletas.some((a) =>
        a.nome_completo.toLowerCase().includes(search.toLowerCase()),
      ),
  );

  const totalFamilias = familias.length;
  const totalAtletas = familias.reduce((s, f) => s + f.atletas.length, 0);
  const totalValor = familias.reduce((s, f) => s + f.valor_total, 0);
  const familiasComAlerta = familias.filter((f) =>
    f.atletas.some(
      (a) => a.status === "atencao" || a.status === "crise",
    ),
  );

  const handleAtletaClick = (experienciaId: string | null) => {
    if (!experienciaId) {
      toast.error("Atleta ainda não tem registro de experiência");
      return;
    }
    setLoadingId(experienciaId);
    startTransition(async () => {
      const data = await getFamilyModalData(experienciaId);
      setLoadingId(null);
      if (!data) {
        toast.error("Não foi possível carregar os dados da família");
        return;
      }
      setModalData(data);
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader dense
        eyebrow="Famílias"
        title="Visão Consolidada por Família"
        description="Famílias agrupadas por responsável (apenas em Admissão+). Clique num atleta para editar."
      />

      <FamiliasNav />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Famílias"
          value={totalFamilias}
          icon={UsersRound}
          accent="brand"
        />
        <StatCard
          label="Atletas"
          value={totalAtletas}
          icon={Users}
          accent="blue"
        />
        <StatCard
          label="Valor total"
          value={formatBRL(totalValor)}
          icon={Wallet}
          accent="green"
        />
        <StatCard
          label="Em atenção/crise"
          value={familiasComAlerta.length}
          icon={Activity}
          accent={familiasComAlerta.length > 0 ? "orange" : "brand"}
        />
      </div>

      {/* Toolbar: busca + contagem */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Buscar por responsavel ou atleta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="ml-auto text-xs tabular-nums text-muted-foreground">
          {filtered.length} de {familias.length} famílias
        </p>
      </div>

      {/* Tabela densa agrupada por família */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhuma família encontrada"
          description="Famílias aparecem aqui quando o deal chega em admission_process."
        />
      ) : (
        <Card padding="none" variant="plain" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-border">
                  {TABLE_HEADERS.map((h) => (
                    <th
                      key={h.label}
                      className={cn(
                        "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                        h.className,
                      )}
                    >
                      {h.label}
                    </th>
                  ))}
                  <th className="w-20 px-4 py-2.5">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              {filtered.map((familia) => {
                const hasAlertStatus = familia.atletas.some(
                  (a) => a.status === "atencao" || a.status === "crise",
                );
                const fases = familia.atletas
                  .map((a) => a.fase)
                  .filter(Boolean);
                const hasMixedFases =
                  familia.atletas.length > 1 && new Set(fases).size > 1;

                return (
                  <tbody
                    key={familia.responsavel_id}
                    className="border-b border-border last:border-0"
                  >
                    {/* Linha-cabeçalho da família (responsável) */}
                    <tr className="bg-secondary/50">
                      <td colSpan={TABLE_COL_COUNT} className="px-4 py-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span
                            aria-hidden
                            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-brand text-[10px] font-bold text-white"
                          >
                            {familia.responsavel_nome.charAt(0).toUpperCase()}
                          </span>
                          <span className="text-xs font-semibold text-foreground">
                            {familia.responsavel_nome}
                          </span>
                          {familia.profissao && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Briefcase aria-hidden className="h-3 w-3 text-label-tertiary" />
                              {familia.profissao}
                            </span>
                          )}
                          {familia.whatsapp && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Phone aria-hidden className="h-3 w-3 text-label-tertiary" />
                              {familia.whatsapp}
                            </span>
                          )}
                          {hasAlertStatus && (
                            <Badge tone="orange" size="sm">
                              <AlertTriangle aria-hidden className="h-2.5 w-2.5" />
                              Atenção/Crise
                            </Badge>
                          )}
                          {hasMixedFases && (
                            <Badge tone="purple" size="sm">
                              <Target aria-hidden className="h-2.5 w-2.5" />
                              Fases diferentes
                            </Badge>
                          )}
                          <span className="ml-auto text-xs font-semibold tabular-nums text-foreground">
                            {formatBRL(familia.valor_total)}
                          </span>
                          <span className="text-[10px] text-label-tertiary">
                            valor total
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Linhas de atleta */}
                    {familia.atletas.map((atleta) => {
                      const isLoading = loadingId === atleta.experiencia_id;
                      const statusCfg = atleta.status
                        ? STATUS_BADGE[atleta.status]
                        : null;
                      const clickable = Boolean(atleta.experiencia_id);
                      return (
                        <tr
                          key={atleta.id}
                          onClick={() =>
                            clickable &&
                            !isLoading &&
                            handleAtletaClick(atleta.experiencia_id)
                          }
                          className={cn(
                            "border-b border-border/60 transition-colors last:border-0",
                            clickable
                              ? "cursor-pointer hover:bg-accent"
                              : "opacity-60",
                          )}
                        >
                          <td className="px-4 py-2.5">
                            <p className="truncate text-xs font-medium text-foreground">
                              {atleta.nome_completo}
                            </p>
                          </td>
                          <td className="px-4 py-2.5">
                            {atleta.classificacao ? (
                              <Badge
                                tone={
                                  CLASSIFICATION_TONE[atleta.classificacao] ??
                                  "neutral"
                                }
                                size="sm"
                              >
                                {atleta.classificacao}
                              </Badge>
                            ) : (
                              <span className="text-xs text-label-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs text-muted-foreground">
                              {atleta.fase ? faseLabel(atleta.fase) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {statusCfg ? (
                              <Badge tone={statusCfg.tone} size="sm">
                                {statusCfg.label}
                              </Badge>
                            ) : (
                              <span className="text-xs text-label-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs text-muted-foreground">
                              {atleta.etapa
                                ? ((ETAPA_LABELS as Record<string, string>)[
                                    atleta.etapa
                                  ] ?? atleta.etapa)
                                : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {atleta.lead_score != null ? (
                              <span className="text-xs font-semibold tabular-nums text-primary">
                                {atleta.lead_score}
                              </span>
                            ) : (
                              <span className="text-xs text-label-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {atleta.deal_valor != null ? (
                              <span className="text-xs font-medium tabular-nums text-foreground">
                                {formatBRL(atleta.deal_valor)}
                              </span>
                            ) : (
                              <span className="text-xs text-label-tertiary">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {isLoading ? (
                              <Loader2
                                aria-label="Carregando"
                                className="ml-auto h-3.5 w-3.5 animate-spin text-primary"
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAtletaClick(atleta.experiencia_id);
                                }}
                                disabled={!clickable}
                                className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:text-label-tertiary disabled:hover:bg-transparent"
                              >
                                Editar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        </Card>
      )}

      {modalData && (
        <FamilyDetailModal
          family={modalData}
          journeyConfig={journeyConfig}
          onClose={() => setModalData(null)}
        />
      )}
    </div>
  );
}
