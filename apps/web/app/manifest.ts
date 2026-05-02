import type { MetadataRoute } from "next";

/**
 * Web App Manifest — Bolsa Atleta USA
 *
 * Habilita "Add to Home Screen" no mobile, melhora indexação mobile
 * e fornece metadata para PWA (mesmo sem service worker).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bolsa Atleta USA",
    short_name: "Bolsa Atleta USA",
    description:
      "Projetos de vida estruturados para jovens atletas no sistema educacional americano. Método S.A.F.E.®",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a1128",
    lang: "pt-BR",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
