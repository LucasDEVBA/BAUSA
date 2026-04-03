import { type LeadClassification } from "@/types/lead";
import { cn } from "@/lib/utils";

interface LeadStatusBadgeProps {
  classification: LeadClassification | null;
  size?: "sm" | "md";
  showDot?: boolean;
}

const CONFIG: Record<
  LeadClassification,
  { label: string; className: string; dotClassName: string }
> = {
  QUENTE: {
    label: "Quente",
    className:
      "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
    dotClassName: "bg-emerald-400",
  },
  MORNO: {
    label: "Morno",
    className: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
    dotClassName: "bg-amber-400",
  },
  FRIO: {
    label: "Frio",
    className: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
    dotClassName: "bg-blue-400",
  },
};

export function LeadStatusBadge({
  classification,
  size = "md",
  showDot = true,
}: LeadStatusBadgeProps) {
  if (!classification) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-medium",
          "bg-zinc-800 text-zinc-400 border border-zinc-700",
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
        )}
      >
        Pendente
      </span>
    );
  }

  const config = CONFIG[classification];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        config.className,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      )}
    >
      {showDot && (
        <span
          className={cn("rounded-full", config.dotClassName, "h-1.5 w-1.5")}
        />
      )}
      {config.label}
    </span>
  );
}
