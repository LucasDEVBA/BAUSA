import logoWatermark from "@/assets/logo-watermark.png";
import { cn } from "@/lib/utils";

/**
 * Marca d'água monumental (BAU-02 Parte 1, item 1).
 *
 * A versão antiga do site espalhava 11 cópias da marca em mosaico por seção —
 * o guia diagnostica que repetição em excesso lê como papel de parede, e papel
 * de parede lê como barato. Aqui é UMA por seção, ocupando 60–80% da altura,
 * tom sobre tom, sempre sangrando a borda: de textura repetida a presença
 * arquitetônica.
 *
 * Decorativa: `aria-hidden` e fora da ordem de leitura.
 */
export function Watermark({
  side = "right",
  className,
}: {
  side?: "left" | "right";
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-1/2 z-0 -translate-y-1/2 select-none",
        // Sangra a borda — nunca inteira dentro do quadro. O deslocamento é
        // maior que a metade do logo para garantir o corte mesmo em telas
        // largas, onde o container trava em 1240px.
        side === "right" ? "-right-[22%] lg:-right-[14%]" : "-left-[22%] lg:-left-[14%]",
        className,
      )}
    >
      <img
        src={logoWatermark.src}
        alt=""
        loading="lazy"
        decoding="async"
        // Δ de contraste bem abaixo dos 5% do guia: presença arquitetônica,
        // não objeto. Acima disso passa a competir com o título.
        className="h-[65vh] max-h-[680px] w-auto opacity-[0.022]"
      />
    </div>
  );
}
