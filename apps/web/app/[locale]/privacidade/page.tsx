import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SITE_URL, SEO_DEFAULTS, PAGE_SEO, getSeoText, getOgLocale, getAlternateLocales } from "@/config/seo";
import { JsonLd } from "@/lib/jsonld";
import LegalContent from "@/components/LegalContent";
import { PRIVACIDADE, localeLegal } from "@/content/legal";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const seo = PAGE_SEO.privacidade;
  const title = getSeoText(seo.title, locale);
  const description = getSeoText(seo.description, locale);

  return {
    title,
    description,
    alternates: {
      canonical: seo.canonicalPath,
      languages: {
        "pt-BR": "/privacidade",
        en: "/en/privacidade",
        es: "/es/privacidade",
      },
    },
    openGraph: {
      title,
      description,
      url: seo.canonicalPath,
      type: "article",
      locale: getOgLocale(locale),
      alternateLocale: getAlternateLocales(locale),
      images: [
        {
          url: SEO_DEFAULTS.ogImage,
          width: 1200,
          height: 630,
          alt: SEO_DEFAULTS.ogImageAlt,
        },
      ],
    },
    twitter: { title, description },
  };
}

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Política de Privacidade", item: `${SITE_URL}/privacidade` },
  ],
};

const OUTRO_DOC: Record<string, string> = {
  pt: "Como excluir seus dados →",
  en: "How to delete your data →",
  es: "Cómo eliminar sus datos →",
};

export default async function PrivacidadePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = localeLegal(locale);

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <LegalContent
        doc={PRIVACIDADE[l]}
        outroDoc={{ href: "/exclusao-de-dados", rotulo: OUTRO_DOC[l] }}
      />
    </>
  );
}
