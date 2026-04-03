"use client";

import { ExportCSVButton } from "@/components/shared/ExportCSVButton";
import { type Lead } from "@/types/lead";

interface LeadsExportButtonProps {
  leads: (Lead & { possible_duplicate?: boolean })[];
}

export function LeadsExportButton({ leads }: LeadsExportButtonProps) {
  const headers = [
    "Atleta",
    "Email",
    "Classificacao",
    "Faixa Investimento",
    "Posicao",
    "Cidade/Estado",
    "Data Submissao",
    "WhatsApp Enviado",
    "Reuniao Agendada",
    "Etapa Pipeline",
  ];

  const rows = leads.map((lead) => [
    lead.athlete_name,
    lead.email,
    lead.qualification_classification ?? "",
    lead.investment_range ?? "",
    lead.position ?? "",
    lead.school_city_state ?? "",
    lead.submitted_at ? new Date(lead.submitted_at).toLocaleDateString("pt-BR") : "",
    lead.whatsapp_sent_at ? new Date(lead.whatsapp_sent_at).toLocaleDateString("pt-BR") : "",
    lead.meeting_scheduled ? "Sim" : "Nao",
    lead.pipeline_stage ?? "",
  ]);

  return (
    <ExportCSVButton
      filename={`leads_${new Date().toISOString().split("T")[0]}.csv`}
      headers={headers}
      rows={rows}
    />
  );
}
