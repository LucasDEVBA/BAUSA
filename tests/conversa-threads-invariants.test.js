'use strict';

// Guard — threads da aba Conversa (pedido do CEO, 2026-09-03).
//
// Reclamação: "não está aparecendo o chat com atleta e responsável" e o nome
// vinha sem o papel ao lado. Causas: (1) dedupe por telefone DESCARTAVA o
// segundo papel quando responsável e atleta usam o mesmo número (atleta
// "o próprio" é comum); (2) o seletor de threads só renderizava com 2+ chats;
// (3) o cabeçalho mostrava o nome sem dizer quem é.
//
// Invariantes:
//   1. Dedupe FUNDE os papéis no rótulo ("Responsável · Atleta") — nunca
//      descarta o segundo.
//   2. As duas threads nascem com rótulo de papel (Responsável / Atleta).
//   3. O seletor renderiza também com UMA thread resolvida (rótulo != Contato).
//   4. O cabeçalho exibe o papel ao lado do nome.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const actionSrc = fs.readFileSync(
  path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'actions', 'conversa-threads.ts'), 'utf8');
const panelSrc = fs.readFileSync(
  path.join(__dirname, '..', 'apps', 'crm', 'src', 'components', 'whatsapp', 'ConversaLeadPanel.tsx'), 'utf8');

test('dedupe por telefone FUNDE os papéis, nunca descarta o segundo', () => {
  assert.match(actionSrc, /existente\.label = `\$\{existente\.label\} · \$\{label\}`/,
    'a fusão de rótulos sumiu — mesmo número voltaria a mostrar um papel só');
  assert.ok(!actionSrc.includes('phonesVistos.has'),
    'o dedupe antigo (descarte silencioso) voltou');
});

test('threads de responsável e atleta nascem com rótulo de papel', () => {
  assert.match(actionSrc, /addPrivado\(respWhatsapp \?\? fsGuardianWhatsapp, "Responsável"/,
    'thread do responsável perdeu o rótulo');
  assert.match(actionSrc, /addPrivado\(fsAthleteWhatsapp \?\? atletaWhatsapp, "Atleta"/,
    'thread do atleta perdeu o rótulo');
});

test('seletor renderiza também com UMA thread resolvida', () => {
  assert.match(panelSrc,
    /threads\.length > 1 \|\| \(threads\.length === 1 && threads\[0\]\.label !== "Contato"\)/,
    'o seletor voltou a exigir 2+ threads — chat fundido ficaria sem identificação');
});

test('cabeçalho e chips mostram o papel ao lado do nome', () => {
  assert.match(panelSrc, /threadAtiva\.label !== "Contato"/,
    'o chip de papel do cabeçalho sumiu');
  assert.match(panelSrc, /primeiroNome \? ` · \$\{primeiroNome\}` : ""/,
    'o primeiro nome sumiu dos chips do seletor');
});
