/**
 * Fonte única das rotas do site público. SÓ strings: o middleware importa
 * este arquivo, então nada de React/ícones aqui (incharia o bundle do proxy).
 *
 * Toda rota de 1 segmento precisa estar em RESERVED_ROOT_SEGMENTS: sem isso o
 * middleware trata /<rota> como link curto e reescreve para /l/<rota> (cai na
 * home sem as UTMs). Guard de CI: tests/web-rotas-reservadas-invariants.test.js
 * compara esta lista com app/[locale]/* e com o SLUGS_RESERVADOS do Engine.
 */

import { routing } from "../i18n/routing";

/** Páginas de conteúdo do site (multipage). A home é "/". */
export const SITE_PAGES = ["metodo", "historias", "escolas", "sobre"] as const;
export type SitePage = (typeof SITE_PAGES)[number];

/** Rotas reais que não são páginas de conteúdo (fluxos, legais, utilitárias). */
export const UTILITY_ROUTES = [
  "acesso",
  "forms",
  "privacidade",
  "exclusao-de-dados",
  "agendar",
] as const;

/** Segmentos que nunca podem ser tratados como slug do encurtador. */
export const RESERVED_ROOT_SEGMENTS: readonly string[] = [
  ...routing.locales,
  ...SITE_PAGES,
  ...UTILITY_ROUTES,
  "links",
  "l",
  "api",
  "debug",
];

/** Caminho de cada página de conteúdo (sem prefixo de idioma). */
export const PAGE_PATH: Record<SitePage | "home", string> = {
  home: "/",
  metodo: "/metodo",
  historias: "/historias",
  escolas: "/escolas",
  sobre: "/sobre",
};
