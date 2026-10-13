import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import BrandCta from "@/components/brand/BrandCta";
import VideoChip from "@/components/brand/VideoChip";
import FinalCTA from "@/components/FinalCTA";
import AthleteVideosSection from "@/components/pages/historias/AthleteVideosSection";
import AthleteWall from "@/components/pages/historias/AthleteWall";
import ConquistasSection from "@/components/pages/historias/ConquistasSection";
import FamilyVideosSection from "@/components/pages/historias/FamilyVideosSection";
import HistoriasHeroMedia from "@/components/pages/historias/HistoriasHeroMedia";
import PageHero from "@/components/site/PageHero";
import { PAGE_PATH } from "@/config/routes";
import { SITE_URL, buildPageMetadata, localizedPath } from "@/config/seo";
import { HISTORIAS_PAGE, asLang } from "@/content/historias";
import { pick } from "@/content/types";
import { getVideo } from "@/content/videos";
import { JsonLd } from "@/lib/jsonld";

interface PageProps {
  params: Promise<{ locale: string }>;
}

// Depoimento da Isadora: o chip da abertura dá play numa história antes de qualquer rolagem
const HERO_VIDEO_ID = "P9QiMRW4dII";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata("historias", locale);
}

const absoluteUrl = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`);

export default async function HistoriasPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = asLang(locale);
  const text = HISTORIAS_PAGE;
  const heroVideo = getVideo(HERO_VIDEO_ID);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: pick(text.breadcrumb.home, lang), item: absoluteUrl(localizedPath("/", locale)) },
      { "@type": "ListItem", position: 2, name: pick(text.breadcrumb.current, lang), item: absoluteUrl(localizedPath(PAGE_PATH.historias, locale)) },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />

      <PageHero
        eyebrow={pick(text.hero.eyebrow, lang)}
        title={
          <>
            {pick(text.hero.titleLead, lang)}{" "}
            <span className="ba-serif ba-grad-text block pb-[0.08em] text-[1.06em] tracking-[-0.02em]">{pick(text.hero.titleAccent, lang)}.</span>
          </>
        }
        lead={<p>{pick(text.hero.lead, lang)}</p>}
        breadcrumb={{ homeLabel: pick(text.breadcrumb.home, lang), current: pick(text.breadcrumb.current, lang) }}
        actions={
          <>
            <BrandCta source="historias">{pick(text.hero.cta, lang)}</BrandCta>
            {heroVideo && (
              <VideoChip
                id={heroVideo.id}
                kind={heroVideo.kind}
                label={pick(text.hero.chip, lang)}
                title={pick(heroVideo.title, lang)}
                duration={heroVideo.duration}
              />
            )}
          </>
        }
        media={<HistoriasHeroMedia lang={lang} />}
      />

      <ConquistasSection lang={lang} />
      <AthleteWall lang={lang} />
      <AthleteVideosSection lang={lang} />
      <FamilyVideosSection lang={lang} />
      <FinalCTA source="historias" />
    </>
  );
}
