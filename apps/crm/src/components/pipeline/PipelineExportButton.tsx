"use client";

import { ExportCSVButton } from "@/components/shared/ExportCSVButton";
import { type Deal } from "@/types/deal";
import {
  DEFAULT_DEAL_STAGE_DISPLAY,
  type DealStageConfigMap,
} from "@/lib/etapas-deal";

interface PipelineExportButtonProps {
  deals: Deal[];
  /** Config de exibição das etapas (rótulos) — default estático. */
  stageConfig?: DealStageConfigMap;
}

export function PipelineExportButton({
  deals,
  stageConfig = DEFAULT_DEAL_STAGE_DISPLAY,
}: PipelineExportButtonProps) {
  const headers = [
    "Atleta",
    "Etapa",
    "Valor (BRL)",
    "Classificacao",
    "Proxima Acao",
    "Data Proxima Acao",
    "Criado em",
  ];

  const rows = deals.map((deal) => [
    deal.athlete_name,
    stageConfig[deal.stage]?.label ?? deal.stage,
    deal.deal_value_brl.toLocaleString("pt-BR"),
    deal.classification,
    deal.next_action ?? "",
    deal.next_action_date
      ? new Date(deal.next_action_date).toLocaleDateString("pt-BR")
      : "",
    new Date(deal.created_at).toLocaleDateString("pt-BR"),
  ]);

  return (
    <ExportCSVButton
      filename={`pipeline_${new Date().toISOString().split("T")[0]}.csv`}
      headers={headers}
      rows={rows}
    />
  );
}
