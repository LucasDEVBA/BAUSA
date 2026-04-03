import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SEO_DEFAULTS, PAGE_SEO } from "@/config/seo";
import LinksContent from "@/components/LinksContent";

export function generateMetadata(): Metadata {
  const seo = PAGE_SEO.links;
  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: seo.canonicalPath,
      languages: {
        "pt-BR": "/acesso",
        en: "/en/acesso",
        es: "/es/acesso",
      },
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: seo.canonicalPath,
      type: "website",
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
      title: seo.title,
      description: seo.description,
    },
  };
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function LinksPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <LinksContent />;
}
