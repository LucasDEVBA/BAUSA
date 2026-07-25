import { getTranslations, setRequestLocale } from "next-intl/server";

import { Eyebrow, PillarGrid, Reveal, Section, Timeline, Watermark } from "@/components/bau";
import { FinalCta } from "@/components/sections/FinalCta";
import { PageHero } from "@/components/sections/PageHero";
import { BAU_PAGES, buildBauMetadata } from "@/config/site-pages";

export const metadata = buildBauMetadata(BAU_PAGES.method);

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * A página mais técnica do site: eyebrows em mono, hairlines, precisão.
 * O momento memorável são as iniciais S/A/F/E em Caslon monumental.
 */
export default async function MethodPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site");
  const copy = t.raw("method") as MethodCopy;

  return (
    <>
      <PageHero
        eyebrow={copy.hero.eyebrow}
        title={copy.hero.title}
        sub={copy.hero.sub}
      />

      <Section tone="navy" space="tight">
        <Watermark side="left" />
        <div className="relative z-10 lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow>{copy.why.eyebrow}</Eyebrow>
              <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">{copy.why.title}</h2>
            </Reveal>
          </div>
          <Reveal delay={120} className="mt-8 lg:col-span-6 lg:col-start-7 lg:mt-0">
            <p className="bau-prose text-[17px] text-bau-stone">{copy.why.body}</p>
          </Reveal>
        </div>
      </Section>

      <Section tone="deep">
        <Reveal>
          <Eyebrow>{copy.pillars.eyebrow}</Eyebrow>
        </Reveal>
        <div className="mt-12">
          <PillarGrid pillars={copy.pillars.items} />
        </div>
      </Section>

      <Section tone="navy">
        <Reveal>
          <Eyebrow>{copy.flow.eyebrow}</Eyebrow>
          <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">{copy.flow.title}</h2>
        </Reveal>
        <div className="mt-16">
          <Timeline phases={copy.flow.steps} />
        </div>
      </Section>

      <FinalCta
        title={copy.finalCta.title}
        signature={t("signatures.path")}
        ctaLabel={t("cta.primary")}
        source="metodo"
      />
    </>
  );
}

interface MethodCopy {
  hero: { eyebrow: string; title: string; sub: string };
  why: { eyebrow: string; title: string; body: string };
  pillars: { eyebrow: string; items: { initial: string; title: string; description: string }[] };
  flow: {
    eyebrow: string;
    title: string;
    steps: { label: string; title: string; description: string }[];
  };
  finalCta: { title: string };
}
