'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD — mass-assignment do role anon em form_submissions (T23-S2)
// ════════════════════════════════════════════════════════════════════════
// A anon key é pública (vai no bundle do site) e a policy de INSERT do anon
// é WITH CHECK (true) com grant em todas as colunas. Sem esta trava, um POST
// direto com aprovacao_status='aprovado' pulava o gate humano (o qualify-lead
// PRESERVA decisão humana) e entrava no outreach automático. Em uat/dev o anon
// também tem policy de UPDATE (WITH CHECK true): o PATCH precisa da mesma trava.
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migDir = path.join(__dirname, '..', 'supabase', 'migrations');
const nome = fs.readdirSync(migDir).find((f) => f.endsWith('_form_submissions_anon_campos_servidor.sql'));
assert.ok(nome, 'migration da trava de mass-assignment sumiu');
const SQL = fs.readFileSync(path.join(migDir, nome), 'utf8');

// Colunas que decidem fila/outreach/gate — o anon NUNCA as define.
const CRITICAS = [
  'aprovacao_status', 'aprovacao_decidida_por', 'aprovacao_decidida_em',
  'qualification_classification', 'qualified', 'qualified_at',
  'whatsapp_sent_at', 'followup_1_sent_at', 'followup_2_sent_at',
  'scheduled_followup_at', 'scheduled_followup_sent_at', 'timing_status',
  'meeting_scheduled', 'meeting_scheduled_at', 'score_financeiro',
  'sheets_synced_at', 'deleted_at', 'submitted_at',
];

test('o INSERT anônimo zera as colunas que só o servidor escreve', () => {
  for (const col of CRITICAS) {
    assert.ok(SQL.includes(`'${col}',`), `coluna ${col} saiu da trava de mass-assignment`);
  }
  assert.match(SQL, /padrao := jsonb_build_object\(/);
  assert.match(SQL, /NEW := jsonb_populate_record\(NEW, padrao\);/);
});

test('o UPDATE anônimo mantém as colunas de servidor como estavam (uat/dev têm policy de UPDATE)', () => {
  const ramo = SQL.slice(SQL.indexOf("IF TG_OP = 'UPDATE' THEN"), SQL.indexOf('NEW := jsonb_populate_record'));
  assert.ok(ramo.length > 0, "ramo do UPDATE sumiu — PATCH anônimo voltaria a aprovar lead em uat/dev");
  assert.match(ramo, /antigo := to_jsonb\(OLD\);/, 'o UPDATE tem de restaurar do OLD, não zerar (apagaria a decisão humana)');
  assert.match(ramo, /jsonb_object_agg\(chave, antigo -> chave\)/);
  assert.match(ramo, /FROM jsonb_object_keys\(padrao\) AS chave/, 'a lista do UPDATE tem de ser a MESMA do INSERT');
  // Reenvio do formulário revive lead excluído (deleted_at: null), mas o anon
  // nunca exclui lead: só o NULL passa.
  assert.match(ramo, /NOT \(chave = 'deleted_at' AND to_jsonb\(NEW\) -> 'deleted_at' = 'null'::jsonb\)/);
});

test('a trava é só para o role anon, BEFORE INSERT OR UPDATE, nos 3 schemas', () => {
  assert.match(SQL, /IF current_user <> 'anon' THEN\s*\n\s*RETURN NEW;/, 'CFs/Engine não podem perder a escrita dessas colunas');
  for (const schema of ['public', 'uat', 'dev']) {
    assert.match(SQL, new RegExp(`BEFORE INSERT OR UPDATE ON ${schema}\\.form_submissions`), `trigger ausente em ${schema}`);
  }
});

test('o formulário público não envia nenhuma coluna travada (senão perderia dado)', () => {
  const form = fs.readFileSync(path.join(__dirname, '..', 'apps/web/src/components/forms/FormsPage.tsx'), 'utf8');
  const inicio = form.indexOf('const submissionData = {');
  const fim = form.indexOf('};', inicio);
  const payload = form.slice(inicio, fim);
  for (const col of CRITICAS.filter((c) => c !== 'deleted_at')) {
    assert.ok(!new RegExp(`\\b${col}:`).test(payload), `o formulário passou a enviar ${col} — revise a trava`);
  }
});

test('edge function legada form-handler (service role): whitelist + só insere (nunca sobrescreve lead)', () => {
  const fh = fs.readFileSync(path.join(__dirname, '..', 'supabase/functions/form-handler/index.ts'), 'utf8');
  assert.match(fh, /const CAMPOS_PERMITIDOS = new Set\(\[/, 'whitelist de campos sumiu (mass-assignment com service role)');
  assert.match(fh, /\.filter\(\(\[campo\]\) => CAMPOS_PERMITIDOS\.has\(campo\)\)/);
  // A validação de nascimento por RPC é travada em nascimento-banco-paridade.
  assert.match(
    fh,
    /onConflict: 'submission_id', ignoreDuplicates: true/,
    'upsert com service role sem ignoreDuplicates deixa a anon key sobrescrever lead existente',
  );
  const lista = fh.slice(fh.indexOf('const CAMPOS_PERMITIDOS'), fh.indexOf('])', fh.indexOf('const CAMPOS_PERMITIDOS')));
  for (const col of CRITICAS) {
    assert.ok(!lista.includes(`'${col}'`), `form-handler aceita ${col} — coluna só do servidor`);
  }
  // Paridade com o payload do formulário (exceto deleted_at, que só o upsert direto usa).
  const form = fs.readFileSync(path.join(__dirname, '..', 'apps/web/src/components/forms/FormsPage.tsx'), 'utf8');
  const ini = form.indexOf('const submissionData = {');
  const payload = form.slice(ini, form.indexOf('\n      };', ini));
  const chaves = [...payload.matchAll(/^\s{8}(\w+):/gm)].map((m) => m[1]).filter((k) => k !== 'deleted_at');
  assert.ok(chaves.length > 40, `não achei as chaves do payload (${chaves.length})`);
  for (const k of chaves) {
    assert.ok(lista.includes(`'${k}'`), `campo do formulário fora da whitelist do form-handler: ${k}`);
  }
});
