'use strict';

// Guard — avanço automático reuniao_marcada → reuniao_realizada
// (meeting-transcripts, 2026-08-17).
//
// Auditoria: 88 deals presos em reuniao_marcada com a reunião no passado —
// nenhuma automação movia a etapa. A transcrição capturada é a PROVA de que
// a reunião aconteceu, e o avanço vive na CF meeting-transcripts. Invariantes:
//   1. CAS na etapa (etapa=eq.reuniao_marcada) — deal já adiantado
//      (proposta, contrato…) NUNCA retrocede para reuniao_realizada.
//   2. Respeita soft delete (deleted_at=is.null).
//   3. Fail-open: falha do avanço não derruba a captura da transcrição.
//   4. Os DOIS caminhos (cron e sob demanda) chamam o avanço.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'meeting-transcripts', 'index.js'),
  'utf8',
);

test('avanço usa CAS na etapa — só move quem ainda está em reuniao_marcada', () => {
  assert.match(
    src,
    /deals\?id=eq\.\$\{dealId\}` \+\s*\n\s*`&etapa=eq\.reuniao_marcada&deleted_at=is\.null/,
    'o PATCH do avanço deve filtrar etapa=eq.reuniao_marcada E deleted_at=is.null',
  );
});

test('avanço é fail-open — nunca derruba a captura da transcrição', () => {
  const fn = src.slice(
    src.indexOf('const avancarDealPosTranscricao'),
    src.indexOf('};', src.indexOf('const avancarDealPosTranscricao')) + 2,
  );
  assert.match(fn, /try \{/, 'corpo deve estar em try/catch');
  assert.doesNotMatch(fn, /throw /, 'o avanço nunca relança erro');
});

test('cron E captura sob demanda chamam o avanço', () => {
  const chamadas = src.match(/await avancarDealPosTranscricao\(/g) || [];
  assert.ok(
    chamadas.length >= 2,
    `esperado >=2 call sites (cron + targeted); encontrado ${chamadas.length}`,
  );
});
