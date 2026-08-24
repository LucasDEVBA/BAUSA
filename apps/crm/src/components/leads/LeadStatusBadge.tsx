import { AlertTriangle, type LucideIcon } from "lucide-react";

import { type LeadClassification } from "@/types/lead";
import { cn } from "@/lib/utils";

interface LeadStatusBadgeProps {
  classification: LeadClassification | null;
  size?: "sm" | "md";
  showDot?: boolean;
}

const CONFIG: Record<
  LeadClassification,
  { label: string; className: string; dotClassName: string; icon?: LucideIcon }
> = {
  QUENTE: {
    label: "Quente",
    className:
      "bg-lead-hot/15 text-lead-hot border border-lead-hot/20",
    dotClassName: "bg-lead-hot",
  },
  MORNO: {
    label: "Morno",
    className: "bg-lead-warm/15 text-lead-warm border border-lead-warm/20",
    dotClassName: "bg-lead-warm",
  },
  FRIO: {
    label: "Frio",
    className: "bg-lead-cold/15 text-lead-cold border border-lead-cold/20",
    dotClassName: "bg-lead-cold",
  },
  // Estados v2 — dado sujo / campos essenciais ausentes. Tom neutro de
  // propósito: não são temperatura de lead e nunca entram no funil.
  INVALIDO: {
    label: "Inválido",
    className: "bg-secondary text-muted-foreground border border-border",
    dotClassName: "bg-muted-foreground",
    icon: AlertTriangle,
  },
  INCOMPLETO: {
    label: "Incompleto",
    className: "bg-secondary text-muted-foreground border border-border",
    dotClassName: "bg-muted-foreground",
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
          "bg-secondary text-muted-foreground border border-border",
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
        )}
      >
        Pendente
      </span>
    );
  }

  const config = CONFIG[classification];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        config.className,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      )}
    >
      {Icon ? (
        <Icon className="h-3 w-3" aria-hidden />
      ) : (
        showDot && (
          <span
            className={cn("rounded-full", config.dotClassName, "h-1.5 w-1.5")}
          />
        )
      )}
      {config.label}
    </span>
  );
}
