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
        // Sangra a borda — nunca inteira dentro do quadro.
        side === "right" ? "-right-[12%]" : "-left-[12%]",
        className,
      )}
    >
      <img
        src={logoWatermark.src}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-[70vh] max-h-[720px] w-auto opacity-[0.035]"
      />
    </div>
  );
}
