import type { MetadataRoute } from "next";

import { BAU_PAGES } from "@/config/site-pages";

/** Rotas do site institucional liberadas para indexação. */
const bauAllow = Object.values(BAU_PAGES)
  .filter((page) => !("noIndex" in page && page.noIndex))
  .map((page) => `/${page.slug}`);

/**
 * /avaliacao entra no disallow pela mesma política de /forms: o formulário é
 * ato de candidatura, não página de aquisição orgânica. As duas rotas servem
 * o mesmo componente, então ambas precisam ser bloqueadas.
 */
const bauDisallow = Object.values(BAU_PAGES)
  .filter((page) => "noIndex" in page && page.noIndex)
  .flatMap((page) => [`/${page.slug}`, `/en/${page.slug}`, `/es/${page.slug}`]);

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/acesso", "/en", "/en/acesso", "/es", "/es/acesso", ...bauAllow],
        disallow: [
          "/forms",
          "/en/forms",
          "/es/forms",
          ...bauDisallow,
          "/debug/",
          "/*.json$",
        ],
      },
    ],
    sitemap: "https://bolsaatletausa.com/sitemap.xml",
  };
}
