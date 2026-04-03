import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/acesso", "/en", "/en/acesso", "/es", "/es/acesso"],
        disallow: ["/forms", "/en/forms", "/es/forms", "/debug/", "/*.json$"],
      },
    ],
    sitemap: "https://bolsaatletausa.com/sitemap.xml",
  };
}
