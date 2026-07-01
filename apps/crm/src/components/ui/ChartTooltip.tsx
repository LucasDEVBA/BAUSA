import { cn } from "@/lib/utils";

/**
 * ChartTooltip — tooltip custom único e tokenizado p/ Recharts (DESIGN_SPEC §6.6).
 * Superfície escura arredondada (bg-popover / border-border), linha por série com
 * marcador de cor. Substitui os CustomTooltip duplicados em cada chart.
 *
 * Uso: <Tooltip content={<ChartTooltip valueFormatter={(v) => `R$ ${v}`} />} />
 * Recharts injeta active/payload/label em runtime.
 */
export interface ChartTooltipItem {
  name?: string;
  value?: number | string;
  color?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipItem[];
  label?: React.ReactNode;
  /** Formata o cabeçalho (o `label` do eixo). */
  labelFormatter?: (label: React.ReactNode) => React.ReactNode;
  /** Formata o valor de cada série. Default: número pt-BR. */
  valueFormatter?: (value: number | string, name?: string) => React.ReactNode;
  /** Oculta o cabeçalho (charts sem eixo categórico). */
  hideLabel?: boolean;
  className?: string;
}

function defaultValue(value: number | string): React.ReactNode {
  return typeof value === "number" ? value.toLocaleString("pt-BR") : value;
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  hideLabel,
  className,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg",
        className,
      )}
    >
      {!hideLabel && label !== undefined && label !== "" && (
        <p className="mb-1.5 font-semibold text-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((item, i) => (
          <div key={`${item.name ?? "s"}-${i}`} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name && (
              <span className="text-muted-foreground">{item.name}:</span>
            )}
            <span className="ml-auto font-semibold tabular-nums text-foreground">
              {item.value === undefined
                ? "—"
                : valueFormatter
                  ? valueFormatter(item.value, item.name)
                  : defaultValue(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
