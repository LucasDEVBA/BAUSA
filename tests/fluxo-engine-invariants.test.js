'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — fluxo-engine (motor de Fluxos / "ManyChat próprio")
// ════════════════════════════════════════════════════════════════════════
//
// O motor conversa com CONTATOS REAIS (WhatsApp hoje, Instagram quando o App
// Review sair). Um erro aqui vira mensagem indevida, rajada ou fluxo travado.
// Este guard trava as decisões que não podem regredir silenciosamente:
//
//   1. Canal indisponível NÃO envia (instagram só entra na lista quando a
//      permissão instagram_manage_messages for aprovada).
//   2. Auth fail-closed (sem WEBHOOK_SECRET, ninguém entra).
//   3. CAS no claim da execução (dois ticks não avançam a mesma).
//   4. Idempotência da entrada (dedupe_key) e teto por hora (anti-rajada).
//   5. Anti-loop no encadeamento de blocos.
//   6. Telemetria fail-open — evento que falha não derruba o fluxo.
//   7. Comportamento das funções puras (match de palavra, render, validação).
//
// Execução local:  node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const ENGINE_FILE = path.join(__dirname, '..', 'functions', 'fluxo-engine', 'index.js');
const ACTIONS_FILE = path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'actions', 'fluxos.ts');
const IA_FILE = path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'actions', 'fluxos-ia.ts');

const lerFonte = (arquivo) => {
  assert.ok(fs.existsSync(arquivo), `Arquivo não encontrado: ${arquivo}`);
  return fs.readFileSync(arquivo, 'utf8');
};

/** Carrega a CF com o functions-framework stubado (não há node_modules local). */
function carregarEngine() {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === '@google-cloud/functions-framework') {
      return { http: () => {} };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    delete require.cache[require.resolve(ENGINE_FILE)];
    return require(ENGINE_FILE);
  } finally {
    Module._load = originalLoad;
  }
}

// ─── 1. Canal indisponível não envia ─────────────────────────────────────

test('CANAIS_ENVIO contém whatsapp e NÃO contém instagram (App Review pendente)', () => {
  const engine = carregarEngine();
  assert.ok(engine.CANAIS_ENVIO.has('whatsapp'), 'whatsapp deve poder enviar (Z-API está no ar)');
  assert.equal(
    engine.CANAIS_ENVIO.has('instagram'),
    false,
    'instagram só entra em CANAIS_ENVIO quando instagram_manage_messages for APROVADA — ' +
      'ligar antes faz o fluxo prometer envio que não acontece'
  );
});

test('enviarMensagem barra canal fora da allowlist antes de qualquer POST', () => {
  const fonte = lerFonte(ENGINE_FILE);
  const bloco = fonte.slice(fonte.indexOf('const enviarMensagem'), fonte.indexOf('const executarBloco'));
  assert.match(bloco, /if \(!CANAIS_ENVIO\.has\(canal\)\)/, 'a checagem de canal deve ser a PRIMEIRA guarda');
  const idxGuarda = bloco.indexOf('CANAIS_ENVIO.has(canal)');
  const idxPost = bloco.indexOf('httpRequest');
  assert.ok(idxGuarda >= 0 && idxGuarda < idxPost, 'a guarda de canal precisa vir ANTES do envio HTTP');
});

test('a action de ativar recusa canal indisponível', () => {
  const fonte = lerFonte(ACTIONS_FILE);
  assert.match(fonte, /CANAIS_DISPONIVEIS\s*=\s*new Set<string>\(\["whatsapp"\]\)/);
  assert.match(fonte, /if \(!CANAIS_DISPONIVEIS\.has\(String\(data\.canal\)\)\)/);
  assert.doesNotMatch(
    fonte.slice(fonte.indexOf('CANAIS_DISPONIVEIS')),
    /CANAIS_DISPONIVEIS\s*=\s*new Set<string>\(\[[^\]]*instagram/,
    'instagram não pode entrar em CANAIS_DISPONIVEIS sem App Review'
  );
});

// ─── 2. Auth fail-closed ─────────────────────────────────────────────────

test('auth é fail-closed: sem WEBHOOK_SECRET devolve 401', () => {
  const fonte = lerFonte(ENGINE_FILE);
  assert.match(
    fonte,
    /if \(!WEBHOOK_SECRET \|\| req\.headers\['x-webhook-secret'\] !== WEBHOOK_SECRET\)/,
    'a ausência do secret DEVE bloquear (fail-closed) — fail-open já causou incidente no projeto'
  );
});

// ─── 3. CAS no claim ─────────────────────────────────────────────────────

test('resposta e tick usam CAS (PATCH filtrado por status + return=representation)', () => {
  const fonte = lerFonte(ENGINE_FILE);
  assert.match(
    fonte,
    /fluxo_execucoes\?id=eq\.\$\{execucao\.id\}&status=eq\.aguardando_resposta/,
    'o claim da resposta precisa filtrar por status (CAS)'
  );
  assert.match(
    fonte,
    /fluxo_execucoes\?id=eq\.\$\{execucao\.id\}&status=eq\.ativa/,
    'o claim do tick precisa filtrar por status (CAS)'
  );
  assert.match(fonte, /if \(travadas\.length === 0\) (return|continue)/, 'perdeu o CAS → desiste, não avança');
});

// ─── 4. Idempotência e anti-rajada ───────────────────────────────────────

test('entrada é idempotente por dedupe_key e respeita limite por hora', () => {
  const fonte = lerFonte(ENGINE_FILE);
  assert.match(fonte, /dedupe_key: evento\.dedupeKey/, 'a execução precisa gravar a chave de dedupe');
  assert.match(fonte, /duplicate key\|23505/i, 'colisão de UNIQUE deve ser tratada como "já processado"');
  assert.match(fonte, /recentes\.length >= \(Number\(fluxo\.limite_hora\)/, 'teto por hora é obrigatório (anti-ban)');
});

test('opt-out impede disparo', () => {
  const fonte = lerFonte(ENGINE_FILE);
  assert.match(fonte, /contato\.optin === false \|\| contato\.optout_at/, 'contato em opt-out nunca recebe');
});

// ─── 5. Anti-loop ────────────────────────────────────────────────────────

test('o avanço tem teto de blocos por ciclo', () => {
  const fonte = lerFonte(ENGINE_FILE);
  assert.match(fonte, /MAX_BLOCOS_POR_CICLO\s*=\s*\d+/);
  assert.match(fonte, /passos < MAX_BLOCOS_POR_CICLO/, 'o while precisa do teto — proximo_id circular travaria a CF');
});

// ─── 6. Telemetria fail-open ─────────────────────────────────────────────

test('registrarEvento não propaga erro (telemetria não derruba fluxo)', () => {
  const fonte = lerFonte(ENGINE_FILE);
  const bloco = fonte.slice(fonte.indexOf('const registrarEvento'), fonte.indexOf('const normalizar'));
  assert.match(bloco, /catch \(e\)/, 'gravação de evento precisa de try/catch');
  assert.doesNotMatch(bloco, /throw /, 'evento que falha NUNCA relança — telemetria é fail-open');
});

// ─── 7. IA sempre com fallback ───────────────────────────────────────────

test('bloco de IA exige prompt inline (fallback) na validação', () => {
  const fonte = lerFonte(ACTIONS_FILE);
  assert.match(
    fonte,
    /ia_resposta" \|\| b\.tipo === "ia_condicao"\) && !b\.conteudo\.prompt/,
    'prompt inline é o fallback garantido — agent apagado não pode quebrar o fluxo'
  );
});

test('a sugestão de IA nunca decide a própria confiança', () => {
  const fonte = lerFonte(IA_FILE);
  assert.match(fonte, /const confiavel = m\.entradas >= MIN_EXECUCOES_DIAGNOSTICO/, 'confiança é determinística');
  const schema = fonte.slice(fonte.indexOf('const diagnosticoSchema'), fonte.indexOf('export async function diagnosticarFluxo'));
  assert.doesNotMatch(schema, /confiavel|confianca/, 'o schema da resposta da IA NÃO pode conter o campo de confiança');
});

test('sugestão sem bloco de captura vira aviso explícito', () => {
  const fonte = lerFonte(IA_FILE);
  assert.match(fonte, /!blocos\.some\(\(b\) => b\.tipo === "captura"\)/, 'fluxo sem captura precisa avisar');
});

// ─── 8. Comportamento das funções puras ──────────────────────────────────

test('casaPalavra: contém, exato, começa-com, acento e lista vazia', () => {
  const { casaPalavra } = carregarEngine();
  assert.equal(casaPalavra('Quero saber sobre BOLSA nos EUA', ['bolsa'], 'contem'), true);
  assert.equal(casaPalavra('INSCRIÇÃO aberta', ['inscricao'], 'contem'), true, 'acento deve ser normalizado');
  assert.equal(casaPalavra('bolsa agora', ['bolsa'], 'exato'), false, 'exato não pode casar substring');
  assert.equal(casaPalavra('bolsa', ['bolsa'], 'exato'), true);
  assert.equal(casaPalavra('bolsa atleta', ['bolsa'], 'comeca_com'), true);
  assert.equal(casaPalavra('quero bolsa', ['bolsa'], 'comeca_com'), false);
  assert.equal(casaPalavra('qualquer coisa', [], 'contem'), true, 'sem palavras = sem filtro');
});

test('render substitui o que existe e REMOVE token desconhecido', () => {
  const { render } = carregarEngine();
  assert.equal(render('Oi {nome}!', {}, { nome: 'Ana' }), 'Oi Ana!');
  assert.equal(render('Oi {nome} {xpto}?', {}, { nome: 'Ana' }), 'Oi Ana ?');
  assert.doesNotMatch(render('Valor {desconhecido}', {}, {}), /\{/, 'token cru jamais chega ao contato');
});

test('validarCampo protege e-mail e telefone', () => {
  const { validarCampo } = carregarEngine();
  assert.deepEqual(validarCampo('email', '  ANA@Teste.com '), { ok: true, valor: 'ana@teste.com' });
  assert.equal(validarCampo('email', 'ana@@x').ok, false);
  assert.equal(validarCampo('email', 'sem-arroba').ok, false);
  assert.deepEqual(validarCampo('telefone', '(71) 99146-1565'), { ok: true, valor: '71991461565' });
  assert.equal(validarCampo('telefone', '123').ok, false, 'telefone curto é inválido');
  assert.equal(validarCampo('instagram', '@bolsaatletausa').valor, 'bolsaatletausa');
});

test('captura inválida NÃO avança o fluxo (repete o bloco)', () => {
  const fonte = lerFonte(ENGINE_FILE);
  const bloco = fonte.slice(fonte.indexOf("bloco.tipo === 'captura' && c.campo"), fonte.indexOf('await sb(`fluxo_execucoes?id=eq.${execucao.id}`, { method: \'PATCH\', body: { variaveis } })'));
  assert.match(bloco, /status: 'aguardando_resposta'/, 'resposta inválida mantém a execução esperando');
  assert.match(bloco, /return \{ ok: true, retomadas: 1, revalidacao: true \}/, 'e não segue para o próximo bloco');
});

test('fluxo nasce pausado', () => {
  const fonte = lerFonte(ACTIONS_FILE);
  assert.match(fonte, /ativo: false, \/\/ nasce pausado/, 'ativar é sempre gesto explícito do CEO');
});
