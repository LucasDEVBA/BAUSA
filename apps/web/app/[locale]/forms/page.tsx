import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SEO_DEFAULTS, PAGE_SEO, getSeoText, getOgLocale } from "@/config/seo";
import FormsContent from "@/components/FormsContent";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const seo = PAGE_SEO.forms;
  const title = getSeoText(seo.title, locale);
  const description = getSeoText(seo.description, locale);

  return {
    title,
    description,
    robots: { index: false, follow: false },
    alternates: {
      canonical: seo.canonicalPath,
      languages: {
        "pt-BR": "/forms",
        en: "/en/forms",
        es: "/es/forms",
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: getOgLocale(locale),
      images: [
        {
          url: SEO_DEFAULTS.ogImage,
          width: 1200,
          height: 630,
          alt: SEO_DEFAULTS.ogImageAlt,
        },
      ],
    },
  };
}

export default async function FormsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FormsContent />;
}
