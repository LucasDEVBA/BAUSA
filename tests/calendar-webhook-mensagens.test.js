'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — Textos custom do calendar-webhook (Fase H1)
// ════════════════════════════════════════════════════════════════════════
//
// A CF calendar-webhook passou a ler textos editáveis de
// configuracoes_sistema.scheduler_mensagens (chave meeting_confirmed, par
// { lead, ceo }, editados em /automacoes). INVARIANTE: os builders
// hardcoded são o FALLBACK PERMANENTE — a confirmação de reunião NUNCA
// pode depender exclusivamente da config para ser enviada:
//
//   1. Sem SUPABASE_URL/SUPABASE_SERVICE_KEY → builders (zero mudança).
//   2. Erro de rede/HTTP ao buscar a config → builders + log WARN
//      'mensagens_fallback' (monitorável).
//   3. Texto custom vazio/whitespace após render → builders (config mal
//      salva jamais pode enviar confirmação em branco ao lead ou ao CEO).
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

const SOURCE_FILE = path.join(__dirname, '..', 'functions', 'calendar-webhook', 'index.js');

/** Source sem comentários (mesma estratégia do send-whatsapp-mensagens). */
function loadExecutableSource() {
  assert.ok(fs.existsSync(SOURCE_FILE), `Arquivo não encontrado: ${SOURCE_FILE}`);
  const raw = fs.readFileSync(SOURCE_FILE, 'utf8');
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlockComments
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

// Os 2 builders hardcoded (confirmação ao lead + notificação ao CEO) —
// fallback permanente dos textos custom. Remover qualquer um quebra o
// fallback da confirmação de reunião.
const BUILDERS = ['buildLeadMeetingMessage', 'buildCeoMeetingMessage'];

test('calendar-webhook: builders hardcoded continuam definidos E usados como fallback', () => {
  const src = loadExecutableSource();
  for (const builder of BUILDERS) {
    assert.ok(
      src.includes(`const ${builder} = `),
      `INVARIANTE VIOLADO: builder '${builder}' não está mais definido — ` +
        `ele é o fallback permanente do texto custom e NUNCA pode ser removido.`,
    );
    assert.ok(
      src.includes(`|| ${builder}(`),
      `INVARIANTE VIOLADO: builder '${builder}' não é mais o fallback do ` +
        `texto custom — a mensagem deve cair nele via 'customMessage || ${builder}(...)'.`,
    );
  }
});

test('calendar-webhook: fallback por erro na config existe e é logado (mensagens_fallback)', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes('mensagens_fallback'),
    `INVARIANTE VIOLADO: o log WARN 'mensagens_fallback' sumiu — falha ao ` +
      `buscar a config deve cair nos builders E ser monitorável nos logs.`,
  );
  assert.ok(
    src.includes('if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null'),
    `INVARIANTE VIOLADO: sem credenciais Supabase a busca de textos custom ` +
      `deve retornar null (fallback total nos builders) — a confirmação de ` +
      `reunião não pode exigir a config para funcionar.`,
  );
});

test('calendar-webhook: texto custom vazio/whitespace após render cai no fallback', () => {
  const src = loadExecutableSource();
  assert.ok(
    /if\s*\(!rendered\.trim\(\)\)\s*return null/.test(src),
    `INVARIANTE VIOLADO: renderTemplate deve retornar null para texto ` +
      `vazio/whitespace ('if (!rendered.trim()) return null') — uma config mal ` +
      `salva jamais pode enviar confirmação em branco.`,
  );
});

// Sanidade: o guard detecta ausência de fato
test('guard: detecta corretamente quando o fallback está ausente', () => {
  const fakeSource = 'const msg = custom; // sem builder';
  assert.equal(fakeSource.includes('|| buildLeadMeetingMessage('), false);
  assert.equal(fakeSource.includes('mensagens_fallback'), false);
});
