import { getTranslations, setRequestLocale } from "next-intl/server";

import { ContrastTable, Eyebrow, MonumentalPause, Reveal, Section, Watermark } from "@/components/bau";
import { FinalCta } from "@/components/sections/FinalCta";
import { PageHero } from "@/components/sections/PageHero";
import { BAU_PAGES, buildBauMetadata } from "@/config/site-pages";

export const metadata = buildBauMetadata(BAU_PAGES.concept);

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ConceptPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site");
  // `raw` devolve arrays e objetos; `t()` só devolveria string.
  const copy = t.raw("concept") as ConceptCopy;

  return (
    <>
      <PageHero
        eyebrow={t("nav.concept").toUpperCase()}
        title={copy.hero.titleLine1}
        secondLine={copy.hero.titleLine2}
        sub={copy.hero.sub}
      />

      {/* O problema — texto editorial em coluna estreita, assimétrico. */}
      <Section tone="deep" space="tight">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow>{copy.problem.eyebrow}</Eyebrow>
              <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">
                {copy.problem.title}
              </h2>
            </Reveal>
          </div>

          <div className="mt-10 space-y-6 lg:col-span-6 lg:col-start-7 lg:mt-0">
            {copy.problem.paragraphs.map((paragraph, i) => (
              <Reveal key={paragraph} delay={i * 80}>
                <p className="bau-prose text-[17px] text-bau-stone">{paragraph}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section tone="navy">
        <Watermark side="left" />
        <div className="relative z-10 lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow>{copy.definition.eyebrow}</Eyebrow>
              <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">
                {copy.definition.title}
              </h2>
            </Reveal>
          </div>

          <div className="mt-10 space-y-6 lg:col-span-6 lg:col-start-7 lg:mt-0">
            {copy.definition.paragraphs.map((paragraph, i) => (
              <Reveal key={paragraph} delay={i * 80}>
                <p className="bau-prose text-[17px] text-bau-stone">{paragraph}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* Os três fundamentos */}
      <Section tone="deep" space="tight">
        <Reveal>
          <Eyebrow>{copy.foundations.eyebrow}</Eyebrow>
        </Reveal>

        <ul className="mt-12 grid gap-px bg-[var(--bau-hairline)] lg:grid-cols-3">
          {copy.foundations.items.map((item, i) => (
            <li key={item.title} className="bg-bau-navy-deep">
              <Reveal delay={i * 80} className="block h-full p-8 lg:p-10">
                <h3 className="bau-display text-[1.5rem] text-bau-ivory">{item.title}</h3>
                <p className="mt-4 text-[16px] leading-relaxed text-bau-stone">
                  {item.description}
                </p>
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      {/* Momento memorável da página. */}
      <MonumentalPause phrase={copy.pause} />

      <Section tone="deep">
        <div className="mx-auto max-w-4xl">
          <Reveal>
            <Eyebrow>{copy.contrast.eyebrow}</Eyebrow>
            <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">
              {copy.contrast.title}
            </h2>
          </Reveal>

          <div className="mt-14">
            <ContrastTable
              marketLabel={copy.contrast.marketLabel}
              bauLabel={copy.contrast.bauLabel}
              rows={copy.contrast.rows}
              caption={copy.contrast.caption}
            />
          </div>
        </div>
      </Section>

      {/* Filtro de pertencimento e CTA são UM bloco no BAU-01 (§2.6): o texto
          que qualifica a família é o mesmo que a convida. */}
      <FinalCta
        eyebrow={copy.belonging.eyebrow}
        title={copy.belonging.title}
        body={copy.belonging.paragraphs.join(" ")}
        signature={t("signatures.integrated")}
        ctaLabel={t("cta.primary")}
        source="conceito"
      />
    </>
  );
}

/** Formato da copy desta página (`site.concept` em src/i18n/site/pt.ts). */
interface ConceptCopy {
  hero: { titleLine1: string; titleLine2: string; sub: string };
  problem: { eyebrow: string; title: string; paragraphs: string[] };
  definition: { eyebrow: string; title: string; paragraphs: string[] };
  foundations: { eyebrow: string; items: { title: string; description: string }[] };
  pause: string;
  contrast: {
    eyebrow: string;
    title: string;
    marketLabel: string;
    bauLabel: string;
    caption: string;
    rows: { market: string; bau: string }[];
  };
  belonging: { eyebrow: string; title: string; paragraphs: string[] };
}
