import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { buildBreadcrumbSchema, buildPageMetadata } from "@/config/seo";
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
      <JsonLd data={buildBreadcrumbSchema("privacidade", locale)} />
      <LegalContent
        doc={PRIVACIDADE[l]}
        outroDoc={{ href: "/exclusao-de-dados", rotulo: OUTRO_DOC[l] }}
      />
    </>
  );
}
