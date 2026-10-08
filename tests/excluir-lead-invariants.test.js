'use strict';

// Guard — Exclusão de lead atômica e idempotente (T1, vídeo do CEO 28/09).
//
// Bug (24/08 → 08/10): a cascata rodava no server action com o client do
// usuário; a RLS de atletas/deals (SELECT USING deleted_at IS NULL) barrava
// o próprio UPDATE do soft delete (42501). O erro era engolido, a tela dizia
// "excluído" e o card ficava (Vicente). A 2ª tentativa morria no CAS da
// form_submission ("Lead já estava excluído").
//
// Invariantes:
//   1. A cascata vive numa função SQL SECURITY DEFINER com search_path fixo
//      e gate de papel INTERNO fail-closed (IS DISTINCT FROM 'ceo' → 42501);
//      anon sem EXECUTE.
//   2. Idempotente: form_submission já excluída NÃO é erro — completa a
//      cascata. Pós-condição verificada; violação = RAISE (rollback total).
//   3. Soft delete SEMPRE: nenhum DELETE; grupos de WhatsApp desvinculados
//      (nunca apagados); cliente ativo (contrato/Experiência) é recusado.
//   4. Políticas de SELECT de atletas/deals NÃO são afrouxadas.
//   5. O server action só chama a função (nenhum UPDATE de cascata no
//      client do usuário) e o card só sai com o deal confirmado excluído.

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


const mig = lerMigration('_excluir_lead_atomico.sql');
const action = ler('apps', 'crm', 'src', 'lib', 'actions', 'leads-excluir.ts');
const board = ler('apps', 'crm', 'src', 'components', 'pipeline', 'PipelineBoard.tsx');
const tabela = ler('apps', 'crm', 'src', 'components', 'leads', 'LeadsTable.tsx');

// Só o código executável (sem comentários) — um comentário citando "DELETE"
// não pode mascarar nem disparar o guard.
const semComentariosSql = (sql) => sql.replace(/--[^\n]*/g, '');
const migCodigo = semComentariosSql(mig);

test('função: SECURITY DEFINER, search_path fixo e gate de papel fail-closed', () => {
  assert.match(migCodigo, /SECURITY DEFINER/, 'sem DEFINER a RLS barra o soft delete (o bug)');
  assert.match(migCodigo, /SET search_path = pg_catalog, public/, 'DEFINER sem search_path fixo é sequestrável');
  assert.match(migCodigo, /IF public\.get_user_papel\(\) IS DISTINCT FROM 'ceo' THEN\s*RAISE EXCEPTION '[^']+' USING ERRCODE = '42501'/,
    'gate de papel precisa ser interno e fail-closed (NULL = negado)');
  assert.match(migCodigo, /REVOKE EXECUTE ON FUNCTION %I\.excluir_lead\(uuid, uuid\) FROM PUBLIC, anon/,
    'anon (chave pública do site) não pode executar a função');
});

test('função: gate POR TABELA (uat/dev não têm atletas/deals)', () => {
  assert.match(migCodigo, /information_schema\.tables/, 'gate por schemata quebra o deploy (42P01)');
  for (const t of ['form_submissions', 'atletas', 'deals', 'whatsapp_grupos', 'tarefas', 'contratos_financeiros', 'crm_experiencia']) {
    assert.ok(migCodigo.includes(`'${t}'`), `gate não confere a tabela ${t}`);
  }
});

test('função: idempotente — form_submission já excluída completa a cascata', () => {
  assert.ok(!/Lead já estava excluído/.test(migCodigo), 'o erro "Lead já estava excluído" voltou — caso Vicente');
  assert.ok(!/error: "Lead já estava excluído/.test(action), 'a action voltou a abortar no lead já excluído');
  assert.match(migCodigo, /v_ja_excluido := v_fs_deleted_at IS NOT NULL/, 'estado "já excluído" deixou de ser detectado');
  // atletas recolhidos SEM filtro de deleted_at (repara cascata parcial)
  assert.match(migCodigo, /SELECT COALESCE\(array_agg\(a\.id\), ARRAY\[\]::uuid\[\]\) INTO v_atletas\s*FROM %1\$I\.atletas a WHERE a\.form_submission_id = v_fs_id;/,
    'atletas do lead precisam ser recolhidos vivos OU excluídos (reparo)');
  assert.match(migCodigo, /FOR UPDATE/, 'sem trava, duas abas duplicam a trilha');
});

test('função: soft delete sempre; grupos desvinculados; tarefas canceladas', () => {
  assert.ok(!/\bDELETE\s+FROM\b/i.test(migCodigo), 'exclusão de lead é SOFT DELETE — nunca DELETE');
  assert.match(migCodigo, /UPDATE %1\$I\.form_submissions SET deleted_at = v_agora/, 'soft delete da form_submission sumiu');
  assert.match(migCodigo, /UPDATE %1\$I\.deals SET deleted_at = v_agora/, 'soft delete dos deals sumiu');
  assert.match(migCodigo, /UPDATE %1\$I\.atletas SET deleted_at = v_agora/, 'soft delete dos atletas sumiu');
  const grupos = migCodigo.slice(migCodigo.indexOf('UPDATE %1$I.whatsapp_grupos'), migCodigo.indexOf('RETURNING g.id'));
  assert.match(grupos, /SET atleta_id\s*= CASE/, 'grupo deve ser DESVINCULADO');
  assert.ok(!/deleted_at/.test(grupos), 'grupo de WhatsApp guarda conversa real — nunca soft delete');
  assert.match(migCodigo, /UPDATE %1\$I\.tarefas t SET status = 'cancelada'/, 'tarefas abertas devem ser canceladas, não apagadas');
});

test('função: cliente ativo recusado; pós-condição aborta tudo; trilha com usuário', () => {
  assert.match(migCodigo, /'code', 'cliente_ativo'/, 'cliente com contrato/Experiência não pode ser excluído como lead');
  assert.match(migCodigo, /c\.deal_id = ANY \(v_deals\) AND c\.deleted_at IS NULL/, 'checagem de contrato vivo sumiu');
  assert.match(migCodigo, /RAISE EXCEPTION 'excluir_lead: pós-condição violada/, 'pós-condição sumiu — risco de meio excluído');
  assert.match(migCodigo, /set_config\('audit\.user_id', v_uid::text, true\)/,
    'contexto de audit na MESMA transação (RPC separado não persiste)');
  assert.match(migCodigo, /INSERT INTO public\.audit_logs/, 'form_submissions não tem trigger de audit — registro explícito obrigatório');
});

test('políticas de SELECT de atletas/deals NÃO foram afrouxadas', () => {
  assert.ok(!/(CREATE|ALTER|DROP) POLICY/i.test(migCodigo), 'esta migration não pode mexer em políticas');
  assert.ok(!/DISABLE ROW LEVEL SECURITY/i.test(migCodigo), 'nunca desligar RLS');
});

test('server action: só chama a função; sem cascata no client do usuário', () => {
  assert.equal((action.match(/\.rpc\("excluir_lead", alvo\)/g) ?? []).length, 1, 'chamada única da função');
  assert.match(action, /p_form_submission_id: formSubmissionId/, 'excluirLead deve chamar a função');
  assert.match(action, /p_deal_id: dealId/, 'excluirLeadPorDeal deve chamar a função');
  for (const t of ['form_submissions', 'atletas', 'deals']) {
    assert.ok(!new RegExp(`from\\("${t}"\\)[\\s\\S]{0,80}\\.update\\(`).test(action),
      `UPDATE em ${t} pelo client do usuário voltou — a RLS barra (o bug)`);
  }
  assert.equal((action.match(/getUserPapel\(\)\) !== "ceo"/g) ?? []).length, 2, 'gate CEO nas duas actions');
  assert.ok(!/success: true,\s*atletasExcluidos: 0/.test(action), 'sucesso silencioso com falha voltou');
});

test('UI: card/linha só saem com a exclusão confirmada; aviso vira toast.warning', () => {
  const handler = board.slice(board.indexOf('excluirLeadPorDeal(alvo.id)'), board.indexOf('Sim, excluir'));
  assert.match(handler, /if \(r\.dealAlvoExcluido !== true\)/, 'card só sai com o deal confirmado excluído');
  const iConfirma = handler.indexOf('r.dealAlvoExcluido !== true');
  const iRemove = handler.indexOf('setDeals((prev) => prev.filter((d) => d.id !== alvo.id))');
  assert.ok(iConfirma > 0 && iRemove > iConfirma, 'remoção do card antes da confirmação');
  assert.match(handler, /toast\.warning\(r\.aviso\)/, 'aviso da função deve aparecer');
  assert.match(board, /onExcluirDeal=\{podeEditarColunas \? setDealParaExcluir : undefined\}/,
    'lixeira só para CEO/CTO');
  assert.match(tabela, /toast\.warning\(r\.aviso\)/, 'LeadsTable deve mostrar o aviso');
});

test('automation-engine: lead excluído nunca recebe (template, WhatsApp custom e e-mail custom)', () => {
  const raw = ler('functions', 'automation-engine', 'index.js');
  const exec = raw.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  const n = exec.split('if (submission.deleted_at)').length - 1;
  assert.ok(n >= 3, `run materializado antes da exclusão enviaria mensagem (checagens: ${n}/3)`);
  const elig = exec.slice(exec.indexOf('const checkWhatsappEligibility'), exec.indexOf('const claimLeadColumn'));
  assert.match(elig, /if \(submission\.deleted_at\)/, 'checkWhatsappEligibility sem a checagem de excluído');
});

test('guard: detecta DELETE e cascata no client (auto-teste negativo)', () => {
  assert.ok(/\bDELETE\s+FROM\b/i.test(semComentariosSql('DELETE FROM public.deals WHERE id = x;')));
  assert.ok(!/\bDELETE\s+FROM\b/i.test(semComentariosSql('-- DELETE FROM nunca\nSELECT 1;')));
  assert.ok(/from\("deals"\)[\s\S]{0,80}\.update\(/.test('supabase.from("deals")\n  .update({ deleted_at: agora })'));
});
