/**
 * Invariantes das rotas do site institucional.
 *
 * Cada slug de uma página de um segmento precisa estar reservado em DOIS
 * lugares, em apps diferentes:
 *
 *   · apps/web/middleware.ts        → RESERVED
 *   · apps/crm/.../links-curtos.ts  → SLUGS_RESERVADOS
 *
 * Se sair do primeiro, o middleware reescreve `/<slug>` para o encurtador
 * `/l/<slug>`, que redireciona para a home quando o slug não existe — sem
 * erro, sem log, sem 404. O item do menu simplesmente leva à home.
 *
 * Se sair do segundo, o CEO consegue criar um link curto com o nome de uma
 * página real; o link passa a funcionar só em /l/<slug> e falha no formato
 * curto divulgado.
 *
 * Mesma classe de falha silenciosa dos incidentes de elegibilidade dos
 * schedulers — por isso o guard, e não só o comentário.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

const sitePages = fs.readFileSync(
  path.join(ROOT, "apps/web/src/config/site-pages.ts"),
  "utf8",
);
const middleware = fs.readFileSync(path.join(ROOT, "apps/web/middleware.ts"), "utf8");
const linksCurtos = fs.readFileSync(
  path.join(ROOT, "apps/crm/src/lib/actions/links-curtos.ts"),
  "utf8",
);

/** Slugs declarados em BAU_PAGES — a fonte da verdade. */
const slugs = [...sitePages.matchAll(/slug:\s*"([a-z0-9-]+)"/g)].map((m) => m[1]);

test("BAU_PAGES declara as 7 páginas do site institucional", () => {
  assert.strictEqual(
    slugs.length,
    7,
    `esperava 7 slugs em site-pages.ts, encontrei ${slugs.length}: ${slugs.join(", ")}`,
  );
});

test("todo slug casa com o formato aceito pelo encurtador", () => {
  // Mesmo regex do middleware: um slug fora dele nunca seria sequestrado, mas
  // também indicaria uma rota inconsistente com o resto do site.
  for (const slug of slugs) {
    assert.match(slug, /^[A-Za-z0-9_-]{3,40}$/, `slug fora do formato: ${slug}`);
  }
});

test("middleware importa BAU_SLUGS em vez de repetir a lista", () => {
  assert.match(
    middleware,
    /import\s*\{\s*BAU_SLUGS\s*\}\s*from\s*["'].*site-pages["']/,
    "middleware.ts deve importar BAU_SLUGS de src/config/site-pages",
  );
  assert.match(
    middleware,
    /\.\.\.BAU_SLUGS/,
    "RESERVED do middleware.ts deve espalhar BAU_SLUGS",
  );
});

test("Engine reserva todos os slugs do site (SLUGS_RESERVADOS)", () => {
  const bloco = linksCurtos.slice(
    linksCurtos.indexOf("SLUGS_RESERVADOS"),
    linksCurtos.indexOf("]", linksCurtos.indexOf("SLUGS_RESERVADOS")),
  );

  for (const slug of slugs) {
    assert.ok(
      bloco.includes(`"${slug}"`),
      `slug "${slug}" ausente de SLUGS_RESERVADOS em apps/crm — o CEO poderia ` +
        `criar um link curto que colide com uma página real do site.`,
    );
  }
});

test("rotas indexáveis do site estão no sitemap", () => {
  const sitemap = fs.readFileSync(path.join(ROOT, "apps/web/app/sitemap.ts"), "utf8");
  // `avaliacao` é noIndex por política (mesma de /forms) e fica fora.
  const indexaveis = slugs.filter((s) => s !== "avaliacao");

  assert.match(
    sitemap,
    /BAU_PAGES|BAU_SLUGS/,
    "sitemap.ts deve derivar as rotas de site-pages.ts, não repetir a lista",
  );
  assert.ok(indexaveis.length === 6, "esperava 6 rotas indexáveis");
});
