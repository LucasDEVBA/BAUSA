"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle, Loader2, X } from "lucide-react";
import { solicitarCancelamento } from "@/lib/actions/financeiro";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CancelamentoActionsProps {
  dealId: string;
  atletaNome: string;
}

export function CancelamentoActions({ dealId, atletaNome }: CancelamentoActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [valorReembolso, setValorReembolso] = useState(0);
  const [justificativa, setJustificativa] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");

  const handleSubmit = () => {
    if (!justificativa.trim()) {
      toast.error("Informe a justificativa do reembolso");
      return;
    }

    startTransition(async () => {
      const result = await solicitarCancelamento(dealId, {
        motivo_cancelamento: justificativa,
        valor_reembolso: valorReembolso,
        justificativa_reembolso: justificativa,
        comprovante_url: comprovanteUrl || undefined,
      });
      if (result.success) {
        toast.success("Cancelamento processado com sucesso");
        setShowForm(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao processar cancelamento");
      }
    });
  };

  const inputClass =
    "w-full rounded-lg border border-[#1e2130] bg-[#141720] py-2 px-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30";

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/10"
      >
        <XCircle className="h-3 w-3" />
        Processar
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-[#1e2130] bg-[#0f1117] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Processar cancelamento — {atletaNome}</h3>
          <button
            onClick={() => setShowForm(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Valor de reembolso (R$)</label>
            <input
              type="number"
              min={0}
              step={100}
              value={valorReembolso}
              onChange={(e) => setValorReembolso(Number(e.target.value))}
              className={inputClass}
              placeholder="0"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Justificativa *</label>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
              className={cn(inputClass, "resize-none")}
              placeholder="Motivo do cancelamento e justificativa do valor..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">Comprovante URL (opcional)</label>
            <input
              type="text"
              value={comprovanteUrl}
              onChange={(e) => setComprovanteUrl(e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-lg border border-[#1e2130] bg-[#141720] py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-[#1a1f2e]"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-40"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Confirmar cancelamento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
