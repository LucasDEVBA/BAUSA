import { Badge } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatarValor, type Farol, type MetaComProgresso } from "@/lib/planejamento-tipos";

/** Cores do farol usadas em toda a seção — um só lugar para mudar. */
export const FAROL_BAR: Record<Farol, string> = {
  verde: "bg-sys-green",
  amarelo: "bg-sys-orange",
  vermelho: "bg-sys-red",
};

export const FAROL_TONE: Record<Farol, "green" | "orange" | "red"> = {
  verde: "green",
  amarelo: "orange",
  vermelho: "red",
};

export const FAROL_LABEL: Record<Farol, string> = {
  verde: "No alvo",
  amarelo: "Atenção",
  vermelho: "Em risco",
};

/**
 * Barra de progresso da meta: realizado / alvo + percentual.
 *
 * A barra é cortada em 100% para não vazar do card, mas o número segue
 * mostrando o valor real (145% tem de aparecer como 145%).
 */
export function MetaBar({
  meta,
  compacta = false,
}: {
  meta: MetaComProgresso;
  compacta?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">
          {formatarValor(meta.realizado, meta.unidade)}
          {/* Em "menor é melhor" (CAC, custo) o alvo é um teto — dizer "/ 180"
              faria 154 parecer meta não batida, quando é o oposto. */}
          <span className="text-label-tertiary">
            {meta.direcao === "menor_melhor"
              ? ` · limite ${formatarValor(meta.alvo, meta.unidade)}`
              : ` / ${formatarValor(meta.alvo, meta.unidade)}`}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 text-xs font-semibold tabular-nums",
            meta.farol === "verde" && "text-sys-green",
            meta.farol === "amarelo" && "text-sys-orange",
            meta.farol === "vermelho" && "text-sys-red",
          )}
        >
          {meta.pct.toLocaleString("pt-BR")}%
        </span>
      </div>
      <div
        className={cn("overflow-hidden rounded-full bg-secondary", compacta ? "h-1" : "h-1.5")}
        role="progressbar"
        aria-valuenow={Math.min(100, meta.pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${meta.titulo}: ${meta.pct}% do alvo`}
      >
        <div
          className={cn("h-full rounded-full transition-all", FAROL_BAR[meta.farol])}
          style={{ width: `${Math.min(100, meta.pct)}%` }}
        />
      </div>
    </div>
  );
}

export function FarolBadge({ farol }: { farol: Farol }) {
  return (
    <Badge tone={FAROL_TONE[farol]} size="sm">
      {FAROL_LABEL[farol]}
    </Badge>
  );
}
