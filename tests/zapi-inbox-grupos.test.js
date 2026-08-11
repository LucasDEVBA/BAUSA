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
  // Só pode haver UM INSERT direto p/ whatsapp_mensagens (o do fluxo 1:1,
  // assinado pelo on_conflict). Se aparecer outro, algum caminho de grupo está
  // inserindo conteúdo direto, driblando o opt-in.
  const insertsDiretos = src.match(/whatsapp_mensagens\?on_conflict=message_id/g) ?? [];
  assert.equal(
    insertsDiretos.length,
    1,
    'INVARIANTE VIOLADO: existe mais de um INSERT direto em whatsapp_mensagens — ' +
      'grupo deve gravar SÓ pela RPC (opt-in), não por REST direto.',
  );
  // 2026-08-11 (re-hospedagem de mídia): o ÚNICO outro acesso REST permitido a
  // whatsapp_mensagens é o PATCH de media_path pós-RPC — ele NÃO insere
  // conteúdo (linha inexistente = no-op) e roda gateado por
  // `out.capturar === true && out.inserted === true`. Qualquer outra escrita
  // direta continua proibida.
  const outrosAcessos = (src.match(/rest\/v1\/whatsapp_mensagens/g) ?? []).length - insertsDiretos.length;
  if (outrosAcessos > 0) {
    assert.equal(
      outrosAcessos,
      1,
      'INVARIANTE VIOLADO: acesso REST extra a whatsapp_mensagens além do INSERT 1:1 ' +
        'e do PATCH de media_path — caminho novo precisa passar pela RPC (opt-in).',
    );
    const blocoPatch = src.match(/async function gravarMediaPathGrupo[\s\S]*?\n}\n/);
    assert.ok(blocoPatch, 'o acesso extra deve ser gravarMediaPathGrupo (PATCH de media_path)');
    assert.match(blocoPatch[0], /method: 'PATCH'/, 'gravarMediaPathGrupo deve ser PATCH (nunca INSERT)');
    assert.match(
      blocoPatch[0],
      /is_grupo=is\.true/,
      'o PATCH deve mirar só a linha de grupo já inserida pela RPC',
    );
    assert.match(
      blocoPatch[0],
      /JSON\.stringify\(\{ media_path: mediaPath \}\)/,
      'o PATCH só pode escrever media_path — qualquer outro campo dribla a RPC',
    );
  }
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

// ─── Vínculo automático grupo→família (2026-08-10) ──────────────────────
test('zapi-inbox: vínculo automático usa CAS — vínculo manual do CEO sempre vence', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes('tentarVinculoAutomatico'),
    'a função de vínculo automático deve existir',
  );
  assert.ok(
    src.includes('&atleta_id=is.null'),
    'INVARIANTE VIOLADO: o PATCH do vínculo automático deve carregar o CAS ' +
      '`&atleta_id=is.null` — sem ele, o auto-vínculo sobrescreveria o vínculo ' +
      'manual feito pelo CEO (grupo religado à família errada em silêncio).',
  );
  // Ambiguidade nunca vincula: os SELECTs de match usam limit=2 e exigem length === 1.
  assert.ok(
    /atletas\.length === 1/.test(src),
    'INVARIANTE VIOLADO: match ambíguo (2+ atletas) não pode vincular — a checagem length === 1 sumiu.',
  );
});

test('zapi-inbox: falha do vínculo automático não quebra o webhook', () => {
  const src = loadExecutableSource();
  assert.ok(
    /try\s*\{\s*await tentarVinculoAutomatico/.test(src),
    'INVARIANTE VIOLADO: tentarVinculoAutomatico deve rodar dentro de try/catch — ' +
      'um erro de vínculo jamais pode falhar o webhook (Z-API re-tenta e duplicaria trabalho).',
  );
});

// Sanidade: o guard detecta ausência de fato.
test('guard: detecta corretamente quando o coletor de grupo está ausente', () => {
  const fake = 'const x = 1; // sem coletor';
  assert.equal(fake.includes('rpc/whatsapp_grupo_ingest'), false);
  assert.equal(fake.includes('normalizarGrupo'), false);
});
