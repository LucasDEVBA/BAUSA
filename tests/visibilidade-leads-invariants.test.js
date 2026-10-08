'use strict';

// Guard — Visibilidade de leads (T7/T8/T13, vídeos do CEO de 28/09):
// "suspeito que não tá todos aqui".
//
// Três bugs da MESMA classe — corte silencioso antes do filtro:
//   T7  coluna Frios: .limit(80) ANTES de excluir quem tem deal (filtro no
//       Node) → 114 de 194 FRIOs sumiam do board e da busca.
//   T8  /leads: select("*") sem paginação → o PostgREST corta em
//       max_rows=1000 em silêncio (909 ativos em 08/10).
//   T13 busca do Pipeline só no navegador → INVALIDO, reprovado e fora da
//       janela não apareciam em lugar nenhum.
//
// Invariantes:
//   1. Recortes no BANCO (view vw_cadastros_situacao, security_invoker),
//      sempre com count exact + range; nada de limit antes de filtro.
//   2. A regra "onde o lead está" (localizarCadastroCore) espelha o board —
//      testada por COMPORTAMENTO (corpo executado, não regex).
//   3. Busca só LÊ, só CEO/CTO, sem e-mail/telefone no retorno e sem o termo
//      no log; o termo nunca chega cru à sintaxe do .or() do PostgREST.
//   4. Nada novo no caminho de ESCRITA do form_submissions (sem índice de
//      expressão nem trigger) — captação de lead não pode quebrar por busca.

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

const crm = (...p) => ler('apps', 'crm', 'src', ...p);

const migSrc = lerMigration('_vw_cadastros_situacao.sql');
const revisaoSrc = crm('lib', 'revisao-leads.ts');
const leadsSrc = crm('lib', 'actions', 'leads.ts');
const buscaSrc = crm('lib', 'actions', 'leads-busca.ts');
const listaSrc = crm('lib', 'leads-lista.ts');
const paginacaoSrc = crm('lib', 'supabase-paginacao.ts');
const leadsPageSrc = crm('app', '(dashboard)', 'leads', 'page.tsx');
const tabelaSrc = crm('components', 'leads', 'LeadsTable.tsx');
const boardSrc = crm('components', 'pipeline', 'PipelineBoard.tsx');
const pipelinePageSrc = crm('app', '(dashboard)', 'pipeline', 'page.tsx');

/** Executa o corpo marcado "guard:corpo-js" de uma função de revisao-leads.ts. */
function extrair(nome, params) {
  const ini = revisaoSrc.indexOf(`export function ${nome}(`);
  assert.ok(ini >= 0, `${nome} sumiu de revisao-leads.ts — atualize este guard`);
  const a = revisaoSrc.indexOf('// guard:corpo-js-inicio', ini);
  const b = revisaoSrc.indexOf('// guard:corpo-js-fim', a);
  assert.ok(a > ini && b > a, `marcadores guard:corpo-js ausentes em ${nome}`);
  // eslint-disable-next-line no-new-func
  return new Function(...params, revisaoSrc.slice(a, b));
}

// ─── 1. Migration ─────────────────────────────────────────────────────────

test('view de situação: RLS de quem consulta, sem anon, sem excluídos', () => {
  assert.match(migSrc, /WITH \(security_invoker = true\)/, 'view sem security_invoker vira bypass de RLS');
  assert.match(migSrc, /REVOKE ALL ON %I\.vw_cadastros_situacao FROM PUBLIC, anon, authenticated/,
    'anon não pode ler a view; authenticated só SELECT (default privileges do Supabase dariam ALL)');
  assert.match(migSrc, /GRANT SELECT ON %I\.vw_cadastros_situacao TO authenticated, service_role/);
  assert.match(migSrc, /WHERE fs\.deleted_at IS NULL/, 'excluído (soft delete) não pode aparecer em busca/lista');
  assert.match(migSrc, /at\.deleted_at IS NULL/, 'atleta excluído não pode contar');
  assert.match(migSrc, /dl\.deleted_at IS NULL/, 'deal excluído não pode contar como ativo');
  assert.match(migSrc, /to_regclass\(format\('%I\.atletas', s\)\) IS NULL/,
    'gate POR TABELA sumiu — uat/dev não têm atletas/deals (deploy quebraria com 42P01)');
});

test('busca sem acento: unaccent em extensions, função STABLE com search_path vazio', () => {
  assert.match(migSrc, /CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions/);
  const fn = migSrc.slice(migSrc.indexOf('CREATE OR REPLACE FUNCTION public.f_normalizar_busca'));
  assert.match(fn, /STABLE/, 'f_normalizar_busca deve ser STABLE (dicionário do unaccent pode mudar)');
  assert.match(fn, /SET search_path = ''/, 'search_path mutável em função de busca');
  assert.match(fn, /extensions\.unaccent\('extensions\.unaccent'::regdictionary/, 'unaccent não qualificado');
});

test('nada novo no caminho de escrita do form_submissions', () => {
  assert.ok(!/CREATE (UNIQUE )?INDEX[^;]*form_submissions/i.test(migSrc),
    'índice em form_submissions: erro na função derrubaria INSERT do formulário público');
  assert.ok(!/CREATE TRIGGER/i.test(migSrc), 'migration de visibilidade não pode criar trigger');
  assert.ok(!/ALTER TABLE/i.test(migSrc), 'migration de visibilidade é só view/função (aditiva)');
});

// ─── 2. Onde o lead está (comportamento) ──────────────────────────────────

test('localizarCadastroCore espelha as regras do board', () => {
  const localizar = extrair('localizarCadastroCore', ['f', 'agoraMs', 'janelaFriosDias', 'janelaIncompletosDias']);
  const agora = Date.parse('2026-10-08T12:00:00Z');
  const dia = 86400000;
  const base = {
    qualification_classification: 'FRIO', aprovacao_status: null,
    submitted_at: new Date(agora - 10 * dia).toISOString(),
    deal_id: null, deal_etapa: null, deal_motivo_perda: null,
  };
  const tipo = (patch) => localizar({ ...base, ...patch }, agora, 90, 90).tipo;

  assert.equal(tipo({}), 'coluna_frios');
  assert.equal(tipo({ submitted_at: new Date(agora - 90 * dia).toISOString() }), 'coluna_frios', 'limite de 90 dias inclusivo');
  assert.equal(tipo({ submitted_at: new Date(agora - 91 * dia).toISOString() }), 'fora_janela');
  assert.equal(tipo({ qualification_classification: 'INCOMPLETO' }), 'coluna_incompletos');
  assert.equal(tipo({ qualification_classification: 'INCOMPLETO', submitted_at: '2026-01-01T00:00:00Z' }), 'fora_janela');
  assert.equal(tipo({ qualification_classification: 'INVALIDO' }), 'fora_invalido');
  assert.equal(tipo({ aprovacao_status: 'reprovado' }), 'fora_reprovado');
  assert.equal(tipo({ qualification_classification: 'MORNO', aprovacao_status: 'pendente' }), 'coluna_aprovacao');
  assert.equal(tipo({ qualification_classification: 'FRIO', aprovacao_status: 'pendente' }), 'fora_pendente_classe',
    'fila só aceita QUENTE/MORNO');
  assert.equal(tipo({ qualification_classification: 'QUENTE', aprovacao_status: 'aprovado' }), 'fora_aprovado_sem_deal');
  assert.equal(tipo({ qualification_classification: null }), 'fora_sem_classificacao');
  assert.equal(tipo({ qualification_classification: 'MORNO' }), 'fora_sem_decisao');
  // Com deal ativo
  const comDeal = { deal_id: 'd1', deal_etapa: 'reuniao_marcada' };
  assert.equal(tipo({ ...comDeal, qualification_classification: 'QUENTE', aprovacao_status: 'aprovado' }), 'board_deal');
  assert.equal(tipo({ ...comDeal, aprovacao_status: 'reprovado' }), 'board_deal', 'deal ativo aparece no board mesmo reprovado');
  assert.equal(tipo({ ...comDeal, qualification_classification: 'MORNO', aprovacao_status: 'pendente' }), 'coluna_aprovacao',
    'deal de pendente fica SUSPENSO — o lead aparece na fila');
  assert.equal(tipo({ ...comDeal, aprovacao_status: 'pendente' }), 'fora_deal_suspenso');
  assert.equal(tipo({ deal_id: 'd1', deal_etapa: 'perdido', deal_motivo_perda: 'timing', aprovacao_status: 'aprovado' }),
    'fora_perdido_timing', 'perdido por timing não aparece no Kanban');
  assert.equal(tipo({ deal_id: 'd1', deal_etapa: 'perdido', deal_motivo_perda: 'preco', aprovacao_status: 'pendente' }),
    'board_deal', 'etapa final nunca é suspensa');
  assert.equal(tipo({ deal_id: 'd1', deal_etapa: 'cancelamento_solicitado', aprovacao_status: 'aprovado' }),
    'fora_kanban_cancelamento', 'Kanban não tem coluna de cancelamento (só a Tabela)');
  // Revisão 08/10: a coluna Aguardando aprovação lista TODO pendente QUENTE/MORNO,
  // com ou sem deal — inclusive com deal perdido por timing (oculto do Kanban).
  assert.equal(tipo({ deal_id: 'd1', deal_etapa: 'perdido', deal_motivo_perda: 'timing',
    qualification_classification: 'MORNO', aprovacao_status: 'pendente' }), 'coluna_aprovacao',
    'pendente QUENTE/MORNO está na coluna da fila mesmo com deal perdido por timing');
  assert.equal(localizar({ ...base }, agora, 90, 90).noBoard, true);
  assert.equal(localizar({ ...base, qualification_classification: 'INVALIDO' }, agora, 90, 90).noBoard, false);
});

test('board e busca usam a MESMA janela de 90 dias', () => {
  assert.match(buscaSrc, /localizarCadastroCore\(r, agora, FRIOS_REVISAO_DIAS, INCOMPLETOS_REVISAO_DIAS\)/);
  assert.match(leadsSrc, /paginaCardsRevisao<LeadFrioCard>\("FRIO", FRIOS_REVISAO_DIAS/);
});

// ─── 3. Busca: normalização e filtro seguro ───────────────────────────────

test('termo normalizado igual ao SQL (lower + sem acento)', () => {
  const normalizar = extrair('normalizarTermoBusca', ['texto']);
  assert.equal(normalizar('  JOÃO  Çé  Müller '), 'joao ce muller');
});

test('montarFiltroBusca: tokens em AND, telefone por dígitos, sem injeção no .or()', () => {
  const montar = extrair('montarFiltroBusca', ['termo', 'minimo']);
  assert.equal(montar('Clára Bezerra', 3),
    'and(busca_texto.like."*clara*",busca_texto.like."*bezerra*")');
  assert.equal(montar('(71) 9914-6156', 3), 'busca_telefone.like."*7199146156*"', 'telefone busca só nos telefones');
  assert.equal(montar('ab', 3), null, 'abaixo do mínimo não busca');
  // Revisão 08/10: caractere especial SEPARA (não some) — "D'Ávila" acha "d'avila"
  assert.equal(montar("D'Ávila", 3), 'and(busca_texto.like."*d*",busca_texto.like."*avila*")',
    'apóstrofo colava os pedaços ("davila") e o nome nunca casava');
  // dígitos de e-mail não viram busca de telefone; token só numérico casa os dois
  assert.equal(montar('ana2008@gmail.com', 3), 'busca_texto.like."*ana2008@gmail.com*"');
  assert.equal(montar('maria 7199', 3),
    'and(busca_texto.like."*maria*",or(busca_texto.like."*7199*",busca_telefone.like."*7199*"))',
    'termo misto: o nome continua obrigatório (antes virava OR solto com o telefone)');
  assert.equal(montar('123', 3), null, 'telefone com menos de 4 dígitos não busca (nada de .or(""))');
  for (const hostil of ['x"),email.eq.*', 'a,b(c)d', "o'neil*%"]) {
    const f = montar(hostil, 3);
    // Valor do usuário só aparece entre aspas e sem os caracteres de sintaxe
    const valores = (f ?? '').match(/"\*([^"]*)\*"/g) ?? [];
    for (const v of valores) assert.ok(!/[,()"'%]/.test(v.slice(2, -2)), `caractere de sintaxe vazou: ${v}`);
  }
});

test('colunas de revisão: reunião detectada primeiro', () => {
  const comparar = extrair('compararRevisao', ['a', 'b', 'maisRecentePrimeiro']);
  const itens = [
    { id: 'a', meeting_scheduled: false, submitted_at: '2026-09-02T00:00:00Z' },
    { id: 'b', meeting_scheduled: true, submitted_at: '2026-01-01T00:00:00Z' },
    { id: 'c', meeting_scheduled: null, submitted_at: '2026-09-03T00:00:00Z' },
  ];
  assert.deepEqual([...itens].sort((x, y) => comparar(x, y, true)).map((i) => i.id), ['b', 'c', 'a']);
  assert.deepEqual([...itens].sort((x, y) => comparar(x, y, false)).map((i) => i.id), ['b', 'a', 'c']);
});

// ─── 4. Actions: gate, só leitura, sem PII ────────────────────────────────

test('busca/dossiê/export: só CEO/CTO e só leitura', () => {
  for (const nome of ['buscarCadastrosPipeline', 'obterLeadDossie', 'exportarLeadsCsv']) {
    const ini = buscaSrc.indexOf(`export async function ${nome}`);
    assert.ok(ini >= 0, `${nome} sumiu`);
    const corpo = buscaSrc.slice(ini, ini + 400);
    assert.match(corpo, /getUserPapel\(\)\) !== "ceo"/, `${nome} sem gate CEO (use server = endpoint público)`);
  }
  for (const src of [buscaSrc, listaSrc]) {
    assert.ok(!/\.(update|insert|upsert|delete)\(/.test(src), 'busca/lista não podem escrever no banco');
  }
});

test('busca não devolve e-mail/telefone e não loga o termo', () => {
  const cols = buscaSrc.slice(buscaSrc.indexOf('const COLUNAS_BUSCA_PIPELINE'), buscaSrc.indexOf('export interface CadastroEncontrado'));
  assert.ok(!/email|whatsapp|busca_telefone|busca_texto/.test(cols), 'busca devolveria PII ao navegador');
  assert.match(buscaSrc, /\.limit\(BUSCA_PIPELINE_LIMITE\)/, 'busca sem teto');
  assert.match(revisaoSrc, /export const BUSCA_PIPELINE_LIMITE = 20;/);
  const iniLog = buscaSrc.indexOf('action: "buscar_cadastros_pipeline",\n    usuarioId');
  assert.ok(iniLog >= 0, 'log de auditoria da busca (com usuarioId) sumiu — T13 pede busca auditada');
  const log = buscaSrc.slice(iniLog, iniLog + 300);
  assert.match(log, /termoTamanho: parsed\.data\.length/);
  assert.ok(!/termo: |parsed\.data[,\n]/.test(log), 'termo (pode ser e-mail/telefone) não pode ir para o log');
});

test('colunas de revisão: count exact + range + reunião no topo + lead garantido no modal', () => {
  const consulta = leadsSrc.slice(leadsSrc.indexOf('function consultarRevisao('), leadsSrc.indexOf('async function paginaCardsRevisao'));
  assert.match(consulta, /\.order\("meeting_scheduled", \{ ascending: false, nullsFirst: false \}\)/);
  const cards = leadsSrc.slice(leadsSrc.indexOf('async function paginaCardsRevisao'), leadsSrc.indexOf('async function paginaDetalheRevisao'));
  assert.match(cards, /consultarRevisao\(supabase, classe, dias, COLUNAS_CARD_REVISAO, true\)\s*\.range\(/);
  const detalhe = leadsSrc.slice(leadsSrc.indexOf('async function paginaDetalheRevisao'), leadsSrc.indexOf('export async function listarLeadsFriosCards'));
  assert.match(detalhe, /garantirId && !ids\.includes\(garantirId\)/,
    'card do "Mostrar mais" abriria o modal no lead errado');
  assert.match(detalhe, /UUID_RE\.test\(opts\.garantirId\)/, 'garantirId do client chega ao filtro sem validar');
  assert.match(cards, /paginacaoSegura\(opts, REVISAO_PAGINA\)/, 'offset/limite do client sem validação');
  assert.match(revisaoSrc, /export const LIMITE_MAXIMO_PAGINA = 1000;/, 'limite acima do max_rows cortaria em silêncio');
  const pend = leadsSrc.slice(leadsSrc.indexOf('export async function listarLeadsPendentesCards'), leadsSrc.indexOf('export interface LeadFrioCard'));
  assert.match(pend, /\{ count: "exact" \}/);
  assert.match(pend, /paginacaoSegura\(opts, PENDENTES_PAGINA\)/, 'offset/limite do client sem validação');
  assert.match(pend, /\.range\(offset, offset \+ limite - 1\)/);
  assert.match(pend, /\.in\("qualification_classification", \["QUENTE", "MORNO"\]\)/, 'fila relaxou o filtro de classe');
  // função síncrona: builder do PostgREST é thenable — async o executaria no await
  assert.match(leadsSrc, /\nfunction consultarRevisao\(/, 'consultarRevisao não pode ser async (builder thenable)');
});

// ─── 5. /leads paginada no servidor ───────────────────────────────────────

test('/leads: gate CEO, sem select(*), página por range, KPIs por head count', () => {
  assert.match(leadsPageSrc, /await requirePapel\("ceo"\)/, 'telefone/e-mail de lead só para nível CEO');
  for (const src of [leadsPageSrc, listaSrc]) assert.ok(!/\.select\("\*"\)/.test(src), 'select("*") voltou');
  assert.match(listaSrc, /\.range\(de, de \+ f\.porPagina - 1\)/, 'lista sem paginação no servidor');
  assert.match(listaSrc, /\{ count: "exact", head: true \}/, 'KPIs devem ser head count (nunca baixar linhas)');
  assert.match(listaSrc, /q = q\.order\("id", \{ ascending: false \}\)/, 'paginação sem desempate estável repete/pula linhas');
  assert.match(tabelaSrc, /manualPagination: true/);
  assert.ok(!/get(Pagination|Filtered|Sorted)RowModel\(/.test(tabelaSrc),
    'paginação/filtro/ordenação voltaram para o navegador (corte de 1000)');
});

test('leitura de "todas as linhas" pagina acima do max_rows', () => {
  assert.match(paginacaoSrc, /export const POSTGREST_MAX_ROWS = 1000;/);
  assert.match(paginacaoSrc, /Math\.min\(opcoes\.tamanho \?\? POSTGREST_MAX_ROWS, POSTGREST_MAX_ROWS\)/);
  assert.match(pipelinePageSrc, /buscarTodasAsPaginas\(\(de, ate\) => supabase\s*\.from\("deals"\)/,
    'deals do board voltariam a ser cortados em 1000');
  // Revisão 08/10: form_submissions com .limit(3_000) (teto falso, sem ordem) nas conversas
  const conversasSrc = crm('lib', 'conversas-queries.ts');
  assert.ok(!/\.from\("form_submissions"\)[^;]*\.limit\(3_000\)/.test(conversasSrc),
    'conversas: leitura de form_submissions voltou a cortar em 1000 (subconjunto arbitrário)');
});

// ─── 6. Pipeline: busca no servidor + responsável + badge ─────────────────

test('pipeline: faixa só para CEO, busca por responsável, colunas paginadas', () => {
  assert.match(boardSrc, /useBuscaCadastros\(filters\.search, podeEditarColunas\)/);
  assert.match(boardSrc, /\{podeEditarColunas && \(\s*<ForaDoPipelineFaixa/, 'faixa visível para quem não é CEO');
  assert.match(boardSrc, /card\.athlete_name, card\.guardian_name, card\.position, card\.city_state/,
    'busca dos cards de revisão deixou de casar pelo responsável');
  for (const fn of ['listarLeadsPendentesCards', 'listarLeadsFriosCards', 'listarLeadsIncompletosCards']) {
    assert.match(boardSrc, new RegExp(`usePaginaRevisao\\([^)]*\\(offset, limite\\) => ${fn}\\(\\{ offset, limite \\}\\)`), `${fn} sem paginação`);
  }
  // Integração 08/10 (contrato B4): um átomo só — antes eram 6 cópias com textos divergentes.
  const atomo = crm('components', 'pipeline', 'ReuniaoDetectadaBadge.tsx');
  assert.match(atomo, /Reunião detectada/, 'rótulo do átomo mudou');
  assert.match(atomo, /timeZone: "America\/Sao_Paulo"/, 'data do badge tem que ser absoluta no fuso de Brasília (hidratação)');
  assert.ok(!/formatRelativeTime/.test(atomo), 'data relativa no badge muda entre SSR e hidratação');
  assert.match(atomo, /semDeal \? " — o lead ainda não tem deal no pipeline" : ""/,
    '"sem deal" só pode aparecer onde quem usa garante que não há deal');
  for (const arq of ['FriosColumn.tsx', 'IncompletosColumn.tsx', 'AprovacaoColumn.tsx']) {
    const src = crm('components', 'pipeline', arq);
    assert.match(src, /lead\.meeting_scheduled && \(/, `${arq}: badge de reunião sumiu`);
    assert.match(src, /<ReuniaoDetectadaBadge\b/, `${arq}: badge local em vez do átomo único`);
    assert.ok(!/>\s*Reunião detectada\s*</.test(src), `${arq}: cópia local do badge voltou`);
  }
  // 29 dos 93 pendentes têm deal: a fila nunca pode dizer "sem deal".
  assert.ok(!/<ReuniaoDetectadaBadge[^>]*semDeal/.test(crm('components', 'pipeline', 'AprovacaoColumn.tsx')),
    'Aguardando aprovação marcou "sem deal" (há pendente com deal)');
  for (const arq of ['FriosColumn.tsx', 'IncompletosColumn.tsx']) {
    assert.match(crm('components', 'pipeline', arq), /<ReuniaoDetectadaBadge[^>]*\bsemDeal\b/,
      `${arq}: Frios/Incompletos só listam quem não tem deal ativo`);
  }
  const faixaSrc = crm('components', 'pipeline', 'ForaDoPipelineFaixa.tsx');
  assert.match(faixaSrc, /<ReuniaoDetectadaBadge[^>]*semDeal=\{!item\.deal_id\}/,
    'faixa: "sem deal" só para quem não tem deal ativo');
});

// ─── 7. Revisão 08/10: refresh nunca deixa card velho nem pula card ──────

test('usePaginaRevisao: refresh volta à página do servidor e recarrega o trecho aberto', () => {
  const hook = crm('components', 'pipeline', 'usePaginaRevisao.ts');
  const ramo = hook.slice(hook.indexOf('if (inicial !== base) {'), hook.indexOf('// A action, o tamanho atual'));
  assert.match(ramo, /setItens\(inicial\.itens\.filter\(/,
    'no refresh a lista tem que voltar a ser a página do servidor');
  assert.ok(!/unir\(inicial\.itens, itens/.test(ramo),
    'fundir cards antigos no refresh deixa card que saiu do recorte na tela e desloca o offset (pula 1 card)');
  assert.match(ramo, /setRecarga\(/, 'o trecho já aberto no "Mostrar mais" precisa ser recarregado do servidor');
  assert.match(hook, /carregarRef\.current\(recarga\.offset, recarga\.limite\)/);
  // Revisão de código 08/10: a ação de coluna gera 2–3 payloads seguidos
  // (revalidatePath + router.refresh). Medir o trecho pelo tamanho da lista
  // (já encolhida pelo 1º payload) cancelava a recarga no 2º.
  assert.match(ramo, /planejarRecargaRevisao\(abertos, inicial\.itens\.length, inicial\.total/,
    'o trecho a recarregar tem que vir de `abertos` (o que o CEO abriu), não da lista atual');
  assert.ok(!/carregadosAntes|=\s*itens\.length/.test(ramo), 'faltam calculado pelo tamanho atual da lista (cancela a recarga)');
  const recarga = hook.slice(hook.indexOf('const aplicarRecarga'), hook.indexOf('// Recarga pós-refresh'));
  assert.match(recarga, /setItens\(unir\(paginaAtual, /, 'recarga TROCA a lista por página nova + trecho (nunca funde cards velhos)');
  assert.ok(!/setItens\(\(atuais\)/.test(recarga), 'recarga não pode fundir com a lista antiga');
  const faixa = crm('components', 'pipeline', 'ForaDoPipelineFaixa.tsx');
  assert.match(faixa, /onAtualizado\(item\)/, 'faixa precisa dizer QUAL lead saiu');
  assert.match(boardSrc, /item\.local\.tipo === "coluna_frios"\) frios\.remover\(item\.id\)/,
    '"Enviar p/ fila" pela faixa deixava o card na coluna Frios');
});

test('planejarRecargaRevisao: payloads em sequência não perdem o trecho aberto', () => {
  const planejar = extrair('planejarRecargaRevisao', ['abertos', 'tamanhoPagina', 'totalServidor', 'comErro']);
  // 192 frios, "Mostrar mais" 1× (192 abertos), resgata 1 da 2ª página → 191 abertos.
  const abertos = 191;
  const payload1 = planejar(abertos, 100, 191, false);
  const payload2 = planejar(abertos, 100, 191, false); // router.refresh logo depois
  assert.deepEqual(payload1, { offset: 100, limite: 91 });
  assert.deepEqual(payload2, { offset: 100, limite: 91 }, 'o 2º payload cancelava a recarga (coluna voltava a 100)');
  assert.equal(planejar(100, 100, 191, false), null, 'nada aberto além da página: sem recarga');
  assert.deepEqual(planejar(300, 100, 150, false), { offset: 100, limite: 50 }, 'nunca pede além do total');
  assert.equal(planejar(191, 0, 0, true), null, 'página com erro: sem recarga');
});

test('revisão de código 08/10: board, faixa, /leads e leituras completas', () => {
  // Kanban encolhe com a faixa em vez de ser empurrado e cortado embaixo
  assert.match(boardSrc, /className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-4"/);
  assert.match(pipelinePageSrc, /<div className="flex min-h-0 flex-1 flex-col overflow-hidden">\s*<PipelineBoard/);
  // B6: a faixa refaz a busca depois de QUALQUER decisão nos modais
  assert.ok((boardSrc.match(/busca\.recarregar\(\);\s*router\.refresh\(\);/g) ?? []).length >= 4,
    'decidir no modal deixava a faixa velha (2º clique abria outro lead)');
  const modal = crm('components', 'leads', 'AprovacoesLeads.tsx');
  assert.match(modal, /const pedidoSumiu = /, 'lead pedido que sumiu da lista não pode abrir OUTRO lead em silêncio');
  const faixa = crm('components', 'pipeline', 'ForaDoPipelineFaixa.tsx');
  assert.match(faixa, /<p role="status" aria-live="polite" className="sr-only">/, 'região viva da faixa tem que ficar sempre montada');
  assert.match(boardSrc, /motivoForaDaTela=\{motivoForaDaTela\}/, 'faixa dizia "ainda não carregado" para card filtrado/visão Tabela');
  // /leads
  assert.match(tabelaSrc, /enableSortingRemoval: false/, 'clique em "Recebido" removia a ordem e voltava ao mesmo padrão');
  assert.match(tabelaSrc, /\.\.\.alvoRef\.current, \.\.\.patch/, 'timer da busca partia de filtros velhos e desfazia a classe');
  assert.match(tabelaSrc, /maxLength=\{BUSCA_LEADS_MAX\}/);
  assert.match(crm('components', 'pipeline', 'PipelineFiltersBar.tsx'), /maxLength=\{BUSCA_PIPELINE_MAX\}/);
  assert.match(crm('components', 'leads', 'DossieLead.tsx'), /ssr: false/,
    'dossiê do deep-link ?atleta= renderizado no servidor (UTC) quebra a hidratação');
  assert.match(listaSrc, /\(!error && \(data\?\.length \?\? 0\) === 0\)/, 'offset == total devolve [] (não 416): "Página 2 de 1"');
  // Leituras completas: erro nunca vira parcial calado; deals paginados por chave imutável
  assert.match(paginacaoSrc, /return \{ data: \[\], error, truncado: false \}/);
  assert.ok(!/data: linhas, error, truncado/.test(paginacaoSrc), 'erro num bloco do meio devolvia os blocos já lidos');
  assert.match(pipelinePageSrc, /\.order\("created_at", \{ ascending: false \}\)/, 'paginar deals por updated_at (mutável) pula/duplica');
  assert.match(pipelinePageSrc, /ordenarDealsDoBoard\(todasDealRows\)/, 'ordem de exibição (updated_at desc) + dedupe por id');
  // Export em massa de PII com trilha (quem/quantas linhas), sem o termo
  const iniExp = buscaSrc.indexOf('action: "exportar_leads_csv",\n      usuarioId');
  assert.ok(iniExp >= 0, 'export de leads sem trilha de quem exportou');
  assert.ok(!/termo|f\.q[,\n]/.test(buscaSrc.slice(iniExp, iniExp + 250)), 'termo da busca não pode ir para o log do export');
});

test('/leads: campo de busca não é sobrescrito pela própria navegação', () => {
  assert.match(tabelaSrc, /const minha = qPendentes\.indexOf\(filtros\.q\);/,
    'a resposta de ?q= apagava o que o CEO digitou enquanto a página carregava');
  assert.match(tabelaSrc, /else setBusca\(filtros\.q\);/, 'mudança de ?q= por fora (voltar/menu) tem que chegar ao campo');
});

test('CSV: datas no fuso de Brasília', () => {
  assert.match(buscaSrc, /toLocaleDateString\("pt-BR", \{ timeZone: "America\/Sao_Paulo" \}\)/,
    'CSV gerado no servidor (UTC) troca a data de leads das 21h–24h');
});
