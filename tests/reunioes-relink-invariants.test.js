'use strict';

// Guard — Vincular reunião move o deal (pedido do CEO, 2026-08-26).
//
// Regras do relinkReuniaoDeal (apps/crm/src/lib/actions/reunioes-relink.ts):
//   1. Evento que JÁ aconteceu → reuniao_realizada; futuro → reuniao_marcada.
//   2. Só promove a partir de etapa pré-reunião (whitelist) ou de
//      reuniao_marcada→realizada — deal avançado/perdido/concluído NUNCA
//      retrocede por um relink.
//   3. Vincular marca meeting_scheduled no form_submission (tira o lead dos
//      follow-ups "você não agendou"), best-effort e sem sobrescrever
//      detecção anterior (só quando meeting_scheduled_at ainda é null).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'actions', 'reunioes-relink.ts'),
  'utf8');

test('evento passado → realizada; futuro → marcada', () => {
  assert.match(src, /jaOcorreu\s*\?\s*"reuniao_realizada"\s*:\s*"reuniao_marcada"/,
    'seleção da etapa-alvo por data do evento sumiu');
  assert.match(src, /new Date\(evento\.start\)\.getTime\(\) <= Date\.now\(\)/,
    'cálculo de evento já ocorrido sumiu');
});

test('promoção só para frente: whitelist pré-reunião + marcada→realizada', () => {
  assert.match(src, /ETAPAS_PRE_REUNIAO = new Set\(\["contato_feito", "lead", "aguardando_timing"\]\)/,
    'whitelist de etapas promovíveis mudou — perdido/concluido/avançadas não podem entrar');
  assert.match(src, /etapaAtual === "reuniao_marcada" && alvo === "reuniao_realizada"/,
    'promoção marcada→realizada sumiu');
  assert.match(src, /\.\.\.\(promove \? \{ etapa: alvo \} : \{\}\)/,
    'etapa deixou de ser condicional no update — relink retrocederia deal avançado');
});

test('board reflete o vínculo sem F5: refresh no modal + re-sync no board', () => {
  const modalSrc = fs.readFileSync(
    path.join(__dirname, '..', 'apps', 'crm', 'src', 'components', 'pipeline', 'DealDetailModal.tsx'),
    'utf8');
  const boardSrc = fs.readFileSync(
    path.join(__dirname, '..', 'apps', 'crm', 'src', 'components', 'pipeline', 'PipelineBoard.tsx'),
    'utf8');
  const vincularRegion = modalSrc.slice(
    modalSrc.indexOf('const vincular = (ev: ReuniaoCalendar)'),
    modalSrc.indexOf('const toggleTranscricao'));
  assert.match(vincularRegion, /router\.refresh\(\)/,
    'router.refresh() sumiu do vincular — o board não repinta após mover o deal');
  assert.match(boardSrc, /setDeals\(initialDeals\);\s*\n\s*\}, \[initialDeals\]\)/,
    're-sync de deals com o servidor sumiu do PipelineBoard — card fica na coluna antiga até F5');
});

test('vincular marca meeting_scheduled sem sobrescrever detecção anterior', () => {
  assert.match(src, /meeting_scheduled: true/,
    'flag de reunião sumiu — lead vinculado voltaria a receber follow-up');
  assert.match(src, /\.is\("meeting_scheduled_at", null\)/,
    'guarda contra sobrescrever meeting_scheduled_at sumiu');
  assert.match(src, /if \(promove && formSubmissionId\)/,
    'flag deve ser best-effort e só quando o vínculo promove o deal');
});
