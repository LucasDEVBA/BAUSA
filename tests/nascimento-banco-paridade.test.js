'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD — Data de nascimento: BANCO × front (T23, PR 2)
// ════════════════════════════════════════════════════════════════════════
//
// Vai no PR 2, junto com supabase/migrations/*_form_submissions_validar_nascimento.sql
// e a validação por RPC no form-handler (a paridade front × classificador já
// está em tests/nascimento-serie-paridade.test.js, no PR 1).
// Se o banco ficar MAIS estrito que o front, a família recebe erro no fim do
// formulário; por isso: mesma tabela, folga de faixa/fuso, trava só no INSERT
// do role anon e mensagens = chaves PT do front (traduzidas em en/es).
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');

const TS = ler('apps/web/src/lib/forms/nascimento.ts');
const migDir = path.join(raiz, 'supabase', 'migrations');
const migNome = fs.readdirSync(migDir).find((f) => f.endsWith('_form_submissions_validar_nascimento.sql'));
assert.ok(migNome, 'migration da validação de nascimento sumiu');
const SQL = fs.readFileSync(path.join(migDir, migNome), 'utf8');

const SERIES = ['before_7th', '8th_grade', '9th_grade', 'hs_1st', 'hs_2nd', 'hs_3rd', 'graduated_last_year', 'graduated_2plus'];

const tabelaTs = () => {
  const i = TS.indexOf('FAIXA_IDADE_POR_SERIE');
  const bloco = TS.slice(i, TS.indexOf('};', i));
  const out = {};
  for (const m of bloco.matchAll(/["']?([\w]+)["']?\s*:\s*\{\s*min:\s*(\d+),\s*max:\s*(\d+)\s*\}/g)) {
    out[m[1]] = [Number(m[2]), Number(m[3])];
  }
  const abs = TS.match(/FAIXA_IDADE_ABSOLUTA[^=]*=\s*\{\s*min:\s*(\d+),\s*max:\s*(\d+)\s*\}/);
  assert.ok(abs, 'FAIXA_IDADE_ABSOLUTA sumiu do front');
  return { porSerie: out, absoluta: [Number(abs[1]), Number(abs[2])] };
};

const tabelaSql = () => {
  const out = {};
  for (const m of SQL.matchAll(/WHEN '([\w]+)'\s+THEN ARRAY\[(\d+),\s*(\d+)\]/g)) {
    out[m[1]] = [Number(m[2]), Number(m[3])];
  }
  const absoluta = SQL.match(/ELSE\s+ARRAY\[(\d+),\s*(\d+)\]/);
  assert.ok(absoluta, 'faixa absoluta (ELSE) sumiu do SQL');
  return { porSerie: out, absoluta: [Number(absoluta[1]), Number(absoluta[2])] };
};

test('a tabela série → faixa de idade do banco é IGUAL à do front', () => {
  const ts = tabelaTs();
  const sql = tabelaSql();
  for (const serie of SERIES) {
    assert.deepEqual(sql.porSerie[serie], ts.porSerie[serie], `banco diverge do front em ${serie}`);
  }
  assert.deepEqual(sql.absoluta, ts.absoluta, 'faixa absoluta diverge (banco × front)');
});

test('o banco nunca é MAIS estrito que o front (folga de faixa e de fuso)', () => {
  assert.match(SQL, /\(\(now\(\) AT TIME ZONE 'America\/Sao_Paulo'\)::date \+ 1\)/, 'referência = amanhã BRT (folga de fuso)');
  assert.match(SQL, /v_faixa\[1\] - p_folga_anos OR v_idade > v_faixa\[2\] \+ p_folga_anos/);
  assert.match(SQL, /^\s*1\s+-- folga de faixa/m, 'o trigger precisa chamar com folga de 1 ano');
});

test('a trava do banco vale SÓ para o formulário público (role anon) e só no INSERT', () => {
  assert.match(SQL, /IF current_user <> 'anon' THEN\s*\n\s*RETURN NEW;/, 'CF/Engine não podem ser travados por dado legado');
  for (const schema of ['public', 'uat', 'dev']) {
    assert.match(SQL, new RegExp(`BEFORE INSERT ON ${schema}\\.form_submissions`), `trigger ausente em ${schema}`);
  }
  assert.doesNotMatch(SQL, /BEFORE INSERT OR UPDATE ON/, 'UPDATE travaria PATCH de CF em lead antigo');
  assert.match(SQL, /ERRCODE = '23514'/);
});

test('mensagens do banco = chaves PT do front, traduzidas em en/es', () => {
  const doBanco = ['Data de nascimento é obrigatória', 'Data de nascimento inválida', 'A data de nascimento não pode ser no futuro'];
  const incoerente = TS.match(/incoerente:\s*\n?\s*"([^"]+)"/)[1];
  for (const m of [...doBanco, incoerente]) {
    assert.ok(SQL.includes(`'${m}'`), `mensagem do banco diverge do front: ${m}`);
  }
  for (const idioma of ['pt', 'en', 'es']) {
    const tr = ler(`apps/web/src/i18n/translations/${idioma}.ts`);
    for (const m of [...doBanco, incoerente]) {
      assert.ok(tr.includes(`"${m}":`), `form.errors (${idioma}) sem a chave: ${m}`);
    }
  }
});

test('form-handler (service role) valida a data com A MESMA função do banco', () => {
  const fh = ler('supabase/functions/form-handler/index.ts');
  assert.match(fh, /rpc\('fs_motivo_nascimento_invalido'/, 'form-handler deve usar a MESMA função do banco');
  assert.match(fh, /p_folga_anos: 1/, 'form-handler com a mesma folga do trigger');
});
