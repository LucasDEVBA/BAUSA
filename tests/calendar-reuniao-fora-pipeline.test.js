'use strict';

// ════════════════════════════════════════════════════════════════════════
// GUARD — Reunião detectada de lead FORA do pipeline (T14, vídeos 28/09)
// ════════════════════════════════════════════════════════════════════════
//
// Incidente: Samuel (INVALIDO, reunião 21/09) e Clara (FRIO, 08/09) tiveram
// reunião detectada pelo calendar-webhook, mas como não tinham deal o único
// rastro era um log 'no_deal_found' — o Engine não mostrava nada e o CEO
// "fechou verbalmente" um lead que não existia na plataforma.
//
// Invariantes travados aqui:
//   1. Os DOIS caminhos que marcam reunião (push do Google e reconciliação)
//      avisam quando o deal não foi movido.
//   2. O aviso é SÓ interno (notificacoes) — nunca cria deal, nunca toca em
//      classe/aprovação (jamais grava 'aprovado'), nunca envia mensagem.
//   3. Best-effort: try/catch próprio, depois da confirmação ao lead.
//   4. Idempotente: on_conflict=destinatario_id,dedupe_key + ignore-duplicates.
//   5. Escreve em public e só a instância de produção avisa.
//   6. Conteúdo sem PII além do nome; link para o dossiê do lead.
//
// Execução local: node --test tests/
// ════════════════════════════════════════════════════════════════════════

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'calendar-webhook', 'index.js'),
  'utf8',
);

const extrair = (nome, regex) => {
  const m = SRC.match(regex);
  assert.ok(m, `${nome} não encontrada — atualize o guard se renomeou`);
  return m[0];
};

const corpoDe = (inicio, fim) => {
  const i = SRC.indexOf(inicio);
  assert.ok(i >= 0, `trecho '${inicio}' sumiu`);
  const f = fim ? SRC.indexOf(fim, i + inicio.length) : -1;
  return SRC.slice(i, f > i ? f : undefined);
};

// ─── Extract-and-run do montador (função pura) ───────────────────────────
const bloco = [
  extrair('ETAPAS_DEAL_PARADO', /const ETAPAS_DEAL_PARADO = \{[\s\S]*?\n\};/),
  extrair('formatarQuandoCurto', /const formatarQuandoCurto = \(event\) => \{[\s\S]*?\n\};/),
  extrair('montarAvisoForaDoPipeline', /const montarAvisoForaDoPipeline = \(lead, event, diag\) => \{[\s\S]*?\n\};/),
].join('\n');

// eslint-disable-next-line no-new-func
const motor = new Function(`${bloco}\nreturn { montarAvisoForaDoPipeline, ETAPAS_DEAL_PARADO };`)();

const LEAD = {
  id: '11111111-2222-3333-4444-555555555555',
  athlete_name: 'Clara Teste',
  qualification_classification: 'FRIO',
  aprovacao_status: null,
  email: 'familia@example.com',
  guardian_whatsapp: '5511999998888',
};
const EVENTO = { id: 'evt123', start: { dateTime: '2026-10-09T17:30:00Z' } };

test('aviso de lead SEM deal: alta, link do dossiê, dedupe por lead+evento, sem PII', () => {
  const n = motor.montarAvisoForaDoPipeline(LEAD, EVENTO, { situacao: 'sem_deal', dealId: null, etapa: null });
  assert.equal(n.tipo, 'reuniao_fora_pipeline');
  assert.equal(n.severidade, 'alta');
  assert.equal(n.link, `/leads?lead=${LEAD.id}`);
  assert.equal(n.deal_id, null);
  assert.equal(n.dedupe_key, `reuniao_fora_pipeline:${LEAD.id}:evt123`);
  assert.match(n.titulo, /Clara Teste/);
  assert.match(n.mensagem, /09\/10 às 14:30/, 'data/hora em BRT');
  assert.match(n.mensagem, /FRIO/);
  assert.match(n.mensagem, /sem decisão/);
  const texto = `${n.titulo} ${n.mensagem}`;
  assert.ok(!texto.includes(LEAD.email), 'e-mail não pode ir para a notificação');
  assert.ok(!texto.includes(LEAD.guardian_whatsapp), 'telefone não pode ir para a notificação');
});

test('aviso de deal PARADO (perdido/aguardando_timing): média, cita a coluna e leva deal_id', () => {
  const n = motor.montarAvisoForaDoPipeline(LEAD, EVENTO, { situacao: 'deal_parado', dealId: 'd1', etapa: 'perdido' });
  assert.equal(n.severidade, 'media');
  assert.equal(n.deal_id, 'd1');
  assert.match(n.titulo, /"Perdido"/);
  assert.deepEqual(Object.keys(motor.ETAPAS_DEAL_PARADO).sort(), ['aguardando_timing', 'perdido', 'projeto_futuro']);
});

test('evento sem dateTime (dia inteiro) não quebra o montador', () => {
  const n = motor.montarAvisoForaDoPipeline(LEAD, { id: 'e2', start: { date: '2026-10-09' } }, { situacao: 'sem_deal' });
  assert.match(n.mensagem, /data a confirmar/);
});

// ─── Invariantes por fonte ───────────────────────────────────────────────

test('push do Google: aviso depois da confirmação, fora do toggle, só quando o deal NÃO foi movido', () => {
  const handler = corpoDe("functions.http('calendarWebhook'");
  const iMark = handler.indexOf('await markMeetingScheduled(lead.id)');
  const iCeo = handler.indexOf('await notifyCeo(');
  const iAviso = handler.indexOf("avisarReuniaoForaDoPipeline(lead, event, 'webhook')");
  const iSync = handler.indexOf('await triggerSyncLeads(');
  assert.ok(iMark >= 0 && iAviso > iMark, 'aviso tem de vir DEPOIS do CAS de meeting_scheduled');
  assert.ok(iAviso > iCeo, 'aviso tem de vir DEPOIS das confirmações (nunca atrasa o WhatsApp do lead)');
  assert.ok(iSync > iAviso, 'aviso antes do sync do Sheets');
  assert.match(handler, /if \(movido !== true\) \{\s*\n\s*await avisarReuniaoForaDoPipeline/, 'gate "deal não movido" sumiu');
  // Fora do else do toggle confirmacao_reuniao: o aviso vem depois do fechamento do bloco.
  const iToggle = handler.indexOf('ativas.confirmacao_reuniao === false');
  const iRun = handler.indexOf('await registrarRunSistema({', iToggle);
  assert.ok(iAviso > iRun, 'o aviso não pode depender do toggle de confirmação');
});

test('reconciliação também avisa (push perdido = CEO não recebeu nada)', () => {
  const corpo = corpoDe('const reconciliarEventos', 'const listarAgenda');
  assert.match(corpo, /const movido = await moveDealToReuniao\(lead\.id, event\)/);
  assert.match(corpo, /avisarReuniaoForaDoPipeline\(lead, event, 'reconcile'\)/);
});

test('aviso é SÓ interno: nunca escreve aprovação/classe, nunca cria deal, nunca envia mensagem', () => {
  const corpo = corpoDe('const diagnosticarVinculoPipeline', '// ─── Resync de reunião REMARCADA');
  assert.doesNotMatch(corpo, /aprovado/, "o ramo sem deal jamais grava 'aprovado'");
  assert.doesNotMatch(corpo, /aprovacao_status\s*:/, 'não escreve aprovacao_status');
  assert.doesNotMatch(corpo, /qualification_classification\s*:/, 'não escreve classe');
  assert.doesNotMatch(corpo, /rest\/v1\/(deals|atletas|form_submissions)[^`'"]*['"`],\s*\{\s*method: 'POST'/, 'não cria deal/atleta');
  assert.doesNotMatch(corpo, /method: 'PATCH'/, 'não faz PATCH em nada');
  for (const proibido of ['sendLinkMessage', 'SEND_WHATSAPP_URL', 'z-api.io', 'notifyCeo(', 'sendConfirmationWhatsApp']) {
    assert.ok(!corpo.includes(proibido), `o aviso não pode chamar ${proibido}`);
  }
});

test('idempotência no banco + best-effort + só produção + public', () => {
  const corpo = corpoDe('const avisarReuniaoForaDoPipeline', '// ─── Resync de reunião REMARCADA');
  assert.match(corpo, /notificacoes\?on_conflict=destinatario_id,dedupe_key/);
  assert.match(corpo, /resolution=ignore-duplicates/);
  assert.match(corpo, /reuniao_fora_pipeline_aviso_falhou/, 'catch com log WARN sumiu (best-effort)');
  assert.match(corpo, /if \(!AVISO_FORA_PIPELINE_ATIVO\)/, 'gate de produção sumiu');
  assert.match(SRC, /const AVISO_FORA_PIPELINE_ATIVO = SUPABASE_SCHEMA === 'public';/);
  assert.match(SRC, /const NOTIF_SCHEMA = 'public';/);
  assert.match(corpo, /'Content-Profile': NOTIF_SCHEMA/, 'notificação tem de ir para public');
  assert.match(corpo, /papel=in\.\(ceo,cto\)&ativo=is\.true/, 'destinatários CEO/CTO ativos');
});

test('sininho do CEO: aviso com dedupe_key aparece 1x (só a própria cópia), legado continua "vê tudo"', () => {
  const acoes = fs.readFileSync(
    path.join(__dirname, '..', 'apps', 'crm', 'src', 'lib', 'actions', 'automacoes.ts'),
    'utf8',
  );
  const i = acoes.indexOf('export async function getNotificacoesNaoLidas');
  assert.ok(i >= 0, 'getNotificacoesNaoLidas sumiu');
  const corpo = acoes.slice(i, acoes.indexOf('\n}\n', i));
  // 1 linha por destinatário (CEO e CTO) + "CEO vê todas" = aviso em dobro e
  // a cópia do outro nunca sai (RLS de UPDATE só marca a própria).
  assert.match(corpo, /dedupe_key\.is\.null,destinatario_id\.eq\.\$\{user\.id\}/, 'CEO voltaria a ver o aviso 2x');
  assert.match(corpo, /if \(papel !== "ceo"\) \{\s*\n\s*if \(user\) \{\s*\n\s*query = query\.eq\("destinatario_id", user\.id\);/, 'demais papéis: só as próprias');
});

// ─── Engine: o aviso leva a algum lugar e o lead aparece marcado ─────────

const lerCrm = (...p) => fs.readFileSync(path.join(__dirname, '..', 'apps', 'crm', 'src', ...p), 'utf8');

test('deep-link /leads?lead=<id> abre o dossiê de lead SEM atleta/deal e não gruda ao navegar', () => {
  const filtros = lerCrm('lib', 'leads-filtros.ts');
  assert.match(filtros, /lead: z\.preprocess\(primeiro, z\.uuid\(\)\)\.nullable\(\)\.catch\(null\)/,
    '?lead= tem que aceitar só UUID (URL editada à mão cai no padrão)');
  const url = filtros.slice(filtros.indexOf('export function urlFiltrosLeads'));
  assert.ok(!/f\.lead/.test(url), 'o deep-link não pode grudar na URL ao paginar/filtrar');
  const pagina = lerCrm('app', '(dashboard)', 'leads', 'page.tsx');
  assert.match(pagina, /if \(filtros\.lead\) return await obterLeadDossieInterno\(supabase, filtros\.lead\);/,
    'o link da notificação aponta para form_submission_id — não pode exigir atleta');
  const tabela = lerCrm('components', 'leads', 'LeadsTable.tsx');
  assert.match(tabela, /atleta: null, lead: null \}/, 'navegar na tabela tem que soltar os deep-links');
});

test('badge "Reunião detectada" do dossiê e do /leads vem do átomo único (contrato B4)', () => {
  const modal = lerCrm('components', 'leads', 'AprovacoesLeads.tsx');
  const tabela = lerCrm('components', 'leads', 'LeadsTable.tsx');
  for (const [nome, src] of [['AprovacoesLeads', modal], ['LeadsTable', tabela]]) {
    assert.match(src, /<ReuniaoDetectadaBadge\b/, `${nome}: badge local em vez do átomo`);
    assert.ok(!/>\s*Reunião detectada\s*</.test(src), `${nome}: cópia local do badge voltou`);
    assert.ok(!/reuniaoTitulo/.test(src), `${nome}: helper local de título voltou (texto divergente)`);
  }
  // Lista à esquerda + cabeçalho do dossiê.
  assert.equal((modal.match(/<ReuniaoDetectadaBadge\b/g) || []).length, 2, 'badge na lista E no cabeçalho do dossiê');
  // "Sem deal" só onde o recorte garante: a fila tem pendente com deal e
  // "Muito cedo" é quem está em Aguardando timing (tem deal).
  assert.match(modal, /const revisaoSemDeal = modo === "frios" \|\| modo === "incompletos";/,
    'semDeal do modal só pode valer para Frios/Incompletos');
  for (const m of modal.match(/<ReuniaoDetectadaBadge[\s\S]*?\/>/g) || []) {
    assert.match(m, /semDeal=\{revisaoSemDeal\}/, 'badge do modal com semDeal fora da regra');
  }
  // /leads: só no ramo sem deal ativo (pipeline_deal_id vem da view).
  assert.match(tabela,
    /if \(lead\.meeting_scheduled === true && !lead\.pipeline_deal_id\) \{[\s\S]{0,200}?<ReuniaoDetectadaBadge detectadaEm=\{lead\.meeting_scheduled_at\} semDeal \/>/,
    '/leads: badge "sem deal" fora do ramo sem deal ativo');
  const leads = lerCrm('lib', 'actions', 'leads.ts');
  assert.match(leads, /"submitted_at, meeting_scheduled, meeting_scheduled_at"/,
    'fila/revisão deixaram de trazer a reunião detectada para o dossiê');
});

test('T19: modal de Incompletos não diz mais "sem os dados obrigatórios"', () => {
  const modal = lerCrm('components', 'leads', 'AprovacoesLeads.tsx');
  assert.ok(!/sem os dados obrigatórios/.test(modal), 'texto enganoso voltou (85/85 INCOMPLETO tinham os dados)');
  assert.match(modal, /marcados como incompletos pelo classificador/);
});
