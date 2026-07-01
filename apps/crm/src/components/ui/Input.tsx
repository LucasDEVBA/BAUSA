import { forwardRef } from "react";
import { cn } from "@/lib/utils";

/** Input — campo de texto tokenizado, foco no anel primário BAU. */
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
        "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground transition-colors",
        "placeholder:text-placeholder",
        "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
