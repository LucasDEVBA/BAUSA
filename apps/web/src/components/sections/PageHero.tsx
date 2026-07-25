import { Eyebrow, Reveal, Section, Watermark } from "@/components/bau";

/**
 * Hero das páginas internas — tipográfico puro, sem foto.
 *
 * A home tem o único hero com imagem do site; nas páginas de narrativa o
 * Caslon monumental sobre navy é o suficiente. Isso mantém "um momento
 * memorável por página" livre para o que cada página tem de próprio (a
 * frase-pausa do Conceito, o 96% da Jornada, a inversão da Boarding).
 */
export function PageHero({
  eyebrow,
  title,
  secondLine,
  sub,
}: {
  eyebrow: string;
  title: string;
  /** Segunda linha do H1 — quebra editorial, não parágrafo separado. */
  secondLine?: string;
  sub: string;
}) {
  return (
    <Section tone="deep" className="pt-[calc(var(--bau-header-h)+6rem)]">
      <Watermark />

      <div className="relative z-10 lg:grid lg:grid-cols-12">
        <div className="lg:col-span-10">
          <Reveal>
            <Eyebrow>{eyebrow}</Eyebrow>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="bau-display mt-8 text-[2.5rem] sm:text-[3.5rem] lg:text-[4.5rem]">
              {title}
              {secondLine ? (
                <>
                  <br />
                  <span className="text-bau-stone">{secondLine}</span>
                </>
              ) : null}
            </h1>
          </Reveal>

          <Reveal delay={280}>
            <p className="bau-prose mt-10 text-[18px] text-bau-stone">{sub}</p>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
