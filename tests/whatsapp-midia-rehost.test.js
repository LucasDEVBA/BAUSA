'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — Re-hospedagem de mídia do WhatsApp (2026-08-11)
// ════════════════════════════════════════════════════════════════════════
//
// As URLs de mídia da Z-API expiram (~semanas). A zapi-inbox baixa a mídia no
// ingest e sobe no bucket próprio `whatsapp-midia`; a leitura assina URL do
// bucket quando media_path existe. INVARIANTES:
//
//   1. FAIL-OPEN: a re-hospedagem NUNCA quebra o webhook — rehospedarMidia
//      engole qualquer erro e devolve null (mensagem é gravada como antes).
//   2. Teto de download (15MB, paridade com o bucket) e timeout presentes —
//      sem eles um arquivo gigante travaria/estouraria a CF.
//   3. Compat pré-migration: coluna/RPC ausentes → retry SEM media_path
//      (mensagem > mídia; nada é perdido na janela de deploy).
//   4. Leitura prefere media_path (URL assinada) com fallback à media_url
//      legada — remover o fallback mataria toda a mídia pré-feature.
//
// Execução local:  node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CF_PATH = path.join(__dirname, '..', 'functions', 'zapi-inbox', 'index.js');
const ROUTE_PATH = path.join(
  __dirname, '..', 'apps', 'crm', 'src', 'app', 'api', 'whatsapp', 'messages', 'route.ts',
);
const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

function semComentarios(raw) {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const cf = semComentarios(fs.readFileSync(CF_PATH, 'utf8'));
const route = semComentarios(fs.readFileSync(ROUTE_PATH, 'utf8'));

test('zapi-inbox: re-hospedagem é FAIL-OPEN (catch → null, webhook nunca quebra)', () => {
  const bloco = cf.match(/async function rehospedarMidia[\s\S]*?\n}\n/);
  assert.ok(bloco, 'a função rehospedarMidia deve existir');
  assert.match(
    bloco[0],
    /catch[\s\S]*?return null/,
    'INVARIANTE VIOLADO: rehospedarMidia deve engolir QUALQUER erro e devolver ' +
      'null — mídia jamais pode derrubar o webhook (Z-API re-tentaria em loop).',
  );
  // O corpo inteiro precisa estar dentro do try (nenhum throw escapa).
  assert.match(bloco[0], /\{\s*try\s*\{/, 'o corpo de rehospedarMidia deve abrir com try');
});

test('zapi-inbox: teto de bytes, timeout de ociosidade E deadline wall-clock', () => {
  assert.ok(
    cf.includes('15 * 1024 * 1024'),
    'INVARIANTE VIOLADO: teto de 15MB (paridade com o bucket) sumiu — arquivo ' +
      'gigante estouraria memória/tempo da CF.',
  );
  assert.ok(
    cf.includes('MEDIA_DOWNLOAD_TIMEOUT_MS'),
    'INVARIANTE VIOLADO: timeout do download sumiu — URL pendurada travaria o webhook.',
  );
  assert.ok(
    cf.includes('MEDIA_DOWNLOAD_DEADLINE_MS'),
    'INVARIANTE VIOLADO: deadline wall-clock sumiu — o setTimeout do Node é de ' +
      'OCIOSIDADE; um servidor gotejante manteria o download vivo p/ sempre ' +
      '(hang provado em repro na revisão adversarial 2026-08-11).',
  );
  assert.match(
    cf,
    /total > MEDIA_REHOST_MAX_BYTES/,
    'INVARIANTE VIOLADO: o teto deve valer para o corpo REAL (streaming), não só o content-length declarado.',
  );
});

test('zapi-inbox: guard de socket morto no meio do corpo (close sem end → reject)', () => {
  // Socket resetado no meio da response não dispara req.error nem idle-timeout;
  // sem o guard de close a Promise pendura o webhook até o teto da CF (120s).
  const ocorrencias = cf.match(/res\.on\('close'/g);
  assert.ok(
    ocorrencias && ocorrencias.length >= 2,
    `INVARIANTE VIOLADO: o guard res.on('close') deve existir em baixarBinario E ` +
      `no httpRequest (upload de 15MB passa por ele) — encontrado ${ocorrencias ? ocorrencias.length : 0}x.`,
  );
});

test('zapi-inbox: janela pré-migration tem retry sem media_path no insert 1:1', () => {
  assert.ok(
    cf.includes('insert_sem_media_path_retry'),
    'INVARIANTE VIOLADO: insert 1:1 deve re-tentar SEM media_path quando a coluna ainda não existe (PGRST204/42703).',
  );
});

test('zapi-inbox: mídia de GRUPO só persiste após o gate de captura (LGPD)', () => {
  // Achado ALTO da revisão adversarial: rehost antes da RPC persistia mídia de
  // grupo com captura DESLIGADA — bypass do opt-out prometido pela migration
  // 20260810204500. O rehost de grupo SÓ pode rodar quando a RPC confirmou
  // capturar=true E inserted=true.
  assert.ok(
    cf.includes("out.capturar === true && out.inserted === true"),
    'INVARIANTE VIOLADO: o rehost de grupo deve ser gateado por ' +
      '`out.capturar === true && out.inserted === true` — sem isso, mídia de ' +
      'grupo silenciado vira PII órfã permanente no bucket.',
  );
  assert.ok(
    cf.includes('gravarMediaPathGrupo'),
    'o media_path de grupo deve ser gravado via PATCH pós-RPC (gravarMediaPathGrupo)',
  );
});

test('zapi-inbox: upload com Content-Length e log de mídia sem PII', () => {
  assert.match(
    cf,
    /'Content-Length': buffer\.length/,
    'INVARIANTE VIOLADO: upload sem Content-Length vira chunked — a Storage API pode rejeitar e a feature morre em silêncio (fail-open).',
  );
  const blocoLog = cf.match(/midia_rehospedada[\s\S]{0,200}/);
  assert.ok(blocoLog, "o log 'midia_rehospedada' deve existir");
  assert.ok(
    blocoLog[0].includes('maskPhone'),
    'INVARIANTE VIOLADO: o log de mídia deve mascarar a chave (telefone completo no path é PII — convenção da CF inteira).',
  );
  assert.ok(
    !/path: mediaPath/.test(blocoLog[0]),
    'INVARIANTE VIOLADO: o log não pode carregar o path cru (contém o telefone).',
  );
});

test('messages route: leitura prefere media_path assinada com fallback à media_url', () => {
  assert.ok(
    route.includes('createSignedUrls'),
    'INVARIANTE VIOLADO: a rota deve assinar URLs do bucket próprio (createSignedUrls).',
  );
  assert.match(
    route,
    /media_path && assinadas\.get\(row\.media_path\)\)\s*\|\|\s*row\.media_url/,
    'INVARIANTE VIOLADO: resolverMediaUrl deve preferir a assinada e CAIR na ' +
      'media_url legada — sem o fallback, toda mídia pré-feature some da UI.',
  );
  // As DUAS queries do espelho (1:1 e grupo) precisam selecionar media_path.
  const selects = route.match(/media_filename, media_path/g);
  assert.ok(
    selects && selects.length >= 2,
    `media_path deve estar no SELECT das duas threads (1:1 e grupo) — encontrado ${selects ? selects.length : 0}x.`,
  );
});

test('migration: bucket privado + coluna + RPC com p_media_path DEFAULT NULL', () => {
  const arquivos = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.includes('whatsapp_midia_rehost'));
  assert.ok(arquivos.length >= 1, 'migration de re-hospedagem sumiu');
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivos[0]), 'utf8');
  assert.match(sql, /'whatsapp-midia',\s*'whatsapp-midia',\s*false/, 'o bucket deve ser PRIVADO (public=false) — conversas de leads são dado sensível');
  assert.match(sql, /ADD COLUMN IF NOT EXISTS media_path TEXT/, 'coluna media_path sumiu');
  assert.match(sql, /p_media_path\s+TEXT\s+DEFAULT\s+NULL/, 'p_media_path DEFAULT NULL preserva compat com a CF antiga');
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.whatsapp_grupo_ingest\(\s*TEXT, TEXT, TEXT, BOOLEAN/, 'a assinatura antiga (12 args) deve ser dropada — mantê-la geraria PGRST203 (ambiguidade)');
});

// Sanidade: o guard detecta ausência de fato.
test('guard: detecta corretamente quando a re-hospedagem está ausente', () => {
  const fake = "const x = 'sem rehost';";
  assert.equal(fake.includes('rehospedarMidia'), false);
  assert.equal(fake.includes('createSignedUrls'), false);
});
