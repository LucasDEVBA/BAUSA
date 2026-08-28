'use strict';

// Guard — Briefing diário das 9h (ordem do CEO, 2026-08-27).
//
// Origem: o aviso de "leads aguardando aprovação" saía a CADA tick do
// monitor (30min) — com a Z-API desconectada em 26/08, 8 cópias idênticas
// se acumularam na fila de envio. Agora e-mail/WhatsApp/in-app saem UMA
// vez por dia, no 1º tick a partir das 9h BRT, junto com o resumo do dia
// anterior.
//
// Invariantes:
//   1. Gate diário: nada antes das 9h BRT; nada duas vezes no mesmo dia.
//   2. A marca do dia é gravada ANTES do envio (padrão whatsapp_sent_at:
//      falha no meio do envio não vira loop de reenvio).
//   3. O resumo cobre chegada, decisões, mensagens e reuniões de ONTEM
//      (janela do dia BRT convertida a UTC).
//   4. A chave briefing_diario_state nasce em migration com seed
//      (configuracoes-patch-sem-upsert: PATCH sem seed é no-op).
//   5. Timezone é America/Sao_Paulo — nunca o relógio UTC da CF.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'monitor-health', 'index.js'), 'utf8');
const migSrc = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20260827120000_briefing_diario_state.sql'),
  'utf8');

const regiao = src.slice(
  src.indexOf('const TZ_BRT'),
  src.indexOf('// ─── Cloud Scheduler API'),
);

test('gate diário: 9h BRT + no máximo 1 envio por dia', () => {
  assert.match(regiao, /if \(horaBrt\(\) < BRIEFING_HORA_BRT\) return 0;/,
    'gate das 9h sumiu — o briefing voltaria a sair de madrugada');
  assert.match(regiao, /const BRIEFING_HORA_BRT = 9;/, 'horário do briefing mudou de 9h');
  assert.match(regiao, /if \(state\.dia === hoje\) return 0;/,
    'gate de 1x/dia sumiu — o briefing voltaria a repetir a cada tick (bug de 26/08)');
});

test('marca do dia gravada ANTES do envio (sem loop de reenvio)', () => {
  const marca = regiao.indexOf("salvarConfigKey('briefing_diario_state'");
  const whatsapp = regiao.indexOf('sendWhatsAppCeo');
  const email = regiao.indexOf('sendEmailWithFallback');
  assert.ok(marca > 0, 'gravação do briefing_diario_state sumiu');
  assert.ok(whatsapp > marca && email > marca,
    'a marca do dia precisa ser gravada ANTES de qualquer envio');
});

test('resumo de ontem cobre chegada, decisões, mensagens e reuniões', () => {
  for (const col of [
    "jan('submitted_at')",
    "jan('aprovacao_decidida_em')",
    "jan('whatsapp_sent_at')",
    "jan('followup_1_sent_at')",
    "jan('followup_2_sent_at')",
    "jan('meeting_scheduled_at')",
  ]) {
    assert.ok(regiao.includes(col), `janela do resumo perdeu: ${col}`);
  }
  assert.match(regiao, /qualification_classification=eq\.QUENTE/,
    'quebra por classificação sumiu do resumo');
});

test('timezone é America/Sao_Paulo, com a matemática do dia BRT correta', () => {
  assert.match(regiao, /America\/Sao_Paulo/, 'timezone BRT sumiu');
  // Roda o código real: 02:59Z ainda é o dia anterior em BRT; 03:00Z vira o dia.
  const motor = new Function(`
    ${regiao.slice(0, regiao.indexOf('const contarFs'))}
    return { dataBrt };
  `)();
  assert.equal(motor.dataBrt(new Date('2026-08-27T02:59:00Z')), '2026-08-26');
  assert.equal(motor.dataBrt(new Date('2026-08-27T03:00:00Z')), '2026-08-27');
});

test('chave briefing_diario_state nasce em migration com seed', () => {
  assert.ok(migSrc.includes("'briefing_diario_state'"), 'seed da chave sumiu');
  assert.ok(migSrc.includes('ON CONFLICT (chave) DO NOTHING'),
    'seed deve ser idempotente (ON CONFLICT DO NOTHING)');
});

test('canais continuam governando o envio (paridade com notificacoes-canais)', () => {
  const fn = regiao.slice(regiao.indexOf('const alertarAprovacaoPendente'));
  assert.match(fn, /cfg\.whatsapp === true/, 'WhatsApp só com canal ligado');
  assert.match(fn, /cfg\.email === true/, 'e-mail só com canal ligado');
  assert.match(fn, /cfg\.inapp !== false/, 'in-app respeita o opt-out');
});
