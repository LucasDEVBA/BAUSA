const functions = require('@google-cloud/functions-framework');
const { google } = require('googleapis');

// ─── Configuração ─────────────────────────────────────────────
// HTTP POST (chamado pelo BAUSA Engine com x-webhook-secret): lista os
// eventos do Google Calendar do CEO que casam com UM lead (por e-mail de
// convidado OU telefone na descrição — mesmo matching do calendar-webhook).
// Usado pela UI de "relink" da aba Reunião: quando um lead remarca, o deal
// pode ficar preso no evento antigo; esta função dá visibilidade de TODAS
// as reuniões do lead para o CEO religar a correta.
// Read-only (calendar.readonly), não escreve em nada.
const WEBHOOK_SECRET        = process.env.WEBHOOK_SECRET;
const SERVICE_ACCOUNT_EMAIL = process.env.SERVICE_ACCOUNT_EMAIL;
const GOOGLE_CALENDAR_ID    = process.env.GOOGLE_CALENDAR_ID;
const RAW_KEY               = process.env.SERVICE_ACCOUNT_PRIVATE_KEY || '';
const SERVICE_ACCOUNT_PRIVATE_KEY = RAW_KEY
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\\\\n/g, '\n');

// Janela de busca: histórico + futuros (remarcações vivem nos dois lados)
const LOOKBACK_DAYS  = 180;
const LOOKAHEAD_DAYS = 120;
// Paginação: singleEvents expande recorrências (um recorrente diário já gera
// ~300 instâncias na janela) — sem paginar, o corte por startTime ASC perderia
// exatamente os eventos RECENTES (os que interessam ao relink).
const PAGE_SIZE  = 250;
const MAX_PAGES  = 8;

// Mesmo padrão de anexo de transcrição da CF meeting-transcripts
const TRANSCRIPT_TITLE_RE = /transcript|transcri[çc][ãa]o|notes by gemini|anota[çc][õo]es (do|de) gemini|notas (do|de) gemini/i;
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

// ─── Log estruturado ──────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// ─── Auth Google (Calendar readonly) ──────────────────────────
const buildGoogleAuth = () => new google.auth.JWT(
  SERVICE_ACCOUNT_EMAIL,
  undefined,
  SERVICE_ACCOUNT_PRIVATE_KEY,
  ['https://www.googleapis.com/auth/calendar.readonly'],
);

// Últimos 10 dígitos do telefone (qualquer DDI) — mesmo matching do webhook
const phoneTail = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits.slice(-10) : null;
};

// O evento casa com o lead? Attendee por e-mail OU QUALQUER telefone do lead
// (responsável e atleta — o webhook casa contra os dois) na descrição.
const eventMatchesLead = (event, emails, tails) => {
  const attendees = (event.attendees || []).map((a) => (a.email || '').toLowerCase());
  if (emails.some((e) => e && attendees.includes(e))) return true;
  if (tails.length > 0) {
    const descDigits = String(event.description || '').replace(/\D/g, '');
    if (tails.some((t) => descDigits.includes(t))) return true;
  }
  return false;
};

// ─── Cloud Function principal ─────────────────────────────────
functions.http('calendarLeadEvents', async (req, res) => {
  // API de consulta do Engine: secret OBRIGATÓRIO (≠ schedulers).
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false, error: 'Unauthorized' });
  }
  if (req.method !== 'POST') {
    return res.status(405).send({ success: false, error: 'Method not allowed' });
  }

  const startTime = Date.now();
  try {
    if (!GOOGLE_CALENDAR_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
      throw new Error('Env vars do Google (Calendar/Service Account) não configuradas');
    }

    const body = req.body || {};
    const emails = [body.email, body.guardianEmail]
      .filter(Boolean)
      .map((e) => String(e).trim().toLowerCase());
    // Aceita 1..N telefones (responsável + atleta — o webhook casa contra ambos)
    const phonesInput = Array.isArray(body.phones) ? body.phones : [body.phone];
    const tails = [...new Set(phonesInput.map(phoneTail).filter(Boolean))];

    if (emails.length === 0 && tails.length === 0) {
      return res.status(400).send({ success: false, error: 'Informe email e/ou phone(s).' });
    }

    const auth = buildGoogleAuth();
    const calendar = google.calendar({ version: 'v3', auth });

    const timeMin = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
    const timeMax = new Date(Date.now() + LOOKAHEAD_DAYS * 86400000).toISOString();

    // showDeleted: eventos cancelados aparecem (contexto de remarcação).
    // Pagina até o fim da janela (teto MAX_PAGES) — sem isto, o corte por
    // startTime ASC perderia os eventos recentes.
    const items = [];
    let pageToken;
    let pages = 0;
    do {
      const listRes = await calendar.events.list({
        calendarId: GOOGLE_CALENDAR_ID,
        timeMin,
        timeMax,
        singleEvents: true,
        showDeleted: true,
        maxResults: PAGE_SIZE,
        orderBy: 'startTime',
        pageToken,
      });
      items.push(...(listRes.data.items || []));
      pageToken = listRes.data.nextPageToken;
      pages++;
    } while (pageToken && pages < MAX_PAGES);
    if (pageToken) {
      log('WARN', 'lead_events_window_truncated', { pages, scanned: items.length });
    }

    const eventos = items
      .filter((ev) => eventMatchesLead(ev, emails, tails))
      .map((ev) => {
        const attachment = (ev.attachments || []).find((a) =>
          a.mimeType === GOOGLE_DOC_MIME && TRANSCRIPT_TITLE_RE.test(a.title || ''));
        return {
          id: ev.id,
          summary: ev.summary || '(sem título)',
          start: ev.start?.dateTime || ev.start?.date || null,
          end: ev.end?.dateTime || ev.end?.date || null,
          status: ev.status || 'confirmed',
          hangoutLink: ev.hangoutLink || null,
          htmlLink: ev.htmlLink || null,
          updated: ev.updated || null,
          temTranscricaoAnexada: !!attachment,
        };
      })
      // Mais recentes primeiro (start desc) — a remarcação nova no topo.
      .sort((a, b) => new Date(b.start || 0) - new Date(a.start || 0));

    const durationMs = Date.now() - startTime;
    log('INFO', 'lead_events_listed', {
      scanned: items.length,
      matched: eventos.length,
      hasEmail: emails.length > 0,
      phones: tails.length,
      durationMs,
    });

    return res.status(200).send({ success: true, eventos });
  } catch (error) {
    log('ERROR', 'lead_events_error', { error: error.message });
    return res.status(500).send({ success: false, error: error.message });
  }
});
