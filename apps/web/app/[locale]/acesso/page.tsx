import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SITE_URL, SEO_DEFAULTS, PAGE_SEO, getSeoText, getOgLocale, getAlternateLocales } from "@/config/seo";
import { JsonLd } from "@/lib/jsonld";
import LinksContent from "@/components/LinksContent";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const seo = PAGE_SEO.links;
  const title = getSeoText(seo.title, locale);
  const description = getSeoText(seo.description, locale);

  return {
    title,
    description,
    alternates: {
      canonical: seo.canonicalPath,
      languages: {
        "pt-BR": "/acesso",
        en: "/en/acesso",
        es: "/es/acesso",
      },
    },
    openGraph: {
      title,
      description,
      url: seo.canonicalPath,
      type: "website",
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
    twitter: {
      title,
      description,
    },
  };
}

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Início",
      item: SITE_URL,
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Links",
      item: `${SITE_URL}/acesso`,
    },
  ],
};

export default async function LinksPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <LinksContent />
    </>
  );
}
