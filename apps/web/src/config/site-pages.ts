import type { Metadata } from "next";

import { SEO_DEFAULTS, SITE_URL } from "./seo";

/**
 * Rotas e SEO do site institucional (BAU-01).
 *
 * ⚠️ SINCRONIA OBRIGATÓRIA — o slug de cada rota precisa estar em:
 *   1. `RESERVED` em `apps/web/middleware.ts`
 *   2. `SLUGS_RESERVADOS` em `apps/crm/src/lib/actions/links-curtos.ts`
 *
 * Sem isso o middleware reescreve `/<slug>` para o encurtador `/l/<slug>`, que
 * redireciona para a home quando o slug não existe — SEM erro, SEM log, SEM
 * 404. O link do menu simplesmente leva o usuário para a home.
 * O guard `tests/site-routes.test.js` bloqueia o merge se a sincronia quebrar.
 */
export interface BauPage {
  /** Slug de um segmento. Precisa estar nas duas listas de reservados. */
  slug: string;
  title: string;
  description: string;
  /** Fora do sitemap enquanto a página não deve ser indexada. */
  noIndex?: boolean;
}

export const BAU_PAGES = {
  concept: {
    slug: "educacao-esportiva-inteligente",
    title: "O que é Educação Esportiva Inteligente® | Bolsa Atleta USA",
    description:
      "Conheça o modelo exclusivo que integra educação, esporte e formação humana para jovens atletas brasileiros no sistema educacional americano.",
  },
  method: {
    slug: "metodo-safe",
    title: "Método S.A.F.E.® | Como estruturamos cada projeto de vida",
    description:
      "Singularidade, Acadêmico, Financeiro e Esporte: os quatro pilares que estruturam decisões seguras no caminho High School → universidade americana.",
  },
  journey: {
    slug: "jornada",
    title: "A Jornada | Da High School à universidade americana",
    description:
      "Conheça cada etapa do caminho acadêmico-atlético nos EUA — e como a Bolsa Atleta USA acompanha sua família do início à universidade.",
  },
  boarding: {
    slug: "vida-na-boarding",
    title: "Como é a vida em uma boarding school americana | Bolsa Atleta USA",
    description:
      "Rotina, moradia, alimentação, supervisão, saúde e comunicação com a família: como seu filho vai viver — e como acompanhamos cada dia.",
  },
  stories: {
    slug: "historias",
    title: "Histórias reais | Atletas e famílias da Bolsa Atleta USA",
    description:
      "As jornadas reais de jovens brasileiros que estudam e jogam nas melhores instituições americanas — contadas por eles e por suas famílias.",
  },
  founder: {
    slug: "fundador",
    title: "Leandro Ribeiro | Fundador & Estrategista-Chefe da Bolsa Atleta USA",
    description:
      "De estudante-atleta bolsista integral nos EUA a estrategista de projetos de vida: a história de quem domina o sistema por dentro.",
  },
  evaluation: {
    slug: "avaliacao",
    title: "Avaliação Estratégica | Bolsa Atleta USA",
    description:
      "O primeiro passo de todo projeto de vida: uma leitura criteriosa e individual do momento do seu filho e da sua família.",
    // Mesma política de /forms: o formulário não é página de aquisição orgânica.
    noIndex: true,
  },
} as const satisfies Record<string, BauPage>;

export const BAU_SLUGS = Object.values(BAU_PAGES).map((page) => page.slug);

/**
 * Metadata das páginas institucionais.
 *
 * NÃO emite `alternates.languages`. A copy existe só em português; declarar
 * hreflang para /en e /es apontando conteúdo idêntico em PT multiplicaria por
 * sete um problema de conteúdo duplicado. Cada página passa a emitir hreflang
 * quando for de fato traduzida.
 */
export function buildBauMetadata(page: BauPage): Metadata {
  const canonical = `/${page.slug}`;

  return {
    // `absolute` porque os títulos do BAU-01 já trazem "| Bolsa Atleta USA".
    // Sem isso o template do layout raiz duplica o sufixo.
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical },
    robots: page.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: page.title,
      description: page.description,
      url: `${SITE_URL}${canonical}`,
      type: "website",
      locale: "pt_BR",
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
      card: "summary_large_image",
      site: SEO_DEFAULTS.twitterHandle,
      creator: SEO_DEFAULTS.twitterHandle,
      title: page.title,
      description: page.description,
      images: [{ url: SEO_DEFAULTS.ogImage, alt: SEO_DEFAULTS.ogImageAlt }],
    },
  };
}
