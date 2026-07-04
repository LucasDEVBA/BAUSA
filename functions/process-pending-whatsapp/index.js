const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ─── Configuração via variáveis de ambiente ─────────────────────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SEND_WHATSAPP_URL = process.env.SEND_WHATSAPP_URL;
const SEND_MESSAGES_URL = process.env.SEND_MESSAGES_URL; // messenger-service (email)
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
    // Timeout 90s: o send-whatsapp pode demorar ~25-40s para dois envios
    // sequenciais (atleta + responsável) com retry interno do Z-API.
    // O timeout antigo de 30s causava lead_processing_failed mesmo quando
    // Z-API confirmava entrega — gerando duplicação no próximo cron.
    req.setTimeout(90000, () => {
      req.destroy();
      reject(new Error('Request timeout (90s)'));
    });

    if (postData) req.write(postData);
    req.end();
  });
};

// ─── Intervalos configuráveis (editáveis pelo CEO em /automacoes) ──────────
// Lidos de configuracoes_sistema.scheduler_intervalos com fallback nos
// defaults históricos. INVARIANTE (guard de CI): clamp 1h–720h — a config
// jamais pode zerar o delay (envio imediato) nem congelar o fluxo >30 dias.
const DEFAULT_INICIAL_HORAS = 22;
const DEFAULT_TIMING_ALT_HORAS = 48;

const clampHoras = (valor, fallback) => {
  // parseFloat (não Number): null/''/false viram NaN → fallback, em vez de 0→1h
  const n = typeof valor === 'number' ? valor : Number.parseFloat(valor);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 1), 720);
};

const fetchIntervalos = async () => {
  try {
    const url = `${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=eq.scheduler_intervalos&select=valor`;
    const result = await httpRequest(url, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Accept-Profile': SUPABASE_SCHEMA,
        'Content-Type': 'application/json',
      },
    });
    if (result.statusCode >= 400) throw new Error(`GET intervalos: ${result.statusCode}`);
    const valor = (JSON.parse(result.body)[0] || {}).valor || {};
    return {
      inicialHoras: clampHoras(valor.whatsapp_inicial_horas, DEFAULT_INICIAL_HORAS),
      timingAltHoras: clampHoras(valor.whatsapp_timing_alt_horas, DEFAULT_TIMING_ALT_HORAS),
    };
  } catch (e) {
    // Config indisponível JAMAIS para o scheduler — usa os defaults históricos
    log('WARN', 'intervalos_fallback', { error: e.message });
    return { inicialHoras: DEFAULT_INICIAL_HORAS, timingAltHoras: DEFAULT_TIMING_ALT_HORAS };
  }
};

// ─── Buscar leads pendentes de WhatsApp ────────────────────────
// 2 critérios distintos:
//   A) Timing ideal:        QUENTE/MORNO, qualified_at > Nh (default 22h), sem whatsapp_sent_at
//   B) Timing alternativo:  timing_status IN (muito_cedo, tarde_demais),
//                            qualified_at > Nh (default 48h — mais tempo para
//                            acomodar a comunicação sensível), sem whatsapp_sent_at
const fetchPendingLeads = async () => {
  const intervalos = await fetchIntervalos();
  log('INFO', 'intervalos_em_uso', intervalos);
  const twentyTwoHoursAgo = new Date(Date.now() - intervalos.inicialHoras * 60 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(Date.now() - intervalos.timingAltHoras * 60 * 60 * 1000).toISOString();

  const fetchByFilters = async (filters) => {
    const url = `${SUPABASE_URL}/rest/v1/form_submissions?${filters.join('&')}&select=*&order=qualified_at.asc&limit=20`;
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

  // Bucket A: Timing ideal — 22h desde qualified_at
  const idealLeads = await fetchByFilters([
    'qualification_classification=in.(QUENTE,MORNO)',
    `qualified_at=lt.${twentyTwoHoursAgo}`,
    'qualified_at=not.is.null',
    'whatsapp_sent_at=is.null',
    'or=(timing_status.is.null,timing_status.eq.ideal)',
  ]);

  // Bucket B: Timing alternativo — 48h desde qualified_at (early_potential ou late_timing)
  // Mantém o mesmo filtro de classificação Gemini do Bucket A: somente leads
  // QUENTE/MORNO recebem mensagens automáticas. Leads FRIO + timing alternativo
  // não entram no fluxo (paridade com leads FRIO + timing ideal, que já são excluídos).
  const alternativeLeads = await fetchByFilters([
    'qualification_classification=in.(QUENTE,MORNO)',
    'timing_status=in.(muito_cedo,tarde_demais)',
    `qualified_at=lt.${fortyEightHoursAgo}`,
    'qualified_at=not.is.null',
    'whatsapp_sent_at=is.null',
  ]);

  // Deduplicação por id (defensivo, caso queries se sobreponham)
  const seen = new Set();
  const all = [];
  for (const lead of [...idealLeads, ...alternativeLeads]) {
    if (!seen.has(lead.id)) {
      seen.add(lead.id);
      all.push(lead);
    }
  }
  return all;
};

// ─── Marcar lead como WhatsApp enviado (CAS atômico) ───────────
// MUDANÇA CRÍTICA: agora inclui o filtro `whatsapp_sent_at=is.null`
// na query para garantir atomicidade. Apenas 1 instância vence o
// PATCH; instâncias seguintes recebem 0 rows updated e sabem que
// devem PULAR o envio.
//
// Esta função DEVE ser chamada ANTES do envio para Z-API. Se o envio
// falhar/timeout posteriormente, o CAS já está marcado e evita duplicar
// em próximas execuções do cron.
//
// Retorna true se foi a instância que efetivamente marcou (única
// autorizada a enviar). Retorna false caso contrário.
const markWhatsAppSent = async (submissionId, email, athleteName) => {
  let url;
  if (submissionId) {
    url = `${SUPABASE_URL}/rest/v1/form_submissions`
      + `?id=eq.${encodeURIComponent(submissionId)}`
      + `&whatsapp_sent_at=is.null`;
  } else {
    url = `${SUPABASE_URL}/rest/v1/form_submissions`
      + `?email=ilike.${encodeURIComponent((email || '').trim())}`
      + `&athlete_name=ilike.${encodeURIComponent((athleteName || '').trim())}`
      + `&whatsapp_sent_at=is.null`;
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

  // Retorna true se atualizou (fomos os primeiros) — false se outra
  // instância (anterior ou concorrente) já marcou e ganhou a corrida.
  try {
    const updated = JSON.parse(result.body || '[]');
    return Array.isArray(updated) && updated.length > 0;
  } catch {
    return false;
  }
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

// ─── Helper: traduz timing_status → messageType correspondente ──
// 'ideal'        → 'initial'           (template original "Reunião Estratégica")
// 'muito_cedo'   → 'early_potential'   (potencial, retorno em novembro)
// 'tarde_demais' → 'late_timing'       (fora da janela competitiva)
const timingToMessageType = (timingStatus) => {
  if (timingStatus === 'muito_cedo') return 'early_potential';
  if (timingStatus === 'tarde_demais') return 'late_timing';
  return 'initial';
};

// ─── Enviar WhatsApp via send-whatsapp function ────────────────
const triggerWhatsApp = async (lead) => {
  const messageType = timingToMessageType(lead.timing_status);
  const payload = JSON.stringify({
    record: { ...lead },
    messageType,
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
    messageType,
  };
};

// ─── Enviar Email via messenger-service ───────────────────────
// Disparado em paralelo ao WhatsApp APENAS para timing_status
// alternativos (muito_cedo / tarde_demais). Para timing ideal o
// email já foi enviado no INSERT do form_submissions (fluxo original).
const triggerEmail = async (lead) => {
  if (!SEND_MESSAGES_URL) {
    log('WARN', 'email_skip_no_url', { email: lead.email });
    return { statusCode: 0, body: 'SEND_MESSAGES_URL not configured' };
  }

  const messageType = timingToMessageType(lead.timing_status);
  const payload = JSON.stringify({
    record: { ...lead },
    messageType,
  });

  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

  const result = await httpRequest(SEND_MESSAGES_URL, {
    method: 'POST',
    headers,
  }, payload);

  return {
    statusCode: result.statusCode,
    body: result.body.substring(0, 300),
    messageType,
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

        // 2a. CAS ATÔMICO ANTES DO ENVIO: marca whatsapp_sent_at = NOW()
        // SOMENTE SE ainda for NULL. Se outra execução já marcou ou venceu
        // a corrida, pula este lead. Isso garante que mesmo em timeout do
        // send-whatsapp (Z-API às vezes demora >30s) NÃO duplicamos no
        // próximo cron, porque o registro já foi marcado antes do envio.
        const whatsappSentAt = new Date().toISOString();
        let marked = false;
        try {
          marked = await markWhatsAppSent(lead.id, lead.email, lead.athlete_name);
        } catch (markErr) {
          log('ERROR', 'cas_mark_failed', { email: lead.email, error: markErr.message });
          results.push({ email: lead.email, athlete: lead.athlete_name, status: 'error', error: `CAS mark failed: ${markErr.message}` });
          continue;
        }

        if (!marked) {
          log('INFO', 'cas_lost_skip', {
            email: lead.email,
            reason: 'whatsapp_sent_at já preenchido por outra execução — pulando',
          });
          results.push({ email: lead.email, athlete: lead.athlete_name, status: 'skipped_cas_lost' });
          continue;
        }

        // 2b. Envia WhatsApp (template depende de timing_status)
        const whatsappResult = await triggerWhatsApp(lead);

        log('INFO', 'whatsapp_result', {
          email: lead.email,
          statusCode: whatsappResult.statusCode,
          messageType: whatsappResult.messageType,
        });

        // 2b-bis. Para timing alternativo (muito_cedo / tarde_demais),
        // dispara também o email correspondente. Para 'ideal' o email
        // de boas-vindas já foi enviado no fluxo de INSERT do form.
        const isAlternativeTiming = lead.timing_status === 'muito_cedo' || lead.timing_status === 'tarde_demais';
        if (isAlternativeTiming) {
          try {
            const emailResult = await triggerEmail(lead);
            log('INFO', 'email_result', {
              email: lead.email,
              statusCode: emailResult.statusCode,
              messageType: emailResult.messageType,
            });
          } catch (emailErr) {
            log('WARN', 'email_send_failed', { email: lead.email, error: emailErr.message });
          }
        }

        // 2c. Sync Sheets independente do resultado do envio (DB já foi
        // marcado pelo CAS — refletir mesmo se Z-API der erro/timeout).
        // O CEO/Head veem no Pipeline e podem reenviar manualmente se
        // necessário a partir do War Room.
        await triggerSyncLeads({ ...lead, whatsapp_sent_at: whatsappSentAt });

        if (whatsappResult.statusCode < 400) {
          results.push({
            email: lead.email,
            athlete: lead.athlete_name,
            status: 'sent',
          });
        } else {
          // Z-API retornou erro — DB já foi marcado, mas registramos
          // erro nos logs para investigação manual.
          log('ERROR', 'whatsapp_send_failed_after_cas', {
            email: lead.email,
            statusCode: whatsappResult.statusCode,
            body: whatsappResult.body,
          });

          results.push({
            email: lead.email,
            athlete: lead.athlete_name,
            status: 'failed_after_cas',
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