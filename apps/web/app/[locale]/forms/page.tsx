import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SEO_DEFAULTS, PAGE_SEO } from "@/config/seo";
import FormsContent from "@/components/FormsContent";

export function generateMetadata(): Metadata {
  const seo = PAGE_SEO.forms;
  return {
    title: seo.title,
    description: seo.description,
    robots: { index: false, follow: false },
    alternates: {
      canonical: seo.canonicalPath,
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
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
  };
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function FormsPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <FormsContent />;
}
