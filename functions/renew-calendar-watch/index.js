const functions = require('@google-cloud/functions-framework');
const { google } = require('googleapis');
const crypto = require('crypto');

// ─── Configuração ─────────────────────────────────────────────
const SERVICE_ACCOUNT_EMAIL   = process.env.SERVICE_ACCOUNT_EMAIL;
const GOOGLE_CALENDAR_ID      = process.env.GOOGLE_CALENDAR_ID;
const WEBHOOK_URL             = process.env.CALENDAR_WEBHOOK_URL;
const RAW_KEY                 = process.env.SERVICE_ACCOUNT_PRIVATE_KEY || '';
const SERVICE_ACCOUNT_PRIVATE_KEY = RAW_KEY
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\\\\n/g, '\n');

// ─── Log estruturado ──────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// ─── Cloud Function principal ─────────────────────────────────
functions.http('renewCalendarWatch', async (req, res) => {
  const startTime = Date.now();

  try {
    if (!SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY || !GOOGLE_CALENDAR_ID || !WEBHOOK_URL) {
      log('ERROR', 'missing_env_vars', {
        hasEmail: !!SERVICE_ACCOUNT_EMAIL,
        hasKey: !!SERVICE_ACCOUNT_PRIVATE_KEY,
        hasCalendarId: !!GOOGLE_CALENDAR_ID,
        hasWebhookUrl: !!WEBHOOK_URL,
      });
      return res.status(500).send({ success: false, error: 'Missing env vars' });
    }

    const auth = new google.auth.JWT(
      SERVICE_ACCOUNT_EMAIL,
      undefined,
      SERVICE_ACCOUNT_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/calendar'],
    );

    const calendar = google.calendar({ version: 'v3', auth });

    // Gerar ID único para o canal
    const channelId = `bausa-calendar-${crypto.randomUUID().slice(0, 8)}`;

    // Tentar parar watches antigos (ignora erros)
    try {
      // Não temos o ID do canal antigo, mas o Google limpa automaticamente
      // quando um novo watch é criado para o mesmo calendário
      log('INFO', 'creating_new_watch');
    } catch { /* ignorar */ }

    // Criar novo watch — expira em 7 dias
    const watchResponse = await calendar.events.watch({
      calendarId: GOOGLE_CALENDAR_ID,
      requestBody: {
        id: channelId,
        type: 'web_hook',
        address: WEBHOOK_URL,
        // Expira em 7 dias (máximo permitido pelo Google)
        expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const durationMs = Date.now() - startTime;

    log('INFO', 'watch_created', {
      channelId,
      resourceId: watchResponse.data.resourceId,
      expiration: watchResponse.data.expiration,
      durationMs,
    });

    return res.status(200).send({
      success: true,
      channelId,
      resourceId: watchResponse.data.resourceId,
      expiration: new Date(Number(watchResponse.data.expiration)).toISOString(),
      durationMs,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    log('ERROR', 'watch_creation_failed', {
      error: error.message,
      durationMs,
    });

    return res.status(500).send({
      success: false,
      error: error.message,
    });
  }
});
