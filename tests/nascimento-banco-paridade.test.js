'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD — Data de nascimento: BANCO × front (T23, PR-09)
// ════════════════════════════════════════════════════════════════════════
//
// Trava supabase/migrations/*_form_submissions_validar_nascimento.sql e a
// validação por RPC no form-handler (a paridade front × classificador está em
// tests/nascimento-serie-paridade.test.js).
// Se o banco ficar MAIS estrito que o front, a família recebe erro no fim do
// formulário; por isso: mesma tabela, folga de faixa/fuso, trava só no INSERT
// do role anon, falha interna da validação NÃO derruba o envio e mensagens =
// chaves PT do front (traduzidas em en/es).
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (rel) => fs.readFileSync(path.join(raiz, rel), 'utf8');

const TS = ler('apps/web/src/lib/forms/nascimento.ts');
const FH = ler('supabase/functions/form-handler/index.ts');
const migDir = path.join(raiz, 'supabase', 'migrations');
const migNome = fs.readdirSync(migDir).find((f) => f.endsWith('_form_submissions_validar_nascimento.sql'));
assert.ok(migNome, 'migration da validação de nascimento sumiu');
const SQL = fs.readFileSync(path.join(migDir, migNome), 'utf8');

const SERIES = ['before_7th', '8th_grade', '9th_grade', 'hs_1st', 'hs_2nd', 'hs_3rd', 'graduated_last_year', 'graduated_2plus'];

// motivo do banco/RPC → chave do MSG_NASCIMENTO do front. `anoAtual` fica só
// no front: o banco cobre o mesmo caso pela faixa (idade 0 nunca é coerente).
const MOTIVO_BANCO_PARA_FRONT = {
  ausente: 'obrigatoria',
  formato: 'invalida',
  futuro: 'futuro',
  incoerente_serie: 'incoerente',
  fora_faixa: 'foraDaFaixa',
};

const corpoFuncao = (nome) => {
  const i = SQL.indexOf(`FUNCTION public.${nome}(`);
  assert.ok(i >= 0, `função ${nome} sumiu da migration`);
  const ini = SQL.indexOf('AS $$', i);
  return SQL.slice(ini, SQL.indexOf('$$;', ini + 5));
};

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
  const faixa = corpoFuncao('fs_faixa_idade_serie');
  const out = {};
  for (const m of faixa.matchAll(/WHEN '([\w]+)'\s+THEN ARRAY\[(\d+),\s*(\d+)\]/g)) {
    out[m[1]] = [Number(m[2]), Number(m[3])];
  }
  assert.match(faixa, /ELSE\s+NULL/, 'série desconhecida tem de devolver NULL (o chamador decide a absoluta)');
  const absoluta = corpoFuncao('fs_motivo_nascimento_invalido').match(/coalesce\(v_faixa_serie, ARRAY\[(\d+),\s*(\d+)\]\)/);
  assert.ok(absoluta, 'faixa absoluta (coalesce) sumiu do SQL');
  return { porSerie: out, absoluta: [Number(absoluta[1]), Number(absoluta[2])] };
};

const escapar = (txt) => txt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const msgFront = (chave) => {
  const m = TS.match(new RegExp(`\\b${chave}:\\s*\\n?\\s*"([^"]+)"`));
  assert.ok(m, `MSG_NASCIMENTO.${chave} sumiu do front`);
  return m[1];
};

test('a tabela série → faixa de idade do banco é IGUAL à do front', () => {
  const ts = tabelaTs();
  const sql = tabelaSql();
  for (const serie of SERIES) {
    assert.deepEqual(sql.porSerie[serie], ts.porSerie[serie], `banco diverge do front em ${serie}`);
  }
  assert.deepEqual(Object.keys(sql.porSerie).sort(), Object.keys(ts.porSerie).sort(), 'série a mais/a menos no banco');
  assert.deepEqual(sql.absoluta, ts.absoluta, 'faixa absoluta diverge (banco × front)');
});

test('o banco nunca é MAIS estrito que o front (folga de faixa e de fuso)', () => {
  const trg = corpoFuncao('fs_validar_nascimento_anon');
  assert.match(trg, /\(\(now\(\) AT TIME ZONE 'America\/Sao_Paulo'\)::date \+ 1\)/, 'referência = amanhã BRT (folga de fuso)');
  assert.match(trg, /^\s*1\s+-- folga de faixa/m, 'o trigger precisa chamar com folga de 1 ano');
  const motivo = corpoFuncao('fs_motivo_nascimento_invalido');
  assert.match(motivo, /v_idade < v_faixa\[1\] - v_folga OR v_idade > v_faixa\[2\] \+ v_folga/);
  // Sem série conhecida, o motivo é o mesmo do front (foraDaFaixa), não "série escolhida".
  assert.match(motivo, /CASE WHEN v_faixa_serie IS NULL THEN 'fora_faixa' ELSE 'incoerente_serie' END/);
  // Ano de 5 dígitos e cast ISO estrito, sem depender de DateStyle.
  assert.ok(motivo.includes("'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'"), 'formato ISO estrito sumiu');
});

test('a idade do banco é a mesma conta do front e não depende do TimeZone da sessão', () => {
  const motivo = corpoFuncao('fs_motivo_nascimento_invalido').replace(/--[^\n]*/g, '');
  // age(date, date) passa por timestamptz: em America/Sao_Paulo o aniversário de
  // quem nasceu no início do horário de verão saía 1 ano a menos.
  assert.doesNotMatch(motivo, /\bage\s*\(/, 'idade via age() depende do TimeZone da sessão');
  assert.doesNotMatch(motivo, /timestamptz|with time zone/i, 'a validação não pode passar por timestamptz');
  // calcularIdade do front: ano − ano − (ainda não fez aniversário no ano da referência).
  assert.match(TS, /ref\.mes < nasc\.mes \|\| \(ref\.mes === nasc\.mes && ref\.dia < nasc\.dia\)/, 'calcularIdade do front mudou: revisar a conta do banco');
  assert.match(
    motivo,
    /v_idade := extract\(year FROM p_ref\)::int - extract\(year FROM v_data\)::int\s*\n\s*- CASE WHEN \(extract\(month FROM p_ref\), extract\(day FROM p_ref\)\)\s*\n\s*< \(extract\(month FROM v_data\), extract\(day FROM v_data\)\)\s*\n\s*THEN 1 ELSE 0 END;/,
    'idade do banco ≠ calcularIdade do front',
  );
  assert.match(SQL, /fs_motivo_nascimento_invalido\([\s\S]*?\)\s*\nRETURNS text\s*\nLANGUAGE plpgsql\s*\nIMMUTABLE/, 'função pura: IMMUTABLE');
});

test('a trava do banco vale SÓ para o formulário público (role anon) e só no INSERT', () => {
  const trg = corpoFuncao('fs_validar_nascimento_anon');
  assert.match(trg, /IF current_user <> 'anon' THEN\s*\n\s*RETURN NEW;/, 'CF/Engine não podem ser travados por dado legado');
  for (const schema of ['public', 'uat', 'dev']) {
    assert.match(SQL, new RegExp(`BEFORE INSERT ON ${schema}\\.form_submissions`), `trigger ausente em ${schema}`);
  }
  // O upsert do formulário já passa pelo BEFORE INSERT; no UPDATE a trava só
  // pegaria PATCH em lead legado com data ruim.
  assert.doesNotMatch(SQL, /BEFORE INSERT OR UPDATE ON/, 'a trava de nascimento é só de INSERT');
  assert.doesNotMatch(SQL, /SECURITY DEFINER/, 'o trigger roda como anon (invoker)');
  assert.match(trg, /ERRCODE = '23514'/, 'check_violation → PostgREST devolve 400');
});

test('falha interna da validação aceita o envio com WARNING (nunca derruba a captura do lead)', () => {
  const trg = corpoFuncao('fs_validar_nascimento_anon');
  const bloco = trg.slice(trg.indexOf('BEGIN\n    v_motivo :='), trg.indexOf('IF v_motivo IS NOT NULL'));
  assert.ok(bloco.length > 0, 'chamada da validação fora do bloco protegido');
  assert.match(bloco, /EXCEPTION WHEN others THEN\s*\n\s*RAISE WARNING[\s\S]*RETURN NEW;\s*\n\s*END;/);
  // O RAISE do motivo fica FORA do bloco protegido (senão o próprio 23514 seria engolido).
  assert.doesNotMatch(bloco, /ERRCODE = '23514'/);
  // Sem EXECUTE para anon a trava desligaria (o fail-open aceitaria tudo).
  assert.match(SQL, /GRANT EXECUTE ON FUNCTION public\.fs_faixa_idade_serie\(text\) TO anon/);
  assert.match(SQL, /GRANT EXECUTE ON FUNCTION public\.fs_motivo_nascimento_invalido\(text, text, date, int\) TO anon/);
});

test('mensagens do banco = chaves PT do front, traduzidas em en/es', () => {
  const trg = corpoFuncao('fs_validar_nascimento_anon');
  for (const [motivo, chave] of Object.entries(MOTIVO_BANCO_PARA_FRONT)) {
    const msg = msgFront(chave);
    assert.match(trg, new RegExp(`WHEN '${motivo}'\\s+THEN '${escapar(msg)}'`), `trigger: mensagem de ${motivo} diverge do front (${chave})`);
    for (const idioma of ['pt', 'en', 'es']) {
      const tr = ler(`apps/web/src/i18n/translations/${idioma}.ts`);
      assert.ok(tr.includes(`"${msg}":`), `form.errors (${idioma}) sem a chave: ${msg}`);
    }
  }
  // Todo motivo que a função devolve tem mensagem própria (e nenhum sobra).
  const devolvidos = new Set([...corpoFuncao('fs_motivo_nascimento_invalido').matchAll(/(?:RETURN|THEN|ELSE) '([a-z_]+)'/g)]
    .map((m) => m[1]));
  assert.deepEqual([...devolvidos].sort(), Object.keys(MOTIVO_BANCO_PARA_FRONT).sort());
});

test('form-handler (service role) valida a data com A MESMA função e as MESMAS mensagens do banco', () => {
  assert.match(FH, /rpc\('fs_motivo_nascimento_invalido'/, 'form-handler deve usar a MESMA função do banco');
  assert.match(FH, /p_folga_anos: 1/, 'form-handler com a mesma folga do trigger');
  assert.match(FH, /timeZone: 'America\/Sao_Paulo'/, 'referência do form-handler = data em BRT');
  for (const [motivo, chave] of Object.entries(MOTIVO_BANCO_PARA_FRONT)) {
    const msg = msgFront(chave);
    assert.match(FH, new RegExp(`${motivo}:\\s*\\n?\\s*'${escapar(msg)}'`), `form-handler: mensagem de ${motivo} diverge do front`);
  }
  // Valida ANTES de gravar: a RPC vem antes do upsert.
  assert.ok(FH.indexOf("rpc('fs_motivo_nascimento_invalido'") < FH.indexOf(".from('form_submissions')"), 'validação depois da gravação');
  assert.doesNotMatch(FH, /console\.log\([^)]*formData\.email/, 'e-mail do lead não vai para o log');
});
