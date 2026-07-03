import { cn } from "@/lib/utils";

import { HeaderMenu } from "./HeaderMenu";

/**
 * PageHeader — cabeçalho de tela: eyebrow opcional → título → descrição → ações.
 *
 * `dense` (telas de dashboard com cards de KPI): linha única enxuta — eyebrow + título
 * pequeno à esquerda; descrição e ações recolhem num menu minimalista (HeaderMenu),
 * deixando os KPIs subirem. Sem `dense`, layout padrão com ações visíveis à direita.
 */
export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  dense?: boolean;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, dense, className }: PageHeaderProps) {
  if (dense) {
    return (
      <div className={cn("flex items-center justify-between gap-3", className)}>
        <div className="flex min-w-0 items-baseline gap-2">
          {eyebrow && <span className="shrink-0 text-eyebrow text-primary">{eyebrow}</span>}
          <h1 className="truncate text-title-3 text-foreground">{title}</h1>
        </div>
        {(description || actions) && <HeaderMenu description={description} actions={actions} />}
      </div>
    );
  }

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
