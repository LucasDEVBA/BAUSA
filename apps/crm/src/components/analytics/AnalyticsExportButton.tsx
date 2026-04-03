"use client";

import { ExportCSVButton } from "@/components/shared/ExportCSVButton";
import type { RevenueMonth } from "@/types/revenue";

interface AnalyticsExportButtonProps {
  revenueMonths: RevenueMonth[];
}

export function AnalyticsExportButton({ revenueMonths }: AnalyticsExportButtonProps) {
  const headers = ["Mes", "Contratado (USD)", "Recebido (USD)", "Projetado (USD)"];

  const rows = revenueMonths.map((m) => [
    m.month_label,
    m.contracted_usd.toLocaleString("pt-BR"),
    m.received_usd.toLocaleString("pt-BR"),
    m.projected_usd.toLocaleString("pt-BR"),
  ]);

  return (
    <ExportCSVButton
      filename={`analytics_receita_${new Date().toISOString().split("T")[0]}.csv`}
      headers={headers}
      rows={rows}
    />
  );
}
