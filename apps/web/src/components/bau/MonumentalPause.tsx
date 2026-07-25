import { cn } from "@/lib/utils";

import { Reveal } from "./Reveal";

/**
 * Seção de pausa (BAU-02 Parte 1, item 6): uma frase monumental ocupando a
 * tela inteira, entre duas seções densas. É o que dá respiração diferenciada à
 * narrativa — sem ela todas as seções pesam igual e a história achata.
 *
 * As palavras assentam com 60ms de intervalo quando a frase entra em cena.
 * O escalonamento é composto sobre `Reveal`, então `prefers-reduced-motion`
 * continua resolvido num único lugar.
 *
 * Regra: no máximo uma por página — é candidata a "momento memorável".
 */
export function MonumentalPause({
  phrase,
  tone = "deep",
  className,
}: {
  phrase: string;
  tone?: "deep" | "navy" | "ivory";
  className?: string;
}) {
  const words = phrase.split(" ");

  return (
    <section
      className={cn(
        "relative flex min-h-[80vh] items-center justify-center overflow-hidden px-6 py-[6.5rem]",
        tone === "ivory" ? "bg-bau-ivory text-bau-navy-deep" : "bg-bau-navy-deep text-bau-ivory",
        tone === "navy" && "bg-bau-navy",
        className,
      )}
    >
      <p className="bau-display bau-container text-center text-[2rem] leading-[1.15] sm:text-[3rem] lg:text-[4.25rem]">
        {words.map((word, i) => (
          <Reveal
            // A frase é estática e definida na copy: o índice é chave estável.
            key={`${word}-${i}`}
            as="span"
            delay={i * 0.06}
            // Espaço via margem: um inline-block não colapsa espaço em branco
            // de forma previsível entre irmãos.
            className="mr-[0.25em] inline-block"
          >
            {word}
          </Reveal>
        ))}
      </p>
    </section>
  );
}
