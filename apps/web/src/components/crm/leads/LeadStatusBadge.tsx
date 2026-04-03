import { cn } from "@/lib/utils";

/*
  COMPONENT: LeadStatusBadge
  IDENTITY:  BAUSA Elite — fully driven by .crm-badge CSS class system.
             The ::before pseudo-element provides the dot automatically.
             No hardcoded emerald/amber/blue/zinc classes.
  MAPPING:   QUENTE  -> crm-badge-success (green)
             MORNO   -> crm-badge-warning (amber)
             FRIO    -> crm-badge-info    (blue)
             Pending -> crm-badge-neutral  (gray)
*/

interface LeadStatusBadgeProps {
  classification: string | null;
  size?: "sm" | "md";
}

const BADGE_CONFIG: Record<string, { label: string; variant: string }> = {
  QUENTE: { label: "Quente", variant: "crm-badge-success" },
  MORNO:  { label: "Morno",  variant: "crm-badge-warning" },
  FRIO:   { label: "Frio",   variant: "crm-badge-info" },
};

export function LeadStatusBadge({ classification, size = "md" }: LeadStatusBadgeProps) {
  const config = classification ? BADGE_CONFIG[classification] : null;

  if (!config) {
    return (
      <span className={cn(
        "crm-badge crm-badge-neutral",
        size === "sm" && "text-[10px] px-2 py-0.5",
      )}>
        Pendente
      </span>
    );
  }

  return (
    <span className={cn(
      "crm-badge",
      config.variant,
      size === "sm" && "text-[10px] px-2 py-0.5",
    )}>
      {config.label}
    </span>
  );
}
