const functions = require('@google-cloud/functions-framework');
const https = require('https');
const { google } = require('googleapis');

// ─── Configuração ─────────────────────────────────────────────
const WEBHOOK_SECRET          = process.env.WEBHOOK_SECRET;
const SUPABASE_URL            = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY    = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA         = process.env.SUPABASE_SCHEMA || 'public';
const SEND_WHATSAPP_URL       = process.env.SEND_WHATSAPP_URL;
const SYNC_LEADS_URL          = process.env.SYNC_LEADS_URL;
const SERVICE_ACCOUNT_EMAIL   = process.env.SERVICE_ACCOUNT_EMAIL;
const GOOGLE_CALENDAR_ID      = process.env.GOOGLE_CALENDAR_ID;
const CEO_WHATSAPP            = process.env.CEO_WHATSAPP || '';
const RAW_KEY                 = process.env.SERVICE_ACCOUNT_PRIVATE_KEY || '';
const SERVICE_ACCOUNT_PRIVATE_KEY = RAW_KEY
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\\\\n/g, '\n');

// ─── Log estruturado ──────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// ─── HTTP helper com timeout ──────────────────────────────────
const httpRequest = (url, options, postData) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 30000,
    };
    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
};

// ─── Buscar eventos recentes do Calendar ──────────────────────
const getRecentEvents = async (sinceMinutes = 10) => {
  const auth = new google.auth.JWT(
    SERVICE_ACCOUNT_EMAIL,
    undefined,
    SERVICE_ACCOUNT_PRIVATE_KEY,
    ['https://www.googleapis.com/auth/calendar.readonly'],
  );

  const calendar = google.calendar({ version: 'v3', auth });

  const timeMin = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // +60 dias

  const response = await calendar.events.list({
    calendarId: GOOGLE_CALENDAR_ID,
    timeMin,
    timeMax,
    singleEvents: true,
    maxResults: 20,
    orderBy: 'updated',
  });

  return response.data.items || [];
};

// ─── Extrair telefone da descrição do evento ──────────────────
const extractPhoneFromEvent = (event) => {
  const description = event.description || '';
  // Procura padrões de telefone na descrição
  const phonePatterns = [
    /(?:telefone|phone|whatsapp|celular|tel)[:\s]*([+\d\s()-]{10,})/i,
    /(\+?\d{2}\s?\d{2}\s?\d{4,5}[-\s]?\d{4})/,
    /(\+?\d{10,15})/,
  ];

  for (const pattern of phonePatterns) {
    const match = description.match(pattern);
    if (match) {
      return match[1].replace(/[\s()-]/g, '');
    }
  }

  return null;
};

// ─── Buscar lead por email ou telefone ────────────────────────
const findLeadByContact = async (email, phone) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

  const conditions = [];
  if (email) conditions.push(`guardian_email.eq.${encodeURIComponent(email)}`);
  if (email) conditions.push(`email.eq.${encodeURIComponent(email)}`);
  if (phone) conditions.push(`guardian_whatsapp.eq.${encodeURIComponent(phone)}`);
  if (phone) conditions.push(`athlete_whatsapp.eq.${encodeURIComponent(phone)}`);

  if (conditions.length === 0) return null;

  const filter = `or=(${conditions.join(',')})`;
  const url = `${SUPABASE_URL}/rest/v1/form_submissions?${filter}&select=id,email,athlete_name,guardian_name,guardian_whatsapp,athlete_whatsapp,meeting_scheduled&limit=1`;

  const result = await httpRequest(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept-Profile': SUPABASE_SCHEMA,
    },
  });

  const leads = JSON.parse(result.body);
  return Array.isArray(leads) && leads.length > 0 ? leads[0] : null;
};

// ─── Marcar reunião no Supabase ───────────────────────────────
const markMeetingScheduled = async (leadId) => {
  const url = `${SUPABASE_URL}/rest/v1/form_submissions?id=eq.${leadId}&meeting_scheduled=is.null`;

  const result = await httpRequest(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Profile': SUPABASE_SCHEMA,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
  }, JSON.stringify({
    meeting_scheduled: true,
    meeting_scheduled_at: new Date().toISOString(),
  }));

  return result.statusCode < 400;
};

// ─── Mover deal para reuniao_marcada ──────────────────────────
const moveDealToReuniao = async (leadId, event) => {
  // Buscar atleta
  const atletaUrl = `${SUPABASE_URL}/rest/v1/atletas?form_submission_id=eq.${leadId}&deleted_at=is.null&select=id`;
  const atletaRes = await httpRequest(atletaUrl, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept-Profile': SUPABASE_SCHEMA,
    },
  });

  const atletas = JSON.parse(atletaRes.body);
  if (!Array.isArray(atletas) || atletas.length === 0) return false;

  const atletaId = atletas[0].id;

  // Buscar deal ativo
  const dealUrl = `${SUPABASE_URL}/rest/v1/deals?atleta_id=eq.${atletaId}&etapa=eq.lead&deleted_at=is.null&select=id`;
  const dealRes = await httpRequest(dealUrl, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept-Profile': SUPABASE_SCHEMA,
    },
  });

  const deals = JSON.parse(dealRes.body);
  if (!Array.isArray(deals) || deals.length === 0) return false;

  const dealId = deals[0].id;
  const meetLink = event.hangoutLink || event.htmlLink || '';
  const meetDate = event.start?.dateTime || event.start?.date || null;

  const updateUrl = `${SUPABASE_URL}/rest/v1/deals?id=eq.${dealId}`;
  const updateRes = await httpRequest(updateUrl, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Profile': SUPABASE_SCHEMA,
      'Content-Type': 'application/json',
    },
  }, JSON.stringify({
    etapa: 'reuniao_marcada',
    etapa_anterior: 'lead',
    google_calendar_event_id: event.id || 'detected',
    next_action: 'Preparar para reunião',
    data_proxima_acao: meetDate ? meetDate.split('T')[0] : new Date().toISOString().split('T')[0],
    reuniao_agendada_at: new Date().toISOString(),
    reuniao_data: meetDate,
    reuniao_link: meetLink,
  }));

  return updateRes.statusCode < 400;
};

// ─── Enviar WhatsApp de confirmação ───────────────────────────
const sendConfirmationWhatsApp = async (phone, name, event) => {
  if (!SEND_WHATSAPP_URL || !phone) return;

  const meetLink = event.hangoutLink || event.htmlLink || '';
  const eventDate = event.start?.dateTime
    ? new Date(event.start.dateTime).toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
        timeZone: 'America/Sao_Paulo',
      })
    : 'Data a confirmar';
  const eventTime = event.start?.dateTime
    ? new Date(event.start.dateTime).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : '';

  const message = `✅ *Reunião Confirmada!*

Olá, *${name}*!

Sua *Reunião Estratégica Individual* com *Leandro Ribeiro* está confirmada.

📅 *Data:* ${eventDate}
🕐 *Horário:* ${eventTime}h (Brasília)
${meetLink ? `📍 *Link da reunião:* ${meetLink}` : ''}

_Recomendamos acessar 5 minutos antes do horário marcado._

Nos vemos em breve!
*Bolsa Atleta USA*`;

  const payload = JSON.stringify({
    record: {
      athlete_name: name,
      guardian_name: name,
      guardian_whatsapp: phone,
      athlete_whatsapp: phone,
      qualification_classification: 'QUENTE',
    },
    messageType: 'meeting_confirmed',
    customMessage: message,
    phone,
  });

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

  try {
    await httpRequest(SEND_WHATSAPP_URL, { method: 'POST', headers }, payload);
    log('INFO', 'whatsapp_confirmation_sent', { phone, name });
  } catch (err) {
    log('WARN', 'whatsapp_confirmation_failed', { phone, error: err.message });
  }
};

// ─── Notificar CEO ────────────────────────────────────────────
const notifyCeo = async (name, phone, email, event) => {
  if (!SEND_WHATSAPP_URL || !CEO_WHATSAPP) return;

  const meetLink = event.hangoutLink || event.htmlLink || '';
  const eventDate = event.start?.dateTime
    ? new Date(event.start.dateTime).toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long',
        timeZone: 'America/Sao_Paulo',
      })
    : '';
  const eventTime = event.start?.dateTime
    ? new Date(event.start.dateTime).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })
    : '';

  const message = `🔔 *Nova Reunião Agendada*

*Nome:* ${name}
*Telefone:* ${phone}
${email ? `*Email:* ${email}` : ''}

📅 *Data:* ${eventDate}
🕐 *Horário:* ${eventTime}h
${meetLink ? `📍 *Link:* ${meetLink}` : ''}`;

  const payload = JSON.stringify({
    record: {
      athlete_name: name,
      guardian_name: 'CEO',
      guardian_whatsapp: CEO_WHATSAPP,
      athlete_whatsapp: CEO_WHATSAPP,
      qualification_classification: 'QUENTE',
    },
    messageType: 'meeting_confirmed',
    customMessage: message,
    phone: CEO_WHATSAPP,
  });

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

  try {
    await httpRequest(SEND_WHATSAPP_URL, { method: 'POST', headers }, payload);
    log('INFO', 'ceo_notification_sent');
  } catch (err) {
    log('WARN', 'ceo_notification_failed', { error: err.message });
  }
};

// ─── Sync Sheets ──────────────────────────────────────────────
const triggerSyncLeads = async (lead) => {
  if (!SYNC_LEADS_URL) return;

  const payload = JSON.stringify({ record: lead });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

  try {
    await httpRequest(SYNC_LEADS_URL, { method: 'POST', headers }, payload);
  } catch (err) {
    log('WARN', 'sync_leads_failed', { error: err.message });
  }
};

// ─── Cloud Function principal ─────────────────────────────────
functions.http('calendarWebhook', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).send('');

  const startTime = Date.now();

  // Google Push Notification headers
  const channelId = req.headers['x-goog-channel-id'];
  const resourceState = req.headers['x-goog-resource-state'];

  log('INFO', 'webhook_received', { channelId, resourceState, method: req.method });

  // Validação do webhook (sync = verificação inicial do Google)
  if (resourceState === 'sync') {
    log('INFO', 'webhook_sync_verified');
    return res.status(200).send({ success: true, action: 'sync_verified' });
  }

  // Só processa quando há mudança real (exists = criado/atualizado)
  if (resourceState !== 'exists') {
    return res.status(200).send({ success: true, action: 'ignored', resourceState });
  }

  try {
    // Buscar eventos criados/modificados nos últimos 10 minutos
    const events = await getRecentEvents(10);

    log('INFO', 'events_fetched', { count: events.length });

    let processed = 0;

    for (const event of events) {
      // Só processar eventos futuros (não passados)
      const eventStart = event.start?.dateTime || event.start?.date;
      if (!eventStart || new Date(eventStart) < new Date()) continue;

      // Extrair email e telefone do evento
      const attendeeEmails = (event.attendees || [])
        .map(a => a.email?.toLowerCase())
        .filter(Boolean);
      const phone = extractPhoneFromEvent(event);

      if (attendeeEmails.length === 0 && !phone) continue;

      // Buscar lead no Supabase
      let lead = null;
      for (const email of attendeeEmails) {
        lead = await findLeadByContact(email, phone);
        if (lead) break;
      }

      // Se não encontrou por email, tenta só por telefone
      if (!lead && phone) {
        lead = await findLeadByContact(null, phone);
      }

      if (!lead) {
        log('INFO', 'no_matching_lead', {
          eventId: event.id,
          emails: attendeeEmails,
          phone,
          summary: event.summary,
        });
        continue;
      }

      // Já foi marcado? Pula
      if (lead.meeting_scheduled) {
        log('INFO', 'already_scheduled', { email: lead.email });
        continue;
      }

      log('INFO', 'lead_matched', {
        email: lead.email,
        athlete: lead.athlete_name,
        eventId: event.id,
      });

      // 1. Marcar reunião no Supabase
      await markMeetingScheduled(lead.id);

      // 2. Mover deal no pipeline
      try {
        const moved = await moveDealToReuniao(lead.id, event);
        log('INFO', moved ? 'deal_moved' : 'no_deal_found', { leadId: lead.id });
      } catch (err) {
        log('WARN', 'deal_move_error', { error: err.message });
      }

      // 3. Enviar WhatsApp de confirmação para o lead
      const confirmPhone = phone || lead.guardian_whatsapp || lead.athlete_whatsapp;
      const confirmName = lead.guardian_name || lead.athlete_name;
      if (confirmPhone) {
        await sendConfirmationWhatsApp(confirmPhone, confirmName, event);
      }

      // 4. Notificar CEO
      await notifyCeo(
        lead.athlete_name,
        confirmPhone || 'N/A',
        lead.email,
        event,
      );

      // 5. Sync Sheets
      await triggerSyncLeads({
        ...lead,
        meeting_scheduled: true,
        meeting_scheduled_at: new Date().toISOString(),
      });

      processed++;
    }

    const durationMs = Date.now() - startTime;
    log('INFO', 'webhook_complete', { processed, durationMs });

    return res.status(200).send({
      success: true,
      processed,
      durationMs,
    });
  } catch (error) {
    log('ERROR', 'webhook_error', { error: error.message });
    return res.status(500).send({ success: false, error: error.message });
  }
});
