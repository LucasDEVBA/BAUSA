'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD — Data de nascimento × série (T23, caso Samuel 2026-09)
// ════════════════════════════════════════════════════════════════════════
//
// A mesma regra vive em 3 lugares e NÃO pode divergir:
//   1. Front (Zod)            apps/web/src/lib/forms/nascimento.ts
//   2. Classificador (alerta) functions/qualify-lead/index.js
//   3. Banco (envio direto)   supabase/migrations/*_form_submissions_validar_nascimento.sql
//      → travado em tests/nascimento-banco-paridade.test.js (banco × front).
// Se o classificador divergir do front, volta o INVALIDO por idade.
// Também trava: mensagens do front traduzidas em en/es e o input com min/max.
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');

const TS = ler('apps/web/src/lib/forms/nascimento.ts');
const CF = ler('functions/qualify-lead/index.js');

const SERIES = ['before_7th', '8th_grade', '9th_grade', 'hs_1st', 'hs_2nd', 'hs_3rd', 'graduated_last_year', 'graduated_2plus'];

// "before_7th: { min: 6, max: 14 }" | "'8th_grade': {...}" | "\"8th_grade\": {...}"
const tabelaJs = (src, nomeConst) => {
  const i = src.indexOf(nomeConst);
  assert.ok(i >= 0, `${nomeConst} sumiu`);
  const bloco = src.slice(i, src.indexOf('};', i));
  const out = {};
  for (const m of bloco.matchAll(/["']?([\w]+)["']?\s*:\s*\{\s*min:\s*(\d+),\s*max:\s*(\d+)\s*\}/g)) {
    out[m[1]] = [Number(m[2]), Number(m[3])];
  }
  return out;
};

const absolutaJs = (src) => {
  const m = src.match(/FAIXA_IDADE_ABSOLUTA[^=]*=\s*\{\s*min:\s*(\d+),\s*max:\s*(\d+)\s*\}/);
  assert.ok(m, 'FAIXA_IDADE_ABSOLUTA sumiu');
  return [Number(m[1]), Number(m[2])];
};

test('a tabela série → faixa de idade é IGUAL no front e no classificador', () => {
  const ts = tabelaJs(TS, 'FAIXA_IDADE_POR_SERIE');
  const cf = tabelaJs(CF, 'const FAIXA_IDADE_POR_SERIE');
  for (const serie of SERIES) {
    assert.ok(ts[serie], `front sem a série ${serie}`);
    assert.deepEqual(cf[serie], ts[serie], `classificador diverge do front em ${serie}`);
  }
  assert.deepEqual(Object.keys(ts).sort(), [...SERIES].sort(), 'série nova/removida no front sem atualizar o guard');
  assert.deepEqual(absolutaJs(CF), absolutaJs(TS), 'faixa absoluta diverge (classificador × front)');
});

test('mensagens do front (MSG_NASCIMENTO) são chaves traduzidas em pt/en/es', () => {
  const bloco = TS.slice(TS.indexOf('export const MSG_NASCIMENTO'), TS.indexOf('} as const;'));
  const msgs = [...bloco.matchAll(/^\s*\w+:\s*\n?\s*"([^"]+)"/gm)].map((m) => m[1]);
  assert.equal(msgs.length, 6, `esperava 6 mensagens em MSG_NASCIMENTO, achei ${msgs.length}`);
  for (const idioma of ['pt', 'en', 'es']) {
    const tr = ler(`apps/web/src/i18n/translations/${idioma}.ts`);
    for (const m of msgs) {
      assert.ok(tr.includes(`"${m}":`), `form.errors (${idioma}) sem a chave: ${m}`);
    }
  }
});

test('formulário: Zod usa a regra compartilhada, input com min/max e erro do servidor traduzido', () => {
  const form = ler('apps/web/src/components/forms/FormsPage.tsx');
  assert.match(form, /from "@\/lib\/forms\/nascimento"/);
  assert.match(form, /birthDate: z\.string\(\)\.superRefine\(/, 'validação de campo da data sumiu');
  assert.match(form, /validarNascimento\(data\.birthDate, data\.schoolYear\) === "incoerente"/, 'coerência com a série sumiu');
  assert.match(form, /min=\{limitesNascimento\?\.min\}/);
  assert.match(form, /max=\{limitesNascimento\?\.max\}/);
  assert.match(form, /translateError\(submissionError\)/, 'erro do servidor precisa passar pela tradução');
  assert.match(form, /const FORM_DRAFT_KEY = "bolsa_atleta_form_draft_v2";/, 'chave do rascunho mudou — rascunhos salvos se perderiam');
  assert.match(form, /on_conflict=email%2Cathlete_name/, 'upsert por email+athlete_name mudou');
  // age gravado = mesma conta (data LOCAL) da validação; new Date("YYYY-MM-DD")
  // é meia-noite UTC e, em BRT, contava 1 ano a mais na véspera do aniversário.
  assert.match(form, /const computedAge = birthDateValue \? idadeEmAnos\(birthDateValue\) : null;/);
  assert.doesNotMatch(form, /new Date\(birthDateValue\)/, 'cálculo de idade por new Date(ISO) voltou');
});

test('sem série escolhida, a data fora da faixa absoluta não fala de "série escolhida"', () => {
  assert.match(TS, /return faixaDaSerie \? "incoerente" : "foraDaFaixa";/);
  const fora = TS.match(/foraDaFaixa:\s*\n?\s*"([^"]+)"/);
  assert.ok(fora, 'mensagem foraDaFaixa sumiu');
  assert.doesNotMatch(fora[1], /série/, 'a mensagem sem série não pode citar a série');
});
