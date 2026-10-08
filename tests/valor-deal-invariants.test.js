'use strict';

// Guard — valor REAL do deal (T3, 2026-10-08).
//
// Origem: card, coluna, métricas, War Room e export liam SEMPRE
// deals.valor_estimado (estimativa automática da faixa), nunca o contrato.
// Ex.: contrato Journey de R$ 26.000 aparecia como R$ 28.000; Plano/Sinal/
// Saldo do deal nunca eram preenchidos (filtro de plano esvaziava o board).
//
// Invariantes:
//   1. Precedência na LEITURA: contrato vigente com plano > negociado (flag) >
//      estimado — o guard EXECUTA o bloco `@guard-js` de lib/valor-deal.ts.
//   2. Embed 1:1 contrato↔deal volta OBJETO (incidente 05/09): o resolver
//      aceita objeto e array; nenhum consumidor faz .map/[0] no embed.
//   3. Sinal = soma das parcelas de entrada RECEBIDAS (não depende de
//      entrada_paga); contrato soft-deleted e parcela soft-deleted não contam.
//   4. "Aguardando plano" (sinal antes do plano — T11) não vira valor contratado.
//   5. criarContrato NÃO sobrescreve deals.valor_estimado; customizar valor de
//      deal COM contrato é recusado (deal e contrato nunca divergem).
//   6. Todo consumidor de valor do deal usa o resolver (nada de
//      Number(d.valor_estimado) somado direto).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');

const blocoGuardJs = (arquivo, nome) => {
  const src = ler(arquivo);
  const ini = `// @guard-js:inicio ${nome}`;
  const fim = `// @guard-js:fim ${nome}`;
  const a = src.indexOf(ini);
  const b = src.indexOf(fim);
  assert.ok(a >= 0 && b > a, `${arquivo}: marcadores "@guard-js ${nome}" sumiram`);
  return src
    .slice(a + ini.length, b)
    .replace(/^(\s*)(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*:\s*[A-Za-z_$][\w$]*\s*=/gm, '$1const $2 =');
};

const ARQ = 'apps/crm/src/lib/valor-deal.ts';
// eslint-disable-next-line no-new-func
const { resolverValorDealCore } = new Function(
  `${blocoGuardJs(ARQ, 'valor-deal')}\nreturn { resolverValorDealCore };`,
)();

// Espelho de PLANO_VALORES (types/crm.ts) — conferido abaixo contra o fonte.
const TABELA = {
  journey: { padrao: 26000, pix: 23000 },
  legacy: { padrao: 32000, pix: 28500 },
  start: { padrao: 18000, pix: 16000 },
};
const resolver = (deal) => resolverValorDealCore(deal, TABELA);

const parcela = (tipo, status, valor, deleted_at = null) => ({ tipo, status, valor, deleted_at });
const contratoJourney = (extra = {}) => ({
  id: 'c1',
  plano: 'journey',
  valor_total: 26000,
  forma_pagamento_plano: 'padrao',
  deleted_at: null,
  parcelas: [parcela('entrada', 'recebido', 4500), parcela('saldo', 'previsto', 3583.33)],
  ...extra,
});

test('tabela espelhada confere com PLANO_VALORES do fonte', () => {
  const crm = ler('apps', 'crm', 'src', 'types', 'crm.ts');
  assert.match(crm, /journey: \{ padrao: 26000, pix: 23000/);
  assert.match(crm, /legacy: \{ padrao: 32000, pix: 28500/);
  assert.match(crm, /start: \{ padrao: 18000, pix: 16000/);
});

test('sem contrato e sem customização → estimado (valor do deal)', () => {
  const r = resolver({ valor_estimado: 22000, flag_valores_customizados: false, contrato: null });
  assert.equal(r.valor, 22000);
  assert.equal(r.origem, 'estimado');
  assert.equal(r.plano, null);
  assert.equal(r.sinalRecebido, null);
  assert.equal(r.saldoAReceber, null);
});

test('customizado sem contrato → negociado', () => {
  const r = resolver({ valor_estimado: 24500, flag_valores_customizados: true, contrato: null });
  assert.deepEqual([r.valor, r.origem], [24500, 'negociado']);
});

test('contrato vigente (OBJETO, formato real do PostgREST) vence customização e estimativa', () => {
  const r = resolver({ valor_estimado: 28000, flag_valores_customizados: true, contrato: contratoJourney() });
  assert.equal(r.valor, 26000);
  assert.equal(r.origem, 'contratado');
  assert.equal(r.plano, 'Journey');
  assert.equal(r.sinalRecebido, 4500);
  assert.equal(r.saldoAReceber, 21500);
  assert.equal(r.temDesconto, false);
  assert.equal(r.valorEstimadoDeal, 28000);
});

test('embed como ARRAY (defesa) dá o mesmo resultado do objeto', () => {
  const a = resolver({ valor_estimado: 28000, flag_valores_customizados: false, contrato: [contratoJourney()] });
  const o = resolver({ valor_estimado: 28000, flag_valores_customizados: false, contrato: contratoJourney() });
  assert.deepEqual(a, o);
});

test('contrato soft-deleted é ignorado', () => {
  const r = resolver({
    valor_estimado: 22000,
    flag_valores_customizados: false,
    contrato: contratoJourney({ deleted_at: '2026-10-01T00:00:00Z' }),
  });
  assert.deepEqual([r.valor, r.origem, r.sinalRecebido, r.contratoId], [22000, 'estimado', null, null]);
});

test('sinal = só entrada RECEBIDA e não deletada; saldo desconta tudo que foi recebido', () => {
  const r = resolver({
    valor_estimado: 0,
    flag_valores_customizados: false,
    contrato: contratoJourney({
      parcelas: [
        parcela('entrada', 'recebido', 2000),
        parcela('entrada', 'recebido', 2500),
        parcela('entrada', 'previsto', 999),
        parcela('entrada', 'recebido', 777, '2026-10-01T00:00:00Z'),
        parcela('saldo', 'recebido', 3500),
        parcela('saldo', 'atrasado', 3500),
      ],
    }),
  });
  assert.equal(r.sinalRecebido, 4500);
  assert.equal(r.saldoAReceber, 26000 - 4500 - 3500);
});

test('valores numeric como string (PostgREST) são aceitos', () => {
  const r = resolver({
    valor_estimado: '28000.00',
    flag_valores_customizados: false,
    contrato: contratoJourney({ valor_total: '26000.00', parcelas: [parcela('entrada', 'recebido', '4500.00')] }),
  });
  assert.deepEqual([r.valor, r.sinalRecebido, r.saldoAReceber], [26000, 4500, 21500]);
});

test('desconto só abaixo da tabela da forma escolhida (pix à vista não é desconto)', () => {
  const desc = resolver({ valor_estimado: 0, contrato: contratoJourney({ valor_total: 24000 }) });
  assert.deepEqual([desc.temDesconto, desc.descontoPct], [true, 8]);
  const pix = resolver({ valor_estimado: 0, contrato: contratoJourney({ valor_total: 23000, forma_pagamento_plano: 'pix_avista' }) });
  assert.deepEqual([pix.temDesconto, pix.descontoPct], [false, null]);
  const pers = resolver({ valor_estimado: 0, contrato: contratoJourney({ plano: 'personalizado', valor_total: 30000 }) });
  assert.deepEqual([pers.origem, pers.plano, pers.temDesconto], ['contratado', 'Personalizado', false]);
});

test('contrato AGUARDANDO PLANO (plano nulo ou valor 0) não é valor contratado, mas o sinal aparece', () => {
  for (const extra of [{ plano: null, valor_total: null }, { plano: null, valor_total: 4500 }, { plano: 'journey', valor_total: 0 }, { plano: 'a_definir', valor_total: 26000 }]) {
    const r = resolver({
      valor_estimado: 22000,
      flag_valores_customizados: false,
      contrato: contratoJourney({ ...extra, parcelas: [parcela('entrada', 'recebido', 4500)] }),
    });
    assert.equal(r.origem, 'estimado', JSON.stringify(extra));
    assert.equal(r.valor, 22000);
    assert.equal(r.plano, null);
    assert.equal(r.sinalRecebido, 4500);
    assert.equal(r.contratoId, 'c1');
  }
});

test('valor_estimado nulo/inválido → 0 estimado (nunca NaN)', () => {
  for (const v of [null, undefined, '', 'abc']) {
    const r = resolver({ valor_estimado: v, flag_valores_customizados: true, contrato: null });
    assert.equal(r.valor, 0);
    assert.equal(r.origem, 'estimado', 'flag sem valor não vira "negociado R$ 0"');
  }
});

// ─── Consumidores ────────────────────────────────────────────────

test('pipeline e deal-fetch: embed do contrato + resolver (sem valor_estimado cru)', () => {
  for (const arq of ['apps/crm/src/app/(dashboard)/pipeline/page.tsx', 'apps/crm/src/lib/deal-fetch.ts']) {
    const src = ler(arq);
    assert.match(src, /\$\{EMBED_CONTRATO_VALOR\}/, `${arq}: embed do contrato sumiu do select`);
    assert.match(src, /\.\.\.camposValorDeal\(/, `${arq}: valor deixou de passar pelo resolver`);
    assert.doesNotMatch(src, /deal_value_brl:\s*\(?row\.valor_estimado/, `${arq}: voltou a exibir valor_estimado cru`);
    assert.doesNotMatch(src, /contrato\)?\s*\.\s*(map|flatMap|forEach)\(|\.contrato\[0\]/, `${arq}: embed 1:1 tratado como array`);
  }
});

test('agregados (War Room, relatórios, famílias, agenda) usam o resolver', () => {
  const arquivos = [
    'apps/crm/src/lib/war-room-queries.ts',
    'apps/crm/src/app/(dashboard)/relatorios/page.tsx',
    'apps/crm/src/app/(dashboard)/familias/page.tsx',
    'apps/crm/src/lib/actions/agenda-calendar.ts',
  ];
  for (const arq of arquivos) {
    const src = ler(arq);
    assert.doesNotMatch(src, /Number\(d\.valor_estimado\)/, `${arq}: soma de valor_estimado cru voltou`);
    assert.match(src, /EMBED_CONTRATO_VALOR_LEVE/, `${arq}: embed do contrato sumiu`);
  }
});

test('customizarValorDeal: recusa deal com contrato, valida, só deal vivo, revalida o board', () => {
  const src = ler('apps', 'crm', 'src', 'lib', 'actions', 'deals.ts');
  const fn = src.slice(src.indexOf('export async function customizarValorDeal'), src.indexOf('export async function atualizarDeal'));
  assert.match(fn, /code: "TEM_CONTRATO"/, 'deal com contrato voltou a aceitar valor próprio (deal ≠ contrato)');
  assert.match(fn, /\.from\("contratos_financeiros"\)[\s\S]{0,200}\.is\("deleted_at", null\)/, 'checagem do contrato vigente sumiu');
  assert.match(fn, /customizarValorSchema\.safeParse/, 'validação (zod) sumiu');
  assert.match(fn, /\.eq\("id", dados\.dealId\)\s*\.is\("deleted_at", null\)/, 'update passou a atingir deal excluído');
  assert.match(fn, /revalidatePath\("\/pipeline"\)/, 'board não repinta após salvar');
  // Contrato existente garantido pelos guards antigos (contratos-custom-invariants)
  assert.match(fn, /flag_valores_customizados: true/);
  assert.match(fn, /justificativa_customizacao: dados\.justificativa/);
});

/** Corpo de uma função exportada (até o próximo `export`); null se não existir. */
const corpoFuncao = (src, nome) => {
  const i = src.indexOf(`export async function ${nome}(`);
  if (i < 0) return null;
  const fim = src.indexOf('\nexport ', i + 1);
  return src.slice(i, fim < 0 ? undefined : fim);
};

test('contrato/pagamento não sobrescrevem deals.valor_estimado e revalidam o /pipeline', () => {
  const fin = ler('apps', 'crm', 'src', 'lib', 'actions', 'financeiro.ts');
  assert.doesNotMatch(fin, /valor_estimado/, 'financeiro.ts passou a escrever valor_estimado — a estimativa original se perde');
  // Se o fluxo de contrato migrar para outro módulo (T9/T11), a exigência vale lá:
  // toda action que muda valor_total/parcelas revalida o /pipeline.
  for (const nome of ['criarContrato', 'confirmarPagamento']) {
    const corpo = corpoFuncao(fin, nome);
    if (corpo === null) continue;
    assert.match(corpo, /revalidatePath\("\/pipeline"\)/, `${nome}: card não reflete contrato/sinal sem F5`);
  }
});

test('card: valor clicável sem disparar drag nem abrir o detalhe', () => {
  const src = ler('apps', 'crm', 'src', 'components', 'pipeline', 'DealCard.tsx');
  const i = src.indexOf('onValorClick ? (');
  assert.ok(i > 0, 'botão do valor sumiu do card');
  const trecho = src.slice(i, i + 700);
  assert.match(trecho, /onPointerDown=\{\(e\) => e\.stopPropagation\(\)\}/, 'pointerdown do valor inicia drag');
  assert.match(trecho, /e\.stopPropagation\(\);\s*onValorClick\(\);/, 'clique no valor também abre o detalhe');
});
