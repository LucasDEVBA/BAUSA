import { CtaPrimary, Eyebrow, Reveal, Section } from "@/components/bau";
import type { CtaSource } from "@/lib/tracking/events";

/**
 * Fecho de página: assinatura de marca em Caslon itálico + o CTA primário.
 *
 * Cada página passa uma `source` distinta para que a Atribuição do Engine
 * mostre de qual página da narrativa a família decidiu se candidatar.
 */
export function FinalCta({
  eyebrow,
  title,
  body,
  signature,
  ctaLabel,
  source,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  /** Assinatura de marca — o único itálico Caslon do sistema. */
  signature?: string;
  ctaLabel: string;
  source: CtaSource;
}) {
  return (
    <Section tone="navy">
      <div className="mx-auto max-w-3xl text-center">
        {eyebrow ? (
          <Reveal className="flex justify-center">
            <Eyebrow>{eyebrow}</Eyebrow>
          </Reveal>
        ) : null}

        <Reveal delay={80}>
          <h2 className="bau-display mt-8 text-[2rem] sm:text-[2.75rem]">{title}</h2>
        </Reveal>

        {body ? (
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-bau-stone">
              {body}
            </p>
          </Reveal>
        ) : null}

        {signature ? (
          <Reveal delay={200}>
            <p className="bau-signature mt-10 text-[1.5rem] text-bau-ivory/80">{signature}</p>
          </Reveal>
        ) : null}

        <Reveal delay={280} className="mt-12 flex justify-center">
          <CtaPrimary source={source} label={ctaLabel} />
        </Reveal>
      </div>
    </Section>
  );
}
