'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — Elegibilidade dos schedulers de WhatsApp
// ════════════════════════════════════════════════════════════════════════
//
// Contexto (incidentes 2026-05-15 / 2026-05-18):
//   Dois bugs da MESMA classe — uma cláusula de filtro de elegibilidade
//   ausente na lista de filtros de um scheduler:
//
//   1. process-pending-whatsapp / Bucket B: faltava o filtro de
//      classificação Gemini → leads FRIO + timing alternativo receberam
//      early_potential / late_timing indevidamente.
//   2. process-followup-whatsapp / fetchFollowupLeads: faltava o filtro
//      de timing → leads muito_cedo / tarde_demais receberam follow-up
//      "agende a reunião" contradizendo a mensagem que já tinham recebido.
//
// Este guard falha o CI se QUALQUER scheduler de elegibilidade deixar de
// aplicar os filtros obrigatórios. É a barreira que impede uma feature
// futura de reintroduzir essa classe de bug.
//
// Estratégia: análise estática do source (sem deploy, sem refator de
// produção). Comentários de linha inteira e blocos são removidos antes
// da verificação para evitar falso-positivo de "cláusula só no comentário".
//
// Execução local:  node --test tests/
// Execução no CI:   job dedicado "scheduler-invariants" no ci.yml
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Este guard vive em tests/ (FORA de functions/) — pastas dentro de
// functions/ são auto-detectadas como Cloud Functions deployáveis pelos
// workflows deploy-functions*.yml. A partir de tests/, functions/ está
// um nível acima.
const FUNCTIONS_DIR = path.join(__dirname, '..', 'functions');

/**
 * Lê o index.js de uma Cloud Function e retorna o código com comentários
 * removidos (blocos /* *​/ e linhas iniciadas por //), de modo que a
 * presença de uma cláusula só conte se ela existir no código executável.
 */
function loadExecutableSource(functionName) {
  const file = path.join(FUNCTIONS_DIR, functionName, 'index.js');
  assert.ok(fs.existsSync(file), `Arquivo não encontrado: ${file}`);

  const raw = fs.readFileSync(file, 'utf8');
  const noBlockComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const noLineComments = noBlockComments
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');

  return noLineComments;
}

/** Conta ocorrências não sobrepostas de uma substring literal. */
function countOccurrences(haystack, needle) {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}

// Cláusulas PostgREST obrigatórias. A sintaxe `=in.(` / `=(` é específica
// de filtro e não aparece em prosa de comentário — robusto contra ruído.
const CLAUSE_CLASSIFICACAO = 'qualification_classification=in.(QUENTE,MORNO)';
const CLAUSE_TIMING_IDEAL = 'or=(timing_status.is.null,timing_status.eq.ideal)';
const CLAUSE_TIMING_ALT = 'timing_status=in.(muito_cedo,tarde_demais)';

// ─── process-pending-whatsapp (whatsapp-scheduler) ──────────────────────
test('process-pending-whatsapp: Bucket A e Bucket B filtram classificação Gemini', () => {
  const src = loadExecutableSource('process-pending-whatsapp');
  const occurrences = countOccurrences(src, CLAUSE_CLASSIFICACAO);

  assert.ok(
    occurrences >= 2,
    `INVARIANTE VIOLADO: '${CLAUSE_CLASSIFICACAO}' deve aparecer em AMBOS os ` +
      `buckets (ideal=Bucket A e alternativo=Bucket B). Encontrado ${occurrences}x. ` +
      `Sem isso, leads FRIO entram no envio automático (incidente 2026-05-15).`,
  );
});

test('process-pending-whatsapp: Bucket A restringe a timing ideal/null', () => {
  const src = loadExecutableSource('process-pending-whatsapp');
  assert.ok(
    src.includes(CLAUSE_TIMING_IDEAL),
    `INVARIANTE VIOLADO: Bucket A (timing ideal) deve conter ` +
      `'${CLAUSE_TIMING_IDEAL}' para não colidir com o Bucket B.`,
  );
});

test('process-pending-whatsapp: Bucket B endereça timing alternativo', () => {
  const src = loadExecutableSource('process-pending-whatsapp');
  assert.ok(
    src.includes(CLAUSE_TIMING_ALT),
    `INVARIANTE VIOLADO: Bucket B deve conter '${CLAUSE_TIMING_ALT}' ` +
      `para rotear early_potential / late_timing.`,
  );
});

// ─── process-followup-whatsapp (followup-scheduler) ─────────────────────
test('process-followup-whatsapp: follow-up filtra classificação Gemini', () => {
  const src = loadExecutableSource('process-followup-whatsapp');
  assert.ok(
    src.includes(CLAUSE_CLASSIFICACAO),
    `INVARIANTE VIOLADO: fetchFollowupLeads deve conter ` +
      `'${CLAUSE_CLASSIFICACAO}'. Sem isso, leads FRIO recebem follow-up.`,
  );
});

test('process-followup-whatsapp: follow-up só atinge timing ideal/null', () => {
  const src = loadExecutableSource('process-followup-whatsapp');
  assert.ok(
    src.includes(CLAUSE_TIMING_IDEAL),
    `INVARIANTE VIOLADO: fetchFollowupLeads deve conter ` +
      `'${CLAUSE_TIMING_IDEAL}'. Sem isso, leads muito_cedo/tarde_demais ` +
      `recebem follow-up contraditório (incidente 2026-05-18).`,
  );
});

// ─── Sanidade: o guard realmente detecta ausência ───────────────────────
test('guard: detecta corretamente quando uma cláusula está ausente', () => {
  const fakeSource = "const filters = ['whatsapp_sent_at=is.null'];";
  assert.equal(
    fakeSource.includes(CLAUSE_CLASSIFICACAO),
    false,
    'O guard deve reportar ausência quando a cláusula não existe.',
  );
});
