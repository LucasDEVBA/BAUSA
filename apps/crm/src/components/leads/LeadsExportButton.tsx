"use client";

import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { exportarLeadsCsv } from "@/lib/actions/leads-busca";
import { downloadCSV, generateCSV } from "@/lib/export-csv";
import { type FiltrosLeads } from "@/lib/leads-filtros";

interface LeadsExportButtonProps {
  /** Filtro atual da tabela — o CSV traz TODOS os leads dele, não só a página. */
  filtros: FiltrosLeads;
  /** Total do filtro (null = não carregou). */
  total: number | null;
}

const HEADERS = [
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

/**
 * Export de /leads (T8): a tabela agora só tem UMA página no navegador, então
 * o CSV é montado no servidor (paginando acima do max_rows de 1000).
 * Mesmas 10 colunas do export antigo.
 */
export function LeadsExportButton({ filtros, total }: LeadsExportButtonProps) {
  const [exportando, startExportar] = useTransition();

  const exportar = () => {
    startExportar(async () => {
      try {
        const r = await exportarLeadsCsv(filtros);
        if (!r.success) {
          toast.error(r.error);
          return;
        }
        downloadCSV(`leads_${new Date().toISOString().split("T")[0]}.csv`, generateCSV(HEADERS, r.linhas));
        if (r.truncado) toast.warning("Exportação parou no teto de 20.000 leads — refine o filtro.");
      } catch {
        toast.error("Falha de rede ao exportar. Tente de novo.");
      }
    });
  };

  return (
    <button
      type="button"
      onClick={exportar}
      disabled={exportando || total === 0 || total === null}
      title={total !== null ? `Exporta os ${total} leads do filtro atual` : undefined}
      className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      {exportando ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Download aria-hidden className="h-4 w-4" />}
      {exportando ? "Exportando…" : "Exportar CSV"}
    </button>
  );
}
