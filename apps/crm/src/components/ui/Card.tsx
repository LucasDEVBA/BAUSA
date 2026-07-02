import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Card — superfície premium do design system v2.
 * `glass`  liquid glass intenso (padrão premium, refrata a aurora do <main>)
 * `plain`  superfície sólida · `ghost` sem borda/sombra.
 * `accent` desenha um traço curto e delicado no canto superior esquerdo
 *  (detalhe minimalista de cor por significado).
 */
const cardVariants = cva("relative rounded-2xl text-card-foreground", {
  variants: {
    variant: {
      glass: "glass-card",
      plain: "border border-border bg-card shadow-sm",
      ghost: "bg-card",
    },
    padding: { none: "", sm: "p-3", md: "p-4", lg: "p-5" },
    interactive: {
      true: "transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      false: "",
    },
  },
  defaultVariants: { variant: "glass", padding: "md", interactive: false },
});

export type CardAccent =
  | "brand"
  | "burgundy"
  | "green"
  | "orange"
  | "red"
  | "blue"
  | "purple"
  | "teal"
  | "neutral";

const ACCENT_STUB: Record<CardAccent, string> = {
  brand: "bg-primary",
  burgundy: "bg-bau-burgundy",
  green: "bg-sys-green",
  orange: "bg-sys-orange",
  red: "bg-sys-red",
  blue: "bg-sys-blue",
  purple: "bg-sys-purple",
  teal: "bg-sys-teal",
  neutral: "bg-label-quaternary",
};

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  accent?: CardAccent;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant, padding, interactive, accent, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, padding, interactive }), className)}
      {...props}
    >
      {accent && (
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-3 top-4 h-4 w-[3px] rounded-full",
            ACCENT_STUB[accent],
          )}
        />
      )}
      {children}
    </div>
  );
});
