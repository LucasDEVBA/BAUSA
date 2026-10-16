'use strict';

// ════════════════════════════════════════════════════════════════════════
// Guard — acessibilidade e performance do site público multipage (2026-10)
//
// Achados da revisão adversarial (teclado, zoom de 200%, contraste, LCP).
// Nenhum deles quebra build, tsc ou screenshot de desktop: só aparecem com
// Tab no celular, zoom, movimento reduzido ou rede lenta. Por isso o guard
// trava o mecanismo de cada correção no código-fonte (Node 20, sem deps).
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.join(__dirname, '..', 'apps/web');
const read = (rel) => fs.readFileSync(path.join(WEB, rel), 'utf8');

const BRAND_CSS = read('src/styles/brand.css');
const PLAYER = read('src/components/brand/VideoPlayer.tsx');
const MOTION = read('src/components/brand/useBrandMotion.ts');
const HERO = read('src/components/HeroSection.tsx');

test('foco de teclado não para atrás da dock nem da pílula do topo (WCAG 2.4.11)', () => {
  assert.match(
    BRAND_CSS,
    /html:has\(\.ba-dock-shell\)\s*\{\s*scroll-padding-bottom:\s*var\(--ba-dock-space\)/,
    'sem scroll-padding-bottom o link focado no fim da tela fica atrás da dock',
  );
  assert.match(
    BRAND_CSS,
    /\.ba-page :focus-visible\s*\{\s*scroll-margin-top:/,
    'sem scroll-margin-top no foco o Shift+Tab deixa o controle atrás do header',
  );
});

test('marquee de logos para e volta ao início com foco de teclado', () => {
  assert.match(BRAND_CSS, /\.ba-marquee:has\(:focus-visible\) \.ba-track\s*\{\s*animation:\s*none/);
});

test('zoom de 200% (viewport < 300px): rótulo e botão voltam a quebrar linha', () => {
  const narrow = BRAND_CSS.slice(BRAND_CSS.lastIndexOf('@media (max-width: 299px)'));
  assert.match(narrow, /\.ba-page \.whitespace-nowrap/);
  assert.match(narrow, /white-space:\s*normal/);
  assert.match(BRAND_CSS, /\.ba-page \.grid > \*\s*\{\s*min-width:\s*0/, 'grid de coluna única volta a estourar a tela');
});

test('player: Tab alcança os controles do YouTube e não escapa do diálogo', () => {
  assert.doesNotMatch(
    PLAYER,
    /event\.key === "Tab"\)\s*\{\s*event\.preventDefault\(\)/,
    'prender todo Tab no botão fechar deixa play/legenda/volume inalcançáveis pelo teclado (WCAG 2.1.1)',
  );
  assert.match(PLAYER, /ref=\{iframeRef\}/);
  assert.equal((PLAYER.match(/tabIndex=\{0\}[^>]*FOCUS_GUARD_CLASS/g) || []).length, 2, 'sentinelas de foco nas duas bordas do diálogo');
});

test('revelação ao rolar: foco revela na hora e movimento reduzido não toca no DOM', () => {
  assert.match(MOTION, /addEventListener\("focusin", handleFocusIn\)/);
  assert.match(MOTION, /if \(reduceMotion\) return;/, 'gravar data-in com movimento reduzido gera erro de hidratação em seção lazy');
});

test('LCP da home: foto do hero otimizada pelo next/image com preload', () => {
  assert.doesNotMatch(HERO, /<img[\s\S]{0,80}HERO_IMAGE_URL/, 'o <img> cru baixava o JPEG de 1920px (325 KB) no celular');
  assert.match(HERO, /<Image\s+src=\{HERO_IMAGE_URL\}[\s\S]{0,200}preload/);
  assert.match(HERO, /sizes=\{HERO_IMAGE_SIZES\}/);
});
