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
    icon: "bg-zinc-800 text-zinc-300",
    border: "border-[#1e2130]",
    value: "text-white",
    trend: "text-zinc-400",
  },
  hot: {
    icon: "bg-emerald-500/10 text-emerald-400",
    border: "border-emerald-500/20",
    value: "text-emerald-400",
    trend: "text-emerald-500",
  },
  warm: {
    icon: "bg-amber-500/10 text-amber-400",
    border: "border-amber-500/20",
    value: "text-amber-400",
    trend: "text-amber-500",
  },
  cold: {
    icon: "bg-blue-500/10 text-blue-400",
    border: "border-blue-500/20",
    value: "text-blue-400",
    trend: "text-blue-500",
  },
  purple: {
    icon: "bg-purple-500/10 text-purple-400",
    border: "border-purple-500/20",
    value: "text-purple-400",
    trend: "text-purple-500",
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
        "relative overflow-hidden rounded-xl border bg-[#141720] p-5 transition-all hover:bg-[#1a1f2e]",
        styles.border,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-400">{title}</p>
          <p className={cn("mt-1.5 text-3xl font-bold tabular-nums", styles.value)}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
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
