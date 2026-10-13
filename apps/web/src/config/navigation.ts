/**
 * Fonte única da navegação do site público: Header (desktop), dock mobile e
 * rodapé leem daqui. Só dados (rotas de src/config/routes.ts e chaves i18n);
 * os ícones ficam no componente client para não arrastar React para cá.
 */

import type { Localized } from "@/content/types";
import { PAGE_PATH, type SitePage } from "./routes";

export type NavKey = "home" | SitePage | "apply";

export interface NavItem {
  key: NavKey;
  href: string;
  /** Chave em src/i18n/translations do rótulo visível. */
  labelKey: string;
}

/** Destino do CTA de conversão: o formulário fica fora do grupo (site), sem dock. */
export const APPLY_PATH = "/forms";

const NAV_ITEMS: Record<NavKey, NavItem> = {
  home: { key: "home", href: PAGE_PATH.home, labelKey: "header.navHome" },
  metodo: { key: "metodo", href: PAGE_PATH.metodo, labelKey: "header.navMethod" },
  historias: { key: "historias", href: PAGE_PATH.historias, labelKey: "header.navStories" },
  escolas: { key: "escolas", href: PAGE_PATH.escolas, labelKey: "header.navSchools" },
  sobre: { key: "sobre", href: PAGE_PATH.sobre, labelKey: "header.navAbout" },
  apply: { key: "apply", href: APPLY_PATH, labelKey: "header.dockApply" },
};

const pickItems = (keys: readonly NavKey[]): readonly NavItem[] => keys.map((key) => NAV_ITEMS[key]);

/** Header desktop: as páginas de conteúdo (a home é o logo; o CTA é o botão). */
export const HEADER_NAV = pickItems(["metodo", "historias", "escolas", "sobre"]);

/**
 * Dock mobile, na ordem da tab bar: 4 destinos + CTA. "Sobre" fica no header
 * desktop e no rodapé; na dock a quinta posição é da conversão.
 */
export const DOCK_NAV = pickItems(["home", "metodo", "historias", "escolas", "apply"]);

/** Mapa do site no rodapé. */
export const FOOTER_NAV = pickItems(["home", "metodo", "historias", "escolas", "sobre", "apply"]);

/** Título do mapa do site no rodapé (texto novo: fora do dicionário global). */
export const FOOTER_NAV_LABEL: Localized = {
  pt: "Navegue",
  en: "Explore",
  es: "Explora",
};

/** Id do <main> em SiteChrome: alvo do link "pular para o conteúdo". */
export const MAIN_CONTENT_ID = "conteudo";

/**
 * Rótulos dos landmarks e do atalho de teclado. Ficam aqui (e não no
 * dicionário global) para não disputar os arquivos de tradução com as outras
 * frentes; leitor de tela anuncia o nome no idioma da página.
 */
export const NAV_A11Y: Record<"headerNav" | "skipToContent" | "legalNav" | "newTab", Localized> = {
  headerNav: { pt: "Principal", en: "Main", es: "Principal" },
  skipToContent: { pt: "Pular para o conteúdo", en: "Skip to content", es: "Saltar al contenido" },
  legalNav: { pt: "Informações legais", en: "Legal information", es: "Información legal" },
  newTab: { pt: "abre em nova aba", en: "opens in a new tab", es: "se abre en una pestaña nueva" },
};

/**
 * Item ativo pela rota (pathname do next-intl, já sem o prefixo de idioma).
 * A home só casa exato; as páginas também casam subcaminhos futuros.
 */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === PAGE_PATH.home) return pathname === PAGE_PATH.home;
  return pathname === href || pathname.startsWith(`${href}/`);
}
