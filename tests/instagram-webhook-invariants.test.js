'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — instagram-webhook
// ════════════════════════════════════════════════════════════════════════
//
// Este webhook é PÚBLICO: a Meta precisa alcançá-lo sem secret nosso na URL.
// A assinatura HMAC é a ÚNICA prova de origem. Um furo aqui = qualquer um
// forja um comentário e faz a marca mandar DM. Por isso o guard trava:
//
//   1. Sem APP_SECRET → recusa TUDO (fail-closed).
//   2. Assinatura comparada em tempo constante e sobre o corpo CRU.
//   3. Handshake GET só responde com o verify token certo.
//   4. Tradução do payload não reage a evento da PRÓPRIA conta (loop).
//   5. O webhook não envia mensagem — só traduz e repassa.
//
// Execução local:  node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');

const WEBHOOK_FILE = path.join(__dirname, '..', 'functions', 'instagram-webhook', 'index.js');

const lerFonte = () => {
  assert.ok(fs.existsSync(WEBHOOK_FILE), `Arquivo não encontrado: ${WEBHOOK_FILE}`);
  return fs.readFileSync(WEBHOOK_FILE, 'utf8');
};

function carregar(env = {}) {
  const originalLoad = Module._load;
  const anteriores = {};
  for (const [k, v] of Object.entries(env)) {
    anteriores[k] = process.env[k];
    process.env[k] = v;
  }
  Module._load = function (request, parent, isMain) {
    if (request === '@google-cloud/functions-framework') return { http: () => {} };
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve(WEBHOOK_FILE)];
    return require(WEBHOOK_FILE);
  } finally {
    Module._load = originalLoad;
    for (const [k, v] of Object.entries(anteriores)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

const assinar = (segredo, corpo) =>
  'sha256=' + crypto.createHmac('sha256', segredo).update(corpo).digest('hex');

// ─── 1. Fail-closed sem segredo ──────────────────────────────────────────

test('sem INSTAGRAM_APP_SECRET, NENHUMA assinatura é aceita', () => {
  const { assinaturaValida } = carregar({});
  const corpo = Buffer.from('{"object":"instagram"}');
  assert.equal(assinaturaValida(corpo, assinar('qualquer', corpo)), false);
  assert.equal(assinaturaValida(corpo, 'sha256=' + 'a'.repeat(64)), false);
});

// ─── 2. Assinatura correta / incorreta ───────────────────────────────────

test('assinatura válida é aceita; adulterar corpo ou segredo reprova', () => {
  const segredo = 'segredo-de-teste';
  const { assinaturaValida } = carregar({ INSTAGRAM_APP_SECRET: segredo });
  const corpo = Buffer.from('{"object":"instagram","entry":[]}');

  assert.equal(assinaturaValida(corpo, assinar(segredo, corpo)), true, 'assinatura correta deve passar');
  assert.equal(assinaturaValida(Buffer.from('{"object":"instagram","entry":[1]}'), assinar(segredo, corpo)), false,
    'corpo adulterado deve reprovar');
  assert.equal(assinaturaValida(corpo, assinar('outro-segredo', corpo)), false, 'segredo errado deve reprovar');
});

test('header ausente, malformado ou sem prefixo sha256= é recusado', () => {
  const segredo = 's';
  const { assinaturaValida } = carregar({ INSTAGRAM_APP_SECRET: segredo });
  const corpo = Buffer.from('x');
  for (const header of [undefined, null, '', 'abc', 'sha1=abc', 123, {}]) {
    assert.equal(assinaturaValida(corpo, header), false, `header ${JSON.stringify(header)} deve reprovar`);
  }
});

test('a comparação da assinatura é em tempo constante', () => {
  const fonte = lerFonte();
  assert.match(fonte, /crypto\.timingSafeEqual/, 'comparar com === vaza tempo e permite forjar byte a byte');
  assert.match(fonte, /if \(!APP_SECRET\) return false;/, 'fail-closed explícito');
});

test('o HMAC usa o corpo CRU (rawBody), não o JSON re-serializado', () => {
  const fonte = lerFonte();
  assert.match(fonte, /req\.rawBody/, 'sem rawBody a assinatura correta seria invalidada por diferença de bytes');
  const handler = fonte.slice(fonte.indexOf("functions.http('instagramWebhook'"));
  const idxAssina = handler.indexOf('assinaturaValida');
  const idxParse = handler.indexOf('JSON.parse');
  assert.ok(idxAssina >= 0 && idxAssina < idxParse, 'validar a assinatura ANTES de interpretar o corpo');
});

// ─── 3. Handshake ────────────────────────────────────────────────────────

test('o handshake GET exige verify token configurado e igual', () => {
  const fonte = lerFonte();
  assert.match(
    fonte,
    /if \(!VERIFY_TOKEN \|\| modo !== 'subscribe' \|\| token !== VERIFY_TOKEN\)/,
    'sem token configurado o handshake precisa falhar (senão qualquer um assina o webhook)'
  );
});

// ─── 4. Tradução dos eventos ─────────────────────────────────────────────

test('DM vira evento de resposta E de entrada, com dedupe pelo mid', () => {
  const { traduzirEntry } = carregar({ IG_USER_ID: '17841453972885804' });
  const eventos = traduzirEntry({
    messaging: [{ sender: { id: '999' }, message: { mid: 'm1', text: 'quero saber da bolsa' } }],
  });
  assert.equal(eventos.length, 2, 'uma DM gera resposta + entrada');
  assert.equal(eventos[0].resposta, true, 'a primeira tenta CONTINUAR a conversa');
  assert.equal(eventos[1].gatilho, 'dm_palavra_chave');
  assert.equal(eventos[1].dedupeKey, 'm1');
  assert.equal(eventos[0].canal, 'instagram');
});

test('resposta a Story usa o gatilho de story, não o de DM', () => {
  const { traduzirEntry } = carregar({ IG_USER_ID: '1' });
  const eventos = traduzirEntry({
    messaging: [{ sender: { id: '999' }, message: { mid: 'm2', text: 'top!', reply_to: { story: { id: 's1' } } } }],
  });
  assert.equal(eventos[1].gatilho, 'resposta_story');
});

test('evento da PRÓPRIA conta é ignorado (anti-loop)', () => {
  const meu = '17841453972885804';
  const { traduzirEntry } = carregar({ IG_USER_ID: meu });
  assert.deepEqual(
    traduzirEntry({ messaging: [{ sender: { id: meu }, message: { mid: 'm3', text: 'oi' } }] }),
    [],
    'eco da nossa própria mensagem não pode reentrar no fluxo'
  );
  assert.deepEqual(
    traduzirEntry({ changes: [{ field: 'comments', value: { id: 'c1', from: { id: meu }, text: 'obrigado!' } }] }),
    [],
    'nosso próprio comentário não pode disparar fluxo'
  );
});

test('comentário em Reels e em post usam gatilhos distintos e trazem o post', () => {
  const { traduzirEntry } = carregar({ IG_USER_ID: '1' });
  const feed = traduzirEntry({
    changes: [{ field: 'comments', value: { id: 'c1', from: { id: '9', username: 'ana' }, text: 'EUA', media: { id: 'p1' } } }],
  });
  assert.equal(feed[0].gatilho, 'comentario_post');
  assert.equal(feed[0].postId, 'p1');
  assert.equal(feed[0].username, 'ana');
  assert.equal(feed[0].dedupeKey, 'c1', 'o id do comentário evita disparo duplicado');

  const reels = traduzirEntry({
    changes: [{ field: 'comments', value: { id: 'c2', from: { id: '9' }, text: 'EUA', media: { id: 'r1', media_product_type: 'REELS' } } }],
  });
  assert.equal(reels[0].gatilho, 'comentario_reels');
});

test('entry vazio não gera evento', () => {
  const { traduzirEntry } = carregar({});
  assert.deepEqual(traduzirEntry({}), []);
  assert.deepEqual(traduzirEntry({ messaging: [], changes: [] }), []);
});

// ─── 5. O webhook não envia mensagem ─────────────────────────────────────

test('o webhook só traduz e repassa — nunca envia mensagem', () => {
  const fonte = lerFonte();
  assert.doesNotMatch(
    fonte,
    /graph\.instagram\.com|\/me\/messages|send-whatsapp/i,
    'quem envia é o fluxo-engine (que tem o gate de escopo e o de canal) — não a borda'
  );
  assert.match(fonte, /module\.exports = \{ assinaturaValida, traduzirEntry \}/);
});

test('falha de repasse não devolve erro à Meta (evita reprocessar o lote)', () => {
  const fonte = lerFonte();
  const bloco = fonte.slice(fonte.indexOf('for (const entry of corpo.entry'), fonte.indexOf("log('info', 'webhook_ok'"));
  assert.match(bloco, /catch \(e\)/, 'erro por evento é capturado');
  assert.doesNotMatch(bloco, /res\.status\(5\d\d\)/, 'não devolver 5xx no meio do lote');
});
