const functions = require('@google-cloud/functions-framework');
const { google } = require('googleapis');
const crypto = require('crypto');
const https = require('https');

// ─── Configuração ─────────────────────────────────────────────
const SERVICE_ACCOUNT_EMAIL   = process.env.SERVICE_ACCOUNT_EMAIL;
const GOOGLE_CALENDAR_ID      = process.env.GOOGLE_CALENDAR_ID;
const WEBHOOK_URL             = process.env.CALENDAR_WEBHOOK_URL;
const RAW_KEY                 = process.env.SERVICE_ACCOUNT_PRIVATE_KEY || '';
const SERVICE_ACCOUNT_PRIVATE_KEY = RAW_KEY
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\\\\n/g, '\n');
// Sinal de observabilidade (config manual pós-deploy — ver plano F2): sem
// essas envs a CF funciona normalmente, só não grava o watch_state.
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA      = process.env.SUPABASE_SCHEMA || 'public';

// ─── Log estruturado ──────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// ─── Sinal observável: calendar_watch_state em configuracoes_sistema ───
// O watch do Google expira em ≤7 dias; se este cron falhar, o push do
// calendar-webhook morre EM SILÊNCIO (a falha mais silenciosa do sistema —
// auditoria 2026-07-19). Gravar a expiração dá ao monitor-health um sinal
// positivo: `expiration < now+24h` → alerta crítico ANTES do watch morrer.
// FAIL-OPEN: telemetria nunca pode quebrar a renovação em si.
const salvarWatchState = (state) => new Promise((resolve) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log('WARN', 'watch_state_skip', { reason: 'envs Supabase ausentes' });
    return resolve(false);
  }
  try {
    const postData = JSON.stringify({ valor: state });
    const u = new URL(`${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=eq.calendar_watch_state`);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Profile': SUPABASE_SCHEMA,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        Prefer: 'return=minimal',
      },
      timeout: 15000,
    }, (res) => {
      res.resume();
      if (res.statusCode >= 400) log('WARN', 'watch_state_save_failed', { statusCode: res.statusCode });
      resolve(res.statusCode < 400);
    });
    req.on('error', (e) => { log('WARN', 'watch_state_save_failed', { error: e.message }); resolve(false); });
    req.on('timeout', () => { req.destroy(); log('WARN', 'watch_state_save_failed', { error: 'timeout' }); resolve(false); });
    req.write(postData);
    req.end();
  } catch (e) {
    log('WARN', 'watch_state_save_failed', { error: e.message });
    resolve(false);
  }
});

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

    // Sinal observável (fail-open — nunca bloqueia a renovação)
    await salvarWatchState({
      expiration: new Date(Number(watchResponse.data.expiration)).toISOString(),
      channelId,
      resourceId: watchResponse.data.resourceId || null,
      renewed_at: new Date().toISOString(),
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
