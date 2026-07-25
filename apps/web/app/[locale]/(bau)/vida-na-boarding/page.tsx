import { getTranslations, setRequestLocale } from "next-intl/server";

import { Eyebrow, Reveal, Section, VideoCard } from "@/components/bau";
import { FinalCta } from "@/components/sections/FinalCta";
import { PageHero } from "@/components/sections/PageHero";
import { BAU_PAGES, buildBauMetadata } from "@/config/site-pages";
import { DEPOIMENTOS_FAMILIAS } from "@/data/testimonials";

export const metadata = buildBauMetadata(BAU_PAGES.boarding);

interface PageProps {
  params: Promise<{ locale: string }>;
}

/**
 * INVERSÃO DELIBERADA (BAU-02 Parte 3): esta é a única página de fundo ivory —
 * a página "de dia" do site. A mudança de temperatura É a mensagem: aqui se
 * fala de cuidado, não de estratégia.
 *
 * O hero permanece navy para não quebrar a continuidade da navegação; a
 * inversão começa na rotina.
 */
export default async function BoardingPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site");
  const copy = t.raw("boarding") as BoardingCopy;

  // As mães são a voz que esta página precisa — não os atletas.
  const maes = DEPOIMENTOS_FAMILIAS.filter((f) => f.mae).slice(0, 3);

  return (
    <>
      <PageHero eyebrow={copy.hero.eyebrow} title={copy.hero.title} sub={copy.hero.sub} />

      {/* A rotina como peça central, em ivory. */}
      <Section tone="ivory">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-4">
            <Reveal>
              <Eyebrow tone="light">{copy.routine.eyebrow}</Eyebrow>
              <h2 className="bau-display mt-6 text-[2rem] text-bau-navy-deep lg:text-[2.5rem]">
                {copy.routine.title}
              </h2>
              <p className="mt-6 text-[15px] leading-relaxed text-bau-navy/60">
                {copy.routine.note}
              </p>
            </Reveal>
          </div>

          <Reveal delay={120} className="mt-10 lg:col-span-7 lg:col-start-6 lg:mt-0">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">{copy.routine.caption}</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="bau-mono w-32 border-t border-bau-gold pb-4 pt-4 text-[11px] font-medium text-bau-navy/70"
                  >
                    {copy.routine.timeLabel}
                  </th>
                  <th
                    scope="col"
                    className="bau-mono border-t border-bau-gold pb-4 pl-6 pt-4 text-[11px] font-medium text-bau-navy/70"
                  >
                    {copy.routine.momentLabel}
                  </th>
                </tr>
              </thead>
              <tbody>
                {copy.routine.rows.map((row) => (
                  <tr key={row.time} className="border-t border-bau-navy/10 align-top">
                    <th
                      scope="row"
                      className="bau-mono py-6 text-left text-[13px] font-medium text-bau-navy-deep"
                    >
                      {row.time}
                    </th>
                    <td className="py-6 pl-6 text-[16px] leading-relaxed text-bau-navy/80">
                      {row.moment}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="bau-signature mt-12 text-[1.375rem] text-bau-navy-deep">
              {copy.routine.closing}
            </p>
          </Reveal>
        </div>
      </Section>

      {/* As cinco seguranças — cards claros. */}
      <Section tone="ivory" space="tight">
        <Reveal>
          <Eyebrow tone="light">{copy.safeties.eyebrow}</Eyebrow>
          <h2 className="bau-display mt-6 text-[2rem] text-bau-navy-deep lg:text-[2.5rem]">
            {copy.safeties.title}
          </h2>
        </Reveal>

        <ul className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {copy.safeties.items.map((item, i) => (
            <li key={item.title}>
              <Reveal
                delay={i * 70}
                className="block h-full rounded-[var(--radius-bau)] border border-bau-navy/10 bg-white p-8 transition-colors duration-200 hover:border-bau-blue"
              >
                <h3 className="bau-display text-[1.5rem] text-bau-navy-deep">{item.title}</h3>
                <p className="mt-4 text-[16px] leading-relaxed text-bau-navy/70">
                  {item.description}
                </p>
              </Reveal>
            </li>
          ))}
        </ul>
      </Section>

      {/* Volta ao navy: a BAU depois do embarque. */}
      <Section tone="deep">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow>{copy.afterBoarding.eyebrow}</Eyebrow>
              <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">
                {copy.afterBoarding.title}
              </h2>
            </Reveal>
          </div>
          <div className="mt-10 space-y-6 lg:col-span-6 lg:col-start-7 lg:mt-0">
            {copy.afterBoarding.paragraphs.map((paragraph, i) => (
              <Reveal key={paragraph} delay={i * 80}>
                <p className="bau-prose text-[17px] text-bau-stone">{paragraph}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      {maes.length > 0 ? (
        <Section tone="deep" space="tight">
          <Reveal>
            <Eyebrow>{copy.mothers.eyebrow}</Eyebrow>
            <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">{copy.mothers.title}</h2>
          </Reveal>

          <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {maes.map((familia) => (
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
      ) : null}

      <FinalCta
        title={copy.finalCta.title}
        body={copy.finalCta.body}
        signature={t("signatures.human")}
        ctaLabel={t("cta.primary")}
        source="boarding"
      />
    </>
  );
}

interface BoardingCopy {
  hero: { eyebrow: string; title: string; sub: string };
  routine: {
    eyebrow: string;
    title: string;
    timeLabel: string;
    momentLabel: string;
    caption: string;
    rows: { time: string; moment: string }[];
    closing: string;
    note: string;
  };
  safeties: { eyebrow: string; title: string; items: { title: string; description: string }[] };
  afterBoarding: { eyebrow: string; title: string; paragraphs: string[] };
  mothers: { eyebrow: string; title: string };
  finalCta: { title: string; body: string };
}
