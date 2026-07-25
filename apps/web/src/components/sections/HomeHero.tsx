import { CtaPrimary, ArrowLink, Eyebrow, Reveal } from "@/components/bau";

/**
 * Hero da home — o único do site com fotografia.
 *
 * Sequência orquestrada de entrada (BAU-02 §2.6): eyebrow (0ms) → H1 (120ms) →
 * sub (400ms) → CTA (550ms). É a única sequência orquestrada do site; nas
 * demais páginas a entrada é o fade+rise padrão.
 *
 * A foto recebe véu navy a 70% — garante contraste AA do ivory sobre ela e
 * unifica a gradação fria do site inteiro.
 */
export function HomeHero({
  eyebrow,
  title,
  sub,
  ctaLabel,
  secondaryCta,
  secondaryHref,
  imageAlt,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  ctaLabel: string;
  secondaryCta: string;
  secondaryHref: string;
  imageAlt: string;
}) {
  return (
    <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden pt-[var(--bau-header-h)]">
      {/* LCP da home. `fetchPriority=high` + preload no layout. */}
      <img
        src="/hero-campus.jpg"
        alt={imageAlt}
        fetchPriority="high"
        decoding="async"
        width={1920}
        height={1080}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Véu navy a 70% (BAU-02 Parte 3) — garante AA do ivory sobre a foto e
          unifica a gradação fria, sem apagar a arquitetura do campus, que é
          justamente o que comunica autoridade institucional. */}
      <div aria-hidden="true" className="absolute inset-0 bg-bau-navy-deep/70" />
      {/* Reforço só na base, onde fica o texto. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-bau-navy-deep via-bau-navy-deep/25 to-transparent"
      />

      <div className="bau-container relative z-10 py-24">
        <div className="max-w-4xl">
          <Reveal>
            <Eyebrow>{eyebrow}</Eyebrow>
          </Reveal>

          <Reveal delay={120}>
            <h1 className="bau-display mt-8 text-[2.75rem] sm:text-[4rem] lg:text-[5.5rem]">
              {title}
            </h1>
          </Reveal>

          <Reveal delay={400}>
            <p className="bau-prose mt-8 text-[17px] text-bau-stone sm:text-[19px]">{sub}</p>
          </Reveal>

          <Reveal delay={550}>
            <div className="mt-12 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
              <CtaPrimary source="hero" label={ctaLabel} />
              <ArrowLink href={secondaryHref}>{secondaryCta}</ArrowLink>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
