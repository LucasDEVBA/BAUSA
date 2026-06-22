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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ETAPA_LABELS } from "@/types/crm";
import { getFamilyModalData } from "@/lib/actions/experiencia";
import {
  FamilyDetailModal,
  type FamilyModalData,
} from "@/components/familias-shared/FamilyDetailModal";
import { toast } from "sonner";
import type { FamiliaConsolidada } from "./page";

interface FamiliasConsolidadasClientProps {
  familias: FamiliaConsolidada[];
}

const CLASSIFICATION_BADGE: Record<string, string> = {
  QUENTE: "bg-sys-green/15 text-sys-green border-sys-green/20",
  MORNO: "bg-sys-orange/15 text-sys-orange border-sys-orange/20",
  FRIO: "bg-sys-blue/15 text-sys-blue border-sys-blue/20",
};

const FASE_BADGE: Record<string, string> = {
  admissao: "bg-primary/10 text-primary border-primary/20",
  aprovado: "bg-sys-blue/15 text-sys-blue border-sys-blue/20",
  pre_embarque: "bg-sys-cyan/15 text-sys-cyan border-sys-cyan/20",
  embarcado_inicial: "bg-plan-legacy/15 text-plan-legacy border-plan-legacy/20",
  acompanhamento: "bg-sys-green/15 text-sys-green border-sys-green/20",
  encerrado: "bg-secondary text-muted-foreground border-border",
};

const FASE_LABELS: Record<string, string> = {
  admissao: "Admissão",
  aprovado: "Aprovado",
  pre_embarque: "Pré-embarque",
  embarcado_inicial: "Embarcado",
  acompanhamento: "Acompanhamento",
  encerrado: "Encerrado",
};

const STATUS_BADGE: Record<string, { label: string; bg: string }> = {
  satisfeita: {
    label: "Satisfeita",
    bg: "bg-sys-green/15 text-sys-green border-sys-green/20",
  },
  atencao: {
    label: "Atenção",
    bg: "bg-sys-orange/15 text-sys-orange border-sys-orange/20",
  },
  crise: {
    label: "Crise",
    bg: "bg-sys-red/15 text-sys-red border-sys-red/20",
  },
};

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export function FamiliasConsolidadasClient({
  familias,
}: FamiliasConsolidadasClientProps) {
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
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-title-2 text-foreground">
              Visão Consolidada por Família
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Famílias agrupadas por responsável (apenas em Admissão+). Clique
            num atleta para editar.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
            Famílias
          </p>
          <p className="mt-1 text-base font-semibold text-primary">
            {totalFamilias}
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
            Atletas
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">{totalAtletas}</p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
            Valor total
          </p>
          <p className="mt-1 text-base font-semibold text-sys-green">
            {formatBRL(totalValor)}
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
            Em atenção/crise
          </p>
          <p className="mt-1 text-base font-semibold text-sys-orange">
            {familiasComAlerta.length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2 max-w-sm">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por responsavel ou atleta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm text-foreground placeholder:text-placeholder outline-none w-full"
        />
      </div>

      {/* Family Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-label-tertiary">
          <Users className="mb-3 h-10 w-10" />
          <p className="text-sm">Nenhuma família encontrada</p>
          <p className="mt-1 text-xs text-label-tertiary">
            Famílias aparecem aqui quando o deal chega em{" "}
            <code>admission_process</code>.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
              <div
                key={familia.responsavel_id}
                className={cn(
                  "rounded-lg border border-border/70 bg-card/60 p-3.5 transition-all",
                  hasAlertStatus
                    ? "border-sys-orange/30"
                    : "",
                )}
              >
                {/* Guardian Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-plan-legacy text-sm font-bold text-white">
                    {familia.responsavel_nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {familia.responsavel_nome}
                    </p>
                    {familia.profissao && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Briefcase className="h-3 w-3 text-label-tertiary" />
                        <p className="text-[10px] text-muted-foreground truncate">
                          {familia.profissao}
                        </p>
                      </div>
                    )}
                    {familia.whatsapp && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-label-tertiary" />
                        <p className="text-[10px] text-muted-foreground">
                          {familia.whatsapp}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-sys-green">
                      {formatBRL(familia.valor_total)}
                    </p>
                    <p className="text-[10px] text-label-tertiary">valor total</p>
                  </div>
                </div>

                {/* Alerts */}
                {(hasAlertStatus || hasMixedFases) && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {hasAlertStatus && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-sys-orange/20 bg-sys-orange/15 px-2 py-0.5 text-[10px] font-semibold text-sys-orange">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Atenção/Crise
                      </span>
                    )}
                    {hasMixedFases && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-plan-legacy/20 bg-plan-legacy/15 px-2 py-0.5 text-[10px] font-semibold text-plan-legacy">
                        <Target className="h-2.5 w-2.5" />
                        Fases diferentes
                      </span>
                    )}
                  </div>
                )}

                {/* Athletes */}
                <div className="space-y-2">
                  {familia.atletas.map((atleta) => {
                    const isLoading = loadingId === atleta.experiencia_id;
                    const statusCfg = atleta.status
                      ? STATUS_BADGE[atleta.status]
                      : null;
                    return (
                      <button
                        type="button"
                        key={atleta.id}
                        onClick={() =>
                          handleAtletaClick(atleta.experiencia_id)
                        }
                        disabled={isLoading || !atleta.experiencia_id}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-left transition-colors",
                          atleta.experiencia_id
                            ? "hover:border-primary/40 cursor-pointer"
                            : "opacity-60 cursor-not-allowed",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">
                            {atleta.nome_completo}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {atleta.classificacao && (
                              <span
                                className={cn(
                                  "inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold",
                                  CLASSIFICATION_BADGE[atleta.classificacao] ??
                                    "bg-secondary text-muted-foreground border-border",
                                )}
                              >
                                {atleta.classificacao}
                              </span>
                            )}
                            {atleta.fase && (
                              <span
                                className={cn(
                                  "inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold",
                                  FASE_BADGE[atleta.fase] ??
                                    "bg-secondary text-muted-foreground border-border",
                                )}
                              >
                                {FASE_LABELS[atleta.fase] ?? atleta.fase}
                              </span>
                            )}
                            {statusCfg && (
                              <span
                                className={cn(
                                  "inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold",
                                  statusCfg.bg,
                                )}
                              >
                                {statusCfg.label}
                              </span>
                            )}
                            {atleta.etapa && (
                              <span className="text-[10px] text-muted-foreground truncate">
                                Deal:{" "}
                                {(ETAPA_LABELS as Record<string, string>)[
                                  atleta.etapa
                                ] ?? atleta.etapa}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {atleta.lead_score != null && (
                            <div className="text-center">
                              <p className="text-xs font-bold text-primary">
                                {atleta.lead_score}
                              </p>
                              <p className="text-[9px] text-label-tertiary">score</p>
                            </div>
                          )}
                          {atleta.deal_valor != null && (
                            <div className="text-center">
                              <p className="text-xs font-bold text-sys-green">
                                {formatBRL(atleta.deal_valor)}
                              </p>
                              <p className="text-[9px] text-label-tertiary">valor</p>
                            </div>
                          )}
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                          ) : (
                            <span className="text-[10px] text-primary font-semibold">
                              Editar
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalData && (
        <FamilyDetailModal
          family={modalData}
          onClose={() => setModalData(null)}
        />
      )}
    </div>
  );
}
