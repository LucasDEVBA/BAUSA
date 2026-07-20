const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ─── Configuração via variáveis de ambiente ─────────────────────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';
// Runs de observabilidade vão p/ public SEMPRE — o Engine (apps/crm) lê public em todos os ambientes, igual ao whatsapp_mensagens da zapi-inbox. NÃO usar SUPABASE_SCHEMA aqui.
const RUNS_SCHEMA = 'public';
const SEND_WHATSAPP_URL = process.env.SEND_WHATSAPP_URL;
const SEND_MESSAGES_URL = process.env.SEND_MESSAGES_URL;
const SYNC_LEADS_URL = process.env.SYNC_LEADS_URL;

// Throttle entre leads (anti-ban Z-API + cuidado com Resend rate limit)
const DELAY_BETWEEN_LEADS_MS = parseInt(process.env.DELAY_BETWEEN_LEADS_MS || '10000', 10);

// Máximo de leads por execução (proteção)
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
    // Timeout 90s (paridade com process-pending-whatsapp): o send-whatsapp
    // faz 2 envios sequenciais (atleta + responsável) com delay anti-ban de
    // 20-30s entre eles — 60s ficava apertado e gerava erro espúrio.
    req.setTimeout(90000, () => {
      req.destroy(new Error('Request timeout (90s)'));
    });
    if (postData) req.write(postData);
    req.end();
  });

// ─── Buscar leads cuja scheduled_followup_at já chegou ────────
// Critérios:
//   - timing_status = 'muito_cedo'
//   - scheduled_followup_at <= NOW()
//   - scheduled_followup_sent_at IS NULL
const fetchEligibleLeads = async () => {
  const nowIso = new Date().toISOString();
  const url = `${SUPABASE_URL}/rest/v1/form_submissions`
    + `?timing_status=eq.muito_cedo`
    + `&scheduled_followup_at=lte.${encodeURIComponent(nowIso)}`
    + `&scheduled_followup_sent_at=is.null`
    + `&select=*`
    + `&order=scheduled_followup_at.asc`
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
    throw new Error(`Supabase GET ${result.statusCode}: ${result.body}`);
  }
  return JSON.parse(result.body);
};

// ─── CAS atômico: marca scheduled_followup_sent_at ─────────────
// Retorna true APENAS se foi a instância que efetivamente atualizou
// (mesma lógica de markFollowupSent em process-followup-whatsapp).
const markScheduledFollowupSent = async (submissionId) => {
  const url = `${SUPABASE_URL}/rest/v1/form_submissions`
    + `?id=eq.${encodeURIComponent(submissionId)}`
    + `&scheduled_followup_sent_at=is.null`;

  const result = await httpRequest(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Profile': SUPABASE_SCHEMA,
      'Prefer': 'return=representation',
    },
  }, JSON.stringify({
    scheduled_followup_sent_at: new Date().toISOString(),
  }));

  if (result.statusCode >= 400) {
    throw new Error(`Supabase PATCH scheduled_followup_sent_at: ${result.statusCode} ${result.body}`);
  }

  const updated = JSON.parse(result.body || '[]');
  return Array.isArray(updated) && updated.length > 0;
};

// ─── Enviar WhatsApp scheduled_return ──────────────────────────
const triggerWhatsApp = async (lead) => {
  const payload = JSON.stringify({
    record: { ...lead },
    messageType: 'scheduled_return',
  });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

  const result = await httpRequest(SEND_WHATSAPP_URL, { method: 'POST', headers }, payload);
  return {
    statusCode: result.statusCode,
    body: result.body.substring(0, 300),
  };
};

// ─── Enviar Email scheduled_return ─────────────────────────────
const triggerEmail = async (lead) => {
  if (!SEND_MESSAGES_URL) {
    log('WARN', 'email_skip_no_url');
    return { statusCode: 0, body: 'SEND_MESSAGES_URL not configured' };
  }

  // schedule_url usado no CTA do email (mesmo padrão do send-whatsapp)
  const scheduleUrl = `https://bolsaatletausa.com/agendar?email=${encodeURIComponent(lead.email || '')}&name=${encodeURIComponent(lead.athlete_name || '')}`;

  const payload = JSON.stringify({
    record: { ...lead, schedule_url: scheduleUrl },
    messageType: 'scheduled_return',
  });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

  const result = await httpRequest(SEND_MESSAGES_URL, { method: 'POST', headers }, payload);
  return {
    statusCode: result.statusCode,
    body: result.body.substring(0, 300),
  };
};

// ─── Sincronizar Sheets ────────────────────────────────────────
const triggerSyncLeads = async (lead) => {
  if (!SYNC_LEADS_URL) return;
  const payload = JSON.stringify({ record: { ...lead } });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;
  try {
    await httpRequest(SYNC_LEADS_URL, { method: 'POST', headers }, payload);
  } catch (err) {
    log('WARN', 'sync_leads_error', { email: lead.email, error: err.message });
  }
};

// ─── Âncora da automação de SISTEMA (aba Execuções de /automacoes) ─────────
// ID fixo semeado pela migration 20260709220205_automacoes_sistema_runs
// (guard de CI: tests/automacao-runs-sistema.test.js compara CF ↔ migration).
const RUN_SCHEDULED_RETURN_ID = 'a0000000-0000-4000-8000-000000000005';

// ─── Registrar execução em automacao_runs (observabilidade) ────────────────
// SEGURANÇA: runs de sistema nascem SEMPRE em estado TERMINAL (sucesso/erro,
// tentativas=1, proxima_tentativa_at=null) — a automation-engine NUNCA os
// executa (a fila dela só seleciona pendente/erro-com-retry/executando).
// Falha no registro JAMAIS afeta o fluxo principal (WARN e segue).
// PII: contexto/resultado sem telefone/e-mail — só o nome do atleta.
const registrarRunSistema = async ({ automacaoId, ok, lead = null, acoes = [] }) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
    const postData = JSON.stringify({
      automacao_id: automacaoId,
      status: ok ? 'sucesso' : 'erro',
      tentativas: 1,
      proxima_tentativa_at: null,
      executado_at: new Date().toISOString(),
      gatilho_origem_tabela: lead && lead.id ? 'form_submissions' : null,
      gatilho_origem_id: (lead && lead.id) || null,
      contexto: lead ? { athlete_name: lead.athlete_name || null } : {},
      resultado: { acoes },
    });
    const result = await httpRequest(`${SUPABASE_URL}/rest/v1/automacao_runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Profile': RUNS_SCHEMA,
        'Prefer': 'return=minimal',
      },
    }, postData);
    if (result.statusCode >= 400) {
      throw new Error(`POST automacao_runs ${result.statusCode}: ${(result.body || '').substring(0, 200)}`);
    }
  } catch (e) {
    log('WARN', 'run_sistema_fallback', { error: e.message });
  }
};

// ─── Toggles on/off das automações de sistema (/automacoes) ────────────────
// configuracoes_sistema.sistema_automacoes_ativas — campo ausente = ATIVA
// (fail-open). Config indisponível JAMAIS para o scheduler — fallback {}.
const fetchAtivas = async () => {
  try {
    const url = `${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=eq.sistema_automacoes_ativas&select=valor`;
    const result = await httpRequest(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Accept-Profile': SUPABASE_SCHEMA,
        'Content-Type': 'application/json',
      },
    });
    if (result.statusCode >= 400) throw new Error(`GET ativas: ${result.statusCode}`);
    const valor = (JSON.parse(result.body)[0] || {}).valor;
    return valor && typeof valor === 'object' ? valor : {};
  } catch (e) {
    log('WARN', 'ativas_fallback', { error: e.message });
    return {};
  }
};

// ─── Cloud Function principal ──────────────────────────────────
functions.http('processScheduledFollowups', async (req, res) => {
  // Auth FAIL-CLOSED: secret obrigatório — os jobs do Cloud Scheduler enviam
  // o header x-webhook-secret (infra/scheduler.sh).
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false, error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const triggeredBy = req.body?.triggered_by || 'cron';

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SEND_WHATSAPP_URL) {
      throw new Error('Variáveis de ambiente obrigatórias não configuradas');
    }

    log('INFO', 'scheduled_followups_start', {
      triggeredBy,
      now: new Date().toISOString(),
      maxPerRun: MAX_LEADS_PER_RUN,
    });

    // Toggle on/off em /automacoes (ausente = ativo); desligado → sem envio,
    // leads seguem elegíveis (scheduled_followup_sent_at NULL) até reativar.
    const ativas = await fetchAtivas();
    if (ativas.scheduled_return === false) {
      log('WARN', 'scheduled_return_desativado_skip');
      return res.status(200).send({
        success: true,
        processed: 0,
        message: 'Retomada agendada desativada em /automacoes',
      });
    }

    const eligibleLeads = await fetchEligibleLeads();
    log('INFO', 'eligible_leads_found', { count: eligibleLeads.length });

    if (eligibleLeads.length === 0) {
      return res.status(200).send({
        success: true,
        processed: 0,
        message: 'Nenhum lead elegível (scheduled_followup_at não chegou ou já enviado)',
      });
    }

    const stats = { sent: 0, cas_lost: 0, failed: 0 };
    const details = [];

    for (let i = 0; i < eligibleLeads.length; i++) {
      const lead = eligibleLeads[i];
      const idx = `[${i + 1}/${eligibleLeads.length}]`;

      try {
        log('INFO', `${idx} processing`, {
          email: lead.email,
          athlete: lead.athlete_name,
          scheduledFor: lead.scheduled_followup_at,
        });

        // CAS atômico: só procede se for a primeira instância a marcar
        const marked = await markScheduledFollowupSent(lead.id);
        if (!marked) {
          stats.cas_lost++;
          log('INFO', `${idx} cas_lost`, {
            email: lead.email,
            reason: 'Outra execução já marcou scheduled_followup_sent_at',
          });
          continue;
        }

        // Envia WhatsApp + Email em paralelo
        const sentAt = new Date().toISOString();
        const [waResult, emailResult] = await Promise.all([
          triggerWhatsApp(lead).catch((err) => ({ statusCode: 500, body: err.message })),
          triggerEmail(lead).catch((err) => ({ statusCode: 500, body: err.message })),
        ]);

        log('INFO', `${idx} send_results`, {
          email: lead.email,
          whatsappStatusCode: waResult.statusCode,
          emailStatusCode: emailResult.statusCode,
        });

        // Registro em automacao_runs (aba Execuções) — estado TERMINAL, APÓS
        // o resultado real do envio (CAS perdido acima não registra).
        const envioOk = waResult.statusCode < 400 || emailResult.statusCode < 400;
        await registrarRunSistema({
          automacaoId: RUN_SCHEDULED_RETURN_ID,
          ok: envioOk,
          lead,
          acoes: [{
            tipo: 'scheduled_return',
            status: envioOk ? 'ok' : 'falha',
            detalhe: `whatsapp HTTP ${waResult.statusCode}, email HTTP ${emailResult.statusCode}`,
          }],
        });

        // Sincroniza Sheets (fire-and-forget)
        await triggerSyncLeads({ ...lead, scheduled_followup_sent_at: sentAt });

        if (waResult.statusCode < 400 || emailResult.statusCode < 400) {
          stats.sent++;
          details.push({ email: lead.email, status: 'sent', whatsapp: waResult.statusCode, email_status: emailResult.statusCode });
        } else {
          stats.failed++;
          details.push({ email: lead.email, status: 'failed', whatsapp: waResult.statusCode, email_status: emailResult.statusCode });
        }
      } catch (err) {
        stats.failed++;
        log('ERROR', `${idx} exception`, { email: lead.email, error: err.message });
        details.push({ email: lead.email, status: 'exception', error: err.message });
      }

      // Throttle anti-ban entre leads (default 10s)
      if (i < eligibleLeads.length - 1) {
        await sleep(DELAY_BETWEEN_LEADS_MS);
      }
    }

    const durationMs = Date.now() - startTime;
    log('INFO', 'scheduled_followups_complete', {
      triggeredBy,
      processed: eligibleLeads.length,
      ...stats,
      durationMs,
    });

    return res.status(200).send({
      success: true,
      triggeredBy,
      processed: eligibleLeads.length,
      ...stats,
      details,
      durationMs,
    });
  } catch (error) {
    log('CRITICAL', 'scheduled_followups_error', {
      error: error.message,
      durationMs: Date.now() - startTime,
    });
    return res.status(500).send({ success: false, error: error.message });
  }
});
