'use strict';

// Guard — módulo de e-mail (2026-08-19): email-events (webhook Resend),
// email-inbox-sync (espelho do Gmail) e a extensão customEmail.
//
// Invariantes:
//   1. email-events é FAIL-CLOSED: sem RESEND_WEBHOOK_SECRET nenhum evento
//      entra (URL pública — a assinatura svix é a única prova de origem,
//      mesma classe do instagram-webhook).
//   2. A verificação svix FUNCIONA (testada com assinatura real gerada aqui)
//      e usa timingSafeEqual.
//   3. Métricas só andam para FRENTE (PATCH com <coluna>=is.null).
//   4. email-inbox-sync: auth fail-closed, INSERT idempotente
//      (ignore-duplicates), lead match respeita soft delete, e o scope do
//      Gmail é READONLY — o espelho nunca ganha poder de envio/alteração.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const eventsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'email-events', 'index.js'), 'utf8');
const syncSrc = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'email-inbox-sync', 'index.js'), 'utf8');
const sendSrc = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'send-messages', 'index.js'), 'utf8');

// ─── email-events ───────────────────────────────────────────────

const m = eventsSrc.match(/const verificarAssinatura = \(req\) => \{[\s\S]*?\n\};/);
assert.ok(m, 'verificarAssinatura não encontrada — atualize o guard se renomeou');
// eslint-disable-next-line no-new-func
const makeVerificar = (secret) => new Function(
  'RESEND_WEBHOOK_SECRET', 'crypto', 'SVIX_TOLERANCE_S',
  `${m[0]}; return verificarAssinatura;`
)(secret, crypto, 300);

const assinar = (secret, id, ts, raw) => {
  const chave = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return crypto.createHmac('sha256', chave)
    .update(Buffer.concat([Buffer.from(`${id}.${ts}.`), raw]))
    .digest('base64');
};

test('svix: assinatura válida passa, corpo adulterado falha', () => {
  const secret = 'whsec_' + Buffer.from('segredo-de-teste-32-bytes!!!').toString('base64');
  const verificar = makeVerificar(secret);
  const raw = Buffer.from(JSON.stringify({ type: 'email.delivered', data: { email_id: 'x' } }));
  const ts = String(Math.floor(Date.now() / 1000));
  const req = {
    headers: { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': `v1,${assinar(secret, 'msg_1', ts, raw)}` },
    rawBody: raw,
  };
  assert.equal(verificar(req).ok, true, 'assinatura correta deve passar');

  const adulterado = { ...req, rawBody: Buffer.from('{"type":"email.delivered","data":{"email_id":"OUTRO"}}') };
  assert.equal(verificar(adulterado).ok, false, 'corpo adulterado deve falhar');
});

test('svix: FAIL-CLOSED sem secret e com timestamp velho', () => {
  const raw = Buffer.from('{}');
  const semSecret = makeVerificar('');
  assert.equal(semSecret({ headers: {}, rawBody: raw }).ok, false, 'sem secret = rejeita tudo');

  const secret = 'whsec_' + Buffer.from('segredo-de-teste-32-bytes!!!').toString('base64');
  const verificar = makeVerificar(secret);
  const tsVelho = String(Math.floor(Date.now() / 1000) - 3600);
  const req = {
    headers: { 'svix-id': 'msg_1', 'svix-timestamp': tsVelho, 'svix-signature': `v1,${assinar(secret, 'msg_1', tsVelho, raw)}` },
    rawBody: raw,
  };
  assert.equal(verificar(req).ok, false, 'replay de 1h deve falhar');
});

test('email-events usa timingSafeEqual e corpo CRU', () => {
  assert.match(eventsSrc, /timingSafeEqual/, 'comparação de assinatura deve ser constant-time');
  assert.match(eventsSrc, /req\.rawBody/, 'assinatura verifica o corpo CRU');
});

test('email-events: métricas só andam para frente (primeiro evento vence)', () => {
  assert.match(
    eventsSrc,
    /emails_mensagens\?resend_email_id=eq\.[^&]+&\$\{coluna\}=is\.null/,
    'PATCH deve exigir coluna is.null — reabertura não sobrescreve o primeiro evento',
  );
});

test('email-events: stub de email.sent é idempotente', () => {
  assert.match(eventsSrc, /resolution=ignore-duplicates/, 'INSERT do stub usa ignore-duplicates');
});

// ─── email-inbox-sync ───────────────────────────────────────────

test('inbox-sync: auth fail-closed (sem secret ninguém aciona)', () => {
  assert.match(
    syncSrc,
    /!WEBHOOK_SECRET \|\| req\.headers\['x-webhook-secret'\] !== WEBHOOK_SECRET/,
    'padrão fail-closed do projeto',
  );
});

test('inbox-sync: Gmail em READONLY — espelho nunca envia/altera', () => {
  assert.match(syncSrc, /gmail\.readonly/, 'scope readonly presente');
  assert.doesNotMatch(syncSrc, /gmail\.(send|modify|compose)/, 'nenhum scope de escrita no Gmail');
});

test('inbox-sync: INSERT idempotente e lead match com soft delete', () => {
  assert.match(syncSrc, /resolution=ignore-duplicates/, 'UNIQUE(gmail_message_id) + ignore-duplicates');
  assert.match(syncSrc, /form_submissions\?select=id&email=eq\.[^&]+&deleted_at=is\.null/, 'lead excluído não deve casar');
});

// ─── send-messages (extensão customEmail) ───────────────────────

test('customEmail: validações originais intactas + replyTo validado', () => {
  for (const campo of ["'to'", "'subject'", "'text'", "'replyTo'"]) {
    assert.ok(sendSrc.includes(`Campo ${campo}`), `validação de ${campo} presente`);
  }
});
