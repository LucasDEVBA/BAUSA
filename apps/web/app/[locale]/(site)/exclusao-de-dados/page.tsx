import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SITE_URL, buildPageMetadata } from "@/config/seo";
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

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Exclusão de Dados", item: `${SITE_URL}/exclusao-de-dados` },
  ],
};

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
      <JsonLd data={breadcrumbSchema} />
      <LegalContent doc={EXCLUSAO[l]} outroDoc={{ href: "/privacidade", rotulo: OUTRO_DOC[l] }} />
    </>
  );
}
