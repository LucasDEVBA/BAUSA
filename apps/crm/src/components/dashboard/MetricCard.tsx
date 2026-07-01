import { type LucideIcon, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "hot" | "warm" | "cold" | "purple";
  className?: string;
}

const VARIANT_STYLES = {
  default: {
    icon: "bg-secondary text-foreground",
    border: "border-border",
    value: "text-foreground",
  },
  hot: {
    icon: "bg-sys-green/15 text-sys-green",
    border: "border-sys-green/20",
    value: "text-sys-green",
  },
  warm: {
    icon: "bg-sys-orange/15 text-sys-orange",
    border: "border-sys-orange/20",
    value: "text-sys-orange",
  },
  cold: {
    icon: "bg-sys-blue/15 text-sys-blue",
    border: "border-sys-blue/20",
    value: "text-sys-blue",
  },
  purple: {
    icon: "bg-sys-purple/15 text-sys-purple",
    border: "border-sys-purple/20",
    value: "text-sys-purple",
  },
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: MetricCardProps) {
  const styles = VARIANT_STYLES[variant];
  const up = trend ? trend.value >= 0 : false;
  // O label às vezes já vem com "%" no início ("% vs mês anterior"); o badge já
  // mostra o percentual, então removemos o "% " duplicado do contexto.
  const trendContext = trend?.label.replace(/^%\s*/, "");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/70 bg-card/60 p-3.5 transition-all hover:shadow-md",
        styles.border,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", styles.icon)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <p className={cn("text-xl font-semibold tabular-nums", styles.value)}>{value}</p>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
              up ? "bg-sys-green/15 text-sys-green" : "bg-sys-red/15 text-sys-red",
            )}
          >
            {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {up ? "+" : ""}
            {trend.value}%
          </span>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
      {trendContext && <p className="mt-0.5 text-[11px] text-label-tertiary">{trendContext}</p>}
    </div>
  );
}
