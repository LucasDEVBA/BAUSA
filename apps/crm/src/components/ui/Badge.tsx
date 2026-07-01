import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge / Pill — status, deltas e contadores (DESIGN_SPEC §6.4).
 * Tinted fill tokenizado: bg-{tom}/15 · text-{tom} · border-{tom}/20.
 * Tons semânticos (status) e de marca (destaque). Classes literais por tom
 * (exigência do Tailwind v4 — nada de interpolação de className).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border font-semibold leading-none",
  {
    variants: {
      tone: {
        neutral:
          "border-border bg-secondary text-muted-foreground",
        green: "border-sys-green/20 bg-sys-green/15 text-sys-green",
        orange: "border-sys-orange/20 bg-sys-orange/15 text-sys-orange",
        red: "border-sys-red/20 bg-sys-red/15 text-sys-red",
        blue: "border-primary/20 bg-primary/15 text-primary",
        purple: "border-sys-purple/20 bg-sys-purple/15 text-sys-purple",
        yellow: "border-sys-yellow/25 bg-sys-yellow/15 text-sys-yellow",
        brand: "border-bau-blue/20 bg-bau-blue/15 text-bau-blue",
        burgundy:
          "border-bau-burgundy/20 bg-bau-burgundy/15 text-bau-burgundy",
        gold: "border-bau-gold/25 bg-bau-gold/15 text-bau-gold",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[10px]",
        md: "px-2 py-0.5 text-[11px]",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props} />
  );
}
