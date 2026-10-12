import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SITE_URL, buildPageMetadata } from "@/config/seo";
import { JsonLd } from "@/lib/jsonld";
import LegalContent from "@/components/LegalContent";
import { PRIVACIDADE, localeLegal } from "@/content/legal";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPageMetadata("privacidade", locale);
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
