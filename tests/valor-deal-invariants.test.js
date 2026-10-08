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
//   7. Sinal pago antes do plano (T11, contrato B3 do PLANO): o card mostra
//      "Sinal R$ X pago · total a definir" + badge "A definir"; o texto do
//      sinal não some quando o valor é 0; a coluna soma o valor resolvido.
//   8. Embed com hint de FK explícito (PGRST201 silencioso derruba a tela).

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
const { resolverValorDealCore, contratoAguardandoPlano, sinalPagoAntesDoPlano } = new Function(
  `${blocoGuardJs(ARQ, 'valor-deal')}\nreturn { resolverValorDealCore, contratoAguardandoPlano, sinalPagoAntesDoPlano };`,
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

test('sinal antes do plano (T11): regra do card executada sobre o deal já resolvido', () => {
  // Mesmo caminho do board: resolver → campos do Deal → regra do card.
  const campos = (deal) => {
    const r = resolver(deal);
    return { contrato_id: r.contratoId ?? undefined, product_tier: r.plano ?? undefined, signal_value_brl: r.sinalRecebido ?? undefined };
  };
  const aguardando = campos({
    valor_estimado: 22000,
    flag_valores_customizados: false,
    contrato: contratoJourney({ plano: null, valor_total: 4500, parcelas: [parcela('entrada', 'recebido', 4500)] }),
  });
  assert.equal(contratoAguardandoPlano(aguardando), true);
  assert.equal(sinalPagoAntesDoPlano(aguardando), 4500);

  // Lead sem faixa (valor 0) que pagou o sinal: o texto do sinal NÃO some.
  const semFaixa = campos({
    valor_estimado: null,
    contrato: contratoJourney({ plano: null, valor_total: 3000, parcelas: [parcela('entrada', 'recebido', 3000)] }),
  });
  assert.equal(resolver({ valor_estimado: null, contrato: contratoJourney({ plano: null, valor_total: 3000 }) }).valor, 0);
  assert.equal(sinalPagoAntesDoPlano(semFaixa), 3000);

  // Contrato sem plano e sem sinal recebido: badge "A definir", sem texto de sinal.
  const semSinal = campos({
    valor_estimado: 22000,
    contrato: contratoJourney({ plano: null, valor_total: null, parcelas: [parcela('entrada', 'previsto', 4500)] }),
  });
  assert.equal(contratoAguardandoPlano(semSinal), true);
  assert.equal(sinalPagoAntesDoPlano(semSinal), null);

  // Contrato com plano (sinal normal) e deal sem contrato: regra não se aplica.
  const comPlano = campos({ valor_estimado: 28000, contrato: contratoJourney() });
  assert.deepEqual([contratoAguardandoPlano(comPlano), sinalPagoAntesDoPlano(comPlano)], [false, null]);
  const semContrato = campos({ valor_estimado: 22000, contrato: null });
  assert.deepEqual([contratoAguardandoPlano(semContrato), sinalPagoAntesDoPlano(semContrato)], [false, null]);
});

test('card do T11: "Sinal R$ X pago · total a definir", previsão secundária e badge "A definir"', () => {
  const vd = ler(ARQ);
  assert.match(vd, /`Sinal \$\{brl\(sinal\)\} pago · total a definir`/, 'texto do sinal antes do plano mudou');
  assert.match(vd, /`previsão \$\{formatarValorDeal\(/, 'linha de previsão deixou de usar o valor resolvido');

  const card = ler('apps', 'crm', 'src', 'components', 'pipeline', 'DealCard.tsx');
  const valorDoCard = card.slice(card.indexOf('function ValorDoCard'), card.indexOf('function rotuloAcessivelValor'));
  assert.match(valorDoCard, /sinalPagoAntesDoPlano\(deal\)/, 'card não aplica a regra do sinal antes do plano');
  assert.match(valorDoCard, /textoSinalAntesDoPlano\(/, 'card não mostra "Sinal R$ X pago · total a definir"');
  assert.match(valorDoCard, /textoPrevisaoDoSinal\(deal\)/, 'card perdeu a linha de previsão');
  assert.match(card, /\{aguardandoPlano && \([\s\S]{0,500}uppercase[\s\S]{0,300}A definir/, 'badge "A definir" do contrato sem plano sumiu');
  assert.match(card, /const aguardandoPlano = contratoAguardandoPlano\(deal\)/);
  // O TEXTO do sinal não depende do valor (só a barra depende) — revisão R7.
  assert.doesNotMatch(card, /sinalRecebido > 0 && deal\.deal_value_brl > 0/, 'texto do sinal voltou a sumir quando o valor é 0');
  // O número SOMADO na coluna segue o resolver (deal_value_brl), nunca o sinal.
  const coluna = ler('apps', 'crm', 'src', 'components', 'pipeline', 'PipelineColumn.tsx');
  assert.doesNotMatch(coluna, /signal_value_brl/, 'total da coluna passou a somar o sinal em vez do valor resolvido');
});

test('embed com hint de FK explícito (PGRST201 silencioso derrubou 6 telas)', () => {
  const vd = ler(ARQ);
  const embed = (nome) => {
    const m = vd.match(new RegExp(`export const ${nome} =\\s*"([^"]+)"`));
    assert.ok(m, `${nome} sumiu`);
    return m[1];
  };
  for (const nome of ['EMBED_CONTRATO_VALOR', 'EMBED_CONTRATO_VALOR_LEVE']) {
    assert.match(embed(nome), /^contrato:contratos_financeiros!contratos_financeiros_deal_id_fkey\(/, `${nome}: hint da FK deal→contrato sumiu`);
  }
  assert.match(embed('EMBED_CONTRATO_VALOR'), /parcelas!parcelas_contrato_id_fkey\(/, 'hint da FK contrato→parcelas sumiu');
});

test('deal buscado no cliente é rebuscado após salvar o valor (/leads e /remarketing)', () => {
  const sheet = ler('apps', 'crm', 'src', 'components', 'pipeline', 'DealDetailSheet.tsx');
  assert.match(sheet, /onSaved=\{onDealAtualizado\}/, 'DealDetailSheet não avisa quem buscou o deal');
  const modal = ler('apps', 'crm', 'src', 'components', 'pipeline', 'DealDetailModal.tsx');
  assert.match(modal, /<DealDetailSheet[\s\S]{0,300}onDealAtualizado=\{onDealAtualizado\}/, 'editor lateral do detalhe não repassa o aviso');
  const rmkt = ler('apps', 'crm', 'src', 'components', 'remarketing', 'RemarketingLeadSheet.tsx');
  assert.match(rmkt, /\[dealId, versao\]/, '/remarketing não rebusca o deal');
  assert.match(rmkt, /onDealAtualizado=\{\(\) => setVersao\(/, '/remarketing não incrementa a versão após salvar');
  const leads = ler('apps', 'crm', 'src', 'components', 'leads', 'LeadOrDealSheet.tsx');
  assert.match(leads, /onDealAtualizado=\{\(\) => setVersao\(/, '/leads não rebusca o deal');
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
