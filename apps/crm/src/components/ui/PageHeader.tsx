import { cn } from "@/lib/utils";

/**
 * PageHeader — cabeçalho de tela: eyebrow opcional → título grande (display) →
 * descrição → slot de ações à direita. Padrão de topo de todas as telas.
 */
export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-0.5 text-eyebrow text-primary">{eyebrow}</p>}
        <h1 className="text-title-2 text-foreground">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
