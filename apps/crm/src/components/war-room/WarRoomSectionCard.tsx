import Link from "next/link";
import { type LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANT_STYLES = {
  default: {
    card: "border-[#1e2130] hover:border-zinc-600",
    icon: "bg-zinc-800 text-zinc-300",
    accent: "bg-zinc-700",
  },
  danger: {
    card: "border-red-500/20 hover:border-red-500/40",
    icon: "bg-red-500/10 text-red-400",
    accent: "bg-red-500",
  },
  warning: {
    card: "border-amber-500/20 hover:border-amber-500/40",
    icon: "bg-amber-500/10 text-amber-400",
    accent: "bg-amber-500",
  },
  success: {
    card: "border-emerald-500/20 hover:border-emerald-500/40",
    icon: "bg-emerald-500/10 text-emerald-400",
    accent: "bg-emerald-500",
  },
  blue: {
    card: "border-blue-500/20 hover:border-blue-500/40",
    icon: "bg-blue-500/10 text-blue-400",
    accent: "bg-blue-500",
  },
  purple: {
    card: "border-purple-500/20 hover:border-purple-500/40",
    icon: "bg-purple-500/10 text-purple-400",
    accent: "bg-purple-500",
  },
  indigo: {
    card: "border-indigo-500/20 hover:border-indigo-500/40",
    icon: "bg-indigo-500/10 text-indigo-400",
    accent: "bg-indigo-500",
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
  danger: "bg-red-500/15 text-red-400 border border-red-500/30",
  warning: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  success: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  neutral: "bg-zinc-700/50 text-zinc-400 border border-zinc-600/30",
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
        "group relative flex flex-col gap-3 rounded-xl border bg-[#141720] p-4 transition-all hover:bg-[#1a1f2e]",
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
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">{title}</p>
        </div>
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400 mt-0.5" />
      </div>

      {/* Metrics */}
      <div className="space-y-1 pl-0.5">
        {lines.map((line, i) => (
          <p key={i} className={cn("text-sm font-medium", i === 0 ? "text-zinc-100" : "text-zinc-500")}>
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
