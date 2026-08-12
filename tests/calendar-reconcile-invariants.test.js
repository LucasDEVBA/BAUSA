const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Guard: reconciliação e agenda do Calendar.
 *
 * Origem (12/08/2026): o CEO tinha 3 reuniões no dia e a tela mostrava 1.
 * Duas causas distintas — uma reunião cujo push do Google se perdeu e nunca
 * foi reprocessado (o webhook só olha `updatedMin` dos últimos 10 min), e
 * outra sem lead nenhum, invisível numa tela que só lia `deals`.
 *
 * Estes testes travam as duas correções.
 */

const SRC = fs.readFileSync(
  path.join(__dirname, '..', 'functions', 'calendar-webhook', 'index.js'),
  'utf8',
);

test('a reconciliação existe e é acionável por action=reconcile', () => {
  assert.match(SRC, /const reconciliarEventos = async/, 'reconciliarEventos sumiu');
  assert.match(SRC, /action === 'reconcile'/, 'a rota action=reconcile sumiu');
});

test('a reconciliação varre uma JANELA de datas, não apenas o que mudou agora', () => {
  // getEventsInWindow usa timeMin/timeMax; getRecentEvents usa updatedMin.
  // Se a reconciliação passar a usar updatedMin, volta o bug original:
  // evento antigo com notificação perdida nunca mais é visto.
  assert.match(SRC, /const getEventsInWindow = async/, 'getEventsInWindow sumiu');
  assert.match(SRC, /timeMin,\s*\n\s*timeMax,/, 'getEventsInWindow deve consultar por timeMin/timeMax');
  const corpo = SRC.slice(
    SRC.indexOf('const reconciliarEventos'),
    SRC.indexOf('const listarAgenda'),
  );
  assert.match(corpo, /getEventsInWindow\(/, 'reconciliarEventos deve usar getEventsInWindow');
  assert.doesNotMatch(corpo, /getRecentEvents\(/, 'reconciliarEventos NÃO pode depender de updatedMin');
});

test('a reconciliação NÃO envia mensagem para o lead', () => {
  // Ela roda em lote sobre eventos possivelmente antigos: notificar aqui
  // mandaria confirmação de reunião que já aconteceu. Notificar é do webhook.
  const corpo = SRC.slice(
    SRC.indexOf('const reconciliarEventos'),
    SRC.indexOf('const listarAgenda'),
  );
  for (const proibido of ['sendWhatsApp', 'enviarWhatsApp', 'notifyCEO', 'sendEmail']) {
    assert.ok(
      !corpo.includes(proibido),
      `reconciliarEventos não pode chamar ${proibido} — envio é só do webhook`,
    );
  }
});

test('reconcile e agenda exigem o segredo compartilhado', () => {
  const bloco = SRC.slice(SRC.indexOf("if (action === 'reconcile'"), SRC.indexOf('const startTime') + 400);
  assert.match(
    SRC,
    /action === 'reconcile' \|\| action === 'agenda'[\s\S]{0,400}x-webhook-secret/,
    'os modos novos precisam validar x-webhook-secret antes de executar',
  );
  assert.ok(bloco.length > 0);
});

test('o matching evento→lead é UM só para webhook, reconcile e agenda', () => {
  // Se cada caminho casasse por critério próprio, a tela mostraria vínculo
  // que a automação não enxerga (e vice-versa).
  assert.match(SRC, /const matchLeadForEvent = async/, 'matchLeadForEvent sumiu');
  // Só CHAMADAS (a definição é `= async (`, não casa com `nome(`).
  const chamadas = SRC.match(/await matchLeadForEvent\(/g) || [];
  assert.ok(
    chamadas.length >= 3,
    `matchLeadForEvent deve ser chamado nos 3 caminhos — webhook, reconcile e agenda ` +
      `(achei ${chamadas.length})`,
  );
});

test('o caminho do push do Google segue intacto', () => {
  // Os modos novos entram ANTES, mas não podem ter alterado o webhook.
  assert.match(SRC, /resourceState === 'sync'/, 'validação inicial do Google sumiu');
  assert.match(SRC, /resourceState !== 'exists'/, 'filtro de mudança real sumiu');
  assert.match(SRC, /getRecentEvents\(10\)/, 'o webhook deve seguir lendo os últimos 10 min');
});

test('deal em contato_feito também é movido para reuniao_marcada', () => {
  // O filtro era `etapa=eq.lead`; com o processo de 9 estágios, um lead
  // abordado ativamente que agendasse reunião não seria movido.
  assert.match(
    SRC,
    /etapa=in\.\(lead,contato_feito\)/,
    'moveDealToReuniao deve aceitar lead E contato_feito',
  );
});

test('a agenda consulta public — o Engine lê public em todos os ambientes', () => {
  // Em UAT a CF aponta para o schema `uat`, que só tem form_submissions
  // vazio: a tela mostrava "sem lead" em reunião que TEM lead (12/08/2026).
  // A leitura da agenda é para o Engine, então segue o schema dele.
  const corpo = SRC.slice(SRC.indexOf('const listarAgenda'), SRC.indexOf("functions.http('calendarWebhook'"));
  assert.match(
    corpo,
    /matchLeadForEvent\([^)]*'public'\)/,
    "listarAgenda deve casar o lead contra 'public'",
  );
});

test('a ESCRITA da reconciliação continua no schema do ambiente', () => {
  // O contrário do teste acima: se a reconciliação gravasse em public, a CF
  // de UAT alteraria produção.
  const corpo = SRC.slice(SRC.indexOf('const reconciliarEventos'), SRC.indexOf('const listarAgenda'));
  assert.doesNotMatch(
    corpo,
    /matchLeadForEvent\([^)]*'public'\)/,
    'reconciliarEventos NÃO pode forçar public — usaria produção a partir de UAT',
  );
});

test('compromisso pessoal não pede vínculo', () => {
  // "Casa", lembretes e blocos de foco entram na agenda, mas sem alerta.
  assert.match(SRC, /pedeVinculo/, 'a flag pedeVinculo sumiu');
  assert.match(
    SRC,
    /const externos = base\.emails\.filter/,
    'o critério deve ser convidado externo (além do próprio CEO) ou telefone',
  );
});

test('a consulta de janela PAGINA — corte silencioso come o futuro', () => {
  // orderBy startTime crescente: uma página só traz os eventos mais ANTIGOS
  // e descarta o resto. Na agenda de 300 dias isso devolveu 250 eventos que
  // paravam 5 semanas atrás — zero reuniões de hoje em diante (PRD 12/08/2026).
  const corpo = SRC.slice(
    SRC.indexOf('const getEventsInWindow'),
    SRC.indexOf('const extractPhoneFromEvent'),
  );
  assert.match(corpo, /pageToken/, 'getEventsInWindow precisa paginar');
  assert.match(corpo, /nextPageToken/, 'deve seguir o nextPageToken da API');
  assert.match(
    corpo,
    /events_window_truncated/,
    'ao estourar o teto de páginas tem de LOGAR — truncar calado foi o bug',
  );
});
