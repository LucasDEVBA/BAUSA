'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — automation-engine (ação ia_prompt)
// ════════════════════════════════════════════════════════════════════════
//
// A ação ia_prompt gera texto com Gemini a partir do prompt do CEO + contexto
// do registro. Três invariantes de SEGURANÇA/OPERAÇÃO não podem regredir:
//   1. SEM ENVIO EXTERNO: o texto da IA vira notificação/tarefa interna —
//      NUNCA WhatsApp/e-mail direto (a IA escreve, o CEO revisa e envia).
//   2. TETO POR TICK: cada run de IA custa até IA_DEADLINE_MS — sem teto,
//      um lote de runs de IA estoura o timeout da engine (540s).
//   3. FAIL-CLEAR SEM KEY: sem GEMINI_API_KEY o run marca erro com mensagem
//      acionável, sem afetar as demais automações/ações do tick.
//
// Mesmo estilo string-match do tests/automation-engine-eligibility.test.js.
// Execução local:  node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENGINE_FILE = path.join(__dirname, '..', 'functions', 'automation-engine', 'index.js');

function loadExecutableSource() {
  assert.ok(fs.existsSync(ENGINE_FILE), `Arquivo não encontrado: ${ENGINE_FILE}`);
  const raw = fs.readFileSync(ENGINE_FILE, 'utf8');
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlockComments
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

/** Recorta o bloco executável da ação ia_prompt (até o próximo bloco de ação). */
function blocoIaPrompt(src) {
  const inicio = src.indexOf(`acao.tipo === 'ia_prompt'`);
  assert.ok(
    inicio >= 0,
    `INVARIANTE VIOLADO: a ação ia_prompt deve existir no executeAcao.`,
  );
  const proximoBloco = src.indexOf(`acao.tipo === '`, inicio + 1);
  return proximoBloco > inicio ? src.slice(inicio, proximoBloco) : src.slice(inicio);
}

// ─── Invariante 1: a IA NUNCA envia mensagem externa ─────────────────────
test('automation-engine: ia_prompt não referencia canais de envio externo', () => {
  const src = loadExecutableSource();
  const bloco = blocoIaPrompt(src);
  for (const proibido of ['SEND_WHATSAPP_URL', 'SEND_MESSAGES_URL', 'ZAPI', 'customMessage', 'customEmail']) {
    assert.ok(
      !bloco.includes(proibido),
      `INVARIANTE VIOLADO: o bloco da ação ia_prompt referencia "${proibido}" — ` +
        `a IA NUNCA envia mensagem externa (WhatsApp/e-mail). O texto gerado ` +
        `vira notificação in-app ou tarefa interna: o CEO revisa e envia.`,
    );
  }
  // O resultado permitido é interno: notificações e/ou tarefas.
  assert.ok(
    bloco.includes(`sbPost('notificacoes'`) && bloco.includes(`sbPost('tarefas'`),
    `INVARIANTE VIOLADO: o resultado da ação ia_prompt deve ser gravado como ` +
      `notificação in-app ou tarefa interna (sbPost em notificacoes/tarefas).`,
  );
});

// ─── Invariante 2: teto de execuções de IA por tick ──────────────────────
test('automation-engine: teto de IA por tick (IA_MAX_PER_TICK) com defer sem claim', () => {
  const src = loadExecutableSource();
  assert.ok(
    /IA_MAX_PER_TICK\s*=\s*\d+/.test(src),
    `INVARIANTE VIOLADO: IA_MAX_PER_TICK deve existir — cada run de IA custa ` +
      `até IA_DEADLINE_MS e, sem teto, um lote de runs de IA estoura o ` +
      `timeout da engine (540s).`,
  );
  assert.ok(
    src.includes('IA_MAX_PER_TICK') && src.includes('deferred_ia'),
    `INVARIANTE VIOLADO: o excedente do teto deve ser ADIADO e contabilizado ` +
      `(deferred_ia) para o próximo tick.`,
  );
  // O defer acontece ANTES do claim — o run adiado segue pendente e roda no
  // próximo tick SEM queimar tentativa.
  const idxDefer = src.indexOf('ia_budget_deferred');
  const idxClaim = src.indexOf('await claimRun(run)');
  assert.ok(
    idxDefer >= 0 && idxClaim > idxDefer,
    `INVARIANTE VIOLADO: o defer do teto de IA deve acontecer ANTES do ` +
      `claimRun no loop do tick — depois do claim, o run queimaria tentativa.`,
  );
});

// ─── Invariante 3: fail-clear sem GEMINI_API_KEY ─────────────────────────
test('automation-engine: sem GEMINI_API_KEY o run marca erro claro', () => {
  const src = loadExecutableSource();
  const bloco = blocoIaPrompt(src);
  assert.ok(
    bloco.includes('IA não configurada (GEMINI_API_KEY)'),
    `INVARIANTE VIOLADO: sem GEMINI_API_KEY a ação ia_prompt deve marcar o ` +
      `run como erro com a mensagem "IA não configurada (GEMINI_API_KEY)" — ` +
      `fail-clear, sem afetar as demais automações/ações do tick.`,
  );
  assert.ok(
    bloco.indexOf('GEMINI_API_KEY') < bloco.indexOf('callGeminiWithResilience'),
    `INVARIANTE VIOLADO: a checagem da key deve vir ANTES de qualquer ` +
      `chamada à Gemini.`,
  );
});

// ─── Invariante 4: deadline por run de IA ────────────────────────────────
test('automation-engine: chamada Gemini tem deadline por run (IA_DEADLINE_MS)', () => {
  const src = loadExecutableSource();
  assert.ok(
    /IA_DEADLINE_MS\s*=\s*\d+/.test(src) && src.includes('IA_DEADLINE_MS - (Date.now() - inicio)'),
    `INVARIANTE VIOLADO: callGeminiWithResilience deve impor deadline por ` +
      `run (IA_DEADLINE_MS) — a engine processa vários runs por tick e não ` +
      `pode gastar o tick inteiro numa única chamada de IA.`,
  );
});
