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
import { Button, Card, Input } from "@/components/ui";

interface RowState {
  label: string;
  description: string;
  order: number;
  alertDays: number;
}

type RowsState = Record<FamilyJourneyStage, RowState>;

interface PipelinesTabProps {
  /** Valor cru de configuracoes_sistema["fases_familia_config"]. */
  fasesConfigRaw: unknown;
  /** Valor cru de configuracoes_sistema["inatividade_por_fase"]. */
  inatividadeRaw: unknown;
  /** Sincroniza o estado do pai após salvar com sucesso. */
  onSaved: (
    fases: FasesFamiliaConfig,
    inatividade: Record<string, number>,
  ) => void;
}

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

export function PipelinesTab({
  fasesConfigRaw,
  inatividadeRaw,
  onSaved,
}: PipelinesTabProps) {
  const [isPending, startTransition] = useTransition();
  const [{ rows, stageOrder }, setState] = useState(() =>
    buildInitialRows(fasesConfigRaw, inatividadeRaw),
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
      toast.success("Fases da jornada da família atualizadas");
      onSaved(fases, inatividade);
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

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending} size="sm">
          <Save className="h-3.5 w-3.5" />
          Salvar tudo
        </Button>
      </div>
    </div>
  );
}
