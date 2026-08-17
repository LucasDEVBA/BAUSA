import type { MetadataRoute } from "next";

const BASE_URL = "https://bolsaatletausa.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ["", "/en", "/es"];
  const pages = [
    { path: "", changeFrequency: "monthly" as const, priority: 1.0 },
    { path: "/acesso", changeFrequency: "monthly" as const, priority: 0.7 },
    { path: "/privacidade", changeFrequency: "yearly" as const, priority: 0.3 },
    { path: "/exclusao-de-dados", changeFrequency: "yearly" as const, priority: 0.3 },
  ];

  return pages.flatMap((page) =>
    locales.map((locale) => ({
      url: `${BASE_URL}${locale}${page.path}`,
      lastModified: new Date(),
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
  );
}
