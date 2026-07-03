"use client";

import type { ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { MoreHorizontal } from "lucide-react";

export interface HeaderMenuProps {
  description?: string;
  actions?: ReactNode;
  ariaLabel?: string;
}

/**
 * HeaderMenu — gatilho minimalista (⋯) que recolhe descrição + ações do cabeçalho
 * num popover de vidro. Usado pelo PageHeader denso (telas de dashboard) para manter
 * o topo enxuto sem esconder contexto/ações.
 */
export function HeaderMenu({ description, actions, ariaLabel = "Detalhes e ações da tela" }: HeaderMenuProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] text-muted-foreground shadow-sm backdrop-blur-xl transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [-webkit-backdrop-filter:blur(16px)]"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-3 shadow-xl backdrop-blur-2xl [-webkit-backdrop-filter:blur(24px)]"
        >
          {description && (
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
          {description && actions && <div className="my-2.5 h-px bg-border" />}
          {actions && <div className="flex flex-col items-stretch gap-1.5">{actions}</div>}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
