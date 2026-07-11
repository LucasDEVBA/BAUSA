"use client";

import { useState, useTransition } from "react";
import { Info, Save } from "lucide-react";
import { toast } from "sonner";
import { atualizarConfiguracao } from "@/lib/actions/configuracoes";
import {
  ALERT_DAYS_MAX,
  ALERT_DAYS_MIN,
  FASES_SEM_ALERTA,
  FASE_DESCRIPTION_MAX,
  FASE_LABEL_MAX,
  combineAlertDaysFromInatividade,
  mergeJourneyConfig,
  orderedStages,
  parseFasesFamiliaConfig,
  type FaseFamiliaOverride,
  type FasesFamiliaConfig,
} from "@/lib/fases-familia";
import {
  FAMILY_JOURNEY_STAGES,
  JOURNEY_STAGE_CONFIG,
  type FamilyJourneyStage,
} from "@/types/family";
import {
  DEAL_STAGES,
  ETAPA_ACCENTS,
  ETAPA_ACCENT_DOT,
  ETAPA_ACCENT_LABEL,
  ETAPA_DEAL_LABEL_MAX,
  mergeDealStageConfig,
  mergeProbabilidadePorEtapa,
  orderedDealStages,
  parseEtapasDealConfig,
  type EtapaDealAccent,
  type EtapaDealOverride,
  type EtapasDealConfig,
} from "@/lib/etapas-deal";
import {
  DEAL_STAGE_CONFIG,
  PIPELINE_STAGE_ORDER,
  type DealStage,
} from "@/types/deal";
import { cn } from "@/lib/utils";
import { Button, Card, Input } from "@/components/ui";

interface RowState {
  label: string;
  description: string;
  order: number;
  alertDays: number;
}

type RowsState = Record<FamilyJourneyStage, RowState>;

interface DealRowState {
  label: string;
  /** "" = manter a cor original da etapa (sem override de acento). */
  accent: "" | EtapaDealAccent;
  order: number;
  oculta: boolean;
  probabilidade: number;
}

type DealRowsState = Record<DealStage, DealRowState>;

interface PipelinesTabProps {
  /** Valor cru de configuracoes_sistema["fases_familia_config"]. */
  fasesConfigRaw: unknown;
  /** Valor cru de configuracoes_sistema["inatividade_por_fase"]. */
  inatividadeRaw: unknown;
  /** Valor cru de configuracoes_sistema["etapas_deal_config"]. */
  etapasDealRaw: unknown;
  /** Valor cru de configuracoes_sistema["probabilidade_por_etapa"]. */
  probabilidadeRaw: unknown;
  /** Sincroniza o estado do pai após salvar com sucesso. */
  onSaved: (
    fases: FasesFamiliaConfig,
    inatividade: Record<string, number>,
  ) => void;
  /** Sincroniza o estado do pai após salvar as etapas do comercial. */
  onSavedEtapasDeal: (
    etapas: EtapasDealConfig,
    probabilidade: Record<string, number>,
  ) => void;
}

/** Etapas fora do Kanban — checkbox "ocultar" não se aplica. */
const ETAPAS_FORA_DO_KANBAN: ReadonlyArray<DealStage> = DEAL_STAGES.filter(
  (s) => !PIPELINE_STAGE_ORDER.includes(s),
);

const labelClass = "text-xs font-medium text-muted-foreground";

function buildInitialRows(
  fasesConfigRaw: unknown,
  inatividadeRaw: unknown,
): { rows: RowsState; stageOrder: FamilyJourneyStage[] } {
  const merged = mergeJourneyConfig(
    combineAlertDaysFromInatividade(
      parseFasesFamiliaConfig(fasesConfigRaw),
      inatividadeRaw,
    ),
  );
  const rows = {} as RowsState;
  for (const stage of FAMILY_JOURNEY_STAGES) {
    const cfg = merged[stage];
    rows[stage] = {
      label: cfg.label,
      description: cfg.description,
      order: cfg.order,
      alertDays: cfg.alertDays,
    };
  }
  // Snapshot da ordem atual — não reordena as linhas enquanto o CEO digita.
  return { rows, stageOrder: orderedStages(merged) };
}

function buildInitialDealRows(
  etapasDealRaw: unknown,
  probabilidadeRaw: unknown,
): { dealRows: DealRowsState; dealStageOrder: DealStage[] } {
  const overrides = parseEtapasDealConfig(etapasDealRaw);
  const merged = mergeDealStageConfig(overrides);
  const probabilidade = mergeProbabilidadePorEtapa(probabilidadeRaw);
  const dealRows = {} as DealRowsState;
  for (const stage of DEAL_STAGES) {
    const cfg = merged[stage];
    dealRows[stage] = {
      label: cfg.label,
      accent: overrides[stage]?.accent ?? "",
      order: cfg.order,
      oculta: cfg.oculta,
      // Etapa sem valor em config nem fallback (edge — seed 20260401000300
      // ausente): exibe 0 e a probabilidade fica explícita ao salvar.
      probabilidade: probabilidade[stage] ?? 0,
    };
  }
  // Snapshot da ordem atual — não reordena as linhas enquanto o CEO digita.
  return { dealRows, dealStageOrder: orderedDealStages(merged) };
}

export function PipelinesTab({
  fasesConfigRaw,
  inatividadeRaw,
  etapasDealRaw,
  probabilidadeRaw,
  onSaved,
  onSavedEtapasDeal,
}: PipelinesTabProps) {
  const [isPending, startTransition] = useTransition();
  const [{ rows, stageOrder }, setState] = useState(() =>
    buildInitialRows(fasesConfigRaw, inatividadeRaw),
  );
  const [{ dealRows, dealStageOrder }, setDealState] = useState(() =>
    buildInitialDealRows(etapasDealRaw, probabilidadeRaw),
  );

  const updateRow = (
    stage: FamilyJourneyStage,
    campo: keyof RowState,
    valor: string | number,
  ) => {
    setState((prev) => ({
      ...prev,
      rows: {
        ...prev.rows,
        [stage]: { ...prev.rows[stage], [campo]: valor },
      },
    }));
  };

  const updateDealRow = (
    stage: DealStage,
    campo: keyof DealRowState,
    valor: string | number | boolean,
  ) => {
    setDealState((prev) => ({
      ...prev,
      dealRows: {
        ...prev.dealRows,
        [stage]: { ...prev.dealRows[stage], [campo]: valor },
      },
    }));
  };

  const handleSave = () => {
    // Validação client-side (o server valida CEO; valores inválidos também
    // seriam ignorados na leitura — fail-open — mas avisamos antes de gravar).
    for (const stage of FAMILY_JOURNEY_STAGES) {
      const row = rows[stage];
      const label = row.label.trim();
      if (!label || label.length > FASE_LABEL_MAX) {
        toast.error(
          `Rótulo da fase "${stage}" deve ter entre 1 e ${FASE_LABEL_MAX} caracteres.`,
        );
        return;
      }
      if (row.description.trim().length > FASE_DESCRIPTION_MAX) {
        toast.error(
          `Descrição da fase "${stage}" deve ter no máximo ${FASE_DESCRIPTION_MAX} caracteres.`,
        );
        return;
      }
      if (!Number.isFinite(row.order)) {
        toast.error(`Ordem da fase "${stage}" deve ser um número.`);
        return;
      }
      const temAlerta = !FASES_SEM_ALERTA.includes(stage);
      if (
        temAlerta &&
        (!Number.isInteger(row.alertDays) ||
          row.alertDays < ALERT_DAYS_MIN ||
          row.alertDays > ALERT_DAYS_MAX)
      ) {
        toast.error(
          `Dias de alerta da fase "${stage}" deve ser um inteiro entre ${ALERT_DAYS_MIN} e ${ALERT_DAYS_MAX}.`,
        );
        return;
      }
    }

    // Validação da seção Pipeline Comercial (mesma filosofia fail-open na
    // leitura — mas avisamos antes de gravar).
    for (const stage of DEAL_STAGES) {
      const row = dealRows[stage];
      const label = row.label.trim();
      if (!label || label.length > ETAPA_DEAL_LABEL_MAX) {
        toast.error(
          `Rótulo da etapa "${stage}" deve ter entre 1 e ${ETAPA_DEAL_LABEL_MAX} caracteres.`,
        );
        return;
      }
      if (!Number.isFinite(row.order)) {
        toast.error(`Ordem da etapa "${stage}" deve ser um número.`);
        return;
      }
      if (
        !Number.isInteger(row.probabilidade) ||
        row.probabilidade < 0 ||
        row.probabilidade > 100
      ) {
        toast.error(
          `Probabilidade da etapa "${stage}" deve ser um inteiro entre 0 e 100.`,
        );
        return;
      }
    }

    // Persiste só o que difere do default do código — `{}` = tudo padrão.
    // alertDays fica na chave canônica `inatividade_por_fase` (lida também
    // pela função SQL familias_em_alerta_inatividade), não duplicado aqui.
    const fases: FasesFamiliaConfig = {};
    const inatividade: Record<string, number> = {};
    for (const stage of FAMILY_JOURNEY_STAGES) {
      const row = rows[stage];
      const base = JOURNEY_STAGE_CONFIG[stage];
      const override: FaseFamiliaOverride = {};
      const label = row.label.trim();
      const description = row.description.trim();
      if (label !== base.label) override.label = label;
      if (description && description !== base.description) {
        override.description = description;
      }
      if (row.order !== base.order) override.order = row.order;
      if (Object.keys(override).length > 0) fases[stage] = override;
      if (!FASES_SEM_ALERTA.includes(stage)) {
        inatividade[stage] = row.alertDays;
      }
    }

    // Pipeline Comercial: overrides só do que difere do default; a
    // probabilidade é gravada completa na chave canônica seed.
    const etapas: EtapasDealConfig = {};
    const probabilidade: Record<string, number> = {};
    for (const stage of DEAL_STAGES) {
      const row = dealRows[stage];
      const base = DEAL_STAGE_CONFIG[stage];
      const override: EtapaDealOverride = {};
      const label = row.label.trim();
      if (label !== base.label) override.label = label;
      if (row.accent !== "") override.accent = row.accent;
      if (row.order !== base.order) override.order = row.order;
      if (row.oculta) override.oculta = true;
      if (Object.keys(override).length > 0) etapas[stage] = override;
      probabilidade[stage] = row.probabilidade;
    }

    startTransition(async () => {
      const r1 = await atualizarConfiguracao("fases_familia_config", fases);
      if (!r1.success) {
        toast.error(r1.error ?? "Erro ao salvar as fases");
        return;
      }
      const r2 = await atualizarConfiguracao("inatividade_por_fase", inatividade);
      if (!r2.success) {
        toast.error(r2.error ?? "Erro ao salvar os dias de alerta");
        return;
      }
      const r3 = await atualizarConfiguracao("etapas_deal_config", etapas);
      if (!r3.success) {
        toast.error(r3.error ?? "Erro ao salvar as etapas do comercial");
        return;
      }
      const r4 = await atualizarConfiguracao(
        "probabilidade_por_etapa",
        probabilidade,
      );
      if (!r4.success) {
        toast.error(r4.error ?? "Erro ao salvar as probabilidades");
        return;
      }
      toast.success("Pipelines atualizados");
      onSaved(fases, inatividade);
      onSavedEtapasDeal(etapas, probabilidade);
    });
  };

  return (
    <div className="space-y-5">
      <Card accent="brand" padding="sm">
        <div className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">
              Os valores internos das fases não mudam
            </span>{" "}
            — você edita como elas aparecem e alertam. Kanban, badges e seletores
            de fase passam a usar o rótulo e a ordem configurados aqui; os dias
            de alerta alimentam os avisos de inatividade (incluindo a função de
            alerta do banco).
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Jornada da Família
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Uma linha por fase, na ordem de exibição atual.
        </p>

        <div className="space-y-4">
          {stageOrder.map((stage) => {
            const row = rows[stage];
            const semAlerta = FASES_SEM_ALERTA.includes(stage);
            return (
              <div
                key={stage}
                className="rounded-xl border border-border p-3.5 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                    {stage}
                  </code>
                  <span className="text-[10px] text-label-tertiary">
                    valor interno (imutável)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
                  <div className="space-y-1.5 col-span-2 lg:col-span-3">
                    <label className={labelClass}>Rótulo</label>
                    <Input
                      value={row.label}
                      maxLength={FASE_LABEL_MAX}
                      onChange={(e) => updateRow(stage, "label", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2 lg:col-span-5">
                    <label className={labelClass}>Descrição</label>
                    <Input
                      value={row.description}
                      maxLength={FASE_DESCRIPTION_MAX}
                      onChange={(e) =>
                        updateRow(stage, "description", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClass}>Ordem</label>
                    <Input
                      type="number"
                      value={row.order}
                      onChange={(e) =>
                        updateRow(stage, "order", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClass}>
                      Alerta{" "}
                      <span className="text-label-tertiary">(dias)</span>
                    </label>
                    <Input
                      type="number"
                      min={ALERT_DAYS_MIN}
                      max={ALERT_DAYS_MAX}
                      value={semAlerta ? "" : row.alertDays}
                      disabled={semAlerta}
                      onChange={(e) =>
                        updateRow(stage, "alertDays", Number(e.target.value))
                      }
                    />
                    {semAlerta && (
                      <p className="text-[10px] text-label-tertiary">
                        sem alerta de inatividade
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Pipeline Comercial
        </h3>
        <p className="mb-1 text-xs text-muted-foreground">
          Uma linha por etapa, na ordem de exibição atual.
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            Os valores internos das etapas não mudam
          </span>{" "}
          — automações e relatórios continuam funcionando. A probabilidade (%)
          alimenta a previsão de receita do War Room e é aplicada ao mover o
          deal de etapa.
        </p>

        <div className="space-y-4">
          {dealStageOrder.map((stage) => {
            const row = dealRows[stage];
            const base = DEAL_STAGE_CONFIG[stage];
            const foraDoKanban = ETAPAS_FORA_DO_KANBAN.includes(stage);
            return (
              <div
                key={stage}
                className="rounded-xl border border-border p-3.5 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      row.accent !== ""
                        ? ETAPA_ACCENT_DOT[row.accent]
                        : base.dotColor,
                    )}
                  />
                  <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                    {stage}
                  </code>
                  <span className="text-[10px] text-label-tertiary">
                    valor interno (imutável)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
                  <div className="space-y-1.5 col-span-2 lg:col-span-4">
                    <label className={labelClass}>Rótulo</label>
                    <Input
                      value={row.label}
                      maxLength={ETAPA_DEAL_LABEL_MAX}
                      onChange={(e) =>
                        updateDealRow(stage, "label", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2 lg:col-span-3">
                    <label className={labelClass}>Acento</label>
                    <select
                      value={row.accent}
                      onChange={(e) =>
                        updateDealRow(stage, "accent", e.target.value)
                      }
                      className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground transition-colors appearance-none focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
                    >
                      <option value="">Padrão (cor original)</option>
                      {ETAPA_ACCENTS.map((accent) => (
                        <option key={accent} value={accent}>
                          {ETAPA_ACCENT_LABEL[accent]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClass}>Ordem</label>
                    <Input
                      type="number"
                      value={row.order}
                      onChange={(e) =>
                        updateDealRow(stage, "order", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <label className={labelClass}>
                      Probabilidade{" "}
                      <span className="text-label-tertiary">(%)</span>
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={row.probabilidade}
                      onChange={(e) =>
                        updateDealRow(
                          stage,
                          "probabilidade",
                          Number(e.target.value),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-1">
                    <label className={labelClass}>Ocultar</label>
                    <div className="flex h-9 items-center">
                      <input
                        type="checkbox"
                        checked={row.oculta}
                        disabled={foraDoKanban}
                        onChange={(e) =>
                          updateDealRow(stage, "oculta", e.target.checked)
                        }
                        aria-label={`Ocultar coluna ${row.label} do Kanban`}
                        className="h-4 w-4 rounded border-input accent-primary disabled:opacity-40"
                      />
                    </div>
                    {foraDoKanban && (
                      <p className="text-[10px] text-label-tertiary">
                        fora do Kanban
                      </p>
                    )}
                  </div>
                </div>
                {row.oculta && !foraDoKanban && (
                  <p className="text-[10px] text-label-tertiary">
                    A coluna some do Kanban apenas quando estiver vazia — deals
                    existentes continuam visíveis (badge &quot;Oculta&quot;).
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending} size="sm">
          <Save className="h-3.5 w-3.5" />
          Salvar tudo
        </Button>
      </div>
    </div>
  );
}
