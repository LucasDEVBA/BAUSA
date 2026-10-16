import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { buildBreadcrumbSchema, buildPageMetadata } from "@/config/seo";
import { JsonLd } from "@/lib/jsonld";
import LinksContent from "@/components/LinksContent";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata("links", locale);
}

export default async function LinksPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <JsonLd data={buildBreadcrumbSchema("links", locale)} />
      <LinksContent />
    </>
  );
}
