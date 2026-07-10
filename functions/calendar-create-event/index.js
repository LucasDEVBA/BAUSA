const functions = require('@google-cloud/functions-framework');
const crypto = require('crypto');
const { google } = require('googleapis');

// ─── Configuração ─────────────────────────────────────────────
// HTTP POST (Engine, x-webhook-secret OBRIGATÓRIO): cria um compromisso no
// Google Calendar do CEO a partir da /agenda do Engine. O evento carrega o
// NOME DO ATLETA no título e o telefone/e-mail do lead na descrição — o
// mesmo matching do calendar-webhook, que então detecta o evento e cuida da
// notificação/pipeline (1ª reunião) ou do resync (remarcação).
//
// Degradação graciosa (limitações conhecidas de service account):
//  • attendees: SA sem Domain-Wide Delegation não pode convidar → tenta com
//    convidado; em 403 recria sem (o lead é avisado por WhatsApp, não por
//    convite do Google).
//  • Meet: tenta conferenceData (hangoutsMeet); se falhar, cria sem Meet e
//    devolve meetCriado=false (o CEO adiciona na UI do Calendar se quiser).
const WEBHOOK_SECRET        = process.env.WEBHOOK_SECRET;
const SERVICE_ACCOUNT_EMAIL = process.env.SERVICE_ACCOUNT_EMAIL;
const GOOGLE_CALENDAR_ID    = process.env.GOOGLE_CALENDAR_ID;
const RAW_KEY               = process.env.SERVICE_ACCOUNT_PRIVATE_KEY || '';
const SERVICE_ACCOUNT_PRIVATE_KEY = RAW_KEY
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\\\\n/g, '\n');

const DURACAO_MIN_DEFAULT = 60;
const DURACAO_MIN_MAX = 240;

// ─── Log estruturado ──────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// ─── Auth Google (Calendar events — escrita) ──────────────────
const buildGoogleAuth = () => new google.auth.JWT(
  SERVICE_ACCOUNT_EMAIL,
  undefined,
  SERVICE_ACCOUNT_PRIVATE_KEY,
  ['https://www.googleapis.com/auth/calendar.events'],
);

const isConferenceError = (err) => {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('conference') || msg.includes('invalid conference type');
};

const isAttendeeForbidden = (err) => {
  const code = err?.code || err?.response?.status;
  const msg = String(err?.message || '').toLowerCase();
  return code === 403 && (msg.includes('attendee') || msg.includes('service account'));
};

// ─── Cloud Function principal ─────────────────────────────────
functions.http('calendarCreateEvent', async (req, res) => {
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false, error: 'Unauthorized' });
  }
  if (req.method !== 'POST') {
    return res.status(405).send({ success: false, error: 'Method not allowed' });
  }

  try {
    if (!GOOGLE_CALENDAR_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
      throw new Error('Env vars do Google (Calendar/Service Account) não configuradas');
    }

    const body = req.body || {};
    const athleteName = String(body.athleteName || '').trim();
    const guardianName = String(body.guardianName || '').trim();
    const leadEmail = String(body.leadEmail || '').trim().toLowerCase();
    const phone = String(body.phone || '').replace(/\D/g, '');
    const startIso = String(body.startIso || '');
    const observacao = String(body.observacao || '').trim();
    let duracaoMin = Number(body.duracaoMin) || DURACAO_MIN_DEFAULT;
    if (duracaoMin < 15 || duracaoMin > DURACAO_MIN_MAX) duracaoMin = DURACAO_MIN_DEFAULT;

    const startMs = Date.parse(startIso);
    if (!athleteName || !Number.isFinite(startMs)) {
      return res.status(400).send({ success: false, error: 'Informe athleteName e startIso válidos.' });
    }

    const endIso = new Date(startMs + duracaoMin * 60000).toISOString();

    // Título com o NOME DO ATLETA (pedido do CEO); descrição carrega os
    // identificadores que o calendar-webhook usa para casar o lead
    // (telefone em dígitos e/ou e-mail).
    const summary = guardianName
      ? `Reunião — ${athleteName} (${guardianName})`
      : `Reunião — ${athleteName}`;
    const descriptionLinhas = [
      `Reunião criada pelo BAUSA Engine.`,
      `Atleta: ${athleteName}`,
      guardianName ? `Responsável: ${guardianName}` : null,
      phone ? `Telefone: ${phone}` : null,
      leadEmail ? `E-mail: ${leadEmail}` : null,
      observacao ? `\n${observacao}` : null,
    ].filter(Boolean);

    const baseEvent = {
      summary,
      description: descriptionLinhas.join('\n'),
      start: { dateTime: new Date(startMs).toISOString() },
      end: { dateTime: endIso },
    };

    const auth = buildGoogleAuth();
    const calendar = google.calendar({ version: 'v3', auth });

    // Tentativas em ordem de riqueza: (Meet + convidado) → sem convidado →
    // sem Meet. Cada recuo é logado.
    const attempts = [];
    if (leadEmail) {
      attempts.push({ meet: true, attendee: true });
    }
    attempts.push({ meet: true, attendee: false });
    attempts.push({ meet: false, attendee: false });

    let created = null;
    let meetCriado = false;
    let conviteEnviado = false;
    let lastErr = null;

    for (const tent of attempts) {
      const resource = { ...baseEvent };
      if (tent.attendee) resource.attendees = [{ email: leadEmail }];
      if (tent.meet) {
        resource.conferenceData = {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }
      try {
        const insertRes = await calendar.events.insert({
          calendarId: GOOGLE_CALENDAR_ID,
          conferenceDataVersion: tent.meet ? 1 : 0,
          sendUpdates: tent.attendee ? 'all' : 'none',
          requestBody: resource,
        });
        created = insertRes.data;
        meetCriado = Boolean(created.hangoutLink);
        conviteEnviado = tent.attendee;
        break;
      } catch (err) {
        lastErr = err;
        // Recuo esperado: convidado proibido p/ SA sem DWD, ou Meet indisponível.
        if (tent.attendee && isAttendeeForbidden(err)) {
          log('WARN', 'attendee_forbidden_retry_sem_convidado', { error: err.message });
          continue;
        }
        if (tent.meet && isConferenceError(err)) {
          log('WARN', 'meet_indisponivel_retry_sem_meet', { error: err.message });
          continue;
        }
        // Outro erro (403 de escrita no calendar, 401, rede): não insiste.
        throw err;
      }
    }

    if (!created) {
      throw lastErr || new Error('Falha ao criar o evento.');
    }

    log('INFO', 'event_created', {
      eventId: created.id,
      meetCriado,
      conviteEnviado,
      start: startIso,
    });

    return res.status(200).send({
      success: true,
      eventId: created.id,
      htmlLink: created.htmlLink || null,
      hangoutLink: created.hangoutLink || null,
      meetCriado,
      conviteEnviado,
    });
  } catch (error) {
    const code = error?.code || error?.response?.status || null;
    log('ERROR', 'create_event_error', { error: error.message, code });
    // 403 de escrita = calendar não compartilhado com a SA como editor —
    // mensagem acionável para a UI.
    const hint = code === 403
      ? ' (compartilhe o calendário com a service account como "Fazer alterações em eventos")'
      : '';
    return res.status(500).send({ success: false, error: `${error.message}${hint}` });
  }
});
