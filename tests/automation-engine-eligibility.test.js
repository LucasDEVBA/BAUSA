'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — automation-engine (ação enviar_whatsapp + CAS)
// ════════════════════════════════════════════════════════════════════════
//
// A automation-engine executa automações CONFIGURÁVEIS pelo CEO, inclusive
// a ação enviar_whatsapp. Diferente dos schedulers fixos (filtros na query
// PostgREST), aqui a elegibilidade é reaplicada em JS antes de chamar o
// send-whatsapp (checkWhatsappEligibility). Este guard falha o CI se essas
// cláusulas sumirem do código executável — mesma classe de proteção do
// tests/scheduler-eligibility.test.js (incidentes 2026-05-15/18).
//
// Execução local:  node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ENGINE_FILE = path.join(__dirname, '..', 'functions', 'automation-engine', 'index.js');

function loadExecutableSource() {
  assert.ok(fs.existsSync(ENGINE_FILE), `Arquivo não encontrado: ${ENGINE_FILE}`);
  const raw = fs.readFileSync(ENGINE_FILE, 'utf8');
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlockComments
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

// ─── Invariante 1: FRIO nunca recebe WhatsApp automático ─────────────────
test('automation-engine: elegibilidade exige classificação QUENTE/MORNO', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes(`['QUENTE', 'MORNO'].includes(classificacao)`),
    `INVARIANTE VIOLADO: checkWhatsappEligibility deve barrar qualquer ` +
      `classificação fora de QUENTE/MORNO — FRIO NUNCA recebe mensagem ` +
      `automática (incidente 2026-05-15).`,
  );
});

// ─── Invariante 2: elegibilidade é chamada no caminho do envio ───────────
test('automation-engine: enviar_whatsapp passa pela checagem de elegibilidade', () => {
  const src = loadExecutableSource();
  // 1 definição + >=1 chamada no executor da ação
  const occurrences = src.split('checkWhatsappEligibility').length - 1;
  assert.ok(
    occurrences >= 2,
    `INVARIANTE VIOLADO: checkWhatsappEligibility deve ser DEFINIDA e ` +
      `CHAMADA no caminho da ação enviar_whatsapp (encontrado ${occurrences} ` +
      `ocorrência(s)). Sem a chamada, a automação envia sem reaplicar os filtros.`,
  );
  assert.ok(
    src.includes('elig.eligible'),
    `INVARIANTE VIOLADO: o resultado da elegibilidade deve ser verificado ` +
      `antes do POST ao send-whatsapp.`,
  );
});

// ─── Invariante 3: timing ideal vs alternativo nunca se misturam ─────────
test('automation-engine: templates respeitam o fluxo de timing correto', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes(`['muito_cedo', 'tarde_demais'].includes(timing)`),
    `INVARIANTE VIOLADO: templates do fluxo alternativo (early_potential/` +
      `late_timing) devem exigir timing muito_cedo/tarde_demais.`,
  );
  assert.ok(
    src.includes(`timing === 'ideal'`) || src.includes(`'ideal'`),
    `INVARIANTE VIOLADO: templates do fluxo ideal devem exigir ` +
      `timing_status NULL/ideal (incidente 2026-05-18).`,
  );
});

// ─── Invariante 4: quem agendou reunião não recebe follow-up ─────────────
test('automation-engine: follow-ups exigem meeting_scheduled não-true', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes('meeting_scheduled === true'),
    `INVARIANTE VIOLADO: follow-ups (requireNoMeeting) devem barrar leads ` +
      `com meeting_scheduled = true.`,
  );
  assert.ok(
    src.includes('requireNoMeeting: true'),
    `INVARIANTE VIOLADO: followup_1 e followup_2 devem manter ` +
      `requireNoMeeting: true no TEMPLATE_TIMING.`,
  );
});

// ─── Invariante 4b: idempotência NO LEAD — CAS em form_submissions ───────
test('automation-engine: envio marca coluna *_sent_at com CAS antes do POST', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes('claimLeadColumn'),
    `INVARIANTE VIOLADO: a ação enviar_whatsapp deve claimar a coluna ` +
      `*_sent_at do lead (claimLeadColumn) ANTES do POST — sem isso, ` +
      `automação duplica mensagem com os schedulers e com retries.`,
  );
  assert.ok(
    src.includes('${column}=is.null'),
    `INVARIANTE VIOLADO: o claim do lead deve usar o filtro =is.null na URL ` +
      `(CAS canônico markWhatsAppSent/markFollowupSent).`,
  );
  assert.ok(
    src.includes(`casColumn: 'whatsapp_sent_at'`) &&
      src.includes(`casColumn: 'followup_1_sent_at'`) &&
      src.includes(`casColumn: 'followup_2_sent_at'`),
    `INVARIANTE VIOLADO: cada template deve mapear sua coluna *_sent_at ` +
      `(initial→whatsapp, FU1→followup_1, FU2→followup_2).`,
  );
});

// ─── Invariante 4c: ordem da régua (FU pressupõe envio anterior) ─────────
test('automation-engine: follow-ups exigem os envios anteriores da régua', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes(`requires: ['whatsapp_sent_at']`),
    `INVARIANTE VIOLADO: followup_1 deve exigir whatsapp_sent_at preenchido ` +
      `(não existe follow-up sem mensagem inicial).`,
  );
  assert.ok(
    src.includes(`requires: ['whatsapp_sent_at', 'followup_1_sent_at']`),
    `INVARIANTE VIOLADO: followup_2 deve exigir initial + followup_1.`,
  );
});

// ─── Invariante 4d: meeting_confirmed fora do catálogo da engine ─────────
test('automation-engine: meeting_confirmed não é template executável', () => {
  const src = loadExecutableSource();
  assert.ok(
    !src.includes(`meeting_confirmed: {`),
    `INVARIANTE VIOLADO: meeting_confirmed não pode entrar no TEMPLATE_TIMING ` +
      `— o send-whatsapp exige customMessage/phone nesse caminho; sem eles o ` +
      `lead receberia o template initial errado.`,
  );
});

// ─── Invariante 4e: ação custom reaplica a classe QUENTE/MORNO ───────────
test('automation-engine: enviar_whatsapp_custom reaplica a classe QUENTE/MORNO', () => {
  const src = loadExecutableSource();
  const inicio = src.indexOf(`acao.tipo === 'enviar_whatsapp_custom'`);
  assert.ok(
    inicio >= 0,
    `INVARIANTE VIOLADO: a ação enviar_whatsapp_custom deve existir no ` +
      `executeAcao (texto livre ao responsável).`,
  );
  // Recorta o bloco da ação custom (até o próximo bloco de ação) e garante
  // a checagem de classe DENTRO dele — mesma cláusula dos schedulers.
  const proximoBloco = src.indexOf(`acao.tipo === '`, inicio + 1);
  const bloco = proximoBloco > inicio ? src.slice(inicio, proximoBloco) : src.slice(inicio);
  assert.ok(
    bloco.includes(`['QUENTE', 'MORNO'].includes(`),
    `INVARIANTE VIOLADO: enviar_whatsapp_custom deve barrar classificação ` +
      `fora de QUENTE/MORNO antes de qualquer POST — FRIO NUNCA recebe, ` +
      `nem mensagem custom (incidente 2026-05-15).`,
  );
  assert.ok(
    bloco.indexOf(`['QUENTE', 'MORNO'].includes(`) < bloco.indexOf('httpRequest'),
    `INVARIANTE VIOLADO: a checagem de classe da ação custom deve vir ` +
      `ANTES do POST ao send-whatsapp.`,
  );
});

// ─── Invariante 4f: ação e-mail custom reaplica a classe QUENTE/MORNO ────
test('automation-engine: enviar_email_custom reaplica a classe QUENTE/MORNO', () => {
  const src = loadExecutableSource();
  const inicio = src.indexOf(`acao.tipo === 'enviar_email_custom'`);
  assert.ok(
    inicio >= 0,
    `INVARIANTE VIOLADO: a ação enviar_email_custom deve existir no ` +
      `executeAcao (texto livre por e-mail ao responsável).`,
  );
  // Recorta o bloco da ação (até o próximo bloco de ação) e garante a
  // checagem de classe DENTRO dele, ANTES do POST — FRIO nunca recebe
  // outreach automático por NENHUM canal (mesma política do WhatsApp custom).
  const proximoBloco = src.indexOf(`acao.tipo === '`, inicio + 1);
  const bloco = proximoBloco > inicio ? src.slice(inicio, proximoBloco) : src.slice(inicio);
  assert.ok(
    bloco.includes(`['QUENTE', 'MORNO'].includes(`),
    `INVARIANTE VIOLADO: enviar_email_custom deve barrar classificação ` +
      `fora de QUENTE/MORNO antes de qualquer POST — FRIO NUNCA recebe, ` +
      `nem e-mail custom (incidente 2026-05-15).`,
  );
  assert.ok(
    bloco.indexOf(`['QUENTE', 'MORNO'].includes(`) < bloco.indexOf('httpRequest'),
    `INVARIANTE VIOLADO: a checagem de classe da ação de e-mail custom ` +
      `deve vir ANTES do POST ao send-messages.`,
  );
});

// ─── Invariante 5: CAS atômico antes de executar o run ───────────────────
test('automation-engine: claim do run usa CAS (filtro de status na URL)', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes('status=eq.${run.status}'),
    `INVARIANTE VIOLADO: claimRun deve fazer PATCH com filtro ` +
      `status=eq.<atual> na URL — sem CAS, duas instâncias executam o mesmo ` +
      `run (mensagem duplicada ao lead).`,
  );
});

// ─── Invariante 5b: filtro por etapa do gatilho deal_etapa_mudou (J1) ────
test('automation-engine: deal_etapa_mudou respeita gatilho_config.etapa_para', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes(`auto.gatilho === 'deal_etapa_mudou'`) &&
      src.includes('gatilho_config || {}).etapa_para'),
    `INVARIANTE VIOLADO: processRun deve ler gatilho_config.etapa_para do ` +
      `gatilho deal_etapa_mudou — sem o filtro, automação configurada para ` +
      `uma etapa dispararia em TODA transição do pipeline.`,
  );
  assert.ok(
    src.includes('automação espera'),
    `INVARIANTE VIOLADO: run com etapa divergente deve finalizar como ` +
      `'ignorado' com motivo claro ("etapa X, automação espera Y").`,
  );
  // O filtro precisa vir ANTES da avaliação de condições/execução de ações.
  const idxFiltro = src.indexOf('automação espera');
  const idxCondicoes = src.indexOf('evaluateCondicoes(auto.condicoes');
  assert.ok(
    idxFiltro >= 0 && idxCondicoes > idxFiltro,
    `INVARIANTE VIOLADO: o filtro de etapa deve rodar ANTES de ` +
      `evaluateCondicoes no processRun — depois dele, as ações já executariam.`,
  );
});

// ─── Invariante 6: gatilho tarefa_vencida não cria loop de tarefas ───────
test('automation-engine: tarefa_vencida ignora tarefas criadas por automação', () => {
  const src = loadExecutableSource();
  assert.ok(
    src.includes('criada_automaticamente=eq.false'),
    `INVARIANTE VIOLADO: o finder de tarefa_vencida deve filtrar ` +
      `criada_automaticamente=eq.false — sem isso, automação que cria tarefa ` +
      `a partir de tarefa vencida entra em loop infinito.`,
  );
});
