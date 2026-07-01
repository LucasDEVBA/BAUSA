import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Card — superfície base do design system v2.
 * `plain`  superfície sólida (bg-card + borda + sombra suave)
 * `glass`  liquid glass (barras/hero) · `ghost` sem borda/sombra
 */
const cardVariants = cva("rounded-2xl text-card-foreground", {
  variants: {
    variant: {
      plain: "border border-border bg-card shadow-sm",
      glass: "liquid-glass",
      ghost: "bg-card",
    },
    padding: { none: "", sm: "p-4", md: "p-5", lg: "p-6" },
    interactive: {
      true: "transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      false: "",
    },
  },
  defaultVariants: { variant: "plain", padding: "md", interactive: false },
});

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant, padding, interactive, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, interactive }), className)}
      {...props}
    />
  );
});
