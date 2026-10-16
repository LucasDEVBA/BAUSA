'use strict';

// ════════════════════════════════════════════════════════════════════════
// Guard — máquina de estados da dock mobile do site público (2026-10)
//
// A dock (e a pílula do topo, que some junto) segue a regra do iOS 26 /
// Instagram: expandida ao abrir, compacta ao rolar para baixo, reexpande só
// com subida intencional, no topo e no fim da página. Bugs desta classe não
// quebram build nem tsc: a dock "pisca" no bounce do iOS, ou reexpande
// sozinha após refresh no meio da página, e ninguém percebe no desktop.
//
// O CI roda Node 20 sem dependências, então o teste NÃO importa o .ts: lê
// apps/web/src/lib/dock-state.ts, recorta os trechos entre os marcadores
// "dock-state:*" (JS puro por contrato do próprio arquivo) e avalia o código
// real. Se alguém colocar sintaxe TypeScript ali, a avaliação falha aqui.
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'apps/web/src/lib/dock-state.ts'), 'utf8');

function region(name) {
  const start = `// dock-state:${name}-start`;
  const end = `// dock-state:${name}-end`;
  const from = SOURCE.indexOf(start);
  const to = SOURCE.indexOf(end);
  assert.ok(from !== -1 && to > from, `marcadores "${start}" / "${end}" ausentes em dock-state.ts`);
  // Vírgula final de argumento (formatador) não faz parte da expressão
  return SOURCE.slice(from + start.length, to).trim().replace(/,$/, '');
}

function evaluate(code, params = [], args = []) {
  try {
    // eslint-disable-next-line no-new-func
    return new Function(...params, `"use strict"; return (${code});`)(...args);
  } catch (error) {
    throw new Error(`trecho de dock-state.ts não é JS puro (o guard roda sem TypeScript): ${error.message}`);
  }
}

const DOCK_SCROLL = Object.freeze(evaluate(region('config')));
const machine = evaluate(region('core'), ['DOCK_SCROLL'], [DOCK_SCROLL]);

const PAGE_HEIGHT = 10000;
const sample = (y) => ({ y, progress: y / PAGE_HEIGHT });

/** Simula uma rolagem contínua, um passo por evento, a partir do estado dado. */
function scroll(state, ...positions) {
  return positions.reduce((current, y) => machine.next(current, sample(y)), state);
}

const atTop = () => machine.initial(sample(0));

test('constantes têm a ordem que a regra pressupõe', () => {
  assert.ok(DOCK_SCROLL.topExpandedPx < DOCK_SCROLL.compactAfterPx, 'topo precisa ser menor que o limiar de compactar');
  assert.ok(DOCK_SCROLL.downSlopPx > 0 && DOCK_SCROLL.downSlopPx < DOCK_SCROLL.upReexpandPx, 'subida exige mais intenção que a descida');
  assert.ok(DOCK_SCROLL.endProgress > 0.9 && DOCK_SCROLL.endProgress < 1);
  assert.ok(DOCK_SCROLL.compactScale > 0.8 && DOCK_SCROLL.compactScale < 0.9, 'escala medida no Instagram ≈ 0,84');
});

test('abre expandida no topo', () => {
  assert.equal(atTop().compact, false);
});

test('compacta depois de rolar para baixo além do limiar', () => {
  const state = scroll(atTop(), 40, 90, 140, 200);
  assert.equal(state.compact, true);
});

test('não compacta com rolagem curta perto do topo', () => {
  const state = scroll(atTop(), 30, 60, DOCK_SCROLL.compactAfterPx);
  assert.equal(state.compact, false);
});

test('ignora tremida: descida menor que o slop não compacta', () => {
  const expanded = scroll(atTop(), 400, 300, 200); // subiu: expandida e longe do topo
  assert.equal(expanded.compact, false);
  const jitter = scroll(expanded, 205, 203, 208);
  assert.equal(jitter.compact, false, 'deltas abaixo de downSlopPx não podem compactar');
});

test('subida pequena (bounce/momentum) não reexpande', () => {
  const compact = scroll(atTop(), 300, 600, 900);
  assert.equal(compact.compact, true);
  const bounce = scroll(compact, 880, 860);
  assert.equal(bounce.compact, true, `subida de 40px (< ${DOCK_SCROLL.upReexpandPx}) não reexpande`);
});

test('subida intencional reexpande', () => {
  const compact = scroll(atTop(), 300, 600, 900);
  const up = scroll(compact, 880, 860, 840);
  assert.equal(up.compact, false);
});

test('trocar de sentido zera o acumulado', () => {
  const compact = scroll(atTop(), 300, 600, 900);
  // sobe 40, desce 5, sobe 40: nenhuma subida isolada chega ao limiar
  const zigzag = scroll(compact, 860, 865, 825);
  assert.equal(zigzag.compact, true);
});

test('voltar ao topo expande mesmo sem subida intencional acumulada', () => {
  const compact = scroll(atTop(), 300, 600, 900);
  const jump = machine.next(compact, sample(DOCK_SCROLL.topExpandedPx));
  assert.equal(jump.compact, false);
  assert.equal(jump.travel, 0);
});

test('overscroll negativo do iOS conta como topo', () => {
  const compact = scroll(atTop(), 300, 600, 900);
  assert.equal(machine.next(compact, sample(-30)).compact, false);
});

test('fim da página expande', () => {
  const compact = scroll(atTop(), 3000, 6000, 9000);
  assert.equal(compact.compact, true);
  const end = machine.next(compact, { y: 9860, progress: DOCK_SCROLL.endProgress });
  assert.equal(end.compact, false);
});

test('refresh no meio da página começa compacta', () => {
  const restored = machine.initial(sample(4200));
  assert.equal(restored.compact, true);
  assert.equal(restored.y, 4200, 'a posição inicial alimenta o próximo delta');
  // O estado inicial é a base da máquina: uma subida curta logo após o refresh não reexpande
  assert.equal(scroll(restored, 4180).compact, true);
});

test('refresh no fim ou perto do topo começa expandida', () => {
  assert.equal(machine.initial({ y: 9900, progress: 0.99 }).compact, false);
  assert.equal(machine.initial(sample(50)).compact, false);
});

test('modo da dock: teclado esconde, foco e movimento reduzido expandem, altura baixa compacta', () => {
  const base = { scrollCompact: false, reducedMotion: false, focusWithin: false, shortViewport: false, fieldFocused: false };
  assert.equal(machine.dockMode(base), 'expanded');
  assert.equal(machine.dockMode({ ...base, scrollCompact: true }), 'compact');
  assert.equal(machine.dockMode({ ...base, shortViewport: true }), 'compact');
  assert.equal(machine.dockMode({ ...base, scrollCompact: true, focusWithin: true }), 'expanded');
  assert.equal(machine.dockMode({ ...base, scrollCompact: true, reducedMotion: true }), 'expanded');
  assert.equal(machine.dockMode({ ...base, shortViewport: true, reducedMotion: true }), 'expanded');
  assert.equal(machine.dockMode({ ...base, fieldFocused: true, focusWithin: true }), 'hidden');
});

test('modo do header: some junto com a dock só no mobile e nunca com foco dentro', () => {
  const base = { scrollCompact: true, reducedMotion: false, focusWithin: false, desktop: false };
  assert.equal(machine.headerMode(base), 'hidden');
  assert.equal(machine.headerMode({ ...base, scrollCompact: false }), 'shown');
  assert.equal(machine.headerMode({ ...base, desktop: true }), 'shown');
  assert.equal(machine.headerMode({ ...base, focusWithin: true }), 'shown');
  assert.equal(machine.headerMode({ ...base, reducedMotion: true }), 'shown');
});

test('header escondido continua alcançável por teclado e há atalho para o conteúdo', () => {
  const header = fs.readFileSync(path.join(__dirname, '..', 'apps/web/src/components/Header.tsx'), 'utf8');
  assert.match(header, /dockStateMachine\.headerMode\(/, 'o header some pela mesma máquina da dock');
  // inert removeria logo e idioma do Tab enquanto rolado; o foco de teclado é que traz a barra de volta
  assert.doesNotMatch(header, /\binert=/, 'header escondido não pode ser inert');
  assert.match(header, /useKeyboardFocusWithin\(/);
  assert.match(header, /href=\{`#\$\{MAIN_CONTENT_ID\}`\}/, 'link "pular para o conteúdo" precisa apontar para o <main>');
  const chrome = fs.readFileSync(path.join(__dirname, '..', 'apps/web/src/components/site/SiteChrome.tsx'), 'utf8');
  const nav = fs.readFileSync(path.join(__dirname, '..', 'apps/web/src/config/navigation.ts'), 'utf8');
  const id = nav.match(/MAIN_CONTENT_ID = "([^"]+)"/);
  assert.ok(id, 'MAIN_CONTENT_ID ausente em navigation.ts');
  assert.match(chrome, new RegExp(`<main[^>]*id="${id[1]}"`), `o <main> do SiteChrome precisa ter id="${id[1]}"`);
});

test('troca de rota não herda a rolagem suave do <html>', () => {
  // Next 16: sem data-scroll-behavior="smooth" no <html>, o scroll-to-top da
  // navegação anima a partir da posição antiga (tocar na dock no fim da página
  // abre a próxima "voando" de baixo para cima)
  const globals = fs.readFileSync(path.join(__dirname, '..', 'apps/web/app/globals.css'), 'utf8');
  if (!/html\s*\{[^}]*scroll-behavior:\s*smooth/.test(globals)) return;
  const header = fs.readFileSync(path.join(__dirname, '..', 'apps/web/src/components/Header.tsx'), 'utf8');
  const layout = fs.readFileSync(path.join(__dirname, '..', 'apps/web/app/[locale]/layout.tsx'), 'utf8');
  assert.ok(
    /data-scroll-behavior="smooth"/.test(layout) || /dataset\.scrollBehavior\s*=\s*"smooth"/.test(header),
    'html com scroll-behavior: smooth exige data-scroll-behavior="smooth" (layout.tsx ou Header.tsx)',
  );
});

test('a dock usa a máquina e não ouve scroll na mão', () => {
  const dock = fs.readFileSync(path.join(__dirname, '..', 'apps/web/src/components/site/MobileDock.tsx'), 'utf8');
  assert.match(dock, /dockStateMachine\.initial\(/, 'estado inicial precisa vir da máquina (refresh/bfcache)');
  assert.match(dock, /dockStateMachine\.next\(/);
  assert.match(dock, /useMotionValueEvent\(/);
  assert.doesNotMatch(dock, /addEventListener\(\s*["']scroll["']/, 'use useScroll/useMotionValueEvent do framer-motion');
  assert.match(dock, /useReducedMotion\(/);
  assert.match(dock, /lg:hidden/, 'a dock é só mobile/tablet');
});
