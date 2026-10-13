import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import BrandCta from "@/components/brand/BrandCta";
import FinalCTA from "@/components/FinalCTA";
import HowWeWorkSection from "@/components/HowWeWorkSection";
import SAFEMethodSection from "@/components/SAFEMethodSection";
import WhyHighSchoolSection from "@/components/WhyHighSchoolSection";
import MethodFaq from "@/components/pages/metodo/MethodFaq";
import MethodHeroVisual from "@/components/pages/metodo/MethodHeroVisual";
import MethodJourney from "@/components/pages/metodo/MethodJourney";
import MethodVideoRail, { type RailVideo } from "@/components/pages/metodo/MethodVideoRail";
import { MethodVideoChip } from "@/components/pages/metodo/MethodVideoChip";
import PageHero from "@/components/site/PageHero";
import { SITE_URL, buildPageMetadata, localizedPath } from "@/config/seo";
import { PAGE_PATH } from "@/config/routes";
import { FAQ_ITEMS, METHOD_COPY, METHOD_HERO, SAFE_CHIPS, WATCH, keepTogether, toLang } from "@/content/metodo";
import { pick } from "@/content/types";
import { EDUCATIONAL_VIDEOS } from "@/content/videos";
import { JsonLd } from "@/lib/jsonld";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata("metodo", locale);
}

export default async function MetodoPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = toLang(locale);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: pick(METHOD_HERO.breadcrumbHome, lang), item: `${SITE_URL}${localizedPath(PAGE_PATH.home, lang)}` },
      { "@type": "ListItem", position: 2, name: pick(METHOD_HERO.breadcrumbCurrent, lang), item: `${SITE_URL}${localizedPath(PAGE_PATH.metodo, lang)}` },
    ],
  };

  // Mesma fonte do acordeão visível: o Google exige que o FAQPage reflita o que está na tela
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: lang,
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: pick(item.question, lang),
      acceptedAnswer: { "@type": "Answer", text: pick(item.answer, lang) },
    })),
  };

  const railVideos: RailVideo[] = EDUCATIONAL_VIDEOS.map((video) => ({
    id: video.id,
    kind: video.kind,
    title: keepTogether(pick(video.title, lang)),
    duration: video.duration,
    meta: pick(video.category === "institucional" ? WATCH.institutionalMeta : METHOD_COPY.founderMeta, lang),
  }));

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <JsonLd data={faqSchema} />

      <PageHero
        eyebrow={pick(METHOD_HERO.eyebrow, lang)}
        title={
          <>
            {pick(METHOD_HERO.titleBefore, lang)}{" "}
            <span className="whitespace-nowrap">
              <span className="ba-serif ba-grad-text text-[1.12em]">{pick(METHOD_HERO.titleAccent, lang)}</span>
              {/* ® na fonte do título: no itálico serifado ele vira um círculo enorme */}
              <sup className="ml-0.5 align-super text-[0.36em] font-semibold tracking-normal text-[var(--ba-wine)]">®</sup>
            </span>
            {pick(METHOD_HERO.titleAfter, lang) && <> {pick(METHOD_HERO.titleAfter, lang)}</>}
          </>
        }
        lead={<p className="m-0">{pick(METHOD_HERO.lead, lang)}</p>}
        breadcrumb={{ homeLabel: pick(METHOD_HERO.breadcrumbHome, lang), current: pick(METHOD_HERO.breadcrumbCurrent, lang) }}
        actions={
          <>
            <BrandCta source="metodo">{pick(METHOD_HERO.cta, lang)}</BrandCta>
            <div>
              <MethodVideoChip chip={SAFE_CHIPS.intro} />
            </div>
          </>
        }
        media={<MethodHeroVisual />}
      />

      <SAFEMethodSection variant="page" />
      <MethodJourney lang={lang} />
      <WhyHighSchoolSection />
      <HowWeWorkSection variant="page" />
      <MethodVideoRail
        eyebrow={pick(WATCH.eyebrow, lang)}
        titleBefore={pick(WATCH.titleBefore, lang)}
        titleAccent={pick(WATCH.titleAccent, lang)}
        lead={pick(WATCH.lead, lang)}
        languageNote={WATCH.languageNote[lang]}
        railLabel={pick(WATCH.railLabel, lang)}
        prevLabel={pick(WATCH.prev, lang)}
        nextLabel={pick(WATCH.next, lang)}
        videos={railVideos}
      />
      <MethodFaq />
      <FinalCTA source="metodo" />
    </>
  );
}
