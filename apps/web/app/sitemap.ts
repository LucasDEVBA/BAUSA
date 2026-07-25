import type { MetadataRoute } from "next";

import { BAU_PAGES } from "@/config/site-pages";

const BASE_URL = "https://bolsaatletausa.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const legacy = [
    { path: "", changeFrequency: "monthly" as const, priority: 1.0 },
    { path: "/acesso", changeFrequency: "monthly" as const, priority: 0.7 },
  ];

  /**
   * Páginas do site institucional. Só em português: a copy (BAU-01) existe
   * apenas em PT e as rotas não emitem hreflang para /en e /es — declarar
   * alternates para conteúdo idêntico multiplicaria conteúdo duplicado.
   * As rotas legadas mantêm as três variantes de locale que já tinham.
   */
  const bau = Object.values(BAU_PAGES)
    .filter((page) => !("noIndex" in page && page.noIndex))
    .map((page) => ({
      url: `${BASE_URL}/${page.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    }));

  const legacyUrls = legacy.flatMap((page) =>
    ["", "/en", "/es"].map((locale) => ({
      url: `${BASE_URL}${locale}${page.path}`,
      lastModified,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
  );

  return [...legacyUrls, ...bau];
}
