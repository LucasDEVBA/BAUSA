'use strict';

// Teste de INTEGRAÇÃO da exclusão de lead (T1) — contra o banco REAL, como
// `authenticated` com JWT de CEO/CTO (mock não pega RLS: foi exatamente a RLS
// que quebrou a exclusão). Cada caso roda numa transação que TERMINA EM
// ROLLBACK (o runner recusa SQL sem rollback / com commit).
//
// OPT-IN: só roda com BAUSA_DB_INTEGRATION=1 + SUPABASE_ACCESS_TOKEN +
// SUPABASE_PROJECT_ID (no CI fica "skipped"). Ex.:
//   RAW=$(security find-generic-password -s "Supabase CLI" -w)
//   SUPABASE_ACCESS_TOKEN=$(echo "${RAW#go-keyring-base64:}" | base64 -d) \
//   SUPABASE_PROJECT_ID=nikrlikwghqcxcjzthmc BAUSA_DB_INTEGRATION=1 \
//   node --test tests/excluir-lead-integracao.test.js
//
// O runner prefixa a migration do PR (CREATE OR REPLACE dentro da transação)
// — testa o código novo antes do deploy e nada persiste.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');

// Migrations achadas pelo SUFIXO (PLANO.md §3): o timestamp pode ser
// re-carimbado na hora do merge — `supabase db push` sem --include-all exige
// versões crescentes — e o guard não pode depender do número.
const lerMigration = (sufixo) => {
  const dir = path.join(raiz, 'supabase', 'migrations');
  const achadas = fs.readdirSync(dir).filter((n) => n.endsWith(sufixo));
  if (achadas.length !== 1) {
    throw new Error(`esperava exatamente 1 migration *${sufixo}, achei ${achadas.length}`);
  }
  return fs.readFileSync(path.join(dir, achadas[0]), 'utf8');
};

const MIGRATION = lerMigration('_excluir_lead_atomico.sql');

const token = process.env.SUPABASE_ACCESS_TOKEN;
const projeto = process.env.SUPABASE_PROJECT_ID;
const habilitado = process.env.BAUSA_DB_INTEGRATION === '1' && Boolean(token) && Boolean(projeto);
const TIMEOUT_MS = 30_000;

async function rodarEmRollback(arquivoCaso) {
  const caso = ler('tests', 'sql', arquivoCaso);
  // Trava de segurança: nunca persistir nada no banco real.
  assert.match(caso.trim(), /rollback;$/i, `${arquivoCaso} precisa terminar em ROLLBACK`);
  assert.ok(!/\bcommit\b/i.test(caso), `${arquivoCaso} não pode conter COMMIT`);
  const query = `begin;\n${MIGRATION}\n${caso}`;
  // A trava vale para o SQL INTEIRO enviado (migration + caso), não só o caso.
  assert.ok(!/\bcommit\b/i.test(query), 'o SQL enviado ao banco real não pode conter COMMIT');
  assert.match(query.trim(), /rollback;$/i, 'o SQL enviado ao banco real precisa terminar em ROLLBACK');
  const resp = await fetch(`https://api.supabase.com/v1/projects/${projeto}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const corpo = await resp.json();
  return { ok: resp.ok && Array.isArray(corpo), corpo };
}

test('CEO exclui lead meio-excluído pelo card: cascata completa, idempotente, grupo desvinculado, audit com usuário',
  { skip: !habilitado && 'opt-in (BAUSA_DB_INTEGRATION=1)' }, async () => {
    const { ok, corpo } = await rodarEmRollback('excluir-lead.rollback.sql');
    assert.ok(ok, `falhou: ${JSON.stringify(corpo)}`);
    const r = corpo[0].resultado;
    assert.equal(r.r1.success, true);
    assert.equal(r.r1.ja_excluido, true, 'fs já excluída não pode virar erro "Lead já estava excluído"');
    assert.equal(r.r1.deals_excluidos, 1);
    assert.equal(r.r1.atletas_excluidos, 1);
    assert.equal(r.r1.deal_alvo_excluido, true, 'o card só sai quando o deal está confirmadamente excluído');
    assert.equal(r.r1.grupos_desvinculados, 1);
    assert.equal(r.r2.success, true, '2ª aba: sucesso idempotente');
    assert.equal(r.r2.deals_excluidos, 0);
    assert.equal(r.r3.success, true, 'pela form_submission (LeadsTable) também idempotente');
    assert.equal(r.deal_excluido, true);
    assert.equal(r.atleta_excluido, true);
    assert.equal(r.atletas_vivos_com_fs_excluida, 0);
    assert.equal(r.grupo.existe, true, 'grupo de WhatsApp NUNCA é apagado');
    assert.equal(r.grupo.atleta_id, null, 'grupo deve ser desvinculado');
    assert.equal(r.grupo.deleted_at, null);
    assert.equal(r.ceo_ve_deal_excluido, 0, 'RLS de SELECT intacta: CEO não vê o deal excluído');
    assert.ok(r.audit_com_usuario >= 3, 'trilha de audit com o usuário real (deals, atletas, form_submission)');
  });

for (const [arquivo, descricao] of [
  ['excluir-lead.negado-head.sql', 'Head chamando a função direto'],
  ['excluir-lead.negado-anon.sql', 'anon chamando a função direto'],
  ['excluir-lead.rls-intacta.sql', 'UPDATE direto como CEO (políticas não foram afrouxadas)'],
]) {
  test(`${descricao} → 42501, nada muda`, { skip: !habilitado && 'opt-in (BAUSA_DB_INTEGRATION=1)' }, async () => {
    const { ok, corpo } = await rodarEmRollback(arquivo);
    assert.equal(ok, false, 'deveria ter falhado');
    assert.match(JSON.stringify(corpo), /42501/);
  });
}
