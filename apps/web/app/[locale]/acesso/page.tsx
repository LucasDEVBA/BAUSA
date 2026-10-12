import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SITE_URL, buildPageMetadata } from "@/config/seo";
import { JsonLd } from "@/lib/jsonld";
import LinksContent from "@/components/LinksContent";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata("links", locale);
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
