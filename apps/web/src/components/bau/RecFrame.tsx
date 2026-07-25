import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * ELEMENTO-ASSINATURA DA MARCA (BAU-02 §2.5).
 *
 * Todo conteúdo de prova — depoimento, visita institucional, história — vive
 * dentro deste enquadramento de gravação. É a materialização visual de "prova
 * real, filmada, aconteceu": cantos em L nas quatro pontas, ponto vermelho
 * pulsando + "REC", e um timestamp documental no canto oposto.
 *
 * O ponto pulsando é o ÚNICO elemento animado permanente do site — e é CSS
 * puro (`.bau-rec-dot`), então este é um Server Component.
 *
 * Substitui as três implementações divergentes que existiam em
 * TestimonialsCarousel, ParentTestimonialsSection e InstitutionalRecognitionSection.
 */
interface RecFrameProps {
  children: ReactNode;
  /** Legenda documental do canto oposto, ex.: "MONTVERDE · FL · 2026". */
  timestamp?: string;
  className?: string;
}

/** Canto em L — 1.5px, ivory a 40%. */
function Corner({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute z-20 h-5 w-5 border-bau-ivory/40", className)}
    />
  );
}

export function RecFrame({ children, timestamp, className }: RecFrameProps) {
  return (
    <div className={cn("relative isolate", className)}>
      {children}

      <Corner className="left-3 top-3 border-l-[1.5px] border-t-[1.5px]" />
      <Corner className="right-3 top-3 border-r-[1.5px] border-t-[1.5px]" />
      <Corner className="bottom-3 left-3 border-b-[1.5px] border-l-[1.5px]" />
      <Corner className="bottom-3 right-3 border-b-[1.5px] border-r-[1.5px]" />

      {/* Indicador de gravação — um dos dois únicos usos de vermelho na tela. */}
      <div className="pointer-events-none absolute left-6 top-6 z-20 flex items-center gap-2">
        <span aria-hidden="true" className="bau-rec-dot block h-1.5 w-1.5 rounded-full bg-bau-red" />
        <span className="bau-mono text-[10px] leading-none text-bau-ivory/80">REC</span>
      </div>

      {timestamp ? (
        <span className="bau-mono pointer-events-none absolute bottom-6 right-6 z-20 text-[10px] leading-none text-bau-ivory/60">
          {timestamp}
        </span>
      ) : null}
    </div>
  );
}
