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
