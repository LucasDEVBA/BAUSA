import Link from "next/link";
import { type LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANT_STYLES = {
  default: {
    card: "border-border hover:border-fill-2",
    icon: "bg-secondary text-muted-foreground",
    accent: "bg-fill-2",
  },
  danger: {
    card: "border-sys-red/20 hover:border-sys-red/40",
    icon: "bg-sys-red/10 text-sys-red",
    accent: "bg-sys-red",
  },
  warning: {
    card: "border-sys-orange/20 hover:border-sys-orange/40",
    icon: "bg-sys-orange/10 text-sys-orange",
    accent: "bg-sys-orange",
  },
  success: {
    card: "border-sys-green/20 hover:border-sys-green/40",
    icon: "bg-sys-green/10 text-sys-green",
    accent: "bg-sys-green",
  },
  blue: {
    card: "border-sys-blue/20 hover:border-sys-blue/40",
    icon: "bg-sys-blue/10 text-sys-blue",
    accent: "bg-sys-blue",
  },
  purple: {
    card: "border-plan-legacy/20 hover:border-plan-legacy/40",
    icon: "bg-plan-legacy/10 text-plan-legacy",
    accent: "bg-plan-legacy",
  },
  indigo: {
    card: "border-primary/20 hover:border-primary/40",
    icon: "bg-primary/10 text-primary",
    accent: "bg-primary",
  },
} as const;

type Variant = keyof typeof VARIANT_STYLES;

interface WarRoomSectionCardProps {
  href: string;
  title: string;
  icon: LucideIcon;
  lines: string[];
  badge?: {
    label: string;
    variant: "danger" | "warning" | "success" | "neutral";
  };
  variant?: Variant;
}

const BADGE_STYLES = {
  danger: "bg-sys-red/15 text-sys-red border border-sys-red/30",
  warning: "bg-sys-orange/15 text-sys-orange border border-sys-orange/30",
  success: "bg-sys-green/15 text-sys-green border border-sys-green/30",
  neutral: "bg-secondary text-muted-foreground border border-border",
};

export function WarRoomSectionCard({
  href,
  title,
  icon: Icon,
  lines,
  badge,
  variant = "default",
}: WarRoomSectionCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border/70 bg-card/60 p-3 transition-all hover:shadow-md",
        styles.card
      )}
    >
      {/* Accent line */}
      <span className={cn("absolute left-0 top-4 h-8 w-0.5 rounded-r-full", styles.accent)} />

      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", styles.icon)}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-label-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground mt-0.5" />
      </div>

      {/* Metrics */}
      <div className="space-y-1 pl-0.5">
        {lines.map((line, i) => (
          <p key={i} className={cn("text-sm font-medium", i === 0 ? "text-foreground" : "text-muted-foreground")}>
            {line}
          </p>
        ))}
      </div>

      {/* Badge */}
      {badge && (
        <span className={cn("self-start rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_STYLES[badge.variant])}>
          {badge.label}
        </span>
      )}
    </Link>
  );
}
