import { cn } from "@/lib/utils";

/**
 * Skeleton — placeholder de carregamento.
 *
 * Por padrão usa SHIMMER (brilho percorrendo o bloco); `pulse` mantém o
 * comportamento antigo para quem preferir. Ambos respeitam
 * prefers-reduced-motion (regra global em globals.css + override da classe).
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Animação do placeholder. Default: shimmer. */
  animacao?: "shimmer" | "pulse" | "none";
}

export function Skeleton({ className, animacao = "shimmer", ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-lg bg-secondary",
        animacao === "shimmer" && "skeleton-shimmer",
        animacao === "pulse" && "animate-pulse",
        className,
      )}
      {...props}
    />
  );
}
