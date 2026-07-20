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

// ════════════════════════════════════════════════════════════════════════
// F5-PR2 — agents plugáveis nas CFs (automation-engine + chatbot-autonomo)
// REGRA DE OURO: fallback SEMPRE vivo — run/tick NUNCA quebra por agent
// ausente/inativo/sem capacidade. E o agent NUNCA vira porta de envio.
// ════════════════════════════════════════════════════════════════════════

const ENGINE_CF = path.join(ROOT, 'functions', 'automation-engine', 'index.js');
const CHATBOT_CF = path.join(ROOT, 'functions', 'chatbot-autonomo', 'index.js');
const MIGRATION_AGENT_CONVERSA = path.join(
  ROOT, 'supabase', 'migrations', '20260720044049_chatbot_autonomo_agent.sql',
);
const CHATBOT_ACTIONS = path.join(ROOT, 'apps', 'crm', 'src', 'lib', 'actions', 'chatbot-autonomo.ts');

/** Recorta um trecho [inicio, fim) por marcadores — falha se algum sumir. */
function slice(src, inicioMarker, fimMarker, contexto) {
  const inicio = src.indexOf(inicioMarker);
  assert.ok(inicio >= 0, `INVARIANTE VIOLADO: "${inicioMarker}" deve existir em ${contexto}.`);
  const fim = src.indexOf(fimMarker, inicio + inicioMarker.length);
  assert.ok(fim > inicio, `INVARIANTE VIOLADO: "${fimMarker}" deve existir após "${inicioMarker}" em ${contexto}.`);
  return src.slice(inicio, fim);
}

// ─── 4. automation-engine: agent plugável com fallback inline ────────────

test('automation-engine: resolveAgentPrompt filtra ativo+deleted_at+capacidade automacao', () => {
  const src = stripComments(read(ENGINE_CF));
  const helper = slice(src, 'const resolveAgentPrompt', 'const resolveNomesLead', 'automation-engine');
  assert.ok(
    helper.includes('capacidades=cs.') && helper.includes('automacao'),
    'INVARIANTE VIOLADO: a query do agent na engine deve filtrar a capacidade ' +
      '`automacao` (capacidades=cs.{automacao}) — senão um agent de outra ' +
      'superfície viraria prompt de automação.',
  );
  assert.ok(
    helper.includes('ativo=is.true'),
    'INVARIANTE VIOLADO: a query do agent na engine deve exigir ativo=is.true.',
  );
  assert.ok(
    helper.includes('deleted_at=is.null'),
    'INVARIANTE VIOLADO: a query do agent na engine deve excluir soft-deletados.',
  );
});

test('automation-engine: fallback inline VIVO (agentPrompt || p.prompt) + cache por tick', () => {
  const src = stripComments(read(ENGINE_CF));
  assert.ok(
    src.includes('agentPrompt || p.prompt'),
    'INVARIANTE VIOLADO: a ação ia_prompt deve cair no prompt INLINE quando o ' +
      'agent está indisponível (agentPrompt || p.prompt) — o run nunca quebra por agent.',
  );
  assert.ok(
    src.includes('|| passo.prompt'),
    'INVARIANTE VIOLADO: o gate ia_condicao deve cair no prompt INLINE do passo ' +
      '(resolveAgentPrompt(...) || passo.prompt) — fallback garantido.',
  );
  assert.ok(
    src.includes('agentCache'),
    'INVARIANTE VIOLADO: a resolução de agents deve usar o cache por tick ' +
      '(tickState.agentCache) — 1 lookup por agent por tick.',
  );
});

test('automation-engine: resolveAgentPrompt NUNCA referencia canais de envio', () => {
  const src = stripComments(read(ENGINE_CF));
  const helper = slice(src, 'const resolveAgentPrompt', 'const resolveNomesLead', 'automation-engine');
  assert.ok(
    !/SEND_WHATSAPP_URL|SEND_MESSAGES_URL|ZAPI|customMessage|customEmail/.test(helper),
    'INVARIANTE VIOLADO: resolveAgentPrompt só LÊ o prompt do agent — não pode ' +
      'referenciar nenhuma primitiva de envio (SEND_*/Z-API/custom*).',
  );
});

// ─── 5. chatbot-autonomo: agent substitui SÓ a persona; critério é GLOBAL ─

test('chatbot-autonomo: o critério de segurança segue GLOBAL (criterio: config.criterio)', () => {
  const src = stripComments(read(CHATBOT_CF));
  assert.ok(
    src.includes('criterio: config.criterio'),
    'INVARIANTE VIOLADO: a chamada classificarEGerar deve usar LITERALMENTE ' +
      '`criterio: config.criterio` — o agent muda COMO o bot fala (persona), ' +
      'NUNCA quando pode falar (critério de segurança é global e intocável).',
  );
});

test('chatbot-autonomo: resolveAgentPersona filtra ativo+deleted_at+capacidade chatbot_autonomo', () => {
  const src = stripComments(read(CHATBOT_CF));
  const helper = slice(src, 'const resolveAgentPersona', 'const resolveLead', 'chatbot-autonomo');
  assert.ok(
    helper.includes('capacidades=cs.') && helper.includes('chatbot_autonomo'),
    'INVARIANTE VIOLADO: a query do agent do chatbot deve filtrar a capacidade ' +
      '`chatbot_autonomo` — a mais sensível do sistema (a IA fala com o lead).',
  );
  assert.ok(
    helper.includes('ativo=is.true') && helper.includes('deleted_at=is.null'),
    'INVARIANTE VIOLADO: a query do agent do chatbot deve exigir ativo + não deletado.',
  );
});

test('chatbot-autonomo: fallback da persona VIVO (personaEfetiva = config.persona)', () => {
  const src = stripComments(read(CHATBOT_CF));
  assert.ok(
    src.includes('personaEfetiva = config.persona'),
    'INVARIANTE VIOLADO: a persona efetiva deve NASCER da persona padrão ' +
      '(personaEfetiva = config.persona) e só ser trocada com agent válido — ' +
      'agent indisponível nunca pode virar erro nem persona vazia.',
  );
});

test('chatbot-autonomo: a resolução do agent NUNCA toca no envio', () => {
  const src = stripComments(read(CHATBOT_CF));
  const helper = slice(src, 'const resolveAgentPersona', 'const resolveLead', 'chatbot-autonomo');
  const uso = slice(src, 'let personaEfetiva', 'classificarEGerar', 'chatbot-autonomo');
  for (const bloco of [helper, uso]) {
    assert.ok(
      !/enviarResposta|SEND_WHATSAPP_URL/.test(bloco),
      'INVARIANTE VIOLADO: a resolução do agent (helper e uso) não pode ' +
        'referenciar o envio ao lead (enviarResposta*/SEND_WHATSAPP_URL) — ' +
        'agent só troca a persona, nunca abre porta de envio.',
    );
  }
});

// ─── 6. Migration agent_id: coluna + audit trigger recriado ──────────────

test('migration chatbot_autonomo_agent: ADD COLUMN agent_id idempotente', () => {
  const sql = read(MIGRATION_AGENT_CONVERSA);
  assert.ok(
    sql.includes('ADD COLUMN IF NOT EXISTS agent_id'),
    'INVARIANTE VIOLADO: a migration deve adicionar agent_id com IF NOT EXISTS (idempotente).',
  );
});

test('migration chatbot_autonomo_agent: audit trigger recriado com agent_id', () => {
  const sql = read(MIGRATION_AGENT_CONVERSA);
  assert.ok(
    /UPDATE OF modo, atleta_id, agent_id/.test(sql),
    'INVARIANTE VIOLADO: o audit trigger da chatbot_autonomo_conversa deve ser ' +
      'recriado incluindo agent_id na lista UPDATE OF (mudança do CEO = trilha).',
  );
  assert.ok(
    /DROP TRIGGER IF EXISTS trg_audit_chatbot_conversa/.test(sql),
    'INVARIANTE VIOLADO: o trigger deve ser recriado via DROP IF EXISTS + CREATE.',
  );
  // uat/dev gateados pelas DUAS tabelas — a FK exige conversa E agents.
  assert.ok(
    /to_regclass\('uat\.chatbot_autonomo_conversa'\)[\s\S]*?to_regclass\('uat\.agents'\)/.test(sql),
    'INVARIANTE VIOLADO: o bloco UAT deve gatear por chatbot_autonomo_conversa E agents.',
  );
});

// ─── 7. Action setConversaAutonomoAgent: capacidade validada ANTES do upsert ─

test('setConversaAutonomoAgent: valida ativo+deleted_at+capacidade antes do upsert', () => {
  const src = stripComments(read(CHATBOT_ACTIONS));
  const fn = src.slice(src.indexOf('export async function setConversaAutonomoAgent'));
  assert.ok(
    fn.includes('.contains("capacidades", ["chatbot_autonomo"])'),
    'INVARIANTE VIOLADO: setConversaAutonomoAgent deve validar a capacidade ' +
      '`chatbot_autonomo` do agent antes de gravar.',
  );
  assert.ok(
    fn.includes('.eq("ativo", true)') && fn.includes('deleted_at'),
    'INVARIANTE VIOLADO: setConversaAutonomoAgent deve exigir agent ativo e não deletado.',
  );
  const idxValidacao = fn.indexOf('.contains("capacidades"');
  const idxUpsert = fn.indexOf('.upsert(');
  assert.ok(
    idxValidacao >= 0 && idxUpsert > idxValidacao,
    'INVARIANTE VIOLADO: a validação de capacidade deve vir ANTES do upsert.',
  );
});

// Sanidade: o guard detecta ausência de fato.
test('guard: detecta corretamente quando o filtro de capacidade está ausente', () => {
  const fake = 'supabase.from("agents").select("prompt").eq("id", agentId)';
  assert.equal(fake.includes('.contains("capacidades", ["conversa"])'), false);
});
