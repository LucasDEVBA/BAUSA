const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ─── Configuração via variáveis de ambiente ─────────────────────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SEND_WHATSAPP_URL = process.env.SEND_WHATSAPP_URL;
const SYNC_LEADS_URL = process.env.SYNC_LEADS_URL;
// Schema do Supabase: 'public' em PRD, 'uat' em UAT, 'dev' em DEV
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';

// ─── Log estruturado ───────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// ─── Requisição HTTPS genérica com timeout ─────────────────────
const httpRequest = (url, options, postData) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout (30s)'));
    });

    if (postData) req.write(postData);
    req.end();
  });
};

// ─── Buscar leads pendentes de WhatsApp ────────────────────────
// Critério: qualificados (QUENTE ou MORNO), há mais de 22h, sem whatsapp_sent_at
const fetchPendingLeads = async () => {
  // Leads qualificados há mais de 22h que ainda não receberam WhatsApp
  const twentyTwoHoursAgo = new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString();

  // Busca leads:
  // - classification é QUENTE ou MORNO
  // - qualified_at existe e é anterior a 22h atrás
  // - whatsapp_sent_at é NULL (ainda não enviou)
  const filters = [
    'qualification_classification=in.(QUENTE,MORNO)',
    `qualified_at=lt.${twentyTwoHoursAgo}`,
    'qualified_at=not.is.null',
    'whatsapp_sent_at=is.null',
  ].join('&');

  const url = `${SUPABASE_URL}/rest/v1/form_submissions?${filters}&select=*&order=qualified_at.asc&limit=20`;

  const result = await httpRequest(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept-Profile': SUPABASE_SCHEMA,
      'Content-Type': 'application/json',
    },
  });

  if (result.statusCode >= 400) {
    throw new Error(`Supabase GET ${result.statusCode}: ${result.body}`);
  }

  return JSON.parse(result.body);
};

// ─── Marcar lead como WhatsApp enviado ─────────────────────────
// Prefere id=eq.${submissionId} (cirúrgico). Fallback case-insensitive.
const markWhatsAppSent = async (submissionId, email, athleteName) => {
  let url;
  if (submissionId) {
    url = `${SUPABASE_URL}/rest/v1/form_submissions?id=eq.${encodeURIComponent(submissionId)}`;
  } else {
    url = `${SUPABASE_URL}/rest/v1/form_submissions`
      + `?email=ilike.${encodeURIComponent((email || '').trim())}`
      + `&athlete_name=ilike.${encodeURIComponent((athleteName || '').trim())}`;
  }

  const postData = JSON.stringify({
    whatsapp_sent_at: new Date().toISOString(),
  });

  const result = await httpRequest(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Profile': SUPABASE_SCHEMA,
      'Prefer': 'return=representation',
    },
  }, postData);

  if (result.statusCode >= 400) {
    throw new Error(`Supabase PATCH ${result.statusCode}: ${result.body}`);
  }

  return true;
};

// ─── Sincronizar lead atualizado com Google Sheets ─────────────
// Chama sync-elite-leads com o registro completo + campos atualizados.
// Fire-and-forget: erros de sync não bloqueiam o fluxo principal.
const triggerSyncLeads = async (lead) => {
  if (!SYNC_LEADS_URL) {
    log('WARN', 'sync_leads_skip', { reason: 'SYNC_LEADS_URL não configurada' });
    return;
  }

  const payload = JSON.stringify({ record: { ...lead } });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

  try {
    const result = await httpRequest(SYNC_LEADS_URL, { method: 'POST', headers }, payload);
    if (result.statusCode >= 400) {
      log('WARN', 'sync_leads_failed', { email: lead.email, statusCode: result.statusCode });
    } else {
      log('INFO', 'sync_leads_ok', { email: lead.email });
    }
  } catch (err) {
    log('WARN', 'sync_leads_error', { email: lead.email, error: err.message });
  }
};

// ─── Enviar WhatsApp via send-whatsapp function ────────────────
const triggerWhatsApp = async (lead) => {
  const payload = JSON.stringify({
    record: {
      ...lead,
    },
  });

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

  const result = await httpRequest(SEND_WHATSAPP_URL, {
    method: 'POST',
    headers,
  }, payload);

  return {
    statusCode: result.statusCode,
    body: result.body.substring(0, 300),
  };
};

// ─── Delay entre leads (anti-ban) ──────────────────────────────
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Cloud Function principal ──────────────────────────────────
functions.http('processPendingWhatsApp', async (req, res) => {
  const startTime = Date.now();

  // ─── Autenticação via secret compartilhado ──────────────────
  // Permite chamadas do Cloud Scheduler (sem secret) e chamadas autenticadas
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret']) {
    const incoming = req.headers['x-webhook-secret'];
    if (incoming !== WEBHOOK_SECRET) {
      log('WARN', 'auth_failed', { ip: req.ip });
      return res.status(401).send({ success: false, error: 'Unauthorized' });
    }
  }

  try {
    // Validação de env vars obrigatórias
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SEND_WHATSAPP_URL) {
      throw new Error('Variáveis de ambiente obrigatórias não configuradas');
    }

    log('INFO', 'scheduler_start', { timestamp: new Date().toISOString() });

    // 1. Buscar leads pendentes
    const pendingLeads = await fetchPendingLeads();

    if (pendingLeads.length === 0) {
      log('INFO', 'no_pending_leads');
      return res.status(200).send({
        success: true,
        processed: 0,
        message: 'Nenhum lead pendente de WhatsApp',
      });
    }

    log('INFO', 'pending_leads_found', { count: pendingLeads.length });

    // 2. Processar cada lead
    const results = [];

    for (const lead of pendingLeads) {
      try {
        log('INFO', 'processing_lead', {
          email: lead.email,
          athlete: lead.athlete_name,
          classification: lead.qualification_classification,
          qualifiedAt: lead.qualified_at,
        });

        // 2a. Envia WhatsApp
        const whatsappResult = await triggerWhatsApp(lead);

        log('INFO', 'whatsapp_result', {
          email: lead.email,
          statusCode: whatsappResult.statusCode,
        });

        // 2b. Marca como enviado e sincroniza o Sheets com o registro atualizado
        if (whatsappResult.statusCode < 400) {
          const whatsappSentAt = new Date().toISOString();
          await markWhatsAppSent(lead.id, lead.email, lead.athlete_name);

          // Sync full row: passa o lead com whatsapp_sent_at preenchido
          await triggerSyncLeads({ ...lead, whatsapp_sent_at: whatsappSentAt });

          results.push({
            email: lead.email,
            athlete: lead.athlete_name,
            status: 'sent',
          });
        } else {
          log('ERROR', 'whatsapp_send_failed', {
            email: lead.email,
            statusCode: whatsappResult.statusCode,
            body: whatsappResult.body,
          });

          results.push({
            email: lead.email,
            athlete: lead.athlete_name,
            status: 'failed',
            error: `HTTP ${whatsappResult.statusCode}`,
          });
        }

        // 2c. Delay entre leads (45-60s aleatório para anti-ban)
        if (pendingLeads.indexOf(lead) < pendingLeads.length - 1) {
          const randomDelay = 45000 + Math.floor(Math.random() * 15000);
          log('INFO', 'delay_between_leads', { delayMs: randomDelay });
          await delay(randomDelay);
        }

      } catch (leadError) {
        log('ERROR', 'lead_processing_failed', {
          email: lead.email,
          error: leadError.message,
        });

        results.push({
          email: lead.email,
          athlete: lead.athlete_name,
          status: 'error',
          error: leadError.message,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const sent = results.filter(r => r.status === 'sent').length;
    const failed = results.filter(r => r.status !== 'sent').length;

    log('INFO', 'scheduler_complete', {
      processed: results.length,
      sent,
      failed,
      durationMs,
    });

    return res.status(200).send({
      success: true,
      processed: results.length,
      sent,
      failed,
      results,
      durationMs,
    });

  } catch (error) {
    log('CRITICAL', 'scheduler_failed', {
      error: error.message,
      durationMs: Date.now() - startTime,
    });

    return res.status(500).send({
      success: false,
      error: 'Erro no processamento de WhatsApp pendentes',
    });
  }
});