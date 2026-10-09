"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { FinModal, MotivoBloqueio } from "@/components/financeiro/contrato/FinModal";
import { solicitarCancelamento } from "@/lib/actions/financeiro";
import { cn } from "@/lib/utils";

interface CancelamentoActionsProps {
  dealId: string;
  atletaNome: string;
}

/**
 * Processar cancelamento — ação financeira irreversível: usa o FinModal (Radix
 * Dialog: foco preso, Esc, retorno do foco ao gatilho e não fecha enquanto salva).
 */
export function CancelamentoActions({ dealId, atletaNome }: CancelamentoActionsProps) {
  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  // MoneyInput: com type="number", "1.500" virava R$ 1,50 de reembolso.
  const [valorReembolso, setValorReembolso] = useState<number | null>(null);
  const [reembolsoInvalido, setReembolsoInvalido] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [comprovanteUrl, setComprovanteUrl] = useState("");

  const motivo = reembolsoInvalido
    ? "Valor de reembolso inválido — use o formato 7.800,00."
    : !justificativa.trim()
      ? "Informe a justificativa do cancelamento."
      : null;

  const handleSubmit = () => {
    if (motivo) return;
    startTransition(async () => {
      try {
        const result = await solicitarCancelamento(dealId, {
          motivo_cancelamento: justificativa,
          // vazio = sem reembolso; inválido já travou acima (nunca vira 0 por engano)
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
    "w-full rounded-lg border border-border bg-card py-2 px-3 text-base text-foreground placeholder:text-placeholder outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 sm:text-sm";

  return (
    <>
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="flex items-center gap-1 rounded-lg border border-sys-red/20 bg-sys-red/5 px-2.5 py-1 text-[10px] font-medium text-sys-red transition-colors hover:bg-sys-red/10"
      >
        <XCircle className="h-3 w-3" aria-hidden />
        Processar
      </button>

      <FinModal
        aberto={showForm}
        onFechar={() => setShowForm(false)}
        bloqueado={isPending}
        titulo="Processar cancelamento"
        descricao={atletaNome}
        icone={<XCircle className="size-4" />}
        rodape={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)} disabled={isPending}>Cancelar</Button>
            <Button variant="destructive" onClick={handleSubmit} disabled={isPending || motivo !== null}
              aria-describedby={motivo ? `${id}-motivo` : undefined}>
              {isPending ? <Loader2 className="animate-spin" /> : <XCircle />}
              Confirmar cancelamento
            </Button>
            <MotivoBloqueio id={`${id}-motivo`} motivo={motivo} />
          </>
        }
      >
        <div className="space-y-4">
          <MoneyInput
            label="Valor de reembolso"
            value={valorReembolso}
            onValueChange={(x, { invalido }) => {
              setValorReembolso(x);
              setReembolsoInvalido(invalido);
            }}
            placeholder="0,00"
            ajuda="Deixe vazio se não houver reembolso."
          />

          <div>
            <label htmlFor={`${id}-justificativa`} className="mb-1 block text-xs font-medium text-muted-foreground">Justificativa *</label>
            <textarea
              id={`${id}-justificativa`}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              rows={3}
              className={cn(inputClass, "resize-none")}
              placeholder="Motivo do cancelamento e justificativa do valor..."
            />
          </div>

          <div>
            <label htmlFor={`${id}-comprovante`} className="mb-1 block text-xs font-medium text-muted-foreground">Comprovante URL (opcional)</label>
            <input
              id={`${id}-comprovante`}
              type="text"
              value={comprovanteUrl}
              onChange={(e) => setComprovanteUrl(e.target.value)}
              className={inputClass}
              placeholder="https://..."
            />
          </div>
        </div>
      </FinModal>
    </>
  );
}
