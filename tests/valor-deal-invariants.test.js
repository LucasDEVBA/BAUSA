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
//   9. Deal buscado no cliente (/leads, /remarketing) é rebuscado depois de
//      salvar o valor E depois de mudar contrato/pagamento.
//  10. Modal de valor: Esc fecha só ele (abre dentro do detalhe do deal),
//      foco preso, corpo rolável e os mesmos limites do servidor no campo.
//  11. Desconto (revisão R2, PR-07): base = valor_base_plano (legado:
//      valor_total) contra o preço CONFIGURADO em configuracoes_sistema.planos
//      (fallback PLANO_VALORES, mesma regra da RPC fin_valor_tabela), mais
//      itens 'desconto' vivos. Sinal à parte e serviços extras não escondem
//      desconto; mudar o preço da tabela não inventa desconto.

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
const { resolverValorDealCore, contratoAguardandoPlano, sinalPagoAntesDoPlano, tabelaPlanosDaConfig } = new Function(
  `${blocoGuardJs(ARQ, 'valor-deal')}\nreturn { resolverValorDealCore, contratoAguardandoPlano, sinalPagoAntesDoPlano, tabelaPlanosDaConfig };`,
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

// ─── Desconto (revisão R2) ───────────────────────────────────────
const item = (tipo, valor, deleted_at = null) => ({ tipo, valor, deleted_at });

test('R2: sinal cobrado à parte não esconde o desconto (base = valor_base_plano)', () => {
  // Journey negociado a 24k com sinal de 4,5k NÃO abatido: total 28,5k.
  const r = resolver({
    valor_estimado: 0,
    contrato: contratoJourney({ valor_base_plano: 24000, valor_total: 28500 }),
  });
  assert.equal(r.valor, 28500, 'o valor exibido continua o total do contrato');
  assert.deepEqual([r.temDesconto, r.descontoPct], [true, 8]);
  // Base no preço de tabela + serviço extra (+1.200): total acima da tabela, sem desconto.
  const extra = resolver({
    valor_estimado: 0,
    contrato: contratoJourney({ valor_base_plano: 26000, valor_total: 27200, itens: [item('servico', 1200)] }),
  });
  assert.deepEqual([extra.temDesconto, extra.descontoPct], [false, null]);
  // Legado (valor_base_plano nulo): base = valor_total, como antes.
  const legado = resolver({ valor_estimado: 0, contrato: contratoJourney({ valor_base_plano: null, valor_total: 24000 }) });
  assert.deepEqual([legado.temDesconto, legado.descontoPct], [true, 8]);
  // numeric como string (PostgREST)
  const str = resolver({ valor_estimado: 0, contrato: contratoJourney({ valor_base_plano: '24000.00', valor_total: '28500.00' }) });
  assert.deepEqual([str.temDesconto, str.descontoPct], [true, 8]);
});

test('R2: item de desconto vivo conta (objeto ou array); soft-deleted e ajuste não', () => {
  const comItem = resolver({
    valor_estimado: 0,
    contrato: contratoJourney({ valor_base_plano: 26000, valor_total: 24000, itens: [item('desconto', -2000)] }),
  });
  assert.deepEqual([comItem.temDesconto, comItem.descontoPct, comItem.valor], [true, 8, 24000]);
  const objeto = resolver({
    valor_estimado: 0,
    contrato: contratoJourney({ valor_base_plano: 26000, valor_total: 24000, itens: item('desconto', '-2000.00') }),
  });
  assert.deepEqual([objeto.temDesconto, objeto.descontoPct], [true, 8]);
  // Desconto da base E item somam (26k − 24k = 2k; + 1,3k de item = 3,3k / 26k ≈ 13%).
  const soma = resolver({
    valor_estimado: 0,
    contrato: contratoJourney({ valor_base_plano: 24000, valor_total: 22700, itens: [item('desconto', -1300)] }),
  });
  assert.deepEqual([soma.temDesconto, soma.descontoPct], [true, 13]);
  const apagado = resolver({
    valor_estimado: 0,
    contrato: contratoJourney({ valor_base_plano: 26000, valor_total: 26000, itens: [item('desconto', -2000, '2026-10-01T00:00:00Z')] }),
  });
  assert.deepEqual([apagado.temDesconto, apagado.descontoPct], [false, null]);
  const ajuste = resolver({
    valor_estimado: 0,
    contrato: contratoJourney({ valor_base_plano: 26000, valor_total: 25500, itens: [item('ajuste', -500)] }),
  });
  assert.equal(ajuste.temDesconto, false, 'ajuste não é desconto (só tipo "desconto")');
  // Personalizado não tem tabela: só item de desconto conta, sobre a base negociada.
  const pers = resolver({
    valor_estimado: 0,
    contrato: contratoJourney({ plano: 'personalizado', valor_base_plano: 30000, valor_total: 27000, itens: [item('desconto', -3000)] }),
  });
  assert.deepEqual([pers.temDesconto, pers.descontoPct], [true, 10]);
});

test('R2: preço vem da tabela CONFIGURADA (configuracoes_sistema.planos) com fallback por forma', () => {
  const cfg = {
    journey: { valor: 30000, valor_pix: 27000, psicologa: true },
    legacy: { valor: '34000', valor_pix: 0, psicologa: true },
    start: { valor: -1, valor_pix: 'abc' },
  };
  const tabela = tabelaPlanosDaConfig(cfg, TABELA);
  assert.deepEqual(tabela.journey, { padrao: 30000, pix: 27000 });
  assert.deepEqual(tabela.legacy, { padrao: 34000, pix: 28500 }, 'pix 0 → fallback (igual à fin_valor_tabela)');
  assert.deepEqual(tabela.start, { padrao: 18000, pix: 16000 }, 'inválido/negativo → fallback');
  assert.equal(Object.prototype.hasOwnProperty.call(tabela, 'personalizado'), false, 'personalizado não tem tabela');
  for (const vazio of [null, undefined, [], 'x', 42, {}]) {
    assert.deepEqual(tabelaPlanosDaConfig(vazio, TABELA), TABELA, `config ${JSON.stringify(vazio)} → PLANO_VALORES`);
  }
  // Preço subiu para 30k: contrato a 26k agora é desconto (13%).
  const r = resolverValorDealCore({ valor_estimado: 0, contrato: contratoJourney({ valor_base_plano: 26000 }) }, tabela);
  assert.deepEqual([r.temDesconto, r.descontoPct], [true, 13]);
  // Contrato no preço novo NÃO é desconto ("mudar preço ≠ customizado").
  const novo = resolverValorDealCore({ valor_estimado: 0, contrato: contratoJourney({ valor_base_plano: 30000, valor_total: 30000 }) }, tabela);
  assert.deepEqual([novo.temDesconto, novo.descontoPct], [false, null]);
  // O valor exibido não depende da tabela.
  assert.equal(r.valor, resolver({ valor_estimado: 0, contrato: contratoJourney({ valor_base_plano: 26000 }) }).valor);
});

test('R2: fallback e chaves da tabela iguais às da RPC fin_valor_tabela', () => {
  const dir = path.join(raiz, 'supabase', 'migrations');
  const arq = fs.readdirSync(dir).find((f) => f.endsWith('_financeiro_rpcs.sql'));
  assert.ok(arq, 'migration *_financeiro_rpcs.sql sumiu');
  const sql = fs.readFileSync(path.join(dir, arq), 'utf8');
  const i = sql.indexOf('FUNCTION public.fin_valor_tabela');
  assert.ok(i >= 0, 'fin_valor_tabela sumiu');
  const fn = sql.slice(i, sql.indexOf('$$;', i));
  assert.match(fn, /chave = 'planos'/);
  assert.match(fn, /->> 'valor_pix'/);
  assert.match(fn, /->> 'valor'\)/);
  assert.match(fn, /v IS NULL OR v <= 0/, 'SQL deixou de cair no fallback com preço <= 0');
  for (const [plano, { padrao, pix }] of Object.entries(TABELA)) {
    assert.match(fn, new RegExp(`'${plano}:padrao'\\s+THEN ${padrao}\\b`), `${plano} padrão diverge do PLANO_VALORES`);
    assert.match(fn, new RegExp(`'${plano}:pix_avista'\\s+THEN ${pix}\\b`), `${plano} pix diverge do PLANO_VALORES`);
  }
  const vd = ler(ARQ);
  assert.match(vd, /export const CHAVE_CONFIG_PLANOS = "planos";/);
  assert.match(vd, /precoPositivo\(linha\.valor\)/);
  assert.match(vd, /precoPositivo\(linha\.valor_pix\)/);
});

test('R2: board e detalhe medem o desconto pela tabela configurada', () => {
  for (const arq of ['apps/crm/src/app/(dashboard)/pipeline/page.tsx', 'apps/crm/src/lib/deal-fetch.ts']) {
    const src = ler(arq);
    assert.match(src, /\.from\("configuracoes_sistema"\)\.select\("valor"\)\.eq\("chave", CHAVE_CONFIG_PLANOS\)/, `${arq}: não lê a tabela configurada`);
    assert.match(src, /tabelaPlanosDe\(cfgPlanos\.data\?\.valor\)/, `${arq}: tabela configurada não chega ao resolver`);
  }
  assert.match(ler('apps/crm/src/app/(dashboard)/pipeline/page.tsx'), /\.\.\.camposValorDeal\(row, tabelaPlanos\)/);
  assert.match(ler('apps/crm/src/lib/deal-fetch.ts'), /\}, tabelaPlanosDe\(cfgPlanos\.data\?\.valor\)\)/);
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
  // R2: base do desconto + itens (colunas que só existem a partir da migration do financeiro).
  for (const nome of ['EMBED_CONTRATO_VALOR', 'EMBED_CONTRATO_VALOR_LEVE']) {
    assert.match(embed(nome), /\bvalor_base_plano\b/, `${nome}: valor_base_plano sumiu (desconto volta a olhar o total)`);
  }
  assert.match(
    embed('EMBED_CONTRATO_VALOR'),
    /itens:contrato_itens!contrato_itens_contrato_id_fkey\(tipo, valor, deleted_at\)/,
    'itens do contrato (desconto) sumiram do embed ou perderam o hint de FK',
  );
  // As colunas embutidas existem na migration do financeiro (senão o /pipeline cai com 400).
  const dir = path.join(raiz, 'supabase', 'migrations');
  const mig = fs.readdirSync(dir).find((f) => f.endsWith('_financeiro_contrato_flexivel.sql'));
  assert.ok(mig, 'migration *_financeiro_contrato_flexivel.sql sumiu');
  const sql = fs.readFileSync(path.join(dir, mig), 'utf8');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS valor_base_plano/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.contrato_itens \(/);
  assert.match(sql, /contrato_id\s+UUID NOT NULL REFERENCES public\.contratos_financeiros\(id\)/);
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

test('contrato criado/refeito ou pagamento confirmado também rebusca o deal (/leads e /remarketing)', () => {
  // revalidatePath só repinta o /pipeline; quem buscou o deal no cliente
  // seguia com valor estimado e sinal vazio depois de criar o contrato.
  const tab = ler('apps', 'crm', 'src', 'components', 'pipeline', 'DealContratoTab.tsx');
  assert.match(tab, /onAtualizado\?: \(\) => void/, 'DealContratoTab perdeu o aviso de atualização');
  assert.match(tab, /onAtualizado\?\.\(\)/, 'DealContratoTab não avisa após mudar contrato/pagamento');
  for (const arq of ['DealDetailModal.tsx', 'DealDetailSheet.tsx']) {
    const src = ler('apps', 'crm', 'src', 'components', 'pipeline', arq);
    assert.match(src, /<DealContratoTab[\s\S]{0,200}onAtualizado=\{onDealAtualizado\}/, `${arq}: aba do contrato não repassa o aviso`);
  }
});

test('modal de valor: Esc fecha só ele, foco preso, limites do servidor no campo', () => {
  const modal = ler('apps', 'crm', 'src', 'components', 'pipeline', 'CustomizarValorModal.tsx');
  // Aberto dentro do DealDetailModal (Esc em bolha no window): sem captura +
  // stopImmediatePropagation, um Esc fechava o detalhe do deal inteiro.
  assert.match(modal, /addEventListener\("keydown", handler, true\)/, 'Esc do modal de valor voltou a ser ouvido em bolha');
  assert.match(modal, /e\.stopImmediatePropagation\(\);\s*onClose\(\)/, 'Esc do modal de valor volta a fechar o detalhe junto');
  assert.match(modal, /prenderFoco\(e, painelRef\.current\)/, 'Tab voltou a escapar para o board atrás do overlay');
  assert.match(modal, /max-h-\[calc\(100dvh/, 'modal sem altura máxima: rodapé sai da tela com justificativa longa');
  assert.match(modal, /overflow-y-auto/, 'corpo do modal de valor não rola');
  assert.match(modal, /maxLength=\{JUSTIFICATIVA_VALOR_MAX\}/, 'justificativa sem o limite do servidor');
  assert.match(modal, /valor > VALOR_DEAL_MAXIMO/, 'valor acima do teto não é barrado no campo');
  const acao = ler('apps', 'crm', 'src', 'lib', 'actions', 'deals.ts');
  assert.match(acao, /\.max\(VALOR_DEAL_MAXIMO,/, 'servidor deixou de usar o teto compartilhado');
  assert.match(acao, /\.max\(JUSTIFICATIVA_VALOR_MAX,/, 'servidor deixou de usar o limite compartilhado da justificativa');
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
