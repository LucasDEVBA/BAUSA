import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — estado vazio consistente (DESIGN_SPEC §6.12).
 * Ícone muted → título → subtítulo → CTA opcional. Substitui telas em branco
 * e "nenhum resultado" ad-hoc. Só apresentação.
 */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <Icon
          aria-hidden
          className="mb-1 size-8 text-muted-foreground/50"
          strokeWidth={1.5}
        />
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
