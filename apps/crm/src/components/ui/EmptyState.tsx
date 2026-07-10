import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** EmptyState — ícone muted → título → descrição → CTA. */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      {Icon && (
        <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <Icon aria-hidden className="size-5" strokeWidth={1.75} />
        </span>
      )}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && (
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
