"use client";

import { useEffect, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * FormModal — modal CENTRADO (não sheet lateral) para criar/editar registros
 * financeiros. Header com ícone/título/subtítulo + corpo rolável. O conteúdo
 * (children) traz o <form> com sua própria área de scroll e rodapé.
 */
export function FormModal({
  open,
  onClose,
  icon: Icon,
  iconClass = "bg-primary/12 text-primary ring-primary/25",
  title,
  subtitle,
  ariaLabel,
  maxWidth = "max-w-2xl",
  children,
}: {
  open: boolean;
  onClose: () => void;
  icon: LucideIcon;
  iconClass?: string;
  title: string;
  subtitle?: string;
  ariaLabel: string;
  maxWidth?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Trava o scroll do fundo enquanto o modal está aberto
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = anterior;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
          maxWidth,
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl ring-1", iconClass)}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-fill-4 hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Seção do modal — título eyebrow + grid de campos. */
export function ModalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">{title}</p>
      {children}
    </div>
  );
}

export const modalFieldClasses = {
  input:
    "w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30",
  label: "mb-1 block text-[10px] font-medium text-muted-foreground",
};
