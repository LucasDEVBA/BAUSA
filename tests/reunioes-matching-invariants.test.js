'use strict';

// Guard — matching de eventos do Calendar por lead (CF calendar-lead-events).
//
// Incidente 2026-08-26: a aba Reunião do detalhe do lead puxava reuniões de
// OUTROS leads. Causa: o matching por nome aceitava o SOBRENOME sozinho no
// título do evento ("Alves", "Neves", "Silva"…) e nome completo por
// substring — sobrenomes comuns casavam com qualquer família homônima.
//
// Invariantes:
//   1. Nome só casa com 2+ partes do MESMO nome como palavras inteiras do
//      título — sobrenome sozinho nunca casa.
//   2. Partes de pessoas diferentes não se somam (escopo por pessoa).
//   3. Substring de palavra não casa (whole-word via Set de palavras).
//   4. E-mail de attendee e telefone tail-10 na descrição continuam casando
//      (paridade com o calendar-webhook — é o caminho dos eventos do fluxo
//      automático).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'calendar-lead-events', 'index.js'), 'utf8');

// ── Extração real do motor de matching (roda o código de verdade) ──
const inicio = src.indexOf('const phoneTail');
const fim = src.indexOf('// ─── Cloud Function principal');
assert.ok(inicio > 0 && fim > inicio, 'região do matching não encontrada no source');
const regiao = src.slice(inicio, fim);

const motor = new Function(`
  ${regiao}
  return { phoneTail, normalize, nameParts, eventMatchesLead };
`)();
const { phoneTail, nameParts, eventMatchesLead } = motor;

const nomesDe = (names) => names.map(nameParts).filter((p) => p.length >= 2);

test('sobrenome sozinho no título NÃO casa mais (caso Alves do incidente)', () => {
  const nomes = nomesDe(['Diego Alves Gonzaga', 'Renata Alves']);
  const evOutroLead = { summary: 'Família Alves - Alinhamento estratégico', attendees: [] };
  assert.equal(eventMatchesLead(evOutroLead, [], [], nomes), false,
    'reunião de OUTRA família Alves casou com o lead — regressão do incidente 2026-08-26');
});

test('2+ partes do MESMO nome no título casam (evento manual do CEO)', () => {
  const nomes = nomesDe(['Diego Alves Gonzaga', 'Renata Alves']);
  const ev = { summary: 'Leandro x Diego Gonzaga - BAUSA', attendees: [] };
  assert.equal(eventMatchesLead(ev, [], [], nomes), true);
  // Acentos/conectivos normalizados: "José Guilherme de Lima Souza"
  const nomes2 = nomesDe(['José Guilherme de Lima Souza']);
  const ev2 = { summary: 'Reunião José Guilherme', attendees: [] };
  assert.equal(eventMatchesLead(ev2, [], [], nomes2), true);
});

test('partes de pessoas DIFERENTES não se somam', () => {
  const nomes = nomesDe(['Diego Alves Gonzaga', 'Renata Alves']);
  // "renata" (da responsável) + "gonzaga" (do atleta): 1 parte de cada — não casa
  const ev = { summary: 'Renata Gonzaga', attendees: [] };
  assert.equal(eventMatchesLead(ev, [], [], nomes), false);
});

test('substring de palavra não casa (whole-word)', () => {
  const nomes = nomesDe(['Maria Silva']);
  const ev = { summary: 'Ana Maria Silvano - Consultoria', attendees: [] };
  assert.equal(eventMatchesLead(ev, [], [], nomes), false,
    '"maria silva" casou por substring dentro de "maria silvano"');
});

test('e-mail de attendee e telefone na descrição continuam casando', () => {
  const emails = ['renata@gmail.com'];
  const tails = [phoneTail('+55 71 99146-1565')];
  const evEmail = { summary: 'Reunião', attendees: [{ email: 'Renata@Gmail.com' }] };
  assert.equal(eventMatchesLead(evEmail, emails, [], []), true, 'attendee por e-mail quebrou');
  const evFone = { summary: 'Reunião', attendees: [], description: 'WhatsApp: (71) 99146-1565' };
  assert.equal(eventMatchesLead(evFone, [], tails, []), true, 'tail-10 na descrição quebrou');
});

test('nome com só 1 parte útil fica fora do matching', () => {
  assert.deepEqual(nomesDe(['Diego']), [], 'nome de 1 parte deveria ser descartado na entrada');
  assert.deepEqual(nomesDe(['de da do']), [], 'só conectivos deveria ser descartado');
});

test('source: sem matching por sobrenome/substring; corte de 2 partes presente', () => {
  assert.ok(!src.includes('tokens.add(sobrenome)') && !/summary\.includes\(/.test(src),
    'lógica de sobrenome sozinho/substring voltou ao source');
  assert.match(src, /\.length >= 2\)\)/, 'corte de 2+ partes por pessoa sumiu');
  assert.match(src, /palavras\.has\(p\)/, 'matching whole-word (Set de palavras) sumiu');
});
