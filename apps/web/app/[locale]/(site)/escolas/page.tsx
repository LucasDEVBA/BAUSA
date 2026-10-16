import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import FinalCTA from "@/components/FinalCTA";
import BrandCta from "@/components/brand/BrandCta";
import BeforeChoosing from "@/components/pages/escolas/BeforeChoosing";
import FeaturedTour from "@/components/pages/escolas/FeaturedTour";
import MomentsSection from "@/components/pages/escolas/MomentsSection";
import ToursSection from "@/components/pages/escolas/ToursSection";
import PageHero from "@/components/site/PageHero";
import { PAGE_PATH } from "@/config/routes";
import { SITE_URL, buildPageMetadata, localizedPath } from "@/config/seo";
import { ESCOLAS_TEXT, SCHOOL_TOURS, fill, toLang } from "@/content/escolas";
import { pick } from "@/content/types";
import { JsonLd } from "@/lib/jsonld";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata("escolas", locale);
}

function absoluteUrl(path: string, locale: string): string {
  const localized = localizedPath(path, locale);
  return localized === "/" ? SITE_URL : `${SITE_URL}${localized}`;
}

export default async function EscolasPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = toLang(locale);
  const tourCount = SCHOOL_TOURS.length;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: pick(ESCOLAS_TEXT.breadcrumbHome, lang), item: absoluteUrl(PAGE_PATH.home, lang) },
      { "@type": "ListItem", position: 2, name: pick(ESCOLAS_TEXT.breadcrumbCurrent, lang), item: absoluteUrl(PAGE_PATH.escolas, lang) },
    ],
  };

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <PageHero
        eyebrow={pick(ESCOLAS_TEXT.heroEyebrow, lang)}
        title={
          <>
            {pick(ESCOLAS_TEXT.heroTitle, lang)} <span className="ba-serif ba-grad-text text-[1.08em]">{pick(ESCOLAS_TEXT.heroTitleAccent, lang)}</span>
          </>
        }
        lead={fill(pick(ESCOLAS_TEXT.heroLead, lang), { n: tourCount })}
        breadcrumb={{ homeLabel: pick(ESCOLAS_TEXT.breadcrumbHome, lang), current: pick(ESCOLAS_TEXT.breadcrumbCurrent, lang) }}
        actions={
          <>
            <BrandCta href="#tours">{fill(pick(ESCOLAS_TEXT.heroToursCta, lang), { n: tourCount })}</BrandCta>
            <BrandCta href="/forms" variant="ghost" source="escolas">
              {pick(ESCOLAS_TEXT.heroApplyCta, lang)}
            </BrandCta>
          </>
        }
        media={<FeaturedTour />}
      />
      <MomentsSection lang={lang} />
      <ToursSection lang={lang} />
      <BeforeChoosing lang={lang} />
      <FinalCTA source="escolas" />
    </>
  );
}
