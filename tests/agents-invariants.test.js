'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD DE INVARIANTE — Plataforma de Agents (tabela agents + CRUD + análise)
// ════════════════════════════════════════════════════════════════════════
//
// Os agents CUSTOM plugam nas superfícies de IA do Engine. Invariantes que um
// refactor não pode quebrar, verificados estaticamente:
//
//   1. As actions de agents (agents.ts) e do analista (agents-analise.ts) são
//      CEO-gated e NUNCA enviam nada — sem /api/whatsapp/send, sem SEND_*/
//      Z-API, sem fetch. Agent configura/analisa; quem envia é o humano/CF.
//   2. O copiloto de conversa (chatbot-sugestao.ts) só usa agent ATIVO, não
//      soft-deletado e COM a capacidade `conversa` — e o fallback para a
//      persona padrão (CHATBOT_PERSONA_DEFAULT) continua VIVO (agent
//      indisponível nunca pode virar erro nem persona vazia).
//   3. A migration da tabela agents mantém as policies (select ceo+head,
//      escrita ceo, service_role), a auditoria completa, o soft delete e o
//      CHECK do domínio de capacidades.
//
// Execução local:  node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const AGENTS = path.join(ROOT, 'apps', 'crm', 'src', 'lib', 'actions', 'agents.ts');
const ANALISE = path.join(ROOT, 'apps', 'crm', 'src', 'lib', 'actions', 'agents-analise.ts');
const CHATBOT = path.join(ROOT, 'apps', 'crm', 'src', 'lib', 'actions', 'chatbot-sugestao.ts');
const MIGRATION = path.join(ROOT, 'supabase', 'migrations', '20260720034516_agents_plataforma.sql');

function read(file) {
  assert.ok(fs.existsSync(file), `Arquivo não encontrado: ${file}`);
  return fs.readFileSync(file, 'utf8');
}

/** Fonte sem comentários (bloco e linha) — o guard checa código executável. */
function stripComments(raw) {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

// ─── 1. agents.ts + agents-analise.ts: CEO-gated e NUNCA enviam ──────────

for (const [nome, file] of [
  ['agents', AGENTS],
  ['agents-analise', ANALISE],
]) {
  test(`${nome}: toda mutação/análise é gated por papel CEO`, () => {
    const src = stripComments(read(file));
    // Aceita o gate nas duas formas: `papel === "ceo"` ou o early-return `!== "ceo"`.
    assert.match(
      src,
      /getUserPapel\(\)[\s\S]{0,40}[!=]== "ceo"/,
      `INVARIANTE VIOLADO: ${nome}.ts deve conter o gate explícito de papel CEO (getUserPapel).`,
    );
  });

  test(`${nome}: NUNCA envia (sem /api/whatsapp/send)`, () => {
    const src = stripComments(read(file));
    assert.ok(
      !src.includes('/api/whatsapp/send'),
      `INVARIANTE VIOLADO: ${nome}.ts não pode chamar /api/whatsapp/send.`,
    );
  });

  test(`${nome}: NUNCA envia (sem SEND_*/Z-API/primitivas de envio)`, () => {
    const src = stripComments(read(file));
    assert.ok(
      !/SEND_|send-text|zapiRequest|sendWhatsApp/i.test(src),
      `INVARIANTE VIOLADO: ${nome}.ts não pode disparar envio (SEND_*/Z-API).`,
    );
  });

  test(`${nome}: NUNCA envia (sem fetch)`, () => {
    const src = stripComments(read(file));
    assert.ok(
      !/\bfetch\(/.test(src),
      `INVARIANTE VIOLADO: ${nome}.ts não faz fetch — só Supabase/Gemini via libs.`,
    );
  });
}

// ─── 2. chatbot-sugestao.ts: agent gateado + fallback padrão VIVO ────────

test('chatbot-sugestao: agent de conversa exige a capacidade `conversa`', () => {
  const src = stripComments(read(CHATBOT));
  assert.ok(
    src.includes('.contains("capacidades", ["conversa"])'),
    'INVARIANTE VIOLADO: a query do agent deve filtrar a capacidade `conversa` ' +
      '(senão um agent de análise/autônomo viraria persona do copiloto).',
  );
});

test('chatbot-sugestao: agent só entra se ATIVO e não soft-deletado', () => {
  const src = stripComments(read(CHATBOT));
  assert.ok(
    src.includes('.eq("ativo", true)'),
    'INVARIANTE VIOLADO: a query do agent deve filtrar ativo = true.',
  );
  assert.ok(
    src.includes('deleted_at'),
    'INVARIANTE VIOLADO: a query do agent deve excluir soft-deletados (deleted_at).',
  );
});

test('chatbot-sugestao: o fallback para a persona padrão continua VIVO', () => {
  const src = stripComments(read(CHATBOT));
  assert.ok(
    src.includes('CHATBOT_PERSONA_DEFAULT'),
    'INVARIANTE VIOLADO: agent indisponível deve cair SILENCIOSAMENTE na cadeia ' +
      'de persona padrão (CHATBOT_PERSONA_DEFAULT) — nunca erro, nunca persona vazia.',
  );
});

// ─── 3. Migration: RLS + auditoria + soft delete + domínio ───────────────

test('migration agents: SELECT para ceo+head; escrita só ceo; service_role', () => {
  const sql = read(MIGRATION);
  const selectPolicy = sql.match(/CREATE POLICY "agents_select"[\s\S]*?;/);
  assert.ok(selectPolicy, 'a policy agents_select deve existir');
  assert.ok(
    /head_sucesso/.test(selectPolicy[0]),
    'INVARIANTE VIOLADO: o SELECT deve incluir head_sucesso (o Head usa o copiloto de grupo).',
  );
  const insertPolicy = sql.match(/CREATE POLICY "agents_insert"[\s\S]*?;/);
  assert.ok(insertPolicy, 'a policy agents_insert deve existir');
  assert.ok(
    /get_user_papel\(\) = 'ceo'/.test(insertPolicy[0]),
    'INVARIANTE VIOLADO: INSERT deve ser CEO-only.',
  );
  const updatePolicy = sql.match(/CREATE POLICY "agents_update"[\s\S]*?;/);
  assert.ok(updatePolicy, 'a policy agents_update deve existir');
  assert.ok(
    /get_user_papel\(\) = 'ceo'/.test(updatePolicy[0]),
    'INVARIANTE VIOLADO: UPDATE deve ser CEO-only.',
  );
  assert.ok(
    sql.includes('"agents_service"'),
    'a policy agents_service (service_role) deve existir.',
  );
});

test('migration agents: SEM policy de DELETE (exclusão é soft, via UPDATE)', () => {
  const sql = read(MIGRATION);
  assert.ok(
    !/CREATE POLICY[^;]*FOR DELETE/i.test(sql),
    'INVARIANTE VIOLADO: não pode haver policy de DELETE — exclusão é soft ' +
      '({deleted_at, ativo=false}) coberta pela policy de UPDATE do CEO.',
  );
});

test('migration agents: auditoria completa via audit.log_change', () => {
  const sql = read(MIGRATION);
  assert.ok(
    /AFTER INSERT OR DELETE OR UPDATE ON public\.agents[\s\S]*?audit\.log_change/.test(sql),
    'INVARIANTE VIOLADO: a tabela agents deve ter o trigger de auditoria COMPLETO ' +
      '(AFTER INSERT OR DELETE OR UPDATE → audit.log_change).',
  );
});

test('migration agents: soft delete (deleted_at) presente', () => {
  const sql = read(MIGRATION);
  assert.ok(
    sql.includes('deleted_at'),
    'INVARIANTE VIOLADO: a tabela agents deve ter a coluna deleted_at (soft delete).',
  );
});

test('migration agents: CHECK do domínio de capacidades', () => {
  const sql = read(MIGRATION);
  assert.ok(
    /capacidades\s+TEXT\[\]\s+NOT NULL CHECK/.test(sql),
    'INVARIANTE VIOLADO: capacidades deve ser TEXT[] NOT NULL com CHECK.',
  );
  for (const cap of ['conversa', 'automacao', 'analise', 'chatbot_autonomo']) {
    assert.ok(
      sql.includes(`'${cap}'`),
      `INVARIANTE VIOLADO: o CHECK de capacidades deve incluir '${cap}'.`,
    );
  }
  assert.ok(
    // cardinality (NÃO array_length): array_length('{}',1) devolve NULL e o
    // CHECK passa com NULL — array vazio entraria no banco (achado da revisão).
    /cardinality\(capacidades\)\s*>=\s*1/.test(sql),
    'INVARIANTE VIOLADO: o CHECK deve exigir pelo menos 1 capacidade.',
  );
});

// Sanidade: o guard detecta ausência de fato.
test('guard: detecta corretamente quando o filtro de capacidade está ausente', () => {
  const fake = 'supabase.from("agents").select("prompt").eq("id", agentId)';
  assert.equal(fake.includes('.contains("capacidades", ["conversa"])'), false);
});
