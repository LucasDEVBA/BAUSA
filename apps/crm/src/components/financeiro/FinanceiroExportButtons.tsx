"use client";

import { ExportCSVButton } from "@/components/shared/ExportCSVButton";

interface ContractRow {
  atletaNome: string;
  plano: string;
  valor_total: number;
  entrada_paga: boolean;
  nf_status: string;
}

interface ParcelaRow {
  client_name: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at?: string;
}

interface ContractsExportButtonProps {
  contracts: ContractRow[];
}

interface ParcelasExportButtonProps {
  parcelas: ParcelaRow[];
}

export function ContractsExportButton({ contracts }: ContractsExportButtonProps) {
  const headers = ["Cliente", "Plano", "Valor Total", "Entrada Paga", "Status NF"];

  const rows = contracts.map((c) => [
    c.atletaNome,
    c.plano,
    c.valor_total.toLocaleString("pt-BR"),
    c.entrada_paga ? "Sim" : "Nao",
    c.nf_status,
  ]);

  return (
    <ExportCSVButton
      filename={`contratos_${new Date().toISOString().split("T")[0]}.csv`}
      headers={headers}
      rows={rows}
      variant="small"
    />
  );
}

export function ParcelasExportButton({ parcelas }: ParcelasExportButtonProps) {
  const headers = ["Contrato", "Parcela", "Valor", "Vencimento", "Status", "Recebido em"];

  const rows = parcelas.map((p) => [
    p.client_name,
    p.description,
    p.amount.toLocaleString("pt-BR"),
    new Date(p.due_date).toLocaleDateString("pt-BR"),
    p.status,
    p.paid_at ? new Date(p.paid_at).toLocaleDateString("pt-BR") : "",
  ]);

  return (
    <ExportCSVButton
      filename={`parcelas_${new Date().toISOString().split("T")[0]}.csv`}
      headers={headers}
      rows={rows}
      variant="small"
    />
  );
}
