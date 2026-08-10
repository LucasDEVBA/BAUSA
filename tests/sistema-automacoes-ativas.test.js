// ════════════════════════════════════════════════════════════════════════
// Guard: toggles on/off das automações de sistema são FAIL-OPEN
// ════════════════════════════════════════════════════════════════════════
//
// As CFs de sistema leem configuracoes_sistema.sistema_automacoes_ativas para
// permitir desligar automações pela UI (/automacoes). INVARIANTE: campo
// ausente/erro de config = automação ATIVA (comportamento histórico). Uma
// regressão que invertesse o default (ex.: `!== true`) desligaria TODA a
// mensageria silenciosamente com a chave semeada vazia ({}).
//
// Mesmo padrão zero-deps dos demais guards: análise estática por substring
// literal sobre o fonte sem comentários. Roda no CI via `node --test tests/`.
// ════════════════════════════════════════════════════════════════════════

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const stripComments = (src) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

const lerFonte = (fn) =>
  stripComments(
    fs.readFileSync(path.join(__dirname, '..', 'functions', fn, 'index.js'), 'utf8'),
  );

// CF → [toggles esperados como `=== false` no código executável]
const GATES = {
  'process-pending-whatsapp': ['ativas.whatsapp_inicial === false', 'ativas.whatsapp_timing_alt === false'],
  'process-followup-whatsapp': ['ativas.followup_1 === false', 'ativas.followup_2 === false'],
  'process-scheduled-followups': ['ativas.scheduled_return === false'],
  // aprovacao_manual: gate humano da fila de aprovação — desligado (=== false)
  // volta à auto-promoção; ausente = fila ATIVA (fail-open do gate humano)
  'qualify-lead': ['ativas.qualificacao === false', 'ativas.aprovacao_manual === false'],
  'calendar-webhook': ['ativas.confirmacao_reuniao === false'],
  // Resumo de transcrição: desligar NÃO para a captura — só o resumo Gemini
  'meeting-transcripts': ['resumo_transcricao === false'],
  // Monitor: desligar só cala os ALERTAS — os checks continuam rodando/logando
  'monitor-health': ['monitor_alertas === false'],
  // Pós-venda: NPS aos 6 meses (outreach) + alerta ativo de inatividade
  'experiencia-scheduler': ['ativas.nps_automatico === false', 'ativas.alerta_inatividade === false'],
};

for (const [fn, gates] of Object.entries(GATES)) {
  test(`${fn}: gates fail-open (=== false) presentes`, () => {
    const src = lerFonte(fn);
    for (const gate of gates) {
      assert.ok(
        src.includes(gate),
        `${fn} deve conter o gate literal "${gate}" — comparação === false garante ` +
          'que campo ausente/config vazia mantém a automação ATIVA (fail-open)',
      );
    }
    // O anti-padrão `!== true` inverteria o fail-open (config vazia desligaria tudo)
    assert.ok(
      !src.includes('ativas.') || !/ativas\.[a-z0-9_]+\s*!==\s*true/.test(src),
      `${fn} não pode usar "ativas.<toggle> !== true" (inverteria o fail-open)`,
    );
  });
}

test('send-messages: gates de e-mail fail-open + destino com fallback env', () => {
  const src = lerFonte('send-messages');
  assert.ok(
    src.includes('ativas.email_confirmacao !== false'),
    'confirmação deve ser ativa por default (!== false)',
  );
  assert.ok(
    src.includes('ativas.email_interno !== false'),
    'e-mail interno deve ser ativo por default (!== false)',
  );
  assert.ok(
    src.includes(': INTERNAL_EMAIL'),
    'destino do e-mail interno deve ter fallback para a env INTERNAL_EMAIL',
  );
});

test('todas as CFs com gate têm fallback de config ({} em erro)', () => {
  for (const fn of [...Object.keys(GATES), 'send-messages']) {
    const src = lerFonte(fn);
    assert.ok(
      src.includes('ativas_fallback') || src.includes('email_config_fallback') || src.includes('sistema_config_fallback'),
      `${fn} deve logar e degradar para {} quando a config estiver indisponível`,
    );
  }
});

test('qualify-lead: seções do prompt com default fail-open (PROMPT_DEFAULTS)', () => {
  const src = lerFonte('qualify-lead');
  assert.ok(src.includes('PROMPT_DEFAULTS'), 'defaults do prompt devem existir no código');
  assert.ok(
    src.includes(': PROMPT_DEFAULTS[key]'),
    'promptSection deve cair no default quando a config estiver ausente/vazia',
  );
  // Textos-âncora dos critérios: garantem que os defaults não foram removidos
  for (const ancora of ['1️⃣ QUENTE', '2️⃣ MORNO', '3️⃣ FRIO', 'PROFISSÕES COM RENDA VARIÁVEL', 'REGRAS IMPORTANTES']) {
    assert.ok(src.includes(ancora), `default do prompt deve conter "${ancora}"`);
  }
  // O contrato de saída JSON permanece FIXO no código (não é seção editável)
  assert.ok(
    src.includes('FORMATO OBRIGATÓRIO DE RESPOSTA'),
    'contrato JSON de saída deve permanecer hardcoded',
  );
});
