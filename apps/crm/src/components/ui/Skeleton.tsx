import { cn } from "@/lib/utils";

/** Skeleton — placeholder de carregamento (respeita prefers-reduced-motion). */
export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-lg bg-secondary", className)}
      {...props}
    />
  );
}
