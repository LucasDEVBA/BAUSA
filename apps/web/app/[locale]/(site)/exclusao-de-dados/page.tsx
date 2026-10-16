import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { buildBreadcrumbSchema, buildPageMetadata } from "@/config/seo";
import { JsonLd } from "@/lib/jsonld";
import LegalContent from "@/components/LegalContent";
import { EXCLUSAO, localeLegal } from "@/content/legal";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata("exclusaoDados", locale);
}

const OUTRO_DOC: Record<string, string> = {
  pt: "← Política de Privacidade",
  en: "← Privacy Policy",
  es: "← Política de Privacidad",
};

export default async function ExclusaoDadosPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = localeLegal(locale);

  return (
    <>
      <JsonLd data={buildBreadcrumbSchema("exclusaoDados", locale)} />
      <LegalContent doc={EXCLUSAO[l]} outroDoc={{ href: "/privacidade", rotulo: OUTRO_DOC[l] }} />
    </>
  );
}
