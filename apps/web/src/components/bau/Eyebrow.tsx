import { cn } from "@/lib/utils";

/**
 * Marcador de seção do site inteiro (BAU-02 §2.5): Plex Mono caps em stone,
 * com um traço de 24px em gold à esquerda. Substitui qualquer numeração
 * decorativa — não existe outro marcador de seção no sistema.
 */
export function Eyebrow({
  children,
  className,
  tone = "dark",
}: {
  children: React.ReactNode;
  className?: string;
  /** `light` = sobre fundo ivory. */
  tone?: "dark" | "light";
}) {
  return (
    <p
      className={cn(
        "bau-mono flex items-center gap-3 text-[12px] leading-none",
        tone === "dark" ? "text-bau-stone" : "text-bau-navy/70",
        className,
      )}
    >
      <span aria-hidden="true" className="h-px w-6 shrink-0 bg-bau-gold" />
      {children}
    </p>
  );
}
