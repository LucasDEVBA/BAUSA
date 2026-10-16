import type { MetadataRoute } from "next";

import { SITE_URL } from "@/config/seo";
import { SITE_PAGES } from "@/config/routes";

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

interface SitemapPage {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

const LOCALE_PREFIXES = ["", "/en", "/es"];

const PAGES: SitemapPage[] = [
  { path: "", changeFrequency: "monthly", priority: 1.0 },
  // Páginas de conteúdo (multipage): fonte única em src/config/routes.ts
  ...SITE_PAGES.map((page): SitemapPage => ({ path: `/${page}`, changeFrequency: "monthly", priority: 0.8 })),
  { path: "/acesso", changeFrequency: "monthly", priority: 0.6 },
  { path: "/privacidade", changeFrequency: "yearly", priority: 0.3 },
  { path: "/exclusao-de-dados", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((page) =>
    LOCALE_PREFIXES.map((prefix) => ({
      url: `${SITE_URL}${prefix}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
  );
}
