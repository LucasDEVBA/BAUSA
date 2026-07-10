import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DeltaBadge — variação em pílula (▲/▼ %), verde/vermelho. Linguagem da ref.
 * `value` em pontos percentuais (ex.: 12 → "+12%"). null = sem comparação.
 * `invert` p/ métricas onde queda é boa (ex.: custo).
 */
export interface DeltaBadgeProps {
  value: number | null | undefined;
  suffix?: string;
  invert?: boolean;
  className?: string;
}

export function DeltaBadge({ value, suffix = "%", invert = false, className }: DeltaBadgeProps) {
  if (value === null || value === undefined) return null;
  const positive = invert ? value < 0 : value > 0;
  const negative = invert ? value > 0 : value < 0;
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        positive && "border-sys-green/25 bg-sys-green/12 text-sys-green",
        negative && "border-sys-red/25 bg-sys-red/12 text-sys-red",
        !positive && !negative && "border-border bg-secondary text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden className="size-2.5" />
      {value > 0 ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}
