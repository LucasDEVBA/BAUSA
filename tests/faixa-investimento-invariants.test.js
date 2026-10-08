'use strict';

// Guard — faixa de investimento → enum → valor estimado (T4, 2026-10-08).
//
// Origem: mapInvestmentToEnum casava SUBSTRING e testava "40" antes de
// "30"/"20" — o teto de cada faixa caía na faixa de cima ('15k-20k' virava
// 20k_30k/R$ 22.000; '30k-40k' virava 40k_mais/R$ 32.000). 317 deals ativos
// inflados, faixa errada no Engine e no match. A mesma função vivia copiada
// na CF qualify-lead, no Engine e em packages/database.
//
// Invariantes:
//   1. As TRÊS cópias (Engine = fonte única, CF, packages) se COMPORTAM igual
//      — o guard EXECUTA os blocos `@guard-js` (lição do incidente do
//      calendar: testar o código real, nunca uma cópia do teste).
//   2. Tabela do CEO: 15k-20k→ate_20k/16000, 20k-30k→20k_30k/22000,
//      30k-40k→30k_40k/28000, 40k-50k|50k-70k|over-70k→40k_mais/32000.
//   3. Todo código que o formulário público e o /leads/novo podem enviar é
//      CONHECIDO (código novo sem mapeamento = estimativa errada silenciosa).
//   4. Ninguém volta a mapear por substring nem reimplementa a função local.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');

const ARQ_ENGINE = 'apps/crm/src/lib/faixa-investimento.ts';
const ARQ_CF = 'functions/qualify-lead/index.js';
const ARQ_PKG = 'packages/database/src/actions/leads.ts';

/** Bloco `@guard-js` → JS executável (remove `export` e `: Alias` das consts). */
const blocoGuardJs = (arquivo, nome) => {
  const src = ler(arquivo);
  const ini = `// @guard-js:inicio ${nome}`;
  const fim = `// @guard-js:fim ${nome}`;
  const a = src.indexOf(ini);
  const b = src.indexOf(fim);
  assert.ok(a >= 0 && b > a, `${arquivo}: marcadores "@guard-js ${nome}" sumiram — o guard não executa o mapeamento`);
  return src
    .slice(a + ini.length, b)
    .replace(/^(\s*)(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$]*\s*=/gm, '$1const $2 =');
};

const carregar = (arquivo, nomes) => {
  const bloco = blocoGuardJs(arquivo, 'faixa-investimento');
  // eslint-disable-next-line no-new-func
  return new Function(`${bloco}\nreturn { ${nomes.join(', ')} };`)();
};

const NOMES = ['mapInvestmentToEnum', 'mapInvestmentToValor', 'FAIXA_POR_CODIGO', 'VALOR_ESTIMADO_POR_FAIXA'];
const engine = carregar(ARQ_ENGINE, [...NOMES, 'faixaInvestimentoConhecida']);
const cf = carregar(ARQ_CF, [...NOMES, 'faixaInvestimentoConhecida']);
const pkg = carregar(ARQ_PKG, NOMES);

// [entrada, enum esperado, valor esperado]
const CASOS = [
  // Os 6 códigos do formulário público (tabela do CEO)
  ['15k-20k', 'ate_20k', 16000],
  ['20k-30k', '20k_30k', 22000],
  ['30k-40k', '30k_40k', 28000],
  ['40k-50k', '40k_mais', 32000],
  ['50k-70k', '40k_mais', 32000],
  ['over-70k', '40k_mais', 32000],
  // Cadastro manual (/leads/novo): atuais e legado com "_"
  ['abaixo-15k', 'ate_20k', 16000],
  ['abaixo_15k', 'ate_20k', 16000],
  ['15k_20k', 'ate_20k', 16000],
  ['20k_30k', '20k_30k', 22000],
  ['30k_40k', '30k_40k', 28000],
  ['40k_50k', '40k_mais', 32000],
  ['acima_50k', '40k_mais', 32000],
  // Caixa e espaços
  ['OVER-70K', '40k_mais', 32000],
  [' 20k - 30k ', '20k_30k', 22000],
  // Vazio/desconhecido → piso (o CHECK do banco exige um dos 4 enums)
  [null, 'ate_20k', 16000],
  [undefined, 'ate_20k', 16000],
  ['', 'ate_20k', 16000],
  ['100k', 'ate_20k', 16000],
  ['constructor', 'ate_20k', 16000],
  ['__proto__', 'ate_20k', 16000],
  ['toString', 'ate_20k', 16000],
];

for (const [nome, impl] of [['Engine', engine], ['CF qualify-lead', cf], ['packages/database', pkg]]) {
  test(`${nome}: tabela exata do CEO + variações + piso`, () => {
    for (const [entrada, faixa, valor] of CASOS) {
      assert.equal(impl.mapInvestmentToEnum(entrada), faixa, `${nome}: ${JSON.stringify(entrada)} → faixa`);
      assert.equal(impl.mapInvestmentToValor(entrada), valor, `${nome}: ${JSON.stringify(entrada)} → valor`);
    }
  });
}

test('regressão do bug: o TETO da faixa não cai mais na faixa de cima', () => {
  for (const impl of [engine, cf, pkg]) {
    assert.notEqual(impl.mapInvestmentToEnum('15k-20k'), '20k_30k');
    assert.notEqual(impl.mapInvestmentToEnum('20k-30k'), '30k_40k');
    assert.notEqual(impl.mapInvestmentToEnum('30k-40k'), '40k_mais');
  }
});

test('paridade de DADOS: as três cópias têm o mesmo dicionário e a mesma tabela de valores', () => {
  const norm = (o) => JSON.parse(JSON.stringify(o));
  assert.deepEqual(norm(cf.FAIXA_POR_CODIGO), norm(engine.FAIXA_POR_CODIGO), 'CF ≠ Engine (FAIXA_POR_CODIGO)');
  assert.deepEqual(norm(pkg.FAIXA_POR_CODIGO), norm(engine.FAIXA_POR_CODIGO), 'packages ≠ Engine (FAIXA_POR_CODIGO)');
  assert.deepEqual(norm(cf.VALOR_ESTIMADO_POR_FAIXA), norm(engine.VALOR_ESTIMADO_POR_FAIXA), 'CF ≠ Engine (valores)');
  assert.deepEqual(norm(pkg.VALOR_ESTIMADO_POR_FAIXA), norm(engine.VALOR_ESTIMADO_POR_FAIXA), 'packages ≠ Engine (valores)');
  // Só os 4 valores do CHECK atletas_faixa_investimento_check
  const enumsValidos = ['ate_20k', '20k_30k', '30k_40k', '40k_mais'];
  for (const f of Object.values(engine.FAIXA_POR_CODIGO)) assert.ok(enumsValidos.includes(f), `enum inválido: ${f}`);
  assert.deepEqual(Object.keys(engine.VALOR_ESTIMADO_POR_FAIXA).sort(), [...enumsValidos].sort());
});

test('formulário público: todo código do step de investimento é conhecido', () => {
  const src = ler('apps', 'web', 'src', 'components', 'forms', 'FormsPage.tsx');
  const ini = src.indexOf('const investmentRanges = [');
  assert.ok(ini >= 0, 'lista investmentRanges sumiu do FormsPage — atualize o guard');
  const bloco = src.slice(ini, src.indexOf('];', ini));
  const codigos = [...bloco.matchAll(/value:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.equal(codigos.length, 6, `esperados 6 códigos no formulário, achei ${codigos.length}`);
  for (const c of codigos) {
    assert.ok(engine.faixaInvestimentoConhecida(c), `código do formulário sem mapeamento: ${c}`);
    assert.ok(cf.faixaInvestimentoConhecida(c), `CF não conhece o código do formulário: ${c}`);
  }
});

test('/leads/novo: toda opção de faixa é conhecida', () => {
  const src = ler('apps', 'crm', 'src', 'app', '(dashboard)', 'leads', 'novo', 'page.tsx');
  const ini = src.indexOf('value={form.investment_range}');
  assert.ok(ini >= 0, 'select de faixa do /leads/novo sumiu — atualize o guard');
  const bloco = src.slice(ini, src.indexOf('</select>', ini));
  const codigos = [...bloco.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(codigos.length >= 6, 'opções de faixa não encontradas');
  for (const c of codigos) assert.ok(engine.faixaInvestimentoConhecida(c), `opção sem mapeamento: ${c}`);
});

test('ninguém volta a mapear por substring nem reimplementa a função', () => {
  for (const arq of [ARQ_ENGINE, ARQ_CF, ARQ_PKG]) {
    const bloco = blocoGuardJs(arq, 'faixa-investimento');
    assert.doesNotMatch(bloco, /\.includes\(/, `${arq}: mapeamento por substring voltou`);
  }
  const leads = ler('apps', 'crm', 'src', 'lib', 'actions', 'leads.ts');
  assert.match(leads, /from "@\/lib\/faixa-investimento"/, 'leads.ts deixou de usar a fonte única');
  assert.doesNotMatch(leads, /function mapInvestmentTo(Enum|Valor)\(/, 'leads.ts reimplementou o mapeamento');
  // Exibição: a tradução reversa enum→código ('40k_mais' → '40k-50k') mentia
  // para quem respondeu 50k-70k/over-70k. Agora a faixa vem do formulário.
  for (const arq of ['apps/crm/src/app/(dashboard)/pipeline/page.tsx', 'apps/crm/src/lib/deal-fetch.ts']) {
    assert.doesNotMatch(ler(arq), /"40k_mais":\s*"40k-50k"/, `${arq}: tradução reversa lossy voltou`);
  }
  // CF: código desconhecido é logado (não some em silêncio)
  assert.match(ler(ARQ_CF), /faixa_investimento_desconhecida/, 'CF parou de logar faixa desconhecida');
});
