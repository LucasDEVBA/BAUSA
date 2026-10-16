'use strict';

// ════════════════════════════════════════════════════════════════════════
// Guard — paridade de chaves PT/EN/ES do site público
//
// O t() cai em PT em silêncio quando falta a chave em EN/ES e o build do web
// ignora erros de tipo (next.config ignoreBuildErrors), então uma chave
// esquecida vira texto em português dentro de /en sem quebrar nada.
// Este guard compara a ÁRVORE de chaves dos três arquivos de tradução e
// proíbe travessão (— ou –) nos textos visíveis (regra da identidade visual).
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'apps/web/src/i18n/translations');

/** Tokeniza o objeto literal de tradução (strings, identificadores e { } : , [ ]). */
function tokenize(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (source.startsWith('//', i)) { i = source.indexOf('\n', i); if (i < 0) break; continue; }
    if (source.startsWith('/*', i)) { i = source.indexOf('*/', i) + 2; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== ch) j += source[j] === '\\' ? 2 : 1;
      tokens.push({ type: 'str', value: source.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if ('{}:,[]'.includes(ch)) { tokens.push({ type: ch }); i += 1; continue; }
    const ident = source.slice(i).match(/^[A-Za-z_$][\w$]*/);
    if (ident) { tokens.push({ type: 'id', value: ident[0] }); i += ident[0].length; continue; }
    i += 1;
  }
  return tokens;
}

/** Caminhos de chave folha do primeiro objeto literal após `const <lang>`. */
function keyPaths(source) {
  const start = source.indexOf('{', source.search(/const (pt|en|es)\b/));
  // começa DEPOIS da chave de abertura: o objeto raiz não entra no caminho
  const tokens = tokenize(source.slice(start + 1));
  const paths = new Set();
  const stack = [];
  let pendingKey = null;
  let arrayDepth = 0;
  for (let k = 0; k < tokens.length; k += 1) {
    const tok = tokens[k];
    if (arrayDepth > 0) {
      if (tok.type === '[') arrayDepth += 1;
      if (tok.type === ']') arrayDepth -= 1;
      continue;
    }
    if ((tok.type === 'id' || tok.type === 'str') && tokens[k + 1]?.type === ':') {
      pendingKey = tok.value;
      k += 1;
      const next = tokens[k + 1];
      if (next?.type === '{') { stack.push(pendingKey); k += 1; pendingKey = null; continue; }
      if (next?.type === '[') { paths.add([...stack, pendingKey].join('.')); arrayDepth = 1; k += 1; pendingKey = null; continue; }
      paths.add([...stack, pendingKey].join('.'));
      pendingKey = null;
      continue;
    }
    if (tok.type === '{') stack.push('?');
    if (tok.type === '}') {
      if (stack.length === 0) break;
      stack.pop();
    }
  }
  return paths;
}

const files = Object.fromEntries(['pt', 'en', 'es'].map((lang) => [lang, fs.readFileSync(path.join(DIR, `${lang}.ts`), 'utf8')]));
const keys = Object.fromEntries(Object.entries(files).map(([lang, src]) => [lang, keyPaths(src)]));

test('PT tem um número plausível de chaves (o parser não quebrou)', () => {
  assert.ok(keys.pt.size > 300, `só ${keys.pt.size} chaves lidas de pt.ts`);
});

for (const lang of ['en', 'es']) {
  test(`${lang}.ts tem exatamente as chaves de pt.ts`, () => {
    const missing = [...keys.pt].filter((k) => !keys[lang].has(k));
    const extra = [...keys[lang]].filter((k) => !keys.pt.has(k));
    assert.deepEqual(missing, [], `faltando em ${lang}: ${missing.slice(0, 20).join(', ')}`);
    assert.deepEqual(extra, [], `sobrando em ${lang}: ${extra.slice(0, 20).join(', ')}`);
  });
}

test('nenhum texto de interface usa travessão', () => {
  for (const [lang, src] of Object.entries(files)) {
    const offenders = src
      .split('\n')
      .filter((line) => !/^\s*\/\//.test(line))
      // mapa de erros: a CHAVE é a mensagem original do Zod em PT (não aparece na tela)
      .map((line) => line.replace(/^\s*"[^"]*"\s*:/, ''))
      .filter((line) => /"[^"]*[—–][^"]*"/.test(line));
    assert.deepEqual(offenders, [], `travessão em ${lang}.ts: ${offenders.slice(0, 5).join(' | ')}`);
  }
});
