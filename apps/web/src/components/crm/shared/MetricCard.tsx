import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  COMPONENT: MetricCard
  IDENTITY:  BAUSA Elite — .crm-card base + .crm-metric-* tinted variants.
             Icon in rounded-xl container with variant-colored bg.
             Value: 3xl bold tabular-nums tracking-tight.
             Trend: directional icon + colored value.
  CONTRAST:  Title: --crm-text-secondary on surface = 7.4:1 AAA
             Value: --crm-text-primary on surface = 17.6:1 AAA
             Subtitle: --crm-text-tertiary on surface = 4.2:1 AA
*/

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  variant?: "default" | "hot" | "warm" | "cold" | "purple" | "danger";
  className?: string;
}

const METRIC_CLASS: Record<string, string> = {
  default: "",
  hot: "crm-metric-hot",
  warm: "crm-metric-warm",
  cold: "crm-metric-cold",
  purple: "crm-metric-accent",
  danger: "crm-metric-error",
};

const ICON_STYLES: Record<string, string> = {
  default: "bg-[var(--crm-neutral-100)] text-[var(--crm-text-secondary)]",
  hot: "bg-[var(--crm-success-subtle)] text-[var(--crm-success)]",
  warm: "bg-[var(--crm-warning-subtle)] text-[var(--crm-warning)]",
  cold: "bg-[var(--crm-info-subtle)] text-[var(--crm-info)]",
  purple: "bg-[var(--crm-accent-bg)] text-[var(--crm-accent-text)]",
  danger: "bg-[var(--crm-error-subtle)] text-[var(--crm-error)]",
};

const VALUE_STYLES: Record<string, string> = {
  default: "text-[var(--crm-text-primary)]",
  hot: "text-[var(--crm-success)]",
  warm: "text-[var(--crm-warning)]",
  cold: "text-[var(--crm-info)]",
  purple: "text-[var(--crm-accent-text)]",
  danger: "text-[var(--crm-error)]",
};

export function MetricCard({ title, value, subtitle, icon: Icon, trend, variant = "default", className }: MetricCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <div className={cn("crm-card", METRIC_CLASS[variant], className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[var(--crm-text-sm)] font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)] leading-[var(--crm-leading-tight)]">
            {title}
          </p>
          <p className={cn(
            "mt-2 text-[var(--crm-text-3xl)] font-[var(--crm-weight-bold)] tabular-nums leading-none tracking-[var(--crm-tracking-tight)]",
            VALUE_STYLES[variant],
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-[var(--crm-text-sm)] text-[var(--crm-text-tertiary)] leading-[var(--crm-leading-tight)]">
              {subtitle}
            </p>
          )}
          {trend && (
            <div className={cn(
              "mt-2 flex items-center gap-1 text-[var(--crm-text-sm)] font-[var(--crm-weight-medium)]",
              isPositive ? "text-[var(--crm-success)]" : "text-[var(--crm-error)]",
            )}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{isPositive ? "+" : ""}{trend.value} {trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--crm-radius-xl)]",
          ICON_STYLES[variant],
        )}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
