import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Input — campo de texto tokenizado (DESIGN_SPEC §6, §9).
 * border-input · bg-background · foco no anel primário BAU. Placeholder e
 * disabled tokenizados. Só apresentação — validação/onChange ficam no caller.
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type ?? "text"}
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors",
        "placeholder:text-placeholder",
        "focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
