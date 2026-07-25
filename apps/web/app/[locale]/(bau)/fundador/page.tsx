import { getTranslations, setRequestLocale } from "next-intl/server";

import leandro from "@/assets/leandro-ribeiro.jpg";
import { Eyebrow, RecFrame, Reveal, Section, VideoCard, Watermark } from "@/components/bau";
import { FinalCta } from "@/components/sections/FinalCta";
import { BAU_PAGES, buildBauMetadata } from "@/config/site-pages";
import { VISITAS_INSTITUCIONAIS } from "@/data/testimonials";

export const metadata = buildBauMetadata(BAU_PAGES.founder);

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * Hero próprio (não usa PageHero): é a única página com retrato, e o retrato em
 * preto e branco é a única P&B do site — sinaliza "origem, história".
 */
export default async function FounderPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site");
  const copy = t.raw("founder") as FounderCopy;

  return (
    <>
      <Section tone="deep" className="pt-[calc(var(--bau-header-h)+5rem)]">
        <div className="lg:grid lg:grid-cols-12 lg:items-end lg:gap-16">
          <div className="lg:col-span-6">
            <Reveal>
              <Eyebrow>{copy.hero.eyebrow}</Eyebrow>
            </Reveal>
            <Reveal delay={0.12}>
              <h1 className="bau-display mt-8 text-[2.25rem] sm:text-[3rem] lg:text-[3.75rem]">
                {copy.hero.title}
              </h1>
            </Reveal>
            <Reveal delay={0.28}>
              <p className="bau-mono mt-10 text-[12px] text-bau-stone">{copy.hero.sub}</p>
            </Reveal>
          </div>

          <Reveal delay={0.2} className="mt-14 lg:col-span-5 lg:col-start-8 lg:mt-0">
            <RecFrame timestamp="LEANDRO RIBEIRO · FUNDADOR" className="overflow-hidden">
              <img
                src={leandro.src}
                alt={copy.hero.portraitAlt}
                loading="lazy"
                decoding="async"
                // Única P&B do site.
                className="aspect-[4/5] w-full object-cover grayscale"
              />
            </RecFrame>
          </Reveal>
        </div>
      </Section>

      {/* Três atos, em blocos alternados. */}
      <Section tone="navy">
        <Watermark side="left" />
        <div className="relative z-10">
          <Reveal>
            <Eyebrow>{copy.acts.eyebrow}</Eyebrow>
          </Reveal>

          <div className="mt-14 space-y-16">
            {copy.acts.items.map((act, i) => (
              <Reveal key={act.title} delay={i * 0.08}>
                <div className="lg:grid lg:grid-cols-12 lg:gap-16">
                  <h2
                    className={`bau-display text-[1.75rem] text-bau-ivory lg:col-span-3 lg:text-[2rem] ${
                      i % 2 === 1 ? "lg:col-start-2" : ""
                    }`}
                  >
                    {act.title}
                  </h2>
                  <p className="bau-prose mt-4 text-[17px] text-bau-stone lg:col-span-8 lg:col-start-5 lg:mt-0">
                    {act.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {/* Presença institucional — prova dentro do frame REC. */}
      <Section tone="deep">
        <Reveal>
          <Eyebrow>{copy.presence.eyebrow}</Eyebrow>
          <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">{copy.presence.title}</h2>
          <p className="bau-prose mt-6 text-[17px] text-bau-stone">{copy.presence.body}</p>
        </Reveal>

        <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {VISITAS_INSTITUCIONAIS.map((visita) => (
            <li key={visita.youtubeId}>
              <VideoCard
                youtubeId={visita.youtubeId}
                thumbnail={visita.thumbnail.src}
                name={visita.name}
                context={visita.context}
                timestamp={visita.timestamp}
                playLabel={t("cta.watchTestimonial")}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="navy" space="tight">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow>{copy.team.eyebrow}</Eyebrow>
              <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">{copy.team.title}</h2>
            </Reveal>
          </div>
          <Reveal delay={0.12} className="mt-8 lg:col-span-6 lg:col-start-7 lg:mt-0">
            <p className="bau-prose text-[17px] text-bau-stone">{copy.team.body}</p>
          </Reveal>
        </div>
      </Section>

      <FinalCta
        title={copy.finalCta.title}
        signature={t("signatures.path")}
        ctaLabel={t("cta.primary")}
        source="fundador"
      />
    </>
  );
}

interface FounderCopy {
  hero: { eyebrow: string; title: string; sub: string; portraitAlt: string };
  acts: { eyebrow: string; items: { title: string; description: string }[] };
  presence: { eyebrow: string; title: string; body: string };
  team: { eyebrow: string; title: string; body: string };
  finalCta: { title: string };
}
