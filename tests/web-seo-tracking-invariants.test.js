'use strict';

// ════════════════════════════════════════════════════════════════════════
// Guard — SEO e atribuição do site público multipage (2026-10)
//
// O build do web ignora erros de TypeScript (next.config ignoreBuildErrors) e
// nada disto quebra a tela: uma página sem canonical próprio, um <title> com a
// marca duas vezes, um FAQPage fora da página que mostra as perguntas, um
// Person de atleta menor no JSON-LD ou um CTA que não informa o cta_source só
// aparecem semanas depois, no Search Console ou no CAC por origem. O CI roda
// Node 20 sem dependências, então o guard lê o código-fonte.
//
// Invariantes:
//   1. Toda página de conteúdo (SITE_PAGES) tem PAGE_SEO próprio nos 3 idiomas,
//      usa buildPageMetadata com a sua chave, BreadcrumbList e termina com
//      <FinalCTA source="<página>" /> (origem própria no cta_source).
//   2. buildPageMetadata gera canonical por idioma, hreflang com x-default e
//      não repete a marca no <title> (template do layout + título com a marca).
//   3. FAQPage só em /metodo; Person só o do fundador em /sobre.
//   4. Atribuição: captura global no layout raiz (antes só /forms capturava),
//      first-touch com utm_id, e CTA da dock/header com origem própria.
//   5. Âncoras antigas da home (/#metodo, /#depoimentos, /#autoridade) seguem
//      existindo: estão em bios, anúncios e mensagens já enviadas.
//   6. Textos novos das páginas (src/content) sem travessão, como o dicionário.
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'apps/web');
const read = (p) => fs.readFileSync(path.join(WEB, p), 'utf8');

const routes = read('src/config/routes.ts');
const sitePages = [...routes.match(/export const SITE_PAGES = \[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const seo = read('src/config/seo.ts');

/** Arquivos .ts/.tsx de um diretório, recursivo. */
function sourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(WEB, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}

/** Bloco de uma chave do PAGE_SEO (até a próxima chave de 2 espaços). */
function pageSeoBlock(key) {
  const match = seo.match(new RegExp(`\\n  ${key}: \\{([\\s\\S]*?)\\n  \\},`));
  assert.ok(match, `PAGE_SEO.${key} não encontrado em src/config/seo.ts`);
  return match[1];
}

/** Conteúdo dos literais de string (ignora comentários), para checar texto visível. */
function stringLiterals(source) {
  const out = [];
  let i = 0;
  while (i < source.length) {
    if (source.startsWith('//', i)) { const nl = source.indexOf('\n', i); i = nl < 0 ? source.length : nl; continue; }
    if (source.startsWith('/*', i)) { i = source.indexOf('*/', i) + 2; continue; }
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== ch) j += source[j] === '\\' ? 2 : 1;
      out.push(source.slice(i + 1, j));
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return out;
}

test('SITE_PAGES foi lido (o parser não quebrou)', () => {
  assert.ok(sitePages.length >= 4, `só ${sitePages.length} páginas em SITE_PAGES`);
});

for (const page of sitePages) {
  test(`/${page}: PAGE_SEO próprio nos 3 idiomas e canonical /${page}`, () => {
    const block = pageSeoBlock(page);
    for (const field of ['title', 'description']) {
      const fieldBlock = block.match(new RegExp(`${field}: \\{([\\s\\S]*?)\\}`));
      assert.ok(fieldBlock, `PAGE_SEO.${page}.${field} ausente`);
      for (const lang of ['pt', 'en', 'es']) {
        assert.match(fieldBlock[1], new RegExp(`${lang}: "[^"]{3,}"`), `PAGE_SEO.${page}.${field}.${lang} vazio ou ausente`);
      }
    }
    assert.match(block, new RegExp(`canonicalPath: "/${page}"`), `PAGE_SEO.${page}.canonicalPath deve ser "/${page}"`);
    assert.doesNotMatch(block, /noIndex: true/, `/${page} é página de conteúdo e não pode sair do índice`);
  });

  test(`/${page}: metadata, breadcrumb e CTA final com origem própria`, () => {
    const source = read(`app/[locale]/(site)/${page}/page.tsx`);
    assert.match(source, new RegExp(`buildPageMetadata\\("${page}", locale`), `/${page} não usa buildPageMetadata("${page}")`);
    assert.match(source, /setRequestLocale\(locale\)/, `/${page} sem setRequestLocale (perde o render estático por idioma)`);
    assert.match(source, /"BreadcrumbList"/, `/${page} sem JSON-LD BreadcrumbList`);
    assert.match(source, new RegExp(`<FinalCTA source="${page}" />`), `/${page} deve terminar com <FinalCTA source="${page}" />`);
  });
}

test('buildPageMetadata: canonical por idioma, hreflang com x-default e marca uma vez só no título', () => {
  const fn = seo.slice(seo.indexOf('export function buildPageMetadata'));
  assert.match(fn, /const canonical = localizedPath\(path, locale\)/, 'canonical tem que ser a URL do próprio idioma');
  assert.match(fn, /"x-default": localizedPath\(path, "pt"\)/, 'hreflang x-default (PT) ausente');
  assert.match(fn, /alternates: \{ canonical, languages \}/);
  assert.match(fn, /title\.includes\(SEO_DEFAULTS\.siteName\)/, 'título que já cita a marca precisa sair como absolute');
  assert.match(read('app/[locale]/layout.tsx'), /template: "%s \| Bolsa Atleta USA"/);
});

test('FAQPage só em /metodo (onde as perguntas estão visíveis)', () => {
  const offenders = [...sourceFiles('app'), ...sourceFiles('src')].filter(
    (file) => /["']FAQPage["']/.test(read(file)) && file !== path.join('app/[locale]/(site)/metodo/page.tsx'),
  );
  assert.deepEqual(offenders, [], `FAQPage fora de /metodo: ${offenders.join(', ')}`);
});

test('nenhum Person no JSON-LD além do fundador (atletas são menores)', () => {
  const personRe = /["']@type["']\s*:\s*["']Person["']/;
  const files = [...sourceFiles('app'), ...sourceFiles('src')].filter((file) => personRe.test(read(file)));
  assert.deepEqual(files, [path.join('app/[locale]/(site)/sobre/page.tsx')], `Person em: ${files.join(', ')}`);
  const sobre = read('app/[locale]/(site)/sobre/page.tsx');
  const persons = sobre.split(personRe).length - 1;
  assert.equal(persons, 1, 'só um Person em /sobre');
  assert.match(sobre.slice(sobre.search(personRe)), /^[\s\S]{0,200}name: "Leandro Ribeiro"/, 'o único Person é o fundador');
});

test('atribuição capturada em qualquer página de entrada, first-touch com utm_id', () => {
  const layout = read('app/[locale]/layout.tsx');
  assert.match(layout, /<AttributionCapture \/>/, 'AttributionCapture saiu do layout raiz: quem entra por /historias?utm_... perde as UTMs');
  const capture = read('src/components/site/AttributionCapture.tsx');
  for (const fn of ['captureUTMs()', 'captureLandingUrl()', 'captureReferrer()']) assert.ok(capture.includes(fn), `AttributionCapture não chama ${fn}`);
  const utm = read('src/lib/tracking/utm.ts');
  assert.match(utm, /"utm_id"/, 'utm_id (join do CAC por campanha) saiu da captura');
  assert.match(utm, /if \(localStorage\.getItem\(UTM_STORAGE_KEY\)\) return;/, 'captura deixou de ser first-touch');
});

test('cada CTA informa a sua origem (cta_source)', () => {
  const events = read('src/lib/tracking/events.ts');
  const sources = [...events.match(/export const CTA_SOURCES = \[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  for (const source of ['hero', 'final', 'header', 'footer', 'links', 'dock', ...sitePages]) {
    assert.ok(sources.includes(source), `CTA_SOURCES sem "${source}"`);
  }
  assert.match(read('src/components/site/MobileDock.tsx'), /trackCtaClick\("dock"\)/, 'CTA da dock sem cta_source "dock"');
  assert.match(read('src/components/Header.tsx'), /trackCtaClick\("header"\)/, 'CTA do header sem cta_source "header"');
  assert.match(read('src/components/Footer.tsx'), /trackCtaClick\("footer"\)/, 'CTA do rodapé sem cta_source "footer"');
});

test('âncoras antigas da home continuam existindo', () => {
  const anchors = {
    metodo: 'src/components/SAFEMethodSection.tsx',
    depoimentos: 'src/components/TestimonialsCarousel.tsx',
    autoridade: 'src/components/FounderSection.tsx',
  };
  const home = read('src/components/HomeContent.tsx');
  for (const [id, file] of Object.entries(anchors)) {
    assert.match(read(file), new RegExp(`id="${id}"`), `/#${id} quebrou: ${file} perdeu o id`);
    const component = path.basename(file, '.tsx');
    assert.match(home, new RegExp(`<${component}\\b`), `/#${id} quebrou: ${component} saiu da home`);
  }
});

test('robots não bloqueia páginas de conteúdo', () => {
  const robots = read('app/robots.ts');
  const disallow = [...robots.match(/disallow: \[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  for (const page of sitePages) {
    for (const prefix of ['', '/en', '/es']) {
      const url = `${prefix}/${page}`;
      const blocked = disallow.filter((rule) => !rule.includes('*') && url.startsWith(rule.replace(/\/$/, '')));
      assert.deepEqual(blocked, [], `robots bloqueia ${url}`);
    }
  }
});

test('textos novos das páginas (src/content) sem travessão', () => {
  // legal.ts fica de fora: texto jurídico revisado à parte, anterior ao multipage
  const files = ['metodo', 'historias', 'escolas', 'sobre', 'videos', 'athletes', 'schools'].map((name) => `src/content/${name}.ts`);
  files.push('src/config/navigation.ts');
  const offenders = [];
  for (const file of files) {
    for (const literal of stringLiterals(read(file))) {
      if (/[—–]/.test(literal)) offenders.push(`${file}: ${literal.slice(0, 80)}`);
    }
  }
  assert.deepEqual(offenders, [], `travessão em texto visível: ${offenders.slice(0, 5).join(' | ')}`);
});
