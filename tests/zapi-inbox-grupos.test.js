'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — Coletor de grupos do zapi-inbox (Fase A dos agents)
// ════════════════════════════════════════════════════════════════════════
//
// A CF zapi-inbox passou a RECONHECER mensagens de grupo (antes descartadas).
// INVARIANTES que um refactor jamais pode quebrar:
//
//   1. Fluxo 1:1 INTACTO — normalizarMensagem continua descartando grupos
//      (`p.isGroup ... return null`), então uma mensagem de grupo NUNCA cai no
//      INSERT direto de whatsapp_mensagens do caminho 1:1.
//   2. Conteúdo de grupo é OPT-IN — o caminho de grupo passa SEMPRE pela RPC
//      atômica `whatsapp_grupo_ingest` (que só grava conteúdo com capturar=true).
//      Nenhum INSERT direto de mensagem de grupo pode existir na CF.
//   3. O handler roteia grupo ANTES do 1:1 (senão o grupo viraria
//      callback_ignorado e a existência não seria registrada).
//   4. PII: o log de grupo não pode logar o texto da mensagem.
//
// Execução local:  node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_FILE = path.join(__dirname, '..', 'functions', 'zapi-inbox', 'index.js');

/** Source sem comentários (mesma estratégia dos guards existentes). */
function loadExecutableSource() {
  assert.ok(fs.existsSync(SOURCE_FILE), `Arquivo não encontrado: ${SOURCE_FILE}`);
  const raw = fs.readFileSync(SOURCE_FILE, 'utf8');
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlockComments
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

test('zapi-inbox: 1:1 intacto — normalizarMensagem ainda descarta grupos', () => {
  const src = loadExecutableSource();
  assert.ok(
    /p\.isGroup === true \|\| p\.isGroup === 'true'\) return null/.test(src),
    "INVARIANTE VIOLADO: o descarte de grupo em normalizarMensagem sumiu — sem " +
      'ele uma mensagem de grupo cairia no INSERT direto do fluxo 1:1.',
  );
});

test('zapi-inbox: conteúdo de grupo é opt-in — só via RPC whatsapp_grupo_ingest', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes('const normalizarGrupo = ') || src.includes('function normalizarGrupo'),
    'INVARIANTE VIOLADO: normalizarGrupo deve existir (reconhecimento de grupo).',
  );
  assert.ok(
    src.includes('rpc/whatsapp_grupo_ingest'),
    'INVARIANTE VIOLADO: o caminho de grupo deve chamar a RPC atômica ' +
      'whatsapp_grupo_ingest (que aplica o opt-in capturar) — nunca um INSERT direto.',
  );
  // Só pode haver UM POST direto p/ whatsapp_mensagens (o do fluxo 1:1). Se
  // aparecer mais de um, algum caminho de grupo está inserindo conteúdo direto,
  // driblando o opt-in.
  const insertsDiretos = src.match(/rest\/v1\/whatsapp_mensagens/g) ?? [];
  assert.equal(
    insertsDiretos.length,
    1,
    'INVARIANTE VIOLADO: existe mais de um INSERT direto em whatsapp_mensagens — ' +
      'grupo deve gravar SÓ pela RPC (opt-in), não por REST direto.',
  );
});

test('zapi-inbox: handler roteia grupo ANTES do 1:1', () => {
  const src = loadExecutableSource();
  const idxGrupo = src.indexOf('normalizarGrupo(payload)');
  const idx1a1 = src.indexOf('normalizarMensagem(payload)');
  assert.ok(idxGrupo > 0, 'handler deve chamar normalizarGrupo(payload)');
  assert.ok(idx1a1 > 0, 'handler deve chamar normalizarMensagem(payload)');
  assert.ok(
    idxGrupo < idx1a1,
    'INVARIANTE VIOLADO: grupo deve ser roteado ANTES do 1:1 — senão viraria ' +
      'callback_ignorado e a existência do grupo não seria registrada.',
  );
});

test('zapi-inbox: log de grupo não vaza PII (não loga texto)', () => {
  const src = loadExecutableSource();
  const bloco = src.match(/grupo_ingerido[\s\S]*?\}\);/);
  assert.ok(bloco, "o log 'grupo_ingerido' deve existir");
  assert.ok(
    !/texto/.test(bloco[0]),
    'INVARIANTE VIOLADO: o log de grupo não pode incluir o texto da mensagem (PII).',
  );
});

// Sanidade: o guard detecta ausência de fato.
test('guard: detecta corretamente quando o coletor de grupo está ausente', () => {
  const fake = 'const x = 1; // sem coletor';
  assert.equal(fake.includes('rpc/whatsapp_grupo_ingest'), false);
  assert.equal(fake.includes('normalizarGrupo'), false);
});
