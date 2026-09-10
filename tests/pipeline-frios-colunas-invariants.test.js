'use strict';

// Guard — Coluna Frios + re-fila fora de timing + colunas personalizadas
// (ordens do CEO, 2026-09-04).
//
// Invariantes:
//   1. FRIO segue FORA de fila/outreach: a coluna Frios é read-only e o
//      resgate é explícito (MORNO provisório + pendente, com motivo). O
//      filtro IN (QUENTE,MORNO) da fila NÃO é relaxado.
//   2. Colunas personalizadas: enum ganha custom_1..custom_6; entrar/sair
//      delas nunca é retrocesso (trigger SQL + moverDeal); slot nasce
//      OCULTO até ser nomeado; criar coluna exige slot livre + gate CEO.
//   3. Re-fila dos fora de timing: recorte conservador (aprovado, sem
//      reunião, deal pré-reunião) — mesmo desenho da 20260825150000.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const ler = (...p) => fs.readFileSync(path.join(raiz, ...p), 'utf8');

const migSrc = ler('supabase', 'migrations', '20260904120000_colunas_custom_frios_timing.sql');
const leadsSrc = ler('apps', 'crm', 'src', 'lib', 'actions', 'leads.ts');
const dealsSrc = ler('apps', 'crm', 'src', 'lib', 'actions', 'deals.ts');
const etapasSrc = ler('apps', 'crm', 'src', 'lib', 'etapas-deal.ts');
const etapasActionSrc = ler('apps', 'crm', 'src', 'lib', 'actions', 'etapas-pipeline.ts');
const tiposDealSrc = ler('apps', 'crm', 'src', 'types', 'deal.ts');

test('coluna Frios: FRIO continua fora da fila — resgate explícito e guardado', () => {
  // A fila NÃO relaxou o filtro de classe
  assert.match(leadsSrc, /\.in\("qualification_classification", \["QUENTE", "MORNO"\]\)/,
    'defesa em profundidade da fila sumiu');
  // Resgate: MORNO provisório + pendente, SÓ sobre FRIO sem decisão
  const fn = leadsSrc.slice(
    leadsSrc.indexOf('export async function enviarFrioParaAprovacao'),
    leadsSrc.indexOf('export async function listarLeadsPendentesAprovacao'));
  assert.match(fn, /qualification_classification: "MORNO"/, 'provisório MORNO sumiu');
  assert.match(fn, /aprovacao_status: "pendente"/, 'resgate deve cair na fila (pendente)');
  assert.match(fn, /\.eq\("qualification_classification", "FRIO"\)/,
    'resgate só pode agir sobre FRIO');
  assert.match(fn, /\.is\("aprovacao_status", null\)/,
    'resgate não pode sobrescrever decisão humana');
  // Listagem: só FRIO sem decisão, janela recente, sem deal ativo
  assert.match(leadsSrc, /FRIOS_REVISAO_DIAS = 90/, 'janela de revisão mudou');
  assert.match(leadsSrc, /!deals\.some\(\(d\) => d\.deleted_at === null\)/,
    'FRIO com deal ativo (rebaixados em Perdido) não pode duplicar no board');
  // Incidente 2026-09-05: o embed 1:1 de atletas volta OBJETO — flatMap em
  // objeto derrubou /pipeline em PRD. A normalização é obrigatória.
  assert.match(leadsSrc, /Array\.isArray\(v\) \? v : v \? \[v\] : \[\]/,
    'normalização objeto/array do embed sumiu — flatMap em objeto derruba a página');
  assert.match(leadsSrc, /asArray\(row\.atletas\)\.flatMap\(\(a\) => asArray\(a\.deals\)\)/,
    'as duas camadas do embed precisam ser normalizadas');
});

test('enum: seis slots custom adicionados de forma idempotente', () => {
  assert.match(migSrc, /ADD VALUE IF NOT EXISTS %L', 'custom_' \|\| i/,
    'ADD VALUE dos slots custom sumiu');
  assert.match(migSrc, /FOR i IN 1\.\.6 LOOP/, 'devem ser exatamente 6 slots');
});

test('retrocesso: colunas custom isentas no trigger SQL e no moverDeal', () => {
  assert.match(migSrc, /NEW\.etapa::text NOT LIKE 'custom\\_%'/,
    'isenção de retrocesso (entrada) sumiu do trigger');
  assert.match(migSrc, /OLD\.etapa::text NOT LIKE 'custom\\_%'/,
    'isenção de retrocesso (saída) sumiu do trigger');
  assert.match(dealsSrc, /!novaEtapa\.startsWith\("custom_"\)/,
    'isenção de retrocesso sumiu do moverDeal (entrada)');
  assert.match(dealsSrc, /!String\(deal\.etapa\)\.startsWith\("custom_"\)/,
    'isenção de retrocesso sumiu do moverDeal (saída)');
});

test('slot custom nasce oculto; criar coluna exige slot livre + CEO', () => {
  assert.match(etapasSrc, /base\.isCustomSlot === true/,
    'default oculto do slot custom sumiu do merge');
  assert.match(tiposDealSrc, /isCustomSlot: true/, 'flag isCustomSlot sumiu dos slots');
  const criar = etapasActionSrc.slice(
    etapasActionSrc.indexOf('export async function criarColunaPipeline'),
    etapasActionSrc.indexOf('export async function reordenarEtapasPipeline'));
  assert.match(criar, /getUserPapel\(\)\) !== "ceo"/, 'gate CEO sumiu do criar coluna');
  assert.match(criar, /isCustomSlot === true,\s*\)\s*as DealStage\[\]\)\.find\(\(s\) => atual\[s\] === undefined\)/,
    'busca de slot livre mudou — criar não pode sobrescrever coluna nomeada');
  assert.match(criar, /oculta: false/, 'coluna criada precisa nascer visível');
});

test('re-fila fora de timing: recorte conservador', () => {
  assert.match(migSrc, /fs\.timing_status IN \('muito_cedo', 'tarde_demais'\)/,
    'recorte de timing sumiu');
  assert.match(migSrc, /fs\.qualification_classification IN \('QUENTE', 'MORNO'\)/,
    'só qualificados de verdade entram na fila');
  assert.match(migSrc, /fs\.aprovacao_status = 'aprovado'/,
    'a re-fila só reabre decisão de quem estava aprovado');
  assert.match(migSrc, /fs\.meeting_scheduled IS NOT TRUE/,
    'quem tem reunião não pode ser re-enfileirado');
  assert.match(migSrc, /d\.etapa IN \('contato_feito', 'lead', 'aguardando_timing'\)/,
    'só deals pré-reunião podem suspender do board');
});

// ─── Muito cedo — revisão (ordem do CEO, 2026-09-08) ─────────────────────
// Mensagens de timing + retomada de novembro DESLIGADAS: a revisão manual
// vive na coluna Aguardando Timing (card → dossiê; "Ativar agora" → Lead).

const migMuitoCedoSrc = ler('supabase', 'migrations', '20260908120000_estacionar_muito_cedo_aprovados.sql');
const boardSrc = ler('apps', 'crm', 'src', 'components', 'pipeline', 'PipelineBoard.tsx');

test('muito cedo: revisão lista só aprovados estacionados, sem tocar timing_status', () => {
  const fn = leadsSrc.slice(
    leadsSrc.indexOf('export async function listarLeadsMuitoCedoDetalhe'),
    leadsSrc.indexOf('export async function ativarLeadMuitoCedo'));
  assert.match(fn, /\.eq\("timing_status", "muito_cedo"\)/, 'recorte de timing sumiu');
  assert.match(fn, /\.eq\("aprovacao_status", "aprovado"\)/,
    'revisão só pode listar aprovados — pendente pertence à fila de aprovação');
  assert.match(fn, /\.in\("qualification_classification", \["QUENTE", "MORNO"\]\)/,
    'filtro de classe sumiu da revisão');
  assert.match(fn, /d\.etapa === "aguardando_timing"/,
    'revisão deve exigir deal ativo estacionado (quem avançou sai sozinho)');

  const ativar = leadsSrc.slice(leadsSrc.indexOf('export async function ativarLeadMuitoCedo'));
  assert.match(ativar, /\.eq\("etapa", "aguardando_timing"\)/,
    'CAS do ativar sumiu — deal que avançou em outra aba seria puxado de volta');
  assert.match(ativar, /getUserPapel\(\)\) !== "ceo"/, 'gate CEO sumiu do ativar');
  assert.ok(!/timing_status:/.test(ativar),
    'ativar NUNCA pode escrever timing_status — mudaria a elegibilidade dos schedulers (follow-ups)');
});

test('muito cedo: card da coluna Aguardando timing abre o dossiê de revisão', () => {
  assert.match(boardSrc, /stage === "aguardando_timing"/, 'interceptação do clique sumiu');
  assert.match(boardSrc, /modo="muito_cedo"/, 'modal em modo muito_cedo sumiu do board');
});

test('muito cedo: one-shot de estacionamento tem recorte conservador', () => {
  assert.match(migMuitoCedoSrc, /fs\.timing_status = 'muito_cedo'/, 'recorte de timing sumiu');
  assert.match(migMuitoCedoSrc, /fs\.aprovacao_status = 'aprovado'/,
    'só aprovados podem ser estacionados (pendente já está suspenso do board)');
  assert.match(migMuitoCedoSrc, /fs\.meeting_scheduled IS NOT TRUE/,
    'quem tem reunião nunca pode ser estacionado');
  assert.match(migMuitoCedoSrc, /d\.etapa IN \('lead', 'contato_feito'\)/,
    'só etapas iniciais podem ser estacionadas — deal avançado fica onde está');
});

// ─── Ajustes 2026-09-10: reprovar Frios + drop na coluna inteira ─────────

test('frios: reprovar só age sobre FRIO ainda sem decisão (nunca sobrescreve)', () => {
  const fn = leadsSrc.slice(leadsSrc.indexOf('export async function reprovarFrio'));
  assert.match(fn, /aprovacao_status: "reprovado"/, 'reprovar deixou de registrar a decisão');
  assert.match(fn, /\.eq\("qualification_classification", "FRIO"\)/,
    'reprovarFrio poderia agir sobre lead não-FRIO');
  assert.match(fn, /\.is\("aprovacao_status", null\)/,
    'reprovarFrio poderia sobrescrever decisão humana existente');
  assert.match(fn, /getUserPapel\(\)\) !== "ceo"/, 'gate CEO sumiu do reprovarFrio');
});

test('colunas: o drop de reordenação cobre a coluna inteira, não só o cabeçalho', () => {
  const colSrc = ler('apps', 'crm', 'src', 'components', 'pipeline', 'PipelineColumn.tsx');
  // O onDrop precisa estar no div EXTERNO (junto do setNodeRef), senão soltar
  // sobre os cards não faz nada e o reordenar parece quebrado (CEO, 2026-09-10).
  const externo = colSrc.slice(colSrc.indexOf('ref={setNodeRef}'), colSrc.indexOf('draggable={'));
  assert.match(externo, /onDrop=\{/, 'onDrop saiu do contêiner externo da coluna');
  assert.match(externo, /origem !== arrastandoColuna\) return/,
    'proteção contra drop externo (arquivo do Finder) sumiu');
});
