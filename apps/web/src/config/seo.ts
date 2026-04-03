/**
 * Configuração SEO centralizada — Bolsa Atleta USA
 *
 * Todas as variáveis de SEO estão aqui.
 * Altere SITE_URL ao fazer deploy para produção.
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

export interface PageSeoConfig {
  title: string;
  description: string;
  canonicalPath: string;
  ogType?: "website" | "article";
  /** Impede indexação (noindex). Use em páginas internas como /forms */
  noIndex?: boolean;
  ogImage?: string;
}

export const PAGE_SEO: Record<string, PageSeoConfig> = {
  home: {
    title: "Bolsa Atleta USA | Educação Esportiva Inteligente®",
    description:
      "Projetos de vida estruturados para jovens atletas no sistema educacional americano. High School. Universidade. Direção estratégica com o Método S.A.F.E.®",
    canonicalPath: "/",
    ogType: "website",
  },
  links: {
    title: "Links | Bolsa Atleta USA",
    description:
      "Acesse os principais canais e recursos da Bolsa Atleta USA — consultoria elite em bolsas esportivas para o sistema educacional americano.",
    canonicalPath: "/acesso",
    ogType: "website",
  },
  forms: {
    title: "Avaliação Estratégica | Bolsa Atleta USA",
    description:
      "Inicie sua avaliação estratégica personalizada. Processo seletivo exclusivo do Método S.A.F.E.® — Bolsa Atleta USA.",
    canonicalPath: "/forms",
    ogType: "website",
    noIndex: true,
  },
  notFound: {
    title: "Página não encontrada | Bolsa Atleta USA",
    description: "A página que você buscou não existe. Volte ao início.",
    canonicalPath: "/404",
    noIndex: true,
  },
} as const;
