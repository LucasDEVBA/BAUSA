import { type LucideIcon } from "lucide-react";
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
    trend: "text-muted-foreground",
  },
  hot: {
    icon: "bg-sys-green/15 text-sys-green",
    border: "border-sys-green/20",
    value: "text-sys-green",
    trend: "text-sys-green",
  },
  warm: {
    icon: "bg-sys-orange/15 text-sys-orange",
    border: "border-sys-orange/20",
    value: "text-sys-orange",
    trend: "text-sys-orange",
  },
  cold: {
    icon: "bg-sys-blue/15 text-sys-blue",
    border: "border-sys-blue/20",
    value: "text-sys-blue",
    trend: "text-sys-blue",
  },
  purple: {
    icon: "bg-sys-purple/15 text-sys-purple",
    border: "border-sys-purple/20",
    value: "text-sys-purple",
    trend: "text-sys-purple",
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

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-5 transition-all hover:bg-secondary",
        styles.border,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn("mt-1.5 text-3xl font-bold tabular-nums", styles.value)}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <p className={cn("mt-1.5 text-xs", styles.trend)}>
              {trend.value >= 0 ? "+" : ""}
              {trend.value} {trend.label}
            </p>
          )}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", styles.icon)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
