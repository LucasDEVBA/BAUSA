'use strict';

// Guard — Reativação de leads com histórico (ordem do CEO, 2026-08-24).
//
// Fluxo: lead antigo re-aprovado → aprovarLead RE-ARMA o ciclo (whatsapp/
// followups NULL, meeting false, reativacao_em=NOW) → o Bucket A do
// whatsapp-scheduler pega normalmente (MESMO CAS/anti-ban/gate humano) e a
// 1ª mensagem do novo ciclo é o template 'reactivation' (reabertura) — os
// follow-ups seguintes são os de SEMPRE.
//
// Invariantes:
//   1. O re-arme SÓ acontece para lead COM histórico — aprovação de lead
//      novo nunca zera/reativa nada.
//   2. O scheduler troca o template mas NÃO ganha bucket novo — a
//      elegibilidade continua a dos guards de scheduler (classe+timing+
//      aprovado+CAS intactos).
//   3. Reativação nunca re-dispara o e-mail de timing alternativo.
//   4. Os builders de reativação existem e estão ligados nos DOIS selects.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const leadsSrc = fs.readFileSync(
  path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'actions', 'leads.ts'), 'utf8');
const schedulerSrc = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'process-pending-whatsapp', 'index.js'), 'utf8');
const sendSrc = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'send-whatsapp', 'index.js'), 'utf8');
const migSrc = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '20260825150000_reativacao_leads_antigos.sql'), 'utf8');

test('aprovarLead: re-arme SÓ com histórico, com os 5 campos do ciclo', () => {
  assert.match(leadsSrc, /if \(fsRow\.whatsapp_sent_at\) \{/,
    'gate do histórico sumiu — aprovação de lead novo re-armaria ciclo inexistente');
  for (const campo of [
    'reativacao_em: new Date().toISOString()',
    'whatsapp_sent_at: null',
    'followup_1_sent_at: null',
    'followup_2_sent_at: null',
    'meeting_scheduled: false',
  ]) {
    assert.ok(leadsSrc.includes(campo), `re-arme perdeu o campo: ${campo}`);
  }
});

test('scheduler: reativação troca SÓ o template — sem bucket novo', () => {
  assert.match(schedulerSrc, /lead\.reativacao_em\s*\?\s*'reactivation'/,
    'override do template de reativação sumiu do triggerWhatsApp');
  // Nenhuma query nova de elegibilidade: reativacao_em não vira filtro
  // PostgREST ('reativacao_em=is.'/'=not.'/'=eq.'/'=lt.') — o desenho é
  // reusar o Bucket A, não criar bucket.
  assert.ok(!/reativacao_em=(is|not|eq|lt|gt)\./.test(schedulerSrc),
    'reativacao_em virou filtro de query — o desenho é reusar o Bucket A, não criar bucket');
});

test('scheduler: reativação nunca re-dispara o e-mail de timing', () => {
  assert.match(schedulerSrc, /!lead\.reativacao_em &&\s*\(lead\.timing_status === 'muito_cedo'/,
    'guard do e-mail de timing na reativação sumiu');
});

test('send-whatsapp: builders de reativação ligados nos dois destinatários', () => {
  assert.ok(sendSrc.includes('const buildReactivationAthleteMessage'), 'builder do atleta sumiu');
  assert.ok(sendSrc.includes('const buildReactivationGuardianMessage'), 'builder do responsável sumiu');
  assert.match(sendSrc, /messageType === 'reactivation' \? buildReactivationAthleteMessage/,
    'select do atleta não cobre reactivation');
  assert.match(sendSrc, /messageType === 'reactivation' \? buildReactivationGuardianMessage/,
    'select do responsável não cobre reactivation');
  // Copy do CEO (2026-08-25): novo ciclo 2027 + frase de seleção; e a
  // regra dele de estilo: ZERO travessões nos templates de reativação.
  assert.ok(sendSrc.includes('novo ciclo'), 'copy do novo ciclo sumiu');
  assert.ok(sendSrc.includes('Nem todo perfil que chega'), 'frase de seleção do CEO sumiu');
  const regiao = sendSrc.slice(
    sendSrc.indexOf('buildReactivationAthleteMessage'),
    sendSrc.indexOf('const buildAthleteMessage'),
  );
  assert.ok(!regiao.includes('\u2014'), 'travessão voltou à copy de reativação');
});

test('migration do re-envio do lote 2026-08-26: janela fechada + Diego fora', () => {
  const migReenvio = fs.readFileSync(
    path.join(__dirname, '..', 'supabase', 'migrations',
      '20260826120000_reenvio_lote_reativacao.sql'), 'utf8');
  assert.ok(migReenvio.includes("whatsapp_sent_at >= '2026-08-26T14:00:00Z'"),
    'borda inicial da janela sumiu');
  assert.ok(migReenvio.includes("whatsapp_sent_at <  '2026-08-26T15:00:00Z'"),
    'borda final da janela sumiu — sem ela a migration re-armaria lotes futuros');
  assert.ok(migReenvio.includes("id <> 'b2904302-7ba1-4cae-b8d7-633f2da53c34'"),
    'exclusão do Diego Alves Gonzaga sumiu (ordem do CEO: manter como está)');
  assert.ok(migReenvio.includes("aprovacao_status = 'aprovado'"), 'gate humano sumiu');
  assert.ok(migReenvio.includes('meeting_scheduled IS NOT TRUE'),
    'lead que agendou nesse meio-tempo não pode ser re-armado');
});

test('migration da re-fila dos antigos: recorte conservador', () => {
  assert.ok(migSrc.includes("d.etapa IN ('contato_feito', 'lead', 'aguardando_timing')"),
    'recorte de etapa pré-reunião sumiu');
  assert.ok(migSrc.includes("qualification_classification IN ('QUENTE', 'MORNO')"),
    'só realmente qualificados entram na fila');
  assert.ok(migSrc.includes('whatsapp_sent_at IS NOT NULL'),
    'população é quem JÁ recebeu mensagens');
  assert.ok(migSrc.includes("submitted_at < '2026-08-04"), 'corte de 03/08 sumiu');
});
