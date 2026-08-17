const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ─── Configuração via variáveis de ambiente ─────────────────────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';
const QUALIFY_LEAD_URL = process.env.QUALIFY_LEAD_URL;

// Janela mínima entre tentativas (evita spam quando Gemini cai por horas)
const COOLDOWN_HOURS = parseInt(process.env.COOLDOWN_HOURS || '6', 10);

// Limite de tentativas. Após isso, lead fica pendente mas não é
// reprocessado automaticamente — exige clique manual no War Room.
const MAX_AUTOMATIC_ATTEMPTS = parseInt(process.env.MAX_AUTOMATIC_ATTEMPTS || '10', 10);

// Throttle entre leads (rate limit Gemini)
const DELAY_BETWEEN_LEADS_MS = parseInt(process.env.DELAY_BETWEEN_LEADS_MS || '4000', 10);

// Limite de leads processados por execução (proteção)
const MAX_LEADS_PER_RUN = parseInt(process.env.MAX_LEADS_PER_RUN || '50', 10);

// ─── Log estruturado ───────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// ─── Helpers ───────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const httpRequest = (url, options, postData) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'POST',
      headers: options.headers || {},
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy(new Error('Request timeout (60s)'));
    });
    if (postData) req.write(postData);
    req.end();
  });

// ─── Buscar leads pendentes elegíveis para retry ───────────────
// Critérios:
//   - qualification_pending = TRUE
//   - last_qualification_attempt_at < NOW() - COOLDOWN_HOURS (evita spam)
//   - qualification_attempts < MAX_AUTOMATIC_ATTEMPTS (após X tentativas
//     automáticas, lead fica esperando ação manual)
const fetchPendingLeads = async () => {
  const cooldownThreshold = new Date(Date.now() - COOLDOWN_HOURS * 3600 * 1000).toISOString();

  const url = `${SUPABASE_URL}/rest/v1/form_submissions`
    + `?qualification_pending=is.true`
    + `&last_qualification_attempt_at=lt.${encodeURIComponent(cooldownThreshold)}`
    + `&qualification_attempts=lt.${MAX_AUTOMATIC_ATTEMPTS}`
    + `&deleted_at=is.null`
    + `&select=id,email,athlete_name,qualification_attempts,last_qualification_error`
    + `&order=last_qualification_attempt_at.asc.nullsfirst`
    + `&limit=${MAX_LEADS_PER_RUN}`;

  const result = await httpRequest(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept-Profile': SUPABASE_SCHEMA,
    },
  });

  if (result.statusCode >= 400) {
    throw new Error(`Supabase GET pending leads: ${result.statusCode} ${result.body}`);
  }

  return JSON.parse(result.body);
};

// ─── Buscar dados completos de 1 lead (para enviar ao qualify-lead) ─
const fetchLeadFullRecord = async (leadId) => {
  const url = `${SUPABASE_URL}/rest/v1/form_submissions?id=eq.${encodeURIComponent(leadId)}&select=*&limit=1`;

  const result = await httpRequest(url, {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept-Profile': SUPABASE_SCHEMA,
    },
  });

  if (result.statusCode >= 400) {
    throw new Error(`Supabase GET lead ${leadId}: ${result.statusCode}`);
  }

  const arr = JSON.parse(result.body);
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
};

// ─── Chamar qualify-lead para 1 lead específico ────────────────
const triggerQualify = async (leadRecord) => {
  if (!QUALIFY_LEAD_URL) {
    throw new Error('QUALIFY_LEAD_URL não configurada');
  }

  const payload = JSON.stringify({ record: leadRecord });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

  const result = await httpRequest(QUALIFY_LEAD_URL, { method: 'POST', headers }, payload);
  return {
    statusCode: result.statusCode,
    body: result.body.substring(0, 500),
  };
};

// ─── Cloud Function principal ──────────────────────────────────
functions.http('retryQualification', async (req, res) => {
  // Auth FAIL-CLOSED: secret obrigatório — os jobs do Cloud Scheduler enviam
  // o header x-webhook-secret (infra/scheduler.sh). O padrão antigo (fail-open
  // sem header) deixava qualquer chamada anônima da internet executar o job.
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false, error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const triggeredBy = req.body?.triggered_by || 'cron';
  const forceLeadId = req.body?.lead_id;

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !QUALIFY_LEAD_URL) {
      throw new Error('Variáveis de ambiente não configuradas');
    }

    log('INFO', 'retry_qualification_start', {
      triggeredBy,
      forceLeadId: forceLeadId || null,
      cooldownHours: COOLDOWN_HOURS,
      maxAttempts: MAX_AUTOMATIC_ATTEMPTS,
      maxPerRun: MAX_LEADS_PER_RUN,
    });

    let leads;

    if (forceLeadId) {
      // Forçar retry de 1 lead específico (chamada manual via War Room/Lead detail)
      const lead = await fetchLeadFullRecord(forceLeadId);
      if (!lead) {
        return res.status(404).send({ success: false, error: 'Lead não encontrado' });
      }
      leads = [lead];
    } else {
      // Cron: busca todos elegíveis
      const summary = await fetchPendingLeads();
      log('INFO', 'pending_leads_found', { count: summary.length });

      if (summary.length === 0) {
        return res.status(200).send({
          success: true,
          processed: 0,
          message: 'Nenhum lead pendente elegível para retry',
        });
      }

      // Busca registros completos
      leads = [];
      for (const s of summary) {
        const full = await fetchLeadFullRecord(s.id);
        if (full) leads.push(full);
      }
    }

    const results = { sent: 0, success: 0, pending_again: 0, failed: 0, details: [] };

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const idx = `[${i + 1}/${leads.length}]`;

      try {
        log('INFO', 'retry_lead_start', {
          submissionId: lead.id,
          email: lead.email,
          previousAttempts: lead.qualification_attempts,
        });

        const r = await triggerQualify(lead);
        results.sent++;

        const parsed = (() => { try { return JSON.parse(r.body); } catch { return null; } })();

        if (r.statusCode >= 200 && r.statusCode < 300) {
          // 200 = qualificação OK; 202 = ainda pendente (Gemini falhou de novo);
          // skipped_disabled = automação desativada em /automacoes (não é sucesso)
          if (parsed?.action === 'pending_retry') {
            results.pending_again++;
            log('INFO', `${idx} still_pending`, { email: lead.email });
          } else if (parsed?.action === 'skipped_disabled') {
            results.skipped_disabled = (results.skipped_disabled || 0) + 1;
            log('WARN', `${idx} skipped_disabled`, { email: lead.email });
          } else {
            results.success++;
            log('INFO', `${idx} qualified_ok`, {
              email: lead.email,
              classification: parsed?.qualification?.classification,
            });
          }
        } else {
          results.failed++;
          log('ERROR', `${idx} retry_failed`, { email: lead.email, statusCode: r.statusCode, body: r.body });
        }

        results.details.push({
          email: lead.email,
          athlete: lead.athlete_name,
          statusCode: r.statusCode,
          action: parsed?.action || 'qualified',
        });
      } catch (err) {
        results.failed++;
        log('ERROR', `${idx} retry_exception`, { email: lead.email, error: err.message });
        results.details.push({ email: lead.email, athlete: lead.athlete_name, error: err.message });
      }

      // Throttle entre leads para não martelar Gemini
      if (i < leads.length - 1) await sleep(DELAY_BETWEEN_LEADS_MS);
    }

    const durationMs = Date.now() - startTime;
    log('INFO', 'retry_qualification_complete', {
      triggeredBy,
      processed: leads.length,
      success: results.success,
      pendingAgain: results.pending_again,
      failed: results.failed,
      durationMs,
    });

    return res.status(200).send({
      success: true,
      triggeredBy,
      processed: leads.length,
      results,
      durationMs,
    });
  } catch (error) {
    log('CRITICAL', 'retry_qualification_error', {
      error: error.message,
      durationMs: Date.now() - startTime,
    });

    return res.status(500).send({
      success: false,
      error: error.message,
    });
  }
});
