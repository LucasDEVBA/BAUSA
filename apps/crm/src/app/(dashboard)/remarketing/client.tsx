"use client";

import { useState, useTransition } from "react";
import { Download, Target, Info, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { exportarSegmentoCSV } from "@/lib/actions/remarketing";
import type { RemarketingSegment } from "@/lib/remarketing-queries";

type SegmentMeta = Omit<RemarketingSegment, "leads">;

export function RemarketingClient({ segments }: { segments: SegmentMeta[] }) {
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState<string | null>(null);

  const totalGeral = segments.reduce((s, seg) => s + seg.total, 0);

  function handleExport(key: string) {
    setExporting(key);
    startTransition(async () => {
      const result = await exportarSegmentoCSV(key);
      if (result.success) {
        const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`${result.rows} contatos exportados`);
      } else {
        toast.error(result.error);
      }
      setExporting(null);
    });
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-100">
            <Target className="h-5 w-5 text-indigo-400" />
            Re-marketing
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Audiências de leads qualificados (QUENTE/MORNO) que ainda não fecharam —
            para re-impactar na Meta. {totalGeral} leads no total.
          </p>
        </div>
      </div>

      {/* Aviso LGPD */}
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
        <div className="text-xs leading-relaxed text-amber-200/80">
          <strong className="text-amber-300">Uso responsável (LGPD).</strong> A
          exportação contém dados pessoais (email/telefone). Use apenas como Custom
          Audience na Meta, com base legal válida (consentimento ou legítimo
          interesse). A Meta criptografa os dados no upload. O contador de
          consentimento por segmento é informativo.
        </div>
      </div>

      {/* Segmentos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {segments.map((seg) => (
          <div
            key={seg.key}
            className="flex flex-col gap-3 rounded-xl border border-[#1e2130] bg-[#141720] p-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{seg.label}</p>
                <p className="mt-1 text-xs text-zinc-500">{seg.descricao}</p>
              </div>
              <span className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-lg font-bold tabular-nums text-indigo-400">
                {seg.total}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-zinc-600">
              <Info className="h-3 w-3" />
              {seg.comConsentimento} com consentimento LGPD registrado
            </div>

            <button
              onClick={() => handleExport(seg.key)}
              disabled={seg.total === 0 || (isPending && exporting === seg.key)}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {isPending && exporting === seg.key
                ? "Gerando…"
                : seg.total === 0
                  ? "Sem leads"
                  : `Exportar CSV (${seg.total})`}
            </button>
          </div>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-zinc-600">
        <Info className="h-3 w-3" />
        CSV no formato Meta Custom Audience (email, telefone E.164, primeiro nome).
        Suba em Meta Ads → Públicos → Criar público personalizado → Lista de clientes.
      </p>
    </div>
  );
}
