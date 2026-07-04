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
const ZAPI_INSTANCE_ID        = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN              = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN       = process.env.ZAPI_CLIENT_TOKEN;
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
      timeout: options.timeoutMs || 30000,
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

  // Buscar eventos modificados/criados nos últimos N minutos
  const updatedMin = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString();

  const response = await calendar.events.list({
    calendarId: GOOGLE_CALENDAR_ID,
    updatedMin,
    maxResults: 50,
    orderBy: 'updated',
    showDeleted: false,
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
// Usa ilike com sufixo dos últimos 9-10 dígitos para match independente de DDI/formato
const findLeadByContact = async (email, phone) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

  const conditions = [];
  if (email) {
    conditions.push(`guardian_email.eq.${encodeURIComponent(email)}`);
    conditions.push(`email.eq.${encodeURIComponent(email)}`);
  }

  if (phone) {
    // Extrair últimos 9-10 dígitos (número local sem DDI/DDD variável)
    const digits = phone.replace(/\D/g, '');
    const suffix = digits.length >= 10 ? digits.slice(-10) : digits.slice(-9);
    conditions.push(`guardian_whatsapp.like.*${suffix}`);
    conditions.push(`athlete_whatsapp.like.*${suffix}`);
  }

  if (conditions.length === 0) return null;

  const filter = `or=(${conditions.join(',')})`;
  // IMPORTANTE: select=* é obrigatório aqui porque o lead retornado é repassado
  // ao sync-elite-leads (triggerSyncLeads abaixo). O sync-leads/buildRow
  // sobrescreve TODAS as colunas A-BG do Google Sheets, tratando qualquer
  // campo undefined como string vazia. Um SELECT incompleto apaga endereço,
  // esporte, escola, qualificação, follow-ups e UTMs da planilha.
  // Bug histórico (2026-04-10 → 2026-05-28): 42 leads afetados.
  const url = `${SUPABASE_URL}/rest/v1/form_submissions?${filter}&select=*&limit=1`;

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

// ─── Marcar reunião no Supabase (CAS atômico) ─────────────────
// Retorna true APENAS se foi a instância que efetivamente atualizou
// (lead estava com meeting_scheduled != true). Se outra notificação
// já marcou — ou o lead já tinha reunião marcada — retorna false.
// Filtro `not.is.true` cobre os casos `false` (default da coluna) e `null`.
const markMeetingScheduled = async (leadId) => {
  const url = `${SUPABASE_URL}/rest/v1/form_submissions?id=eq.${leadId}&meeting_scheduled=not.is.true`;

  const result = await httpRequest(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Profile': SUPABASE_SCHEMA,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  }, JSON.stringify({
    meeting_scheduled: true,
    meeting_scheduled_at: new Date().toISOString(),
  }));

  if (result.statusCode >= 400) return false;

  try {
    const updated = JSON.parse(result.body || '[]');
    return Array.isArray(updated) && updated.length > 0;
  } catch {
    return false;
  }
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

// ─── Formatar telefone (E.164) ────────────────────────────────
const formatPhone = (phone) => {
  if (!phone) return null;
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.length <= 11) cleaned = `55${cleaned}`;
  if (cleaned.length < 12) return null;
  return cleaned;
};

// ─── Formatar data/hora do evento ─────────────────────────────
const formatEventDateTime = (event) => {
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
  return { eventDate, eventTime };
};

// ─── Enviar via Z-API com link preview ────────────────────────
const sendLinkMessage = async (phone, message, linkUrl, title, description) => {
  const formattedPhone = formatPhone(phone);
  if (!formattedPhone || !ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    log('WARN', 'zapi_skip', { phone, hasZapi: !!ZAPI_INSTANCE_ID });
    return false;
  }

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-link`;

  const postData = JSON.stringify({
    phone: formattedPhone,
    message,
    linkUrl,
    title,
    linkDescription: description,
    image: 'https://lh3.googleusercontent.com/a-/ALV-UjXKwLrleoe7peDm_g3u_88uIfrh08RcWDpvv2VkH7XIkjMFKWko=s256',
  });

  try {
    const result = await httpRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': ZAPI_CLIENT_TOKEN,
      },
    }, postData);

    log('INFO', 'zapi_sent', { phone: formattedPhone, statusCode: result.statusCode });
    return result.statusCode < 400;
  } catch (err) {
    log('WARN', 'zapi_error', { phone, error: err.message });
    return false;
  }
};

// ─── Builders hardcoded das mensagens de confirmação ──────────
// FALLBACK PERMANENTE dos textos custom (scheduler_mensagens.meeting_confirmed)
// — NUNCA remover (guard de CI: tests/calendar-webhook-mensagens.test.js).
const buildLeadMeetingMessage = (name, eventDate, eventTime) => `✅ *Reunião Estratégica Individual confirmada!*

Olá, *${name}*!

Sua reunião com *Leandro Ribeiro* está confirmada.

📅 *Data:* ${eventDate}
🕐 *Horário:* ${eventTime}h (Brasília)

_Recomendamos acessar 5 minutos antes do horário marcado._

Nos vemos em breve!
*Bolsa Atleta USA*`;

const buildCeoMeetingMessage = (athleteName, guardianName, phone, email, eventDate, eventTime) => `🔔 *Nova Reunião Agendada*

*Atleta:* ${athleteName}
*Responsável:* ${guardianName || athleteName}
*Telefone:* ${phone || 'N/A'}
${email ? `*Email:* ${email}` : ''}

📅 *${eventDate}*
🕐 *${eventTime}h*`;

// ─── Textos custom (configuracoes_sistema.scheduler_mensagens) ─
// O CEO edita em /automacoes (chave meeting_confirmed: { lead, ceo }).
// Mesmo padrão da CF send-whatsapp (Fase E): qualquer falha/ausência →
// null e os builders hardcoded acima assumem (fallback permanente).
const fetchMensagensCustom = async () => {
  // Sem credenciais Supabase → fallback total nos builders.
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

  try {
    const url = `${SUPABASE_URL}/rest/v1/configuracoes_sistema` +
      '?chave=eq.scheduler_mensagens&select=valor&limit=1';
    const result = await httpRequest(url, {
      method: 'GET',
      // 5s (não os 30s default): config degradada não pode atrasar a
      // confirmação instantânea de reunião.
      timeoutMs: 5000,
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Accept-Profile': SUPABASE_SCHEMA,
      },
    });

    if (result.statusCode >= 400) {
      throw new Error(`Supabase HTTP ${result.statusCode}`);
    }

    const rows = JSON.parse(result.body);
    const valor = Array.isArray(rows) ? rows[0]?.valor : null;
    // Seed ausente ou formato inesperado → builders assumem (sem erro)
    if (!valor || typeof valor !== 'object') return null;
    return valor;
  } catch (error) {
    log('WARN', 'mensagens_fallback', { error: error.message });
    return null;
  }
};

// Renderiza um texto custom substituindo todos os placeholders (split/join —
// nunca String.replace, que interpreta padrões com $). Retorna null (→ builder
// hardcoded assume) se o texto não existir, não for string ou renderizar
// vazio/whitespace.
const renderTemplate = (texto, vars) => {
  if (!texto || typeof texto !== 'string') return null;

  let rendered = texto;
  for (const [placeholder, valor] of Object.entries(vars)) {
    rendered = rendered.split(placeholder).join(valor);
  }

  if (!rendered.trim()) return null;
  return rendered;
};

// Variáveis suportadas nos textos custom — espelham as interpolações dos
// builders hardcoded. {meet_link} fica disponível, mas o link do Meet SEMPRE
// vai anexado como preview (sendLinkMessage), independente do texto.
const buildMeetingVars = (lead, recipientName, phone, event) => {
  const { eventDate, eventTime } = formatEventDateTime(event);
  return {
    '{atleta_nome}': lead.athlete_name || 'Atleta',
    '{responsavel_nome}': recipientName || 'Responsável',
    '{telefone}': phone || 'N/A',
    '{email}': lead.email || 'N/A',
    '{meet_link}': event.hangoutLink || event.htmlLink || '',
    '{data_reuniao}': eventDate,
    '{hora_reuniao}': eventTime,
  };
};

// ─── Enviar WhatsApp de confirmação para o lead ───────────────
// customMessage: texto custom já renderizado (null → builder hardcoded).
const sendConfirmationWhatsApp = async (phone, name, event, customMessage) => {
  if (!phone) return;

  const meetLink = event.hangoutLink || event.htmlLink || '';
  const { eventDate, eventTime } = formatEventDateTime(event);

  const message = customMessage || buildLeadMeetingMessage(name, eventDate, eventTime);

  const linkTitle = 'Reunião Estratégica Individual — Bolsa Atleta USA';
  const linkDesc = `${eventDate} às ${eventTime}h — com Leandro Ribeiro`;

  const sent = await sendLinkMessage(phone, message, meetLink, linkTitle, linkDesc);
  if (sent) {
    log('INFO', 'whatsapp_confirmation_sent', { phone, name });
  }
};

// ─── Notificar CEO ────────────────────────────────────────────
// customMessage: texto custom já renderizado (null → builder hardcoded).
const notifyCeo = async (athleteName, guardianName, phone, email, event, customMessage) => {
  if (!CEO_WHATSAPP) return;

  const meetLink = event.hangoutLink || event.htmlLink || '';
  const { eventDate, eventTime } = formatEventDateTime(event);

  const message = customMessage || buildCeoMeetingMessage(athleteName, guardianName, phone, email, eventDate, eventTime);

  const linkTitle = `Nova reunião — ${athleteName}`;
  const linkDesc = `${eventDate} às ${eventTime}h`;

  const sent = await sendLinkMessage(CEO_WHATSAPP, message, meetLink, linkTitle, linkDesc);
  if (sent) {
    log('INFO', 'ceo_notification_sent');
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
      const eventStart = event.start?.dateTime || event.start?.date;
      const isFuture = eventStart && new Date(eventStart) > new Date();
      const updatedRecently = event.updated && (Date.now() - new Date(event.updated).getTime()) < 10 * 60 * 1000;

      // Extrair email e telefone do evento
      const attendeeEmails = (event.attendees || [])
        .map(a => a.email?.toLowerCase())
        .filter(Boolean);
      const phone = extractPhoneFromEvent(event);

      log('INFO', 'event_check', {
        summary: (event.summary || '').substring(0, 50),
        eventStart,
        isFuture,
        updatedRecently,
        attendees: attendeeEmails,
        phone,
        updated: event.updated,
      });

      // Só processar eventos futuros ou recém-criados
      if (!isFuture && !updatedRecently) continue;

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

      // 1. Marcar reunião no Supabase (CAS atômico)
      // Só procede com WhatsApp/CEO/Sheets se ESTA instância foi quem
      // marcou de fato. Caso contrário, outra notificação concorrente
      // (ou anterior) já processou — evita confirmação duplicada.
      const marked = await markMeetingScheduled(lead.id);
      if (!marked) {
        log('INFO', 'meeting_already_marked_skip', {
          email: lead.email,
          eventId: event.id,
          reason: 'CAS perdido — outra notificação já marcou meeting_scheduled=true',
        });
        continue;
      }

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

      // Textos custom editáveis (meeting_confirmed) — buscados só quando um
      // lead vai de fato receber a confirmação. Falha/ausência → builders.
      const mensagensCustom = await fetchMensagensCustom();
      const meetingVars = buildMeetingVars(lead, confirmName, confirmPhone, event);
      const leadCustomMsg = renderTemplate(mensagensCustom?.meeting_confirmed?.lead, meetingVars);
      const ceoCustomMsg = renderTemplate(mensagensCustom?.meeting_confirmed?.ceo, meetingVars);

      if (confirmPhone) {
        await sendConfirmationWhatsApp(confirmPhone, confirmName, event, leadCustomMsg);
      }

      // 4. Notificar CEO
      await notifyCeo(
        lead.athlete_name,
        lead.guardian_name || lead.athlete_name,
        confirmPhone || 'N/A',
        lead.email,
        event,
        ceoCustomMsg,
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
