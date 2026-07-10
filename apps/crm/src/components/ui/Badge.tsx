import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge / Pill — status, contadores e classificações. Tinted fill por tom.
 * Classes literais por tom (exigência do Tailwind v4).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border font-semibold leading-none",
  {
    variants: {
      tone: {
        neutral: "border-border bg-secondary text-muted-foreground",
        brand: "border-primary/20 bg-primary/10 text-primary",
        burgundy: "border-bau-burgundy/20 bg-bau-burgundy/10 text-bau-burgundy",
        green: "border-sys-green/20 bg-sys-green/12 text-sys-green",
        orange: "border-sys-orange/20 bg-sys-orange/12 text-sys-orange",
        red: "border-sys-red/20 bg-sys-red/12 text-sys-red",
        blue: "border-sys-blue/20 bg-sys-blue/12 text-sys-blue",
        purple: "border-sys-purple/20 bg-sys-purple/12 text-sys-purple",
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
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
