import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Card — primitivo base de superfície (DESIGN_SPEC §6.1).
 * Container tokenizado (bg-card / border / radius / shadow). Sem cor solta.
 * `variant`: default (card sólido) · glass (.glass-card) · plain (sem borda/sombra).
 * `interactive`: adiciona hover:shadow-md + foco visível quando o card é clicável
 *  (o handler/role/tabIndex ficam a cargo do caller — só apresentação aqui).
 */
const cardVariants = cva("rounded-xl text-card-foreground", {
  variants: {
    variant: {
      default: "border border-border bg-card shadow-sm",
      glass: "glass-card",
      plain: "bg-card",
    },
    padding: {
      none: "",
      sm: "p-4",
      md: "p-5",
    },
    interactive: {
      true: "transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      false: "",
    },
  },
  defaultVariants: { variant: "default", padding: "sm", interactive: false },
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
