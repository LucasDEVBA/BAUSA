'use strict';

// ════════════════════════════════════════════════════════════════════════
// Guard — rotas do site público × encurtador de links (multipage, 2026-10)
//
// O middleware do apps/web reescreve QUALQUER path de 1 segmento que não
// esteja em RESERVED para /l/<slug>. Uma página nova fora da lista quebra
// SÓ em PT (idioma padrão, sem prefixo): /metodo vira /l/metodo, o slug não
// existe e o visitante cai na home sem as UTMs. /en/metodo funciona, então o
// erro passa no QA manual.
//
// Invariantes:
//   1. Toda pasta de rota em app/[locale]/** (ignorando route groups "(x)" e
//      segmentos dinâmicos "[x]") está em RESERVED_ROOT_SEGMENTS.
//   2. O middleware deriva RESERVED de src/config/routes.ts (sem lista local).
//   3. O SLUGS_RESERVADOS do Engine contém todas as rotas reservadas, para o
//      CEO não criar um link curto que só funcionaria em /l/<slug>.
//   4. Toda página de conteúdo (SITE_PAGES) existe em app/[locale] e no sitemap.
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'apps/web');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

function stringArray(source, name) {
  const match = source.match(new RegExp(`export const ${name}[^=]*=\\s*\\[([\\s\\S]*?)\\]`));
  assert.ok(match, `${name} não encontrado em src/config/routes.ts`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const routesSource = read('apps/web/src/config/routes.ts');
const routingSource = read('apps/web/src/i18n/routing.ts');
const locales = [...routingSource.match(/locales:\s*\[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const sitePages = stringArray(routesSource, 'SITE_PAGES');
const utilityRoutes = stringArray(routesSource, 'UTILITY_ROUTES');
const reservedExtra = [...routesSource.match(/RESERVED_ROOT_SEGMENTS[^=]*=\s*\[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const reserved = new Set([...locales, ...sitePages, ...utilityRoutes, ...reservedExtra]);

function routeSegments(dir) {
  const found = new Set();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name.startsWith('(') && entry.name.endsWith(')')) {
      routeSegments(full).forEach((s) => found.add(s));
    } else if (!entry.name.startsWith('[') && !entry.name.startsWith('_')) {
      found.add(entry.name);
    }
  }
  return found;
}

test('toda rota de app/[locale] está reservada no middleware', () => {
  const segments = routeSegments(path.join(WEB, 'app/[locale]'));
  for (const segment of segments) {
    assert.ok(reserved.has(segment), `rota "${segment}" fora de RESERVED_ROOT_SEGMENTS (src/config/routes.ts)`);
  }
});

test('middleware deriva RESERVED da fonte única', () => {
  const middleware = read('apps/web/middleware.ts');
  assert.match(middleware, /import \{ RESERVED_ROOT_SEGMENTS \} from "\.\/src\/config\/routes"/);
  assert.match(middleware, /new Set<string>\(RESERVED_ROOT_SEGMENTS\)/);
});

test('routes.ts não importa React nem ícones (vai para o bundle do middleware)', () => {
  assert.doesNotMatch(routesSource, /from ["'](react|lucide-react|next\/image)["']/);
});

test('Engine bloqueia slugs que colidem com rotas do site', () => {
  const engine = read('apps/crm/src/lib/actions/links-curtos.ts');
  const block = engine.match(/const SLUGS_RESERVADOS = new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(block, 'SLUGS_RESERVADOS não encontrado no Engine');
  const engineSlugs = new Set([...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  for (const segment of reserved) {
    assert.ok(engineSlugs.has(segment), `Engine aceita criar o slug "${segment}", que é rota do site`);
  }
});

test('páginas de conteúdo existem e estão no sitemap', () => {
  const segments = routeSegments(path.join(WEB, 'app/[locale]'));
  const sitemap = read('apps/web/app/sitemap.ts');
  for (const page of sitePages) {
    assert.ok(segments.has(page), `SITE_PAGES lista "${page}" mas app/[locale] não tem a rota`);
    assert.ok(sitemap.includes('SITE_PAGES') || sitemap.includes(`/${page}`), `sitemap não inclui /${page}`);
  }
});
