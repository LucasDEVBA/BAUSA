import { Card } from "./Card";
import { cn } from "@/lib/utils";

/**
 * ChartCard — moldura de gráfico (DESIGN_SPEC §6.6).
 * Header (título + subtítulo + slot de ação/PeriodSelector) → área do gráfico →
 * legenda opcional. Reusa o primitivo Card. Só apresentação.
 */
export interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Ex.: <PeriodSelector /> ou legenda inline. */
  action?: React.ReactNode;
  legend?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({
  title,
  subtitle,
  action,
  legend,
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
      {children}
      {legend && <div className="mt-3">{legend}</div>}
    </Card>
  );
}

/**
 * Estilo de tick de eixo tokenizado (DESIGN_SPEC §9): usa muted-foreground
 * (contraste AA), NÃO chart-grid (cor de linha faint — ilegível como texto).
 */
export const chartAxisTick = { fill: "var(--muted-foreground)", fontSize: 11 } as const;

/** Cor da grade pontilhada (linha, não texto). */
export const CHART_GRID = "var(--chart-grid)";

/** Preenchimento do cursor de hover (barras) — translúcido, tema-aware. */
export const CHART_CURSOR_FILL = "var(--fill-4)";
