import { cn } from "@/lib/utils";

/**
 * ChartTooltip — tooltip único para Recharts. Superfície escura liquid-glass
 * arredondada. Recharts injeta active/payload/label em runtime.
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
  labelFormatter?: (label: React.ReactNode) => React.ReactNode;
  valueFormatter?: (value: number | string, name?: string) => React.ReactNode;
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
    <div className={cn("rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg", className)}>
      {!hideLabel && label !== undefined && label !== "" && (
        <p className="mb-1.5 font-semibold text-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((item, i) => (
          <div key={`${item.name ?? "s"}-${i}`} className="flex items-center gap-2">
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name && <span className="text-muted-foreground">{item.name}:</span>}
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
