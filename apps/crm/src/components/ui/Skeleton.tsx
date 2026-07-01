import { cn } from "@/lib/utils";

/**
 * Skeleton — placeholder de carregamento (DESIGN_SPEC §6.12).
 * bg-secondary + animate-pulse (respeita prefers-reduced-motion via globals.css).
 */
export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-secondary", className)}
      {...props}
    />
  );
}
