import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { SITE_URL, SEO_DEFAULTS, PAGE_SEO, getSeoText, getOgLocale, getAlternateLocales } from "@/config/seo";
import { JsonLd } from "@/lib/jsonld";
import HomeContent from "@/components/HomeContent";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const seo = PAGE_SEO.home;
  const title = getSeoText(seo.title, locale);
  const description = getSeoText(seo.description, locale);

  return {
    title,
    description,
    alternates: {
      canonical: seo.canonicalPath,
      languages: {
        "pt-BR": "/",
        en: "/en",
        es: "/es",
      },
    },
    openGraph: {
      title,
      description,
      url: seo.canonicalPath,
      type: "website",
      locale: getOgLocale(locale),
      alternateLocale: getAlternateLocales(locale),
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
      title,
      description,
      images: [{ url: SEO_DEFAULTS.ogImage, alt: SEO_DEFAULTS.ogImageAlt }],
    },
    keywords:
      "bolsa atleta, bolsa esportiva, universidade americana, NCAA, estudar nos EUA, atleta universitário, high school EUA, educação esportiva",
  };
}

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
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
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "O que é o Método S.A.F.E.®?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "O Método S.A.F.E.® é a metodologia proprietária da Bolsa Atleta USA para estruturar projetos de vida de jovens atletas no sistema educacional esportivo americano, cobrindo da High School à universidade com acompanhamento contínuo.",
      },
    },
    {
      "@type": "Question",
      name: "Como funciona a avaliação estratégica?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A avaliação estratégica é um processo seletivo individual. Candidaturas aprovadas são convidadas para uma conversa direta com o fundador da Bolsa Atleta USA. Trabalhamos com um número limitado de famílias por ciclo.",
      },
    },
    {
      "@type": "Question",
      name: "Quais esportes são atendidos?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A Bolsa Atleta USA atende jovens atletas de diversas modalidades esportivas dentro do sistema NCAA e do sistema educacional americano de High School e Universidade.",
      },
    },
  ],
};

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
  ],
};

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <JsonLd data={organizationSchema} />
      <JsonLd data={websiteSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={breadcrumbSchema} />
      <HomeContent />
    </>
  );
}
