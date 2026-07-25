import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Casca de seção — dá o ritmo editorial do site (BAU-02 §2.4).
 *
 * Alternar `tone` é o que impede o achatamento narrativo apontado no guia:
 * seções densas (grid, tabela) sobre navy, seções de cuidado sobre ivory.
 * Server Component: não emite JS.
 */
type SectionTone = "deep" | "navy" | "ivory";

const TONE: Record<SectionTone, string> = {
  deep: "bg-bau-navy-deep text-bau-ivory",
  navy: "bg-bau-navy text-bau-ivory",
  // Única inversão de temperatura do site — sinaliza "aqui falamos de cuidado".
  ivory: "bg-bau-ivory text-bau-navy-deep",
};

const SPACE = {
  normal: "py-[6.5rem] lg:py-[10.5rem]",
  tight: "py-[4rem] lg:py-[6.5rem]",
} as const;

interface SectionProps {
  children: ReactNode;
  tone?: SectionTone;
  space?: keyof typeof SPACE;
  id?: string;
  className?: string;
  /** Remove o container central — para faixas que sangram a viewport. */
  bleed?: boolean;
}

export function Section({
  children,
  tone = "deep",
  space = "normal",
  id,
  className,
  bleed = false,
}: SectionProps) {
  return (
    <section
      id={id}
      className={cn("relative overflow-hidden", TONE[tone], SPACE[space], className)}
    >
      {bleed ? children : <div className="bau-container relative z-10">{children}</div>}
    </section>
  );
}

/** Container de 1240px com as margens do guia (24px mobile / 80px desktop). */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bau-container", className)}>{children}</div>;
}
