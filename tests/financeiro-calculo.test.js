'use strict';

// ════════════════════════════════════════════════════════════════════════
// Guard — cálculo financeiro do contrato (T6/T9/T10/T11/T18, 2026-10-08)
// ════════════════════════════════════════════════════════════════════════
//
// Testa o MÓDULO REAL (apps/crm/src/lib/financeiro/calculo.mjs) — a mesma
// função que gera a prévia na tela e as parcelas que a RPC grava. Zero deps:
// import dinâmico de ESM a partir do CommonJS do node:test.
//
// Casos reais de produção:
//   • Amanda (31/08): "7.800" digitado virou R$ 7,80 (type=number) → o parser
//     tem que devolver 7800.
//   • 12 × 2.166,02 = 25.992,24 ≠ saldo 25.992,20 → a última parcela absorve.
//   • +30 dias escorregava o dia do vencimento → mesmo dia do mês.
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MODULO = path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'financeiro', 'calculo.mjs');
const TIPOS = path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'financeiro', 'calculo.d.mts');
const carregar = () => import(require('node:url').pathToFileURL(MODULO).href);

test('parseValorBRL: padrão brasileiro e o caso Amanda (7.800 ≠ 7,80)', async () => {
  const { parseValorBRL } = await carregar();
  assert.equal(parseValorBRL('7800'), 7800);
  assert.equal(parseValorBRL('7.800'), 7800);
  assert.equal(parseValorBRL('7.800,00'), 7800);
  assert.equal(parseValorBRL('R$ 7.800,5'), 7800.5);
  assert.equal(parseValorBRL('26.000'), 26000);
  assert.equal(parseValorBRL('1.234.567,89'), 1234567.89);
  assert.equal(parseValorBRL('4500.50'), 4500.5); // hábito en-US: 1–2 casas após UM ponto
  assert.equal(parseValorBRL(',5'), 0.5);
  assert.equal(parseValorBRL(''), null);
  assert.equal(parseValorBRL('abc'), null);
  assert.equal(parseValorBRL('12.34.56'), null);
  assert.equal(parseValorBRL('7,'), null); // ainda digitando
  assert.equal(parseValorBRL('-10'), null);
  assert.equal(parseValorBRL('100000000'), null); // acima do teto
});

test('gerarCronograma: Σ = total ao centavo, última absorve, mesmo dia do mês', async () => {
  const { gerarCronograma, somarValores } = await carregar();
  const p = gerarCronograma({ total: 25992.2, quantidade: 12, primeiroVencimento: '2026-01-31', metodo: 'getnet' });
  assert.equal(p.length, 12);
  assert.equal(somarValores(p.map((x) => x.valor)), 25992.2);
  assert.equal(p[0].valor, 2166.01);
  assert.equal(p[11].valor, 2166.09);
  assert.deepEqual(p.slice(0, 4).map((x) => x.vencimento), ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  assert.equal(p[0].numero_parcela, '1/12');
  const unica = gerarCronograma({ total: 7800, quantidade: 1, primeiroVencimento: '2026-10-08', metodo: 'pix', rotuloUnico: 'Entrada' });
  assert.equal(unica[0].numero_parcela, 'Entrada');
  assert.throws(() => gerarCronograma({ total: 100, quantidade: 0, primeiroVencimento: '2026-10-08', metodo: 'pix' }));
  assert.throws(() => gerarCronograma({ total: 100, quantidade: 2, primeiroVencimento: '2026-02-30', metodo: 'pix' }));
});

test('planejarAbertas: preserva recebidas e continua a numeração', async () => {
  const { planejarAbertas, somarValores } = await carregar();
  const r = planejarAbertas({
    totalGrupo: 21500, recebidas: [{ valor: 3583.33 }, { valor: 3583.33 }],
    quantidadeTotal: 6, primeiroVencimento: '2026-11-16', metodo: 'getnet',
  });
  assert.equal(r.erro, null);
  assert.equal(r.parcelas.length, 4);
  assert.equal(r.parcelas[0].numero_parcela, '3/6');
  assert.equal(somarValores(r.parcelas.map((x) => x.valor)), 21500 - 7166.66);
  const menor = planejarAbertas({ totalGrupo: 100, recebidas: [{ valor: 200 }], quantidadeTotal: 1, primeiroVencimento: '2026-11-16', metodo: 'pix' });
  assert.equal(menor.erro, 'MENOR_QUE_RECEBIDO');
});

test('composicaoValorTotal: sinal abatido (padrão) × não abatido + itens', async () => {
  const { composicaoValorTotal } = await carregar();
  const itens = [{ valor: 2500 }, { valor: -1000 }];
  assert.equal(composicaoValorTotal({ valorBase: 26000, itens, entrada: 5000, sinalAbatido: true }), 27500);
  assert.equal(composicaoValorTotal({ valorBase: 32000, entrada: 4500, sinalAbatido: false }), 36500);
});

test('ehValorIrrisorio: < R$ 100 ou < 1% do total pede confirmação', async () => {
  const { ehValorIrrisorio } = await carregar();
  assert.equal(ehValorIrrisorio(7.8, 26000), true);
  assert.equal(ehValorIrrisorio(200, 26000), true); // < 260
  assert.equal(ehValorIrrisorio(4500, 26000), false);
  assert.equal(ehValorIrrisorio(0, 26000), false);
});

test('estadoContrato: aguardando plano, condições pendentes, quitado, ativo', async () => {
  const { estadoContrato } = await carregar();
  assert.equal(estadoContrato(null), 'sem_contrato');
  assert.equal(estadoContrato({ plano: null, valor_total: 4500 }, []), 'aguardando_plano');
  const ent = { tipo: 'entrada', valor: 4500, status: 'recebido', vencimento: '2026-09-08' };
  assert.equal(estadoContrato({ plano: 'journey', valor_total: 26000 }, [ent]), 'condicoes_pendentes');
  const sal = { tipo: 'saldo', valor: 21500, status: 'previsto', vencimento: '2026-11-08' };
  assert.equal(estadoContrato({ plano: 'journey', valor_total: 26000 }, [ent, sal]), 'ativo');
  assert.equal(estadoContrato({ plano: 'journey', valor_total: 26000 }, [ent, { ...sal, status: 'recebido' }]), 'quitado');
  assert.equal(estadoContrato({ plano: 'journey', valor_total: 26000 }, [ent, { ...sal, deleted_at: '2026-10-01' }]), 'condicoes_pendentes');
  assert.equal(estadoContrato({ plano: 'journey', valor_total: 26000 }, [ent, { ...sal, status: 'cancelado' }]), 'cancelado');
});

test('margemAluno: psicóloga estimada só se não lançada como custo real', async () => {
  const { margemAluno } = await carregar();
  const semLanc = margemAluno({ valorTotal: 26000, custos: [{ valor: 800, categoria: 'taxas_escola', status: 'pago' }], incluiPsicologa: true, custoPsicologa: 1200 });
  assert.equal(semLanc.margem, 24000);
  const comLanc = margemAluno({ valorTotal: 26000, custos: [{ valor: 1500, categoria: 'psicologa', status: 'pago' }, { valor: 99, categoria: 'viagem', status: 'cancelado' }], incluiPsicologa: true, custoPsicologa: 1200 });
  assert.equal(comLanc.margem, 24500);
  assert.equal(comLanc.psicologaEstimada, 0);
});

test('calculo.d.mts declara todo export do calculo.mjs', () => {
  const js = fs.readFileSync(MODULO, 'utf8');
  const dts = fs.readFileSync(TIPOS, 'utf8');
  const nomes = [...js.matchAll(/export (?:const|function) ([A-Za-z_]\w*)/g)].map((m) => m[1]);
  assert.ok(nomes.length > 10, 'exports não encontrados');
  for (const n of nomes) {
    assert.match(dts, new RegExp(`\\b${n}\\b`), `${n} exportado no .mjs mas sem tipo no .d.mts`);
  }
});
