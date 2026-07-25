import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { BAU_SLUGS } from "./src/config/site-pages";
import { routing } from "./src/i18n/routing";

const intlMiddleware = createMiddleware(routing);

// ─── Links curtos na RAIZ do domínio ────────────────────────────────────────
// bolsaatletausa.com/<slug> (sem o /l/) também resolve como link curto: um
// path de UM segmento que não é idioma nem rota do site é reescrito para
// /l/<slug>, que consulta links_curtos, conta o clique e redireciona (slug
// inexistente → home, nunca quebra). Os links /l/<slug> continuam valendo.
// Rotas reais têm precedência via RESERVED — manter em sincronia com
// app/[locale]/* e com RESERVED_SLUGS do Engine (links-curtos.ts).
const RESERVED = new Set<string>([
  ...routing.locales,
  "acesso",
  "forms",
  "links",
  "l",
  "api",
  "debug",
  // Site institucional (BAU-01). Fonte: BAU_SLUGS em src/config/site-pages.ts.
  // Sem isto, /jornada e afins seriam reescritos para o encurtador, que
  // redireciona para a home quando o slug não existe — falha silenciosa.
  ...BAU_SLUGS,
]);
const SLUG_RE = /^\/([A-Za-z0-9_-]{3,40})$/;

export default function middleware(req: NextRequest) {
  const match = req.nextUrl.pathname.match(SLUG_RE);
  if (match && !RESERVED.has(match[1].toLowerCase())) {
    return NextResponse.rewrite(new URL(`/l/${match[1]}`, req.url));
  }
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    // Match all pathnames except internal Next.js paths and static files
    "/((?!_next|api|l/|favicon\\.ico|favicon\\.jpg|og-image\\.jpg|og-logo\\.jpg|hero-campus\\.jpg|placeholder\\.svg|debug|sitemap\\.xml|robots\\.txt|manifest\\.webmanifest).*)",
  ],
};
