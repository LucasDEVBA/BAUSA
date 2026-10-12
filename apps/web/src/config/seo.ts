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
  privacidade: {
    title: {
      pt: "Política de Privacidade",
      en: "Privacy Policy",
      es: "Política de Privacidad",
    },
    description: {
      pt: "Quais dados a Bolsa Atleta USA coleta, por que coleta, com quem compartilha e como você pode acessar, corrigir ou excluir os seus.",
      en: "What data Bolsa Atleta USA collects, why we collect it, who we share it with, and how you can access, correct or delete yours.",
      es: "Qué datos recopila Bolsa Atleta USA, por qué los recopila, con quién los comparte y cómo puede acceder, corregir o eliminar los suyos.",
    },
    canonicalPath: "/privacidade",
    ogType: "article",
  },
  exclusaoDados: {
    title: {
      pt: "Exclusão de Dados",
      en: "Data Deletion",
      es: "Eliminación de Datos",
    },
    description: {
      pt: "Como pedir a exclusão dos seus dados dos sistemas da Bolsa Atleta USA, o que é apagado e em quanto tempo.",
      en: "How to request deletion of your data from Bolsa Atleta USA's systems, what gets deleted, and how long it takes.",
      es: "Cómo solicitar la eliminación de sus datos de los sistemas de Bolsa Atleta USA, qué se elimina y en cuánto tiempo.",
    },
    canonicalPath: "/exclusao-de-dados",
    ogType: "article",
  },
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
      pt: "Links",
      en: "Links",
      es: "Enlaces",
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
      pt: "Avaliação Estratégica",
      en: "Strategic Evaluation",
      es: "Evaluación Estratégica",
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
  metodo: {
    title: {
      pt: "Método S.A.F.E.® e como atuamos",
      en: "The S.A.F.E. Method® and how we work",
      es: "Método S.A.F.E.® y cómo trabajamos",
    },
    description: {
      pt: "Como a Bolsa Atleta USA estrutura cada projeto: os quatro pilares do Método S.A.F.E.®, a High School como ponte para a universidade e as respostas às dúvidas mais comuns das famílias.",
      en: "How Bolsa Atleta USA structures each project: the four pillars of the S.A.F.E. Method®, High School as the bridge to university, and answers to families' most common questions.",
      es: "Cómo Bolsa Atleta USA estructura cada proyecto: los cuatro pilares del Método S.A.F.E.®, la High School como puente a la universidad y las respuestas a las dudas más comunes de las familias.",
    },
    canonicalPath: "/metodo",
    ogType: "article",
  },
  historias: {
    title: {
      pt: "Histórias de atletas e famílias",
      en: "Athlete and family stories",
      es: "Historias de atletas y familias",
    },
    description: {
      pt: "Atletas brasileiros em high schools e universidades americanas: convocações, conquistas e depoimentos em vídeo de atletas e famílias da Bolsa Atleta USA.",
      en: "Brazilian athletes at American high schools and universities: national team call-ups, achievements and video testimonials from Bolsa Atleta USA athletes and families.",
      es: "Atletas brasileños en high schools y universidades estadounidenses: convocatorias, logros y testimonios en video de atletas y familias de Bolsa Atleta USA.",
    },
    canonicalPath: "/historias",
    ogType: "website",
  },
  escolas: {
    title: {
      pt: "Por dentro das escolas e universidades",
      en: "Inside the schools and universities",
      es: "Por dentro de las escuelas y universidades",
    },
    description: {
      pt: "Tours exclusivos em português por high schools e universidades esportivas dos EUA, como IMG Academy, Montverde, Harvard e University of Miami, com treinadores e diretores.",
      en: "Exclusive tours of U.S. sports high schools and universities such as IMG Academy, Montverde, Harvard and the University of Miami, with coaches and directors.",
      es: "Tours exclusivos por high schools y universidades deportivas de EE. UU., como IMG Academy, Montverde, Harvard y University of Miami, con entrenadores y directores.",
    },
    canonicalPath: "/escolas",
    ogType: "website",
  },
  sobre: {
    title: {
      pt: "Sobre a Bolsa Atleta USA e o fundador",
      en: "About Bolsa Atleta USA and its founder",
      es: "Sobre Bolsa Atleta USA y su fundador",
    },
    description: {
      pt: "Leandro Ribeiro viveu o sistema educacional esportivo americano como estudante-atleta bolsista e profissional de admissões. Conheça a origem da Educação Esportiva Inteligente®.",
      en: "Leandro Ribeiro lived the American sports-education system as a scholarship student-athlete and admissions professional. Discover the origin of Intelligent Sports Education®.",
      es: "Leandro Ribeiro vivió el sistema educativo deportivo estadounidense como estudiante-atleta becado y profesional de admisiones. Conozca el origen de la Educación Deportiva Inteligente®.",
    },
    canonicalPath: "/sobre",
    ogType: "article",
  },
  notFound: {
    title: {
      pt: "Página não encontrada",
      en: "Page not found",
      es: "Página no encontrada",
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

const LOCALE_PREFIX: Record<string, string> = { pt: "", en: "/en", es: "/es" };
const HREFLANG: Record<string, string> = { pt: "pt-BR", en: "en", es: "es" };

/** URL de uma rota no idioma pedido (PT sem prefixo, como no routing "as-needed"). */
export function localizedPath(path: string, locale: string): string {
  const prefix = LOCALE_PREFIX[locale] ?? "";
  if (path === "/") return prefix || "/";
  return `${prefix}${path}`;
}

/**
 * Metadata padronizada por página: canonical PRÓPRIO de cada idioma (antes /en
 * e /es apontavam para a URL em PT e o Google tendia a ignorá-las), hreflang
 * completo com x-default e Open Graph coerente. Títulos do PAGE_SEO vêm sem a
 * marca; o template do layout acrescenta "| Bolsa Atleta USA" uma única vez.
 */
export function buildPageMetadata(key: keyof typeof PAGE_SEO, locale: string, options: { absoluteTitle?: boolean } = {}) {
  const seo: PageSeoConfig = PAGE_SEO[key];
  const title = getSeoText(seo.title, locale);
  const description = getSeoText(seo.description, locale);
  const path = seo.canonicalPath;
  const canonical = localizedPath(path, locale);
  const languages: Record<string, string> = { "x-default": localizedPath(path, "pt") };
  for (const lang of Object.keys(LOCALE_PREFIX)) languages[HREFLANG[lang]] = localizedPath(path, lang);

  return {
    title: options.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical, languages },
    robots: seo.noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      type: seo.ogType ?? "website",
      locale: getOgLocale(locale),
      alternateLocale: getAlternateLocales(locale),
      images: [{ url: seo.ogImage ?? SEO_DEFAULTS.ogImage, width: 1200, height: 630, alt: SEO_DEFAULTS.ogImageAlt }],
    },
    // card/site/creator são repetidos: o Next faz merge raso do objeto twitter
    twitter: {
      card: "summary_large_image" as const,
      site: SEO_DEFAULTS.twitterHandle,
      creator: SEO_DEFAULTS.twitterHandle,
      title,
      description,
      images: [{ url: seo.ogImage ?? SEO_DEFAULTS.ogImage, alt: SEO_DEFAULTS.ogImageAlt }],
    },
  };
}
