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
    {
      "@type": "Question",
      name: "A partir de qual idade um atleta pode iniciar o processo?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Recomendamos iniciar o planejamento estratégico a partir dos 13–14 anos, fase em que ainda há tempo hábil para alinhar trajetória esportiva, acadêmica e linguística com os requisitos do sistema americano. Casos de atletas mais velhos são avaliados individualmente.",
      },
    },
    {
      "@type": "Question",
      name: "É necessário ter inglês fluente para iniciar?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Não. O domínio do inglês é construído ao longo do projeto. O que avaliamos no início é o potencial esportivo e acadêmico, o engajamento da família e a clareza do projeto de vida. O inglês entra como pilar de preparação dentro do Método S.A.F.E.®.",
      },
    },
    {
      "@type": "Question",
      name: "Qual a diferença entre High School e Universidade nos EUA?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "High School é o ensino médio americano (geralmente 9ª–12ª série) e funciona como vitrine para recrutadores universitários. Universidade (College/University) é onde ocorrem as bolsas atléticas oficiais via NCAA, NAIA ou NJCAA. A Bolsa Atleta USA atua estrategicamente em ambas as fases.",
      },
    },
    {
      "@type": "Question",
      name: "A Bolsa Atleta USA garante uma bolsa esportiva nos EUA?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Não trabalhamos com promessa de bolsa. Trabalhamos com método e direção estratégica para maximizar as chances do atleta dentro do sistema esportivo-educacional americano. A bolsa é resultado de um projeto bem executado, não um produto à venda.",
      },
    },
    {
      "@type": "Question",
      name: "Como faço para iniciar o processo?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "O primeiro passo é a Avaliação Estratégica — um formulário de candidatura disponível no site. As famílias selecionadas são convidadas para uma conversa direta com o fundador. Por trabalharmos com vagas limitadas, nem todas as candidaturas avançam.",
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
