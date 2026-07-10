import { Card } from "./Card";
import { cn } from "@/lib/utils";

/**
 * ChartCard — moldura de gráfico: header (título + subtítulo + ação/seletor) →
 * área do gráfico → legenda opcional.
 */
export interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  legend?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, action, legend, children, className }: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
      {legend && <div className="mt-3">{legend}</div>}
    </Card>
  );
}

/** Tick de eixo tokenizado (muted-foreground — contraste AA; nunca chart-grid). */
export const chartAxisTick = { fill: "var(--muted-foreground)", fontSize: 11 } as const;
export const CHART_GRID = "var(--chart-grid)";
export const CHART_CURSOR_FILL = "var(--fill-4)";
