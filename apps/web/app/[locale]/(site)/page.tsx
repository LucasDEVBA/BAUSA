import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { BREADCRUMB_HOME, SITE_URL, SEO_DEFAULTS, absoluteLocalizedUrl, buildPageMetadata, getSeoText } from "@/config/seo";
import { PAGE_PATH } from "@/config/routes";
import { JsonLd } from "@/lib/jsonld";
import HomeContent from "@/components/HomeContent";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...buildPageMetadata("home", locale, { absoluteTitle: true }),
    keywords:
      "bolsa atleta, bolsa esportiva, universidade americana, NCAA, estudar nos EUA, atleta universitário, high school EUA, educação esportiva",
  };
}

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  // Mesmo @id do Organization de /sobre: o Google junta as duas descrições numa entidade só
  "@id": `${SITE_URL}/#organization`,
  name: SEO_DEFAULTS.siteName,
  url: SITE_URL,
  logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon.ico` },
  sameAs: [
    "https://instagram.com/bolsaatletausa",
    "https://tiktok.com/@bolsaatletausa",
    "https://youtube.com/@bolsaatletausa",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+1-223-350-8213",
    contactType: "customer service",
    availableLanguage: ["Portuguese", "English"],
  },
  description:
    "Consultoria especializada em projetos de vida para jovens atletas no sistema educacional americano. High School. Universidade. Método S.A.F.E.®",
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SEO_DEFAULTS.siteName,
  url: SITE_URL
};

// O FAQPage mudou para /metodo, onde as perguntas estão visíveis (exigência do Google)
function buildBreadcrumbSchema(locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: getSeoText(BREADCRUMB_HOME, locale),
        item: absoluteLocalizedUrl(PAGE_PATH.home, locale),
      },
    ],
  };
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const breadcrumbSchema = buildBreadcrumbSchema(locale);

  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={breadcrumbSchema} />
      <HomeContent />
    </>
  );
}
