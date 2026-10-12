import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./src/i18n/routing";
import { RESERVED_ROOT_SEGMENTS } from "./src/config/routes";

const intlMiddleware = createMiddleware(routing);

// ─── Links curtos na RAIZ do domínio ────────────────────────────────────────
// bolsaatletausa.com/<slug> (sem o /l/) também resolve como link curto: um
// path de UM segmento que não é idioma nem rota do site é reescrito para
// /l/<slug>, que consulta links_curtos, conta o clique e redireciona (slug
// inexistente → home, nunca quebra). Os links /l/<slug> continuam valendo.
// Rotas reais têm precedência via RESERVED, derivado de src/config/routes.ts
// (fonte única, conferida contra app/[locale]/* e o SLUGS_RESERVADOS do Engine
// pelo guard tests/web-rotas-reservadas-invariants.test.js). Rota fora dessa
// lista é engolida pelo encurtador SÓ em PT: /metodo vira /l/metodo e cai na home.
const RESERVED = new Set<string>(RESERVED_ROOT_SEGMENTS);
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
