'use strict';

// ════════════════════════════════════════════════════════════════════════
// Guard — Banco de Escolas (T15/T16/T22, vídeo do CEO 28/09/2026)
//
// Invariantes:
//   1. Vocabulário: as escolas são HIGH SCHOOLS. Nenhum rótulo de divisão
//      universitária (Division/Div. I/NAIA/JUCO) em telas de escola, Match e
//      modal do Ganho. A tela mostrava "Division I" por um mapa inventado.
//   2. Fonte única de enums: os valores de school-options.ts == CHECK/ENUM das
//      migrations. Nenhum componente define lista local de opção de enum
//      (foi a lista local "moderada"/"media"/"Basico" que quebrou o Salvar
//      com 22P02 em 100% das tentativas).
//   3. Edição segura: atualizarEscola valida com Zod estrito (lista branca),
//      é gated por CEO, sem `as any`, e o cliente manda só o diff.
//   4. Contatos usam as colunas REAIS (data/tipo), não data_contato/tipo_contato.
//   5. Cards só com dado real: nada de "Match médio", contadores mortos
//      (total_aplicados/tempo_medio_resposta/bolsa_media_obtida) ou
//      `Number(budget) || 0`; histórico vem da view escolas_historico_bausa.
//   6. Migration aditiva: perfil NULLABLE sem default, gate por TABELA, view
//      security_invoker; calcular_match_score intocado.
//   7. Sheets: cadastro digitado não some sem confirmação e o foco nunca cai
//      fora do diálogo (abrir/fechar, entrar/sair da edição).
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const CRM = path.join(RAIZ, 'apps', 'crm', 'src');
const MIGRATIONS = path.join(RAIZ, 'supabase', 'migrations');

function ler(arquivo) {
  assert.ok(fs.existsSync(arquivo), `Arquivo não encontrado: ${arquivo}`);
  return fs.readFileSync(arquivo, 'utf8');
}

/** Fonte sem comentários (bloco, linha e JSX {/* *\/}) — o guard checa código. */
function semComentarios(raw) {
  return raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('//'))
    .join('\n');
}

function arquivosDe(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => path.join(dir, f));
}

const OPTIONS = path.join(CRM, 'components', 'escolas', 'school-options.ts');
const ACTIONS = path.join(CRM, 'lib', 'actions', 'escolas.ts');
const SCHEMA = path.join(CRM, 'lib', 'escolas', 'schema.ts');
const FORMULARIO = path.join(CRM, 'lib', 'escolas', 'formulario.ts');
const PAGE = path.join(CRM, 'app', '(dashboard)', 'escolas', 'page.tsx');
const CARD = path.join(CRM, 'components', 'escolas', 'SchoolCard.tsx');
const EDIT = path.join(CRM, 'components', 'escolas', 'SchoolEditForm.tsx');
const STRATEGY_ROW = path.join(CRM, 'components', 'matching', 'EditableStrategyRow.tsx');
const MATCHING_PAGE = path.join(CRM, 'app', '(dashboard)', 'matching', 'page.tsx');
const GANHO = path.join(CRM, 'components', 'pipeline', 'GanhoEscolasModal.tsx');
const MIG_ESCOLAS = path.join(MIGRATIONS, '20260401001500_crm_escolas.sql');
const MIG_ENUMS = path.join(MIGRATIONS, '20260401000000_crm_enum_types.sql');
// Migrations achadas pelo SUFIXO (PLANO.md §3): o timestamp pode ser
// re-carimbado na hora do merge (`supabase db push` sem --include-all exige
// versões crescentes) — o guard não depende do número.
function migrationPorSufixo(sufixo) {
  const achadas = fs.readdirSync(MIGRATIONS).filter((n) => n.endsWith(sufixo));
  if (achadas.length !== 1) throw new Error(`esperava 1 migration *${sufixo}, achei ${achadas.length}`);
  return path.join(MIGRATIONS, achadas[0]);
}
const MIG_PERFIL = migrationPorSufixo('_escolas_perfil_historico.sql');
const MIG_AUDIT = migrationPorSufixo('_audit_log_change_usuario_jwt.sql');

const NCAA_RE = /\bDivision\s+(?:I{1,3}|1|2|3)\b|\bDiv\.\s*I{1,3}\b|\bNAIA\b|\bJUCO\b/;

/** Valores de `export const NOME = [ ... ] as const` em school-options.ts. */
function valoresTS(src, nome) {
  const m = new RegExp(`export const ${nome} = \\[([\\s\\S]*?)\\] as const`).exec(src);
  assert.ok(m, `${nome} não encontrado em school-options.ts`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

/** Valores de `CHECK (coluna IN ('a','b'))` numa migration. */
function valoresCheck(sql, coluna) {
  const m = new RegExp(`${coluna}[\\s\\S]{0,120}?CHECK \\(${coluna} IN \\(([^)]*)\\)`).exec(sql);
  assert.ok(m, `CHECK de ${coluna} não encontrado`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

function valoresEnum(sql, tipo) {
  const m = new RegExp(`CREATE TYPE ${tipo} AS ENUM \\(([^)]*)\\)`).exec(sql);
  assert.ok(m, `ENUM ${tipo} não encontrado`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

const ordenado = (lista) => [...lista].sort();

// ─── 1. Vocabulário ──────────────────────────────────────────────────────

test('nenhum rótulo de divisão universitária nas telas de escola, Match e Ganho', () => {
  const alvos = [
    ...arquivosDe(path.join(CRM, 'components', 'escolas')),
    ...arquivosDe(path.join(CRM, 'lib', 'escolas')),
    PAGE,
    path.join(CRM, 'types', 'school.ts'),
    ACTIONS,
    MATCHING_PAGE,
    STRATEGY_ROW,
    GANHO,
  ];
  const violacoes = alvos.filter((f) => NCAA_RE.test(semComentarios(ler(f))));
  assert.deepEqual(violacoes, [], `vocabulário de universidade voltou em:\n${violacoes.join('\n')}`);
});

test('guard de vocabulário: detecta "Division I" (auto-teste negativo)', () => {
  assert.ok(NCAA_RE.test('const SchoolType = "Division I";'));
  assert.ok(NCAA_RE.test('label: "Div. III"'));
  assert.ok(NCAA_RE.test('?? "NAIA"'));
  assert.ok(!NCAA_RE.test('// comentário sobre Division I'.replace(/^\/\/.*$/, '')));
  assert.ok(!NCAA_RE.test('Boarding (internato)'));
});

test('tipo da escola é exibido com rótulo legível no Match e no Ganho', () => {
  assert.match(semComentarios(ler(MATCHING_PAGE)), /school_type: rotuloTipoEscola\(/,
    'Motor de Match voltou a mostrar o código cru (boarding/mista)');
  assert.match(semComentarios(ler(GANHO)), /rotuloTipoEscola\(e\.tipo\)/,
    'modal do Ganho voltou a mostrar o código cru');
  // O "--" do import (Gateway/RPS) não pode aparecer como se fosse um estado.
  assert.match(semComentarios(ler(MATCHING_PAGE)), /school_state: siglaEstadoUs\(/,
    'Motor de Match voltou a mostrar a UF crua ("--")');
  assert.match(semComentarios(ler(GANHO)), /siglaEstadoUs\(e\.estado\)/,
    'modal do Ganho voltou a mostrar a UF crua ("--")');
  const opts = ler(OPTIONS);
  assert.match(opts, /boarding: "Boarding \(internato\)"/);
  assert.match(opts, /day: "Day school"/);
  assert.match(opts, /mista: "Boarding \+ Day"/);
  // Os tipos da TELA vêm da fonte única (TAREFAS T15, passo 5).
  const comp = (nome) => semComentarios(ler(path.join(CRM, 'components', 'escolas', nome)));
  assert.match(comp('SchoolCard.tsx'), /TIPO_LABEL\[school\.tipo\]/, 'selo do card deve vir de TIPO_LABEL');
  assert.match(comp('SchoolDetailSheet.tsx'), /TIPO_LABEL\[school\.tipo\]/, 'detalhe deve vir de TIPO_LABEL');
  assert.match(comp('EscolasClient.tsx'), /TIPO_OPTIONS\.map\(/, 'filtro de tipo deve vir de TIPO_OPTIONS');
  assert.match(comp('SchoolFormFields.tsx'), /TIPO_OPTIONS\.map\(/, 'criação/edição devem usar TIPO_OPTIONS');
});

// ─── 2. Fonte única de enums == banco ────────────────────────────────────

test('school-options.ts reflete exatamente os CHECKs/ENUMs do banco', () => {
  const opts = ler(OPTIONS);
  const migEscolas = ler(MIG_ESCOLAS);
  const migEnums = ler(MIG_ENUMS);
  const migPerfil = ler(MIG_PERFIL);

  assert.deepEqual(ordenado(valoresTS(opts, 'TIPO_VALUES')), ordenado(valoresCheck(migEscolas, 'tipo')));
  assert.deepEqual(ordenado(valoresTS(opts, 'STATUS_VALUES')), ordenado(valoresCheck(migEscolas, 'status')));
  assert.deepEqual(
    ordenado(valoresTS(opts, 'TEMPERATURA_VALUES')),
    ordenado(valoresCheck(migEscolas, 'temperatura_relacionamento')),
  );
  assert.deepEqual(
    ordenado(valoresTS(opts, 'RESULTADO_ESTRATEGIA_VALUES')),
    ordenado(valoresCheck(migEscolas, 'resultado')),
  );
  assert.deepEqual(ordenado(valoresTS(opts, 'INGLES_VALUES')), ordenado(valoresEnum(migEnums, 'nivel_ingles')));
  assert.deepEqual(
    ordenado(valoresTS(opts, 'AGRESSIVIDADE_VALUES')),
    ordenado(valoresEnum(migEnums, 'agressividade_bolsa')),
  );
  assert.deepEqual(
    ordenado(valoresTS(opts, 'INFLUENCIA_VALUES')),
    ordenado(valoresEnum(migEnums, 'influencia_esporte')),
  );
  const perfilMig = /perfil IN \('[\s\S]*?\)\)/.exec(migPerfil);
  assert.ok(perfilMig, 'CHECK de perfil não encontrado na migration');
  const perfilValores = [...perfilMig[0].matchAll(/''?([a-z_]+)''?/g)].map((x) => x[1]);
  assert.deepEqual(ordenado(valoresTS(opts, 'PERFIL_VALUES')), ordenado(perfilValores));
  // serie_ordem() reconhece 9th..12th e pg_year — PG precisa estar nas opções.
  assert.ok(valoresTS(opts, 'SERIE_VALUES').includes('pg_year'), "opção PG ('pg_year') sumiu");
});

test('nenhum componente define lista local de opções de enum (fonte única)', () => {
  const LISTA_LOCAL = /const (?:INGLES|AGRESSIVIDADE|INFLUENCIA|STATUS|TEMPERATURA|TIPO|RESULTADO)_OPTIONS\s*=/;
  const VALOR_INVENTADO = /"(?:moderada|conservadora|agressiva|Basico|Intermediario|Avancado|aplicado|rejeitado|lista_espera|desistiu)"/;
  const alvos = [
    ...arquivosDe(path.join(CRM, 'components', 'escolas')).filter((f) => !f.endsWith('school-options.ts')),
    STRATEGY_ROW,
  ];
  for (const f of alvos) {
    const src = semComentarios(ler(f));
    assert.ok(!LISTA_LOCAL.test(src), `${path.basename(f)} redefine opções localmente — importe de school-options.ts`);
    assert.ok(!VALOR_INVENTADO.test(src), `${path.basename(f)} usa valor de enum que não existe no banco`);
  }
});

// ─── 3. Edição segura ────────────────────────────────────────────────────

test('atualizarEscola: CEO-gated, Zod estrito com lista branca, sem as any', () => {
  const src = semComentarios(ler(ACTIONS));
  assert.ok(!/\bas any\b/.test(src), 'as any voltou em lib/actions/escolas.ts');
  const fn = src.slice(src.indexOf('export async function atualizarEscola'), src.indexOf('export async function sugerirEscolas'));
  assert.match(fn, /getUserPapel\(\)\)\s*!==\s*"ceo"/, 'gate de papel sumiu');
  assert.match(fn, /escolaAtualizarSchema\.safeParse\(/, 'validação Zod sumiu');
  assert.match(fn, /\.update\(dados\)/, 'UPDATE deve usar SÓ o dado validado');
  assert.match(fn, /\.is\("deleted_at", null\)/, 'não pode editar escola removida');

  const schema = semComentarios(ler(SCHEMA));
  assert.match(schema, /escolaAtualizarSchema = z\.strictObject\(ESCOLA_COLUNAS_SHAPE\)\.partial\(\)/,
    'lista branca (strictObject) sumiu — mass assignment');
  assert.match(schema, /satisfies Record<CampoEditavel, z\.ZodType>/, 'shape deve casar 1:1 com CAMPOS_EDITAVEIS');
  for (const morta of ['total_aplicados', 'total_aceitos', 'taxa_aceitacao', 'deleted_at', 'created_by', 'id:']) {
    const shape = schema.slice(schema.indexOf('ESCOLA_COLUNAS_SHAPE = {'), schema.indexOf('} satisfies'));
    assert.ok(!shape.includes(morta), `campo ${morta} não pode ser editável`);
  }
});

test('edição manda só o diff e "Salvar" sem mexer não chama o servidor', () => {
  const src = semComentarios(ler(EDIT));
  assert.match(src, /diffEscola\(original, montagem\.valores\)/);
  assert.match(src, /Object\.keys\(patch\)\.length === 0/, 'patch vazio precisa curto-circuitar');
  assert.match(src, /atualizarEscola\(school\.id, patch\)/, 'deve enviar o patch, não o form inteiro');
  assert.match(src, /defaultValues: formDaEscola\(school\)/, 'form deve começar com os valores crus do banco');

  const form = semComentarios(ler(FORMULARIO));
  assert.match(form, /return normalizarTexto\(a\) === normalizarTexto\(b\)/,
    'texto precisa ser comparado normalizado (espaço/CRLF não pode virar alteração)');
  assert.match(form, /cidade: cidadePendente\(e\.cidade\) \? "" : e\.cidade/,
    'placeholder "A confirmar" não pode ir para o input como se fosse cidade');
  assert.match(form, /cidade: cidade === "" \? origCidade : cidade/,
    'cidade em branco com placeholder original deve ficar intocada');
  // Coluna nullable com default no banco: pré-preencher o default no form
  // faria o "Salvar sem mexer" gravar a coluna numa escola com NULL.
  assert.match(form, /temperatura_relacionamento: e\.temperatura_relacionamento \?\? ""/,
    'temperatura NULL não pode virar "neutro" no form (Salvar sem mexer gravaria a coluna)');
  assert.ok(!/temperatura_relacionamento \?\? "neutro"/.test(form), 'default inventado voltou ao form');
});

test('sheets de escola: cadastro não some sem confirmação e o foco nunca cai fora do diálogo', () => {
  const src = semComentarios(ler(path.join(CRM, 'components', 'escolas', 'SchoolFormSheet.tsx')));
  assert.match(src, /if \(isDirty\) \{\s*const descartar = await confirm\(/,
    'Esc/fundo/Cancelar descartavam o cadastro digitado sem perguntar');
  assert.ok(!/onClick=\{onClose\}/.test(src), 'fechar pelo fundo/X/Cancelar deve passar pela confirmação');
  assert.match(src, /if \(anterior\?\.isConnected\) anterior\.focus\(\)/, 'foco precisa voltar para quem abriu o sheet');
  // Entrar/sair da edição desmonta o botão focado: o foco não pode cair no
  // <body> (fora do diálogo, onde o Tab preso não alcança).
  const detalhe = semComentarios(ler(path.join(CRM, 'components', 'escolas', 'SchoolDetailSheet.tsx')));
  assert.match(detalhe, /editarRef\.current\?\.focus\(\)/, 'sair da edição deve devolver o foco ao "Editar"');
  assert.match(semComentarios(ler(EDIT)), /setFocus\("nome"\)/, 'entrar na edição deve focar o 1º campo');
});

// ─── 4. Contatos ─────────────────────────────────────────────────────────

test('contatos usam as colunas reais data/tipo', () => {
  const src = semComentarios(ler(ACTIONS));
  assert.ok(!/data_contato|tipo_contato/.test(src), 'colunas inexistentes (42703) voltaram');
  assert.match(src, /\.insert\(\{ escola_id: escolaId, data: dia, tipo, resumo \}\)/);
  assert.match(src, /\.order\("data", \{ ascending: false \}\)/);
  assert.match(src, /ultimo_contato_at\.lte\./, 'último contato só pode avançar');
  assert.match(src, /dia > hojeIsoBrasilia\(Date\.now\(\)\)/,
    'servidor precisa barrar contato com data futura (travaria o último contato)');
  const registrar = src.slice(
    src.indexOf('export async function registrarContatoEscola'),
    src.indexOf('export async function listarContatosEscola'),
  );
  assert.ok(
    registrar.indexOf('.is("deleted_at", null)') > -1 &&
      registrar.indexOf('.is("deleted_at", null)') < registrar.indexOf('.from("historico_contatos_escola")'),
    'contato só pode ser registrado em escola não removida (checar antes do INSERT)',
  );
  const apres = semComentarios(ler(path.join(CRM, 'lib', 'escolas', 'apresentacao.ts')));
  assert.match(apres, /timeZone: FUSO_OPERACAO/, '"há N dias" precisa de fuso explícito (SSR em UTC × navegador em BRT)');
});

// ─── 5. Só dado real ─────────────────────────────────────────────────────

test('cards e KPIs: sem métrica inventada nem null virando 0', () => {
  const alvos = [PAGE, CARD, ...arquivosDe(path.join(CRM, 'lib', 'escolas'))];
  for (const f of alvos) {
    const src = semComentarios(ler(f));
    assert.ok(!/Match m[eé]dio/i.test(src), `${path.basename(f)}: "Match médio" voltou`);
    assert.ok(!/tempo_medio_resposta|total_aplicados|bolsa_media_obtida\b/.test(src),
      `${path.basename(f)}: coluna morta voltou a ser exibida`);
    assert.ok(!/budget_[a-z_]+\)\s*\|\|\s*0/.test(src), `${path.basename(f)}: budget nulo virando 0`);
  }
  const page = semComentarios(ler(PAGE));
  assert.match(page, /from\("escolas_historico_bausa"\)/, 'histórico deve vir da view');
  assert.ok(!/select\("\*"\)/.test(page), 'nunca SELECT *');
});

test('resultado de estratégia não incrementa contador em escolas (fonte = view)', () => {
  const src = semComentarios(ler(ACTIONS));
  const fn = src.slice(src.indexOf('export async function atualizarResultadoEscola'));
  assert.ok(!/total_aceitos/.test(fn), 'incremento read-modify-write voltou');
  assert.match(fn, /resultadoEstrategiaSchema\.safeParse\(/);
  const row = semComentarios(ler(STRATEGY_ROW));
  assert.match(row, /RESULTADO_ESTRATEGIA_OPTIONS/, 'opções de resultado devem vir de school-options');
  assert.match(row, /data_aplicacao: dataAplicacao/, 'data de aplicação coletada precisa ser enviada');
});

// ─── 6. Migrations ───────────────────────────────────────────────────────

test('migration perfil/view: aditiva, gate por tabela, security_invoker, sem tocar no match', () => {
  const sql = ler(MIG_PERFIL);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS perfil TEXT '/, 'perfil deve ser TEXT nullable (aditivo)');
  assert.ok(!/perfil TEXT[^;]*DEFAULT/i.test(sql), 'perfil não pode nascer com default (seria dado inventado)');
  assert.ok(!/NOT NULL/.test(sql.slice(sql.indexOf('ADD COLUMN'), sql.indexOf('COMMENT ON COLUMN'))),
    'perfil não pode ser NOT NULL');
  assert.match(sql, /information_schema\.tables[\s\S]*table_name = 'escolas'/, 'gate deve ser por TABELA');
  assert.match(sql, /security_invoker = true/, 'view precisa respeitar a RLS de quem consulta');
  assert.match(sql, /REVOKE ALL ON %I\.escolas_historico_bausa FROM PUBLIC, anon, authenticated/);
  assert.ok(!/FUNCTION\s+(?:public\.)?(?:calcular_match_score|sugerir_escolas)/i.test(sql),
    'esta migration não pode redefinir o match');
  assert.ok(!/(?:total_aplicados|total_aceitos|taxa_aceitacao)\s*=/.test(sql),
    'colunas lidas pelo calcular_match_score não podem ser alteradas');
  assert.ok(!/DROP COLUMN|ALTER COLUMN|RENAME/i.test(sql), 'migration deve ser só aditiva');
});

test('migration audit: fallback auth.uid() protegido por EXCEPTION, SECURITY DEFINER mantido', () => {
  const sql = ler(MIG_AUDIT);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = pg_catalog, public/);
  assert.match(sql, /_user_id := auth\.uid\(\);\s*EXCEPTION WHEN OTHERS THEN\s*_user_id := NULL;/,
    'fallback do usuário precisa ser à prova de falha (nunca aborta a escrita)');
  assert.match(sql, /IF array_length\(_campos_alterados, 1\) IS NULL THEN\s*RETURN NEW;/,
    'UPDATE sem mudança real continua sem log');
  // audit_logs.user_id tem FK p/ auth.users (NO ACTION): sub sem usuário
  // (JWT de usuário removido) abortaria a escrita com 23503.
  assert.match(sql, /NOT EXISTS \(SELECT 1 FROM auth\.users au WHERE au\.id = _user_id\)/,
    'user_id só pode ser gravado se existir em auth.users');
});
