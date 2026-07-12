'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — Agent de Memória & Documentos (lead-memoria)
// ════════════════════════════════════════════════════════════════════════
//
// A extração de memória/documentos é uma feature de IA que LÊ conversas e
// GRAVA memória/documentos. Dois invariantes precisam ser blindados contra
// regressão, verificados estaticamente:
//
//   1. A IA NUNCA envia nada externo — a action não pode referenciar
//      /api/whatsapp/send, SEND_* nem send-text. Se alguém plugar um envio
//      aqui, o merge é bloqueado.
//   2. Idempotência: a captura de documento usa fonte_ref (message_id) e a
//      memória usa dedupe_key, ambos com semântica ON CONFLICT DO NOTHING
//      (unique_violation 23505 tratado como "já existe"). Reprocessar a mesma
//      conversa NÃO pode duplicar fato nem documento.
//
// Execução local: node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(
  __dirname,
  '..',
  'apps',
  'crm',
  'src',
  'lib',
  'actions',
  'lead-memoria.ts',
);

function loadSource() {
  assert.ok(fs.existsSync(FILE), `Arquivo não encontrado: ${FILE}`);
  const raw = fs.readFileSync(FILE, 'utf8');
  // Remove comentários de bloco e de linha para não dar falso-positivo nos
  // testes de "não envia" (as menções em comentário são explicativas).
  const noBlock = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const src = loadSource();

test('lead-memoria: a extração NUNCA envia (sem /api/whatsapp/send)', () => {
  assert.doesNotMatch(
    src,
    /\/api\/whatsapp\/send/,
    'A action de memória NÃO pode chamar /api/whatsapp/send — extração nunca envia.',
  );
});

test('lead-memoria: a extração NUNCA envia (sem SEND_/send-text)', () => {
  assert.doesNotMatch(
    src,
    /SEND_[A-Z]/,
    'A action de memória NÃO pode referenciar variáveis SEND_* de envio.',
  );
  assert.doesNotMatch(
    src,
    /send-text|sendText|sendMessage|enviarWhatsApp/,
    'A action de memória NÃO pode conter primitivas de envio de mensagem.',
  );
});

test('lead-memoria: captura de documento é idempotente por fonte_ref', () => {
  assert.match(
    src,
    /fonte_ref/,
    'A captura de documento DEVE usar fonte_ref (message_id) para não recapturar o mesmo arquivo.',
  );
});

test('lead-memoria: memória é idempotente por dedupe_key', () => {
  assert.match(
    src,
    /dedupe_key/,
    'A extração de memória DEVE usar dedupe_key para não duplicar fatos ao reprocessar.',
  );
});

test('lead-memoria: idempotência ON CONFLICT DO NOTHING (unique_violation 23505)', () => {
  assert.match(
    src,
    /23505/,
    'Os inserts DEVEM tratar unique_violation (23505) como "já existe" — semântica ON CONFLICT DO NOTHING.',
  );
  assert.match(
    src,
    /inserirIgnorandoDuplicata/,
    'DEVE existir o helper inserirIgnorandoDuplicata (insert idempotente) usado por memória e documentos.',
  );
});

test('lead-memoria: sem atleta_id não anexa documento (reporta pendência)', () => {
  assert.match(
    src,
    /documentosPendentesSemAtleta/,
    'Sem atleta_id não há onde anexar (coluna NOT NULL) — DEVE reportar documentosPendentesSemAtleta.',
  );
});
