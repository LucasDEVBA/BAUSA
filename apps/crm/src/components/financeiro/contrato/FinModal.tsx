"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Casca única dos modais financeiros (Radix Dialog = foco preso, Esc, aria,
 * retorno do foco ao gatilho — WCAG 2.1 AA).
 *
 *  • z-[80]: acima do DealDetailModal (z-50) e do CustomizarValorModal
 *    (z-[70]); abaixo do ConfirmDialog (z-[100]) — confirmações abrem por cima.
 *  • Esc: o DealDetailModal escuta keydown no window; sem o stopPropagation
 *    aqui, Esc fecharia os DOIS modais.
 *  • 375px: vira bottom sheet (largura total, 92dvh, rolagem interna, rodapé
 *    fixo com os botões — nada de rolagem horizontal).
 *  • `bloqueado`: enquanto salva, não fecha por Esc/clique fora (evita
 *    perder o resultado de uma escrita em andamento).
 */

export interface FinModalProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao?: React.ReactNode;
  icone?: React.ReactNode;
  children: React.ReactNode;
  rodape: React.ReactNode;
  largura?: "md" | "lg" | "xl";
  bloqueado?: boolean;
}

export function FinModal({
  aberto,
  onFechar,
  titulo,
  descricao,
  icone,
  children,
  rodape,
  largura = "md",
  bloqueado = false,
}: FinModalProps) {
  return (
    <Dialog.Root open={aberto} onOpenChange={(v) => !v && !bloqueado && onFechar()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[2px] motion-reduce:backdrop-blur-none" />
        <Dialog.Content
          onEscapeKeyDown={(e) => {
            e.stopPropagation();
            if (bloqueado) e.preventDefault();
          }}
          onPointerDownOutside={(e) => bloqueado && e.preventDefault()}
          className={cn(
            "fixed z-[80] flex flex-col overflow-hidden border border-border bg-card shadow-2xl outline-none",
            // mobile: bottom sheet
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
            // >= sm: modal central
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[88dvh] sm:w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pb-0",
            largura === "md" && "sm:max-w-md",
            largura === "lg" && "sm:max-w-2xl",
            largura === "xl" && "sm:max-w-4xl",
          )}
        >
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-start gap-2.5">
              {icone && (
                <span aria-hidden className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary">
                  {icone}
                </span>
              )}
              <div className="min-w-0">
                <Dialog.Title className="text-sm font-semibold text-foreground">{titulo}</Dialog.Title>
                {descricao ? (
                  <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">{descricao}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{titulo}</Dialog.Description>
                )}
              </div>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar" disabled={bloqueado}>
                <X />
              </Button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
          <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-5">
            {rodape}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Motivo VISÍVEL do botão desabilitado, no rodapé do FinModal (o `title` não
 * aparece no toque nem chega ao teclado/leitor de tela). Ligar ao botão com
 * `aria-describedby={motivo ? id : undefined}`.
 */
export function MotivoBloqueio({ id, motivo }: { id: string; motivo: string | null }) {
  if (!motivo) return null;
  return (
    <p id={id} className="text-[11px] text-muted-foreground sm:order-first sm:mr-auto">
      {motivo}
    </p>
  );
}
