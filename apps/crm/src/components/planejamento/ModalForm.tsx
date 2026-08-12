"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui";

/**
 * Modal de formulário da seção Planejamento.
 *
 * Vai para `document.body` via portal: o cabeçalho da página usa
 * `backdrop-filter`, que cria um containing block e prenderia um
 * `position: fixed` dentro dele (o modal apareceria cortado).
 */
export function ModalForm({
  aberto,
  titulo,
  descricao,
  onFechar,
  onSalvar,
  salvando = false,
  bloqueio,
  children,
  largura = "max-w-lg",
}: {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  onFechar: () => void;
  onSalvar: () => void;
  salvando?: boolean;
  bloqueio?: string | null;
  children: ReactNode;
  largura?: string;
}) {
  const caixaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFechar();
    };
    document.addEventListener("keydown", aoTeclar);
    // Trava o scroll do fundo enquanto o modal está aberto.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    caixaRef.current?.querySelector<HTMLElement>("input,select,textarea")?.focus();
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
    };
  }, [aberto, onFechar]);

  if (!aberto || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
        onClick={onFechar}
        aria-hidden
      />
      <div className="fixed inset-0 z-[95] flex items-end justify-center p-0 sm:items-center sm:p-4">
        <div
          ref={caixaRef}
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className={`flex max-h-[92vh] w-full ${largura} flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl`}
        >
          <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
              {descricao && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-label-tertiary">{descricao}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

          {/* Em 375px a mensagem de bloqueio não cabe na mesma linha dos botões:
              ocupa a largura toda acima deles em vez de espremê-los. */}
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
            {bloqueio && (
              <p className="w-full text-[11px] font-medium text-sys-red sm:mr-auto sm:w-auto">
                {bloqueio}
              </p>
            )}
            <Button variant="ghost" size="sm" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={onSalvar} disabled={salvando || Boolean(bloqueio)}>
              {salvando && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </footer>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Campo rotulado — mesma moldura para input, select e textarea. */
export function Campo({
  label,
  ajuda,
  children,
  className,
}: {
  label: string;
  ajuda?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1.5 ${className ?? ""}`}>
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {ajuda && <span className="block text-[11px] text-label-tertiary">{ajuda}</span>}
    </label>
  );
}

export const INPUT_CLS =
  "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/25";
