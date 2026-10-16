import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import leandroPalestra from "@/assets/leandro-palestra.jpg";
import BrandCta from "@/components/brand/BrandCta";
import FinalCTA from "@/components/FinalCTA";
import SobreHarvard from "@/components/pages/sobre/SobreHarvard";
import SobreHeroStage from "@/components/pages/sobre/SobreHeroStage";
import SobreJourney from "@/components/pages/sobre/SobreJourney";
import SobreValues from "@/components/pages/sobre/SobreValues";
import SobreWhy from "@/components/pages/sobre/SobreWhy";
import PageHero from "@/components/site/PageHero";
import { PAGE_PATH } from "@/config/routes";
import { PAGE_SEO, SEO_DEFAULTS, SITE_URL, buildPageMetadata, getSeoText, localizedPath } from "@/config/seo";
import { SOBRE_HERO, SOBRE_SCHEMA, SOBRE_VIDEOS, toLang, withLanguageTag } from "@/content/sobre";
import { pick } from "@/content/types";
import { getVideo } from "@/content/videos";
import type { Lang } from "@/i18n";
import { en } from "@/i18n/translations/en";
import { es } from "@/i18n/translations/es";
import { pt, type Translations } from "@/i18n/translations/pt";
import { JsonLd } from "@/lib/jsonld";

interface PageProps {
  params: Promise<{ locale: string }>;
}

// Rótulos que já existem no dicionário do site (nav, CTA do fundador): lidos no servidor, sem duplicar texto
const DICTIONARY: Record<Lang, Translations> = { pt, en, es };

/** Frame do próprio vídeo (o fundador no estúdio): a capa oficial tem texto queimado no centro. */
const GUIDE_POSTER = `https://i.ytimg.com/vi/${SOBRE_VIDEOS.guide}/maxres1.jpg`;

const SCHEMA_LANGUAGE: Record<Lang, string> = { pt: "pt-BR", en: "en", es: "es" };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata("sobre", locale);
}

function buildSchema(lang: Lang, dict: Translations) {
  const pageUrl = `${SITE_URL}${localizedPath(PAGE_PATH.sobre, lang)}`;
  const homePath = localizedPath(PAGE_PATH.home, lang);
  const homeUrl = homePath === "/" ? SITE_URL : `${SITE_URL}${homePath}`;
  const organizationId = `${SITE_URL}/#organization`;
  const founderId = `${SITE_URL}/sobre#leandro-ribeiro`;
  const guide = getVideo(SOBRE_VIDEOS.guide);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "AboutPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: getSeoText(PAGE_SEO.sobre.title, lang),
        description: getSeoText(PAGE_SEO.sobre.description, lang),
        inLanguage: SCHEMA_LANGUAGE[lang],
        about: { "@id": organizationId },
        mainEntity: { "@id": founderId },
      },
      {
        "@type": "Organization",
        "@id": organizationId,
        name: SEO_DEFAULTS.siteName,
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/og-logo.jpg` },
        description: pick(SOBRE_SCHEMA.organizationDescription, lang),
        founder: { "@id": founderId },
        sameAs: ["https://instagram.com/bolsaatletausa", "https://tiktok.com/@bolsaatletausa", "https://youtube.com/@bolsaatletausa"],
      },
      {
        "@type": "Person",
        "@id": founderId,
        name: "Leandro Ribeiro",
        jobTitle: pick(SOBRE_SCHEMA.jobTitle, lang),
        description: pick(SOBRE_SCHEMA.personDescription, lang),
        image: `${SITE_URL}${leandroPalestra.src}`,
        url: pageUrl,
        worksFor: { "@id": organizationId },
        knowsAbout: ["Student-athlete recruiting", "U.S. high school admissions", "College soccer", "NCAA"],
      },
      ...(guide
        ? [
            {
              "@type": "VideoObject",
              name: pick(guide.title, lang),
              description: pick(SOBRE_SCHEMA.guideDescription, lang),
              thumbnailUrl: `https://i.ytimg.com/vi/${guide.id}/hq720.jpg`,
              uploadDate: "2026-07-02T19:29:00-07:00",
              duration: "PT3M28S",
              embedUrl: `https://www.youtube-nocookie.com/embed/${guide.id}`,
              url: `https://www.youtube.com/watch?v=${guide.id}`,
              inLanguage: "pt-BR",
              author: { "@id": founderId },
              publisher: { "@id": organizationId },
            },
          ]
        : []),
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: dict.header.navHome, item: homeUrl },
          { "@type": "ListItem", position: 2, name: dict.header.navAbout, item: pageUrl },
        ],
      },
    ],
  };
}

export default async function SobrePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const lang = toLang(locale);
  const dict = DICTIONARY[lang];
  const guide = getVideo(SOBRE_VIDEOS.guide);

  return (
    <>
      <JsonLd data={buildSchema(lang, dict)} />

      <PageHero
        eyebrow={pick(SOBRE_HERO.eyebrow, lang)}
        title={
          <>
            {pick(SOBRE_HERO.titleLead, lang)}{" "}
            <span className="ba-serif ba-grad-text text-[1.08em] font-normal">{pick(SOBRE_HERO.titleAccent, lang)}</span>
          </>
        }
        lead={<p className="m-0">{pick(SOBRE_HERO.lead, lang)}</p>}
        breadcrumb={{ homeLabel: dict.header.navHome, current: dict.header.navAbout }}
        actions={
          <>
            <BrandCta source="sobre" className="w-full sm:w-auto">
              {dict.landing.founder.cta}
            </BrandCta>
            <small className="text-center text-[13px] text-[var(--ba-ink-3)] sm:text-left">{dict.landing.founder.ctaNote}</small>
          </>
        }
        media={
          guide && (
            <SobreHeroStage
              video={{
                id: guide.id,
                title: pick(guide.title, lang),
                label: pick(SOBRE_HERO.videoTitle, lang),
                // Com o aviso de idioma: o rótulo do botão (leitor de tela) também precisa dizer que o vídeo é em português
                duration: withLanguageTag(guide.duration, lang),
                poster: GUIDE_POSTER,
              }}
              videoEyebrow={`${pick(SOBRE_HERO.videoEyebrow, lang)} · ${withLanguageTag(guide.duration, lang)}`}
              palestraAlt={pick(SOBRE_HERO.palestraAlt, lang)}
              harvardCaption={pick(SOBRE_HERO.harvardCaption, lang)}
              harvardAlt={pick(SOBRE_HERO.harvardAlt, lang)}
            />
          )
        }
      />

      <SobreJourney lang={lang} />
      <SobreWhy lang={lang} />
      <SobreHarvard lang={lang} recognition={`${dict.landing.founder.recognition1} ${dict.landing.founder.recognition2}`} />
      <SobreValues lang={lang} />
      <FinalCTA source="sobre" />
    </>
  );
}
