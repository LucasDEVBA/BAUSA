'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — Textos custom do send-whatsapp (Fase E)
// ════════════════════════════════════════════════════════════════════════
//
// A CF send-whatsapp passou a ler textos editáveis de
// configuracoes_sistema.scheduler_mensagens (editados em /automacoes).
// INVARIANTE: os builders hardcoded são o FALLBACK PERMANENTE — a função
// NUNCA pode depender exclusivamente da config para conseguir enviar:
//
//   1. Sem SUPABASE_URL/SUPABASE_SERVICE_KEY → builders (zero mudança).
//   2. Erro de rede/HTTP ao buscar a config → builders + log WARN
//      'mensagens_fallback' (monitorável).
//   3. Texto custom vazio/whitespace após render → builders (uma config
//      mal salva jamais pode gerar envio de mensagem em branco).
//
// Este guard falha o CI se um refactor remover os builders hardcoded, o
// log de fallback ou a checagem de texto vazio.
//
// Execução local:  node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE_FILE = path.join(__dirname, '..', 'functions', 'send-whatsapp', 'index.js');

/** Source sem comentários (mesma estratégia do scheduler-eligibility). */
function loadExecutableSource() {
  assert.ok(fs.existsSync(SOURCE_FILE), `Arquivo não encontrado: ${SOURCE_FILE}`);
  const raw = fs.readFileSync(SOURCE_FILE, 'utf8');
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlockComments
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

// Os 12 builders hardcoded (6 templates × atleta/responsável) — fallback
// permanente dos textos custom. Remover qualquer um quebra o fallback.
const BUILDERS = [
  'buildAthleteMessage',
  'buildGuardianMessage',
  'buildAthleteFollowup1Message',
  'buildGuardianFollowup1Message',
  'buildAthleteFollowup2Message',
  'buildGuardianFollowup2Message',
  'buildEarlyPotentialAthleteMessage',
  'buildEarlyPotentialGuardianMessage',
  'buildLateTimingAthleteMessage',
  'buildLateTimingGuardianMessage',
  'buildScheduledReturnAthleteMessage',
  'buildScheduledReturnGuardianMessage',
];

test('send-whatsapp: os 12 builders hardcoded continuam definidos E usados como fallback', () => {
  const src = loadExecutableSource();
  for (const builder of BUILDERS) {
    assert.ok(
      src.includes(`const ${builder} = `),
      `INVARIANTE VIOLADO: builder '${builder}' não está mais definido — ` +
        `ele é o fallback permanente do texto custom e NUNCA pode ser removido.`,
    );
    assert.ok(
      src.includes(`${builder}(data)`),
      `INVARIANTE VIOLADO: builder '${builder}' não é mais chamado na seleção ` +
        `de mensagem — o texto custom deve cair nele via '|| ${builder}(data)'.`,
    );
  }
});

test('send-whatsapp: fallback por erro na config existe e é logado (mensagens_fallback)', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes('mensagens_fallback'),
    `INVARIANTE VIOLADO: o log WARN 'mensagens_fallback' sumiu — falha ao ` +
      `buscar a config deve cair nos builders E ser monitorável nos logs.`,
  );
  assert.ok(
    src.includes('if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null'),
    `INVARIANTE VIOLADO: sem credenciais Supabase a função deve retornar null ` +
      `(fallback total nos builders) — send-whatsapp não pode exigir Supabase.`,
  );
});

test('send-whatsapp: texto custom vazio/whitespace após render cai no fallback', () => {
  const src = loadExecutableSource();
  assert.ok(
    /if\s*\(!rendered\.trim\(\)\)\s*return null/.test(src),
    `INVARIANTE VIOLADO: renderTemplate deve retornar null para texto ` +
      `vazio/whitespace ('if (!rendered.trim()) return null') — uma config mal ` +
      `salva jamais pode enviar mensagem em branco ao lead.`,
  );
});

// ─── Caminho custom (meeting_confirmed) — extensão de link/mídia (I2) ────
// O caminho custom ganhou envio via sendLink quando o payload traz linkUrl
// (card clicável — automações com link/imagem). INVARIANTE: SEM linkUrl o
// fallback sendMessage (/send-text) permanece — callers históricos (convite
// de reunião do Engine, automações só-texto) nunca mudam de comportamento.
test('send-whatsapp: caminho custom mantém sendMessage como fallback sem linkUrl', () => {
  const src = loadExecutableSource();
  const inicio = src.indexOf(`messageType === 'meeting_confirmed'`);
  assert.ok(inicio >= 0, 'Caminho custom (meeting_confirmed) não encontrado.');
  // Recorta o bloco do caminho custom (até a busca dos textos custom).
  const fim = src.indexOf('fetchMensagensCustom()', inicio);
  const bloco = fim > inicio ? src.slice(inicio, fim) : src.slice(inicio);
  assert.ok(
    bloco.includes('sendMessage(payload.phone, payload.customMessage)'),
    `INVARIANTE VIOLADO: o caminho custom deve manter o envio via ` +
      `sendMessage (/send-text) quando o payload NÃO traz linkUrl — ` +
      `fallback histórico dos callers existentes.`,
  );
  assert.ok(
    bloco.includes('payload.linkUrl') && bloco.includes('sendLink('),
    `INVARIANTE VIOLADO: o envio via sendLink no caminho custom deve ser ` +
      `condicionado à presença de payload.linkUrl (card de link opcional).`,
  );
});

// Sanidade: o guard detecta ausência de fato
test('guard: detecta corretamente quando o fallback está ausente', () => {
  const fakeSource = "const msg = custom; // sem builder";
  assert.equal(fakeSource.includes('buildAthleteMessage(data)'), false);
  assert.equal(fakeSource.includes('mensagens_fallback'), false);
});
