'use strict';

// Guard — Contratos totalmente customizáveis (ordem do CEO, 2026-09-10).
//
// Invariantes:
//   1. Regra 3 (BUSINESS_RULES): valor fora da tabela do plano — ou plano
//      personalizado — EXIGE justificativa, gravada em
//      valor_customizado/justificativa_customizacao (audit trail).
//   2. Plano personalizado exige valor negociado explícito.
//   3. Entrada nunca excede o valor total; parcelas >= 1.
//   4. Refazer contrato só sem NENHUM pagamento: entrada_paga false E zero
//      parcelas recebidas, com CAS na exclusão — histórico financeiro real
//      nunca se apaga.
//   5. Migration do enum plano_tipo é idempotente (ADD VALUE IF NOT EXISTS).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');

const finSrc = ler('apps', 'crm', 'src', 'lib', 'actions', 'financeiro.ts');
const migSrc = ler('supabase', 'migrations', '20260910120000_plano_personalizado.sql');

const criar = finSrc.slice(
  finSrc.indexOf('export async function criarContrato'),
  finSrc.indexOf('export async function confirmarPagamento'));

test('contratos: customização exige justificativa (Regra 3) e grava no audit', () => {
  assert.match(criar, /if \(isCustomizado && !justificativa\)/,
    'gate da justificativa sumiu — valor fora da tabela passaria sem audit');
  assert.match(criar, /valor_customizado: isCustomizado \? valorTotal : null/,
    'valor_customizado deixou de ser gravado');
  assert.match(criar, /justificativa_customizacao: isCustomizado \? justificativa : null/,
    'justificativa deixou de ser gravada');
});

test('contratos: personalizado exige valor; entrada e parcelas validadas', () => {
  assert.match(criar, /valorTotal == null \|\| valorTotal <= 0/,
    'plano personalizado sem valor passaria');
  assert.match(criar, /entradaValor < 0 \|\| entradaValor > valorTotal/,
    'entrada maior que o total passaria');
  assert.match(criar, /inclui_psicologa: incluiPsicologa/,
    'toggle de psicóloga voltou a ser ignorado (era derivado só do plano)');
});

test('contratos: refazer só sem nenhum pagamento, com CAS', () => {
  const refazer = finSrc.slice(finSrc.indexOf('export async function excluirContratoSemPagamento'));
  assert.match(refazer, /if \(contrato\.entrada_paga\)/,
    'contrato com entrada paga poderia ser apagado');
  assert.match(refazer, /\.eq\("status", "recebido"\)/,
    'checagem de parcelas recebidas sumiu');
  assert.match(refazer, /\.eq\("entrada_paga", false\)/,
    'CAS da exclusão sumiu — corrida com confirmarPagamento apagaria contrato pago');
  assert.match(refazer, /\.update\(\{ deleted_at: agora \}\)/,
    'exclusão deixou de ser soft delete');
});

test('contratos: migration do plano personalizado é idempotente', () => {
  assert.match(migSrc, /ADD VALUE IF NOT EXISTS 'personalizado'/,
    'ADD VALUE idempotente sumiu da migration');
});

// ─── 2026-09-11: customização de VALOR DO DEAL (modal) + coluna que faltava ──

test('deal: customizar valor grava justificativa + flag (coluna criada na 20260911120000)', () => {
  const dealsSrc2 = ler('apps', 'crm', 'src', 'lib', 'actions', 'deals.ts');
  const fn = dealsSrc2.slice(dealsSrc2.indexOf('export async function customizarValorDeal'));
  assert.match(fn, /flag_valores_customizados: true/, 'flag de customização sumiu');
  assert.match(fn, /justificativa_customizacao: justificativa/, 'justificativa deixou de ser gravada no deal');
  assert.match(fn, /if \(!justificativa\.trim\(\)\)/, 'justificativa deixou de ser obrigatória');
  const mig = ler('supabase', 'migrations', '20260911120000_deals_justificativa_customizacao.sql');
  assert.match(mig, /ADD COLUMN IF NOT EXISTS justificativa_customizacao TEXT/,
    'migration da coluna do deal sumiu — o PATCH voltaria a quebrar (bug 2026-09-11)');
});

test('form: segundo responsável é Sim/Não — "sim" exige os 4 dados, "não" nada', () => {
  const formSrc = ler('apps', 'web', 'src', 'components', 'forms', 'FormsPage.tsx');
  assert.match(formSrc, /hasSecondGuardian: z\.string\(\)\.min\(1/,
    'pergunta Sim/Não do segundo responsável sumiu do schema');
  // "Sim" → mesmos dados do responsável principal (ordem do CEO, 2026-09-11)
  for (const campo of ['guardianName2', 'guardianProfession2', 'guardianWhatsapp2', 'guardianEmail2']) {
    assert.match(formSrc, new RegExp(`path: \\["${campo}"\\]`),
      `${campo} deixou de ser exigido quando "sim"`);
    assert.match(formSrc, new RegExp(`setValue\\("${campo}", ""`),
      `marcar "não" deixou de limpar ${campo} — família voltaria a explicar ausência`);
  }
  assert.match(formSrc, /isValidPhoneNumber\(data\.guardianWhatsapp2\)/,
    'WhatsApp do 2º responsável deixou de ser validado');
  assert.match(formSrc, /guardian_name_2: data\.guardianName2\?\.trim\(\) \|\| null/,
    'payload do 2º responsável sumiu do envio');
  assert.match(formSrc, /watch\("hasSecondGuardian"\) === "sim" && \(/,
    'bloco condicional do 2º responsável sumiu do JSX');
});
