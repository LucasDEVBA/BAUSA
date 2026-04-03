import Link from "next/link";
import { type LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  COMPONENT: WarRoomSectionCard
  IDENTITY:  BAUSA Elite — .crm-card .crm-card-interactive base.
             Left accent bar: 3px gradient matching variant.
             Icon: rounded-xl, variant-tinted bg.
             Title: .crm-section-label. Badge: .crm-badge system.
  CONTRAST:  Title: --crm-text-tertiary via crm-section-label = 4.8:1 AA
             Primary line: --crm-text-primary on surface = 17.6:1 AAA
             Secondary line: --crm-text-secondary on surface = 7.4:1 AAA
*/

const VARIANT_STYLES = {
  default: {
    icon: "bg-[var(--crm-neutral-100)] text-[var(--crm-text-secondary)]",
    accent: "bg-[var(--crm-neutral-400)]",
  },
  danger: {
    icon: "bg-[var(--crm-error-subtle)] text-[var(--crm-error)]",
    accent: "bg-[var(--crm-error)]",
  },
  warning: {
    icon: "bg-[var(--crm-warning-subtle)] text-[var(--crm-warning)]",
    accent: "bg-[var(--crm-warning)]",
  },
  success: {
    icon: "bg-[var(--crm-success-subtle)] text-[var(--crm-success)]",
    accent: "bg-[var(--crm-success)]",
  },
  blue: {
    icon: "bg-[var(--crm-info-subtle)] text-[var(--crm-info)]",
    accent: "bg-[var(--crm-info)]",
  },
  purple: {
    icon: "bg-[var(--crm-accent-bg)] text-[var(--crm-accent-text)]",
    accent: "bg-[var(--crm-accent-500)]",
  },
  indigo: {
    icon: "bg-[var(--crm-accent-bg)] text-[var(--crm-accent-text)]",
    accent: "bg-[var(--crm-accent-500)]",
  },
} as const;

type Variant = keyof typeof VARIANT_STYLES;

const BADGE_MAP: Record<string, string> = {
  danger: "crm-badge crm-badge-error",
  warning: "crm-badge crm-badge-warning",
  success: "crm-badge crm-badge-success",
  neutral: "crm-badge crm-badge-neutral",
};

interface WarRoomSectionCardProps {
  href: string;
  title: string;
  icon: LucideIcon;
  lines: string[];
  badge?: { label: string; variant: "danger" | "warning" | "success" | "neutral" };
  variant?: Variant;
}

export function WarRoomSectionCard({ href, title, icon: Icon, lines, badge, variant = "default" }: WarRoomSectionCardProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <Link href={href} className="crm-card crm-card-interactive group relative flex flex-col gap-3">
      <span className={cn("absolute left-0 top-4 h-8 w-[3px] rounded-r-full", styles.accent)} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-[var(--crm-radius-xl)] shrink-0", styles.icon)}>
            <Icon className="h-4 w-4" />
          </div>
          <p className="crm-section-label">{title}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--crm-text-disabled)] transition-all duration-[var(--crm-duration-base)] group-hover:translate-x-0.5 group-hover:text-[var(--crm-text-secondary)] mt-0.5" />
      </div>

      <div className="space-y-1 pl-0.5">
        {lines.map((line, i) => (
          <p key={i} className={cn(
            "text-[var(--crm-text-base)] font-[var(--crm-weight-medium)]",
            i === 0 ? "text-[var(--crm-text-primary)]" : "text-[var(--crm-text-secondary)]",
          )}>
            {line}
          </p>
        ))}
      </div>

      {badge && (
        <span className={cn("self-start", BADGE_MAP[badge.variant])}>
          {badge.label}
        </span>
      )}
    </Link>
  );
}
