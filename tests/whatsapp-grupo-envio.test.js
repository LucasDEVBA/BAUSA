'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — Grupo interativo (envio + chatbot assistido + RLS Head)
// ════════════════════════════════════════════════════════════════════════
//
// Feature: painel de conversa de grupo INTERATIVO + métricas + chatbot v1
// (assistido) + grupo visível ao Head. INVARIANTES que um refactor não pode
// quebrar:
//
//   1. ENVIO A GRUPO não mutila o grupo_id — o `groupId` (…@g.us) é passado CRU
//      p/ a Z-API (phone: groupId), NUNCA por cleanPhone/isValidPhone (E.164),
//      que rejeitariam o jid de grupo.
//   2. O envio a grupo é roteado ANTES do guard 1:1 (CEO-only) e usa o guard
//      próprio guardWhatsAppGrupoEnvio (CEO ou Head vinculado). Senão o Head
//      nunca conseguiria enviar, ou o grupo cairia na normalização 1:1.
//   3. O guard de envio a grupo autoriza CEO **ou** head_sucesso e confere a
//      VISIBILIDADE via whatsapp_grupos (RLS impõe "Head só grupo vinculado").
//   4. CHATBOT é ASSISTIDO — a action de sugestão NUNCA envia (sem /api/whatsapp
//      /send, sem SEND_*, sem fetch). E o ramo 1:1 (phone) exige CEO.
//   5. RLS do Head é ESCOPADA: mensagens só de grupo (is_grupo = true) e grupo
//      VINCULADO — a conversa 1:1 (is_grupo = false) permanece CEO-only.
//
// Execução local:  node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SEND_ROUTE = path.join(ROOT, 'apps', 'crm', 'src', 'app', 'api', 'whatsapp', 'send', 'route.ts');
const GUARD = path.join(ROOT, 'apps', 'crm', 'src', 'app', 'api', 'whatsapp', 'guard.ts');
const CHATBOT = path.join(ROOT, 'apps', 'crm', 'src', 'lib', 'actions', 'chatbot-sugestao.ts');
const MIGRATION = path.join(ROOT, 'supabase', 'migrations', '20260712141500_whatsapp_grupos_head_select.sql');

function read(file) {
  assert.ok(fs.existsSync(file), `Arquivo não encontrado: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

/** Fonte sem comentários de linha (mesma estratégia dos guards existentes). */
function stripLineComments(raw) {
  return raw
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

test('send route: envio a grupo é roteado ANTES do guard 1:1 (CEO-only)', () => {
  const src = stripLineComments(read(SEND_ROUTE));
  const idxGrupo = src.indexOf('body.groupId !== undefined');
  const idxGuard1a1 = src.indexOf('guardWhatsAppApi()');
  assert.ok(idxGrupo > 0, 'o branch de grupo (body.groupId !== undefined) deve existir');
  assert.ok(idxGuard1a1 > 0, 'o guard 1:1 guardWhatsAppApi() deve existir');
  assert.ok(
    idxGrupo < idxGuard1a1,
    'INVARIANTE VIOLADO: o envio a grupo deve ser roteado ANTES do guardWhatsAppApi ' +
      '(CEO-only) — senão o Head nunca enviaria e o grupo cairia na normalização 1:1.',
  );
});

test('send route: grupo_id é enviado CRU (sem E.164), via guard próprio', () => {
  const src = stripLineComments(read(SEND_ROUTE));
  assert.ok(
    src.includes('guardWhatsAppGrupoEnvio'),
    'o envio a grupo deve usar guardWhatsAppGrupoEnvio (CEO ou Head vinculado).',
  );
  // O grupo_id vai CRU como phone p/ a Z-API — nunca normalizado.
  assert.ok(
    /phone:\s*groupId/.test(src),
    'INVARIANTE VIOLADO: o grupo_id deve ir CRU (phone: groupId) para a Z-API.',
  );
  // O handler de grupo NÃO pode passar o groupId por cleanPhone/isValidPhone.
  const bloco = src.match(/async function handleGroupSend[\s\S]*?\n}\n/);
  assert.ok(bloco, 'handleGroupSend deve existir');
  assert.ok(
    !/cleanPhone|isValidPhone/.test(bloco[0]),
    'INVARIANTE VIOLADO: handleGroupSend não pode normalizar o grupo_id ' +
      '(cleanPhone/isValidPhone mutilariam o jid …@g.us).',
  );
});

test('guard: envio a grupo autoriza CEO ou Head e confere visibilidade (RLS)', () => {
  const src = stripLineComments(read(GUARD));
  const bloco = src.match(/export async function guardWhatsAppGrupoEnvio[\s\S]*?\n}\n/);
  assert.ok(bloco, 'guardWhatsAppGrupoEnvio deve existir');
  assert.ok(
    /papel !== "ceo" && papel !== "head_sucesso"/.test(bloco[0]),
    'INVARIANTE VIOLADO: o guard de grupo deve autorizar CEO ou head_sucesso.',
  );
  assert.ok(
    /from\("whatsapp_grupos"\)/.test(bloco[0]),
    'INVARIANTE VIOLADO: o guard deve conferir a visibilidade do grupo via ' +
      'whatsapp_grupos (a RLS impõe "Head só grupo vinculado").',
  );
});

test('chatbot: action de sugestão NUNCA envia (assistido apenas)', () => {
  // Fonte SEM comentários — o cabeçalho cita "/api/whatsapp/send"/"SEND_" ao
  // documentar a garantia; o guard checa o CÓDIGO executável, não os comentários.
  const src = stripLineComments(read(CHATBOT));
  assert.ok(
    !src.includes('/api/whatsapp/send'),
    'INVARIANTE VIOLADO: a action de sugestão não pode chamar /api/whatsapp/send.',
  );
  assert.ok(
    !/SEND_|send-text|zapiRequest|sendWhatsApp/i.test(src),
    'INVARIANTE VIOLADO: a action de sugestão não pode disparar envio (SEND_*/Z-API).',
  );
  assert.ok(
    !/\bfetch\(/.test(src),
    'INVARIANTE VIOLADO: a action de sugestão não faz fetch — só monta prompt e retorna texto.',
  );
});

test('chatbot: ramo 1:1 (phone) exige CEO; grupo aceita Head', () => {
  const src = stripLineComments(read(CHATBOT));
  assert.ok(
    /isGrupo\s*\?\s*papel === "ceo" \|\| papel === "head_sucesso"\s*:\s*papel === "ceo"/.test(src),
    'INVARIANTE VIOLADO: grupo → CEO ou Head; 1:1 (phone) → CEO apenas.',
  );
});

test('RLS Head: mensagens só de GRUPO vinculado; 1:1 permanece CEO-only', () => {
  const sql = read(MIGRATION);
  assert.ok(
    sql.includes('whatsapp_grupos_head_select'),
    'a policy de SELECT do Head em whatsapp_grupos deve existir.',
  );
  assert.ok(
    sql.includes('whatsapp_msg_head_grupo_select'),
    'a policy de SELECT do Head em whatsapp_mensagens deve existir.',
  );
  // A policy de mensagens do Head DEVE filtrar is_grupo = true — senão exporia 1:1.
  const bloco = sql.match(/CREATE POLICY "whatsapp_msg_head_grupo_select"[\s\S]*?;/);
  assert.ok(bloco, 'a definição da policy de mensagens do Head deve existir');
  assert.ok(
    /is_grupo\s*=\s*true/.test(bloco[0]),
    'INVARIANTE VIOLADO: a policy do Head deve filtrar is_grupo = true — a ' +
      'conversa 1:1 (is_grupo = false) permanece CEO-only.',
  );
  assert.ok(
    /atleta_id IS NOT NULL OR experiencia_id IS NOT NULL/.test(bloco[0]),
    'INVARIANTE VIOLADO: o Head só vê mensagens de grupo VINCULADO a uma família.',
  );
});

// Sanidade: o guard detecta ausência de fato.
test('guard: detecta corretamente quando o roteamento de grupo está ausente', () => {
  const fake = 'const guard = await guardWhatsAppApi();';
  assert.equal(fake.includes('body.groupId !== undefined'), false);
  assert.equal(fake.includes('guardWhatsAppGrupoEnvio'), false);
});
