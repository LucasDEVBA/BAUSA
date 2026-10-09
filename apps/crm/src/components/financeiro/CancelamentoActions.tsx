"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { MoneyInput } from "@/components/ui/MoneyInput";
import { solicitarCancelamento } from "@/lib/actions/financeiro";
import { cn } from "@/lib/utils";

interface CancelamentoActionsProps {
  dealId: string;
  atletaNome: string;
}

export function CancelamentoActions({ dealId, atletaNome }: CancelamentoActionsProps) {
  const router = useRouter();
  const tituloId = useId();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  // MoneyInput: com type="number", "1.500" virava R$ 1,50 de reembolso.
  const [valorReembolso, setValorReembolso] = useState<number | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");

  const handleSubmit = () => {
    if (!justificativa.trim()) {
      toast.error("Informe a justificativa do reembolso");
      return;
    }

    startTransition(async () => {
      try {
        const result = await solicitarCancelamento(dealId, {
          motivo_cancelamento: justificativa,
          valor_reembolso: valorReembolso ?? 0,
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
      } catch (err) {
        console.error({ level: "error", action: "cancelamento_processar", dealId, error: String(err) });
        toast.error("Não foi possível processar o cancelamento. Tente de novo.");
      }
    });
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-card py-2 px-3 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary focus:ring-1 focus:ring-primary/30";

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="flex items-center gap-1 rounded-lg border border-sys-red/20 bg-sys-red/5 px-2.5 py-1 text-[10px] font-medium text-sys-red transition-colors hover:bg-sys-red/10"
      >
        <XCircle className="h-3 w-3" aria-hidden />
        Processar
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowForm(false)} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="liquid-glass relative z-10 w-full max-w-md rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 id={tituloId} className="text-sm font-semibold text-foreground">Processar cancelamento — {atletaNome}</h3>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            aria-label="Fechar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-fill-4 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4">
          <MoneyInput
            label="Valor de reembolso"
            value={valorReembolso}
            onValueChange={setValorReembolso}
            placeholder="0,00"
            ajuda="Deixe vazio se não houver reembolso."
          />

          <div>
            <label htmlFor={`${tituloId}-justificativa`} className="mb-1 block text-xs font-medium text-muted-foreground">Justificativa *</label>
            <textarea
              id={`${tituloId}-justificativa`}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
              className={cn(inputClass, "resize-none")}
              placeholder="Motivo do cancelamento e justificativa do valor..."
            />
          </div>

          <div>
            <label htmlFor={`${tituloId}-comprovante`} className="mb-1 block text-xs font-medium text-muted-foreground">Comprovante URL (opcional)</label>
            <input
              id={`${tituloId}-comprovante`}
              type="text"
              value={comprovanteUrl}
              onChange={(e) => setComprovanteUrl(e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-destructive py-2.5 text-sm font-medium text-destructive-foreground transition-colors hover:opacity-90 disabled:opacity-40"
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
