"use client";

import { cn } from "@/lib/utils";

/**
 * PeriodSelector — segmented control de janela temporal (DESIGN_SPEC §6.7).
 * Ativo = primário BAU (pílula elevada). Controlado. Genérico sobre o tipo do
 * valor. ⚠️ Só usar onde os dados suportam janela real (§8) — nada de botão inerte.
 */
export interface PeriodOption<T extends string> {
  value: T;
  label: string;
}

export interface PeriodSelectorProps<T extends string> {
  options: ReadonlyArray<PeriodOption<T>>;
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
  className?: string;
}

export function PeriodSelector<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel = "Selecionar período",
  className,
}: PeriodSelectorProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border border-border bg-secondary/60 p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              selected
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
