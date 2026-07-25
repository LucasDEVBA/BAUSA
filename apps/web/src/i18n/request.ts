import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import sitePt from "./site/pt";
import { routing } from "./routing";

/**
 * Merge recursivo com fallback para português.
 *
 * Existe porque a copy do site institucional (BAU-01) nasce só em PT: sem isso,
 * uma chave ausente em EN/ES apareceria como o próprio caminho da chave na tela
 * ("site.home.hero.title"), e nada no CI pegaria isso.
 *
 * Trata apenas objetos simples — arrays são substituídos por inteiro, nunca
 * mesclados item a item. Um array parcialmente traduzido produziria uma lista
 * com metade dos itens em cada idioma, que é pior que o fallback completo.
 */
function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(override)) return base;
  if (!isPlainObject(base)) return override as T;

  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    result[key] = key in base ? deepMerge((base as Record<string, unknown>)[key], value) : value;
  }
  return result as T;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  const [legacy, site] = await Promise.all([
    import(`./translations/${locale}`).then((m) => m.default),
    import(`./site/${locale}`).then((m) => m.default),
  ]);

  return {
    locale,
    messages: {
      ...legacy,
      // Namespace do site institucional, sempre completo via fallback PT.
      site: deepMerge(sitePt, site),
    },
  };
});
