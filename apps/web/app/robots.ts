import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        // /forms NÃO entra aqui: bloqueado, o Google nunca lê o noindex da página e
        // ainda pode indexar a URL nua pelos muitos links internos para ela
        disallow: ["/debug/", "/*.json$"],
      },
    ],
    sitemap: "https://bolsaatletausa.com/sitemap.xml",
  };
}
