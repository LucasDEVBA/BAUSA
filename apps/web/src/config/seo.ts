/**
 * Configuração SEO centralizada — Bolsa Atleta USA
 *
 * Todas as variáveis de SEO estão aqui.
 * Suporte multilíngue: PT (padrão), EN, ES.
 */

export const SITE_URL = "https://bolsaatletausa.com";

export const SEO_DEFAULTS = {
  siteName: "Bolsa Atleta USA",
  locale: "pt_BR",
  twitterHandle: "@BolsaAtletaUSA",
  ogImage: `${SITE_URL}/og-image.jpg`,
  ogImageWidth: "1200",
  ogImageHeight: "630",
  ogImageAlt: "Bolsa Atleta USA — Educação Esportiva Inteligente®",
} as const;

const LOCALE_MAP: Record<string, string> = {
  pt: "pt_BR",
  en: "en_US",
  es: "es_ES",
};

export function getOgLocale(locale: string): string {
  return LOCALE_MAP[locale] || "pt_BR";
}

export function getAlternateLocales(locale: string): string[] {
  return Object.values(LOCALE_MAP).filter((l) => l !== getOgLocale(locale));
}

export interface PageSeoConfig {
  title: Record<string, string>;
  description: Record<string, string>;
  canonicalPath: string;
  ogType?: "website" | "article";
  noIndex?: boolean;
  ogImage?: string;
}

export const PAGE_SEO: Record<string, PageSeoConfig> = {
  home: {
    title: {
      pt: "Bolsa Atleta USA | Educação Esportiva Inteligente®",
      en: "Bolsa Atleta USA | Intelligent Sports Education®",
      es: "Bolsa Atleta USA | Educación Deportiva Inteligente®",
    },
    description: {
      pt: "Projetos de vida estruturados para jovens atletas no sistema educacional americano. High School. Universidade. Direção estratégica com o Método S.A.F.E.®",
      en: "Structured life projects for young athletes in the American educational system. High School. University. Strategic direction with the S.A.F.E. Method®",
      es: "Proyectos de vida estructurados para jóvenes atletas en el sistema educativo estadounidense. High School. Universidad. Dirección estratégica con el Método S.A.F.E.®",
    },
    canonicalPath: "/",
    ogType: "website",
  },
  links: {
    title: {
      pt: "Links | Bolsa Atleta USA",
      en: "Links | Bolsa Atleta USA",
      es: "Enlaces | Bolsa Atleta USA",
    },
    description: {
      pt: "Acesse os principais canais e recursos da Bolsa Atleta USA — consultoria elite em bolsas esportivas para o sistema educacional americano.",
      en: "Access the main channels and resources of Bolsa Atleta USA — elite sports scholarship consulting for the American educational system.",
      es: "Acceda a los principales canales y recursos de Bolsa Atleta USA — consultoría de élite en becas deportivas para el sistema educativo estadounidense.",
    },
    canonicalPath: "/acesso",
    ogType: "website",
  },
  forms: {
    title: {
      pt: "Avaliação Estratégica | Bolsa Atleta USA",
      en: "Strategic Evaluation | Bolsa Atleta USA",
      es: "Evaluación Estratégica | Bolsa Atleta USA",
    },
    description: {
      pt: "Inicie sua avaliação estratégica personalizada. Processo seletivo exclusivo do Método S.A.F.E.® — Bolsa Atleta USA.",
      en: "Start your personalized strategic evaluation. Exclusive selection process of the S.A.F.E. Method® — Bolsa Atleta USA.",
      es: "Inicie su evaluación estratégica personalizada. Proceso de selección exclusivo del Método S.A.F.E.® — Bolsa Atleta USA.",
    },
    canonicalPath: "/forms",
    ogType: "website",
    noIndex: true,
  },
  notFound: {
    title: {
      pt: "Página não encontrada | Bolsa Atleta USA",
      en: "Page not found | Bolsa Atleta USA",
      es: "Página no encontrada | Bolsa Atleta USA",
    },
    description: {
      pt: "A página que você buscou não existe. Volte ao início.",
      en: "The page you are looking for does not exist. Return to the homepage.",
      es: "La página que busca no existe. Vuelva al inicio.",
    },
    canonicalPath: "/404",
    noIndex: true,
  },
} as const;

/** Helper para obter título/descrição por locale com fallback para PT */
export function getSeoText(
  field: Record<string, string>,
  locale: string,
): string {
  return field[locale] || field.pt;
}
