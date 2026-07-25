import { getTranslations, setRequestLocale } from "next-intl/server";

import { Eyebrow, Reveal, Section, VideoCard, Watermark } from "@/components/bau";
import { FinalCta } from "@/components/sections/FinalCta";
import { PageHero } from "@/components/sections/PageHero";
import { BAU_PAGES, buildBauMetadata } from "@/config/site-pages";
import { DEPOIMENTOS_ATLETAS, DEPOIMENTOS_FAMILIAS } from "@/data/testimonials";

export const metadata = buildBauMetadata(BAU_PAGES.stories);

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Prova em profundidade: cada história é um capítulo, com o vídeo do atleta à
 * esquerda (frame REC) e a narrativa em quatro atos à direita — decisão,
 * leitura, hoje, vozes. Não é card de depoimento.
 */
export default async function StoriesPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site");
  const copy = t.raw("stories") as StoriesCopy;

  return (
    <>
      <PageHero eyebrow={copy.hero.eyebrow} title={copy.hero.title} sub={copy.hero.sub} />

      {copy.items.map((story, index) => {
        const video = DEPOIMENTOS_ATLETAS[index];

        return (
          <Section
            key={story.slug}
            id={story.slug}
            tone={index % 2 === 0 ? "deep" : "navy"}
          >
            {index % 2 === 0 ? <Watermark side="right" /> : null}

            <div className="relative z-10 lg:grid lg:grid-cols-12 lg:gap-16">
              {/* Vídeo à esquerda — o rosto só aparece dentro do frame REC. */}
              <div className="lg:col-span-4">
                {video ? (
                  <VideoCard
                    youtubeId={video.youtubeId}
                    thumbnail={video.thumbnail.src}
                    name={story.name}
                    context={`${story.age} · ${story.school}`}
                    timestamp={story.timestamp}
                    playLabel={t("cta.watchTestimonial")}
                  />
                ) : null}
              </div>

              <div className="mt-12 lg:col-span-7 lg:col-start-6 lg:mt-0">
                <Reveal>
                  <Eyebrow>{`${story.name} · ${story.school}`}</Eyebrow>
                </Reveal>

                <dl className="mt-10 space-y-10">
                  {(
                    [
                      [copy.actLabels.decision, story.decision],
                      [copy.actLabels.reading, story.reading],
                      [copy.actLabels.today, story.today],
                    ] as const
                  ).map(([label, text], i) => (
                    <Reveal key={label} delay={i * 0.08}>
                      <dt className="bau-display text-[1.375rem] text-bau-ivory">{label}</dt>
                      <dd className="bau-prose mt-3 text-[17px] text-bau-stone">{text}</dd>
                    </Reveal>
                  ))}
                </dl>
              </div>
            </div>
          </Section>
        );
      })}

      {/* Vozes das famílias */}
      <Section tone="deep">
        <Reveal>
          <Eyebrow>{copy.families.eyebrow}</Eyebrow>
          <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">{copy.families.title}</h2>
        </Reveal>

        <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {DEPOIMENTOS_FAMILIAS.map((familia) => (
            <li key={familia.youtubeId}>
              <VideoCard
                youtubeId={familia.youtubeId}
                thumbnail={familia.thumbnail.src}
                name={familia.name}
                timestamp={familia.timestamp}
                playLabel={t("cta.watchTestimonial")}
              />
            </li>
          ))}
        </ul>
      </Section>

      <FinalCta
        title={copy.finalCta.title}
        signature={t("signatures.human")}
        ctaLabel={t("cta.primary")}
        source="historias"
      />
    </>
  );
}

interface StoriesCopy {
  hero: { eyebrow: string; title: string; sub: string };
  actLabels: { decision: string; reading: string; today: string };
  items: {
    slug: string;
    name: string;
    age: string;
    school: string;
    timestamp: string;
    decision: string;
    reading: string;
    today: string;
  }[];
  families: { eyebrow: string; title: string };
  finalCta: { title: string };
}
