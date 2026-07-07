'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — Régua de cobrança (billing-reminders)
// ════════════════════════════════════════════════════════════════════════
//
// A régua NÃO é outreach de lead (não usa classificação Gemini/timing — esses
// invariantes não se aplicam). Mas ela envia mensagem a clientes e move
// dinheiro de reputação: precisa dos SEUS próprios invariantes, verificados
// estaticamente para impedir regressão:
//
//   1. Elegibilidade: só parcelas status previsto/atrasado.
//   2. Contrato ativo: parcela de contrato cancelado (deleted_at) não cobra.
//   3. CAS atômico ANTES do envio: marca a coluna do marco com filtro
//      `=is.null`; se não venceu a corrida (`!won`), pula — nunca duplica.
//
// Execução local: node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadExecutableSource(functionName) {
  const file = path.join(__dirname, '..', 'functions', functionName, 'index.js');
  assert.ok(fs.existsSync(file), `Arquivo não encontrado: ${file}`);
  const raw = fs.readFileSync(file, 'utf8');
  const noBlock = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const src = loadExecutableSource('billing-reminders');

test('billing-reminders: elegibilidade só previsto/atrasado', () => {
  assert.match(
    src,
    /status=in\.\(previsto,atrasado\)/,
    'A busca de parcelas DEVE filtrar status=in.(previsto,atrasado) — nunca cobrar recebido/cancelado.',
  );
});

test('billing-reminders: contrato cancelado não é cobrado', () => {
  assert.match(
    src,
    /contrato\.deleted_at/,
    'extractContato DEVE checar contrato.deleted_at (contrato cancelado → não cobra).',
  );
});

test('billing-reminders: CAS atômico com filtro =is.null antes do envio', () => {
  assert.match(src, /casMark\s*\(/, 'DEVE existir casMark() marcando o marco antes do envio.');
  assert.match(
    src,
    /\$\{column\}=is\.null/,
    'O PATCH do CAS DEVE incluir `${column}=is.null` (só o primeiro marca — atomicidade).',
  );
  assert.match(
    src,
    /if\s*\(\s*!won\s*\)/,
    'Se o CAS não venceu a corrida (!won), DEVE pular — evita envio duplicado.',
  );
});

test('billing-reminders: marca o marco também quando não há contato (não reprocessa em loop)', () => {
  assert.match(
    src,
    /skipped_no_contact/,
    'Sem contato/contrato ativo, DEVE marcar o marco (CAS) e logar skipped_no_contact — sem loop infinito.',
  );
});
