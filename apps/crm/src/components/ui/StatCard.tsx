import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./Card";
import { DeltaBadge } from "./DeltaBadge";

/**
 * StatCard — KPI no padrão da tela favorita + ref Brisk:
 * eyebrow (label maiúsculo) → número grande tabular → delta em badge → contexto.
 * `accent` colore o ícone/realce (marca por padrão).
 */
export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  deltaInvert?: boolean;
  context?: string;
  icon?: LucideIcon;
  accent?: "brand" | "burgundy" | "green" | "orange" | "red" | "blue" | "purple";
  className?: string;
}

const ACCENT: Record<NonNullable<StatCardProps["accent"]>, string> = {
  brand: "bg-primary/10 text-primary",
  burgundy: "bg-bau-burgundy/10 text-bau-burgundy",
  green: "bg-sys-green/12 text-sys-green",
  orange: "bg-sys-orange/12 text-sys-orange",
  red: "bg-sys-red/12 text-sys-red",
  blue: "bg-sys-blue/12 text-sys-blue",
  purple: "bg-sys-purple/12 text-sys-purple",
};

export function StatCard({
  label,
  value,
  delta,
  deltaInvert,
  context,
  icon: Icon,
  accent = "brand",
  className,
}: StatCardProps) {
  return (
    <Card padding="md" accent={accent} className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-eyebrow text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("flex size-7 items-center justify-center rounded-lg", ACCENT[accent])}>
            <Icon aria-hidden className="size-3.5" />
          </span>
        )}
      </div>
      {/* número + delta + contexto na MESMA linha (menor altura) */}
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-2xl font-bold leading-none tracking-tight tabular-nums text-foreground">
          {value}
        </span>
        {delta !== undefined && <DeltaBadge value={delta} invert={deltaInvert} />}
        {context && <span className="text-xs text-muted-foreground">{context}</span>}
      </div>
    </Card>
  );
}
