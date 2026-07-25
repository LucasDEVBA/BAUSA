import { getTranslations, setRequestLocale } from "next-intl/server";

import { Eyebrow, MonumentalStat, Reveal, Section, Timeline, Watermark } from "@/components/bau";
import { FinalCta } from "@/components/sections/FinalCta";
import { PageHero } from "@/components/sections/PageHero";
import { BAU_PAGES, buildBauMetadata } from "@/config/site-pages";

export const metadata = buildBauMetadata(BAU_PAGES.journey);

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * A timeline de 6 fases é a espinha da página; o "96%" é o momento memorável,
 * numa seção-pausa própria entre a jornada e o bloco High School.
 */
export default async function JourneyPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site");
  const copy = t.raw("journey") as JourneyCopy;

  return (
    <>
      <PageHero eyebrow={copy.hero.eyebrow} title={copy.hero.title} sub={copy.hero.sub} />

      <Section tone="deep">
        <Reveal>
          <Eyebrow>{copy.timeline.eyebrow}</Eyebrow>
        </Reveal>
        <div className="mt-16">
          <Timeline phases={copy.timeline.phases} />
        </div>
      </Section>

      {/* Seção-pausa do dado. */}
      <Section tone="navy">
        <Watermark side="right" />
        <div className="relative z-10">
          <MonumentalStat value={copy.stat.value} eyebrow={copy.stat.eyebrow}>
            {copy.stat.description}
          </MonumentalStat>
          <Reveal delay={200} className="mt-16 lg:ml-[50%] lg:pl-8">
            <p className="bau-prose text-[17px] text-bau-stone">{copy.stat.body}</p>
          </Reveal>
        </div>
      </Section>

      <Section tone="deep">
        <Reveal>
          <Eyebrow>{copy.highSchool.eyebrow}</Eyebrow>
          <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">
            {copy.highSchool.title}
          </h2>
        </Reveal>

        <ul className="mt-14 grid gap-px bg-[var(--bau-hairline)] sm:grid-cols-2">
          {copy.highSchool.items.map((item, i) => (
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

      <FinalCta
        title={copy.finalCta.title}
        signature={t("signatures.path")}
        ctaLabel={t("cta.primary")}
        source="jornada"
      />
    </>
  );
}

interface JourneyCopy {
  hero: { eyebrow: string; title: string; sub: string };
  timeline: { eyebrow: string; phases: { label: string; title: string; description: string }[] };
  stat: { eyebrow: string; value: string; description: string; body: string };
  highSchool: { eyebrow: string; title: string; items: { title: string; description: string }[] };
  finalCta: { title: string };
}
