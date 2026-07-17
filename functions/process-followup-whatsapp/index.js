const functions = require('@google-cloud/functions-framework');
const https = require('https');
const { google } = require('googleapis');

// ─── Configuração via variáveis de ambiente ─────────────────────
const WEBHOOK_SECRET         = process.env.WEBHOOK_SECRET;
const SUPABASE_URL           = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY;
const SEND_WHATSAPP_URL      = process.env.SEND_WHATSAPP_URL;
const SYNC_LEADS_URL         = process.env.SYNC_LEADS_URL;
const SERVICE_ACCOUNT_EMAIL  = process.env.SERVICE_ACCOUNT_EMAIL;
const GOOGLE_CALENDAR_ID     = process.env.GOOGLE_CALENDAR_ID;
// Schema do Supabase: 'public' em PRD, 'uat' em UAT, 'dev' em DEV
const SUPABASE_SCHEMA        = process.env.SUPABASE_SCHEMA || 'public';
// Runs de observabilidade vão p/ public SEMPRE — o Engine (apps/crm) lê public em todos os ambientes, igual ao whatsapp_mensagens da zapi-inbox. NÃO usar SUPABASE_SCHEMA aqui.
const RUNS_SCHEMA = 'public';
const RAW_KEY                = process.env.SERVICE_ACCOUNT_PRIVATE_KEY || '';
const SERVICE_ACCOUNT_PRIVATE_KEY = RAW_KEY
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\\\\n/g, '\n');

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
    // Timeout 90s (paridade com process-pending-whatsapp): o send-whatsapp
    // leva rotineiramente 22-35s quando atleta e responsável têm números
    // distintos (envio + delay anti-ban de 20-30s + envio, com retry Z-API).
    // O timeout antigo de 30s abortava o caller e logava
    // followup_X_send_failed espúrio mesmo com o envio concluído (o CAS marca
    // followup_N_sent_at ANTES do call — sem duplicação, mas status falso).
    req.setTimeout(90000, () => {
      req.destroy();
      reject(new Error('Request timeout (90s)'));
    });

    if (postData) req.write(postData);
    req.end();
  });
};

// ─── Delay entre leads (anti-ban) ──────────────────────────────
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Âncoras das automações de SISTEMA (aba Execuções de /automacoes) ──────
// IDs fixos semeados pela migration 20260709220205_automacoes_sistema_runs
// (guard de CI: tests/automacao-runs-sistema.test.js compara CF ↔ migration).
const RUN_FOLLOWUP_1_ID = 'a0000000-0000-4000-8000-000000000003';
const RUN_FOLLOWUP_2_ID = 'a0000000-0000-4000-8000-000000000004';

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

// ─── Verificar se lead agendou reunião via Google Calendar API ─
// Busca eventos no calendário do Leandro onde o e-mail do responsável
// apareça como participante, a partir da data de envio do WhatsApp inicial.
const checkMeetingScheduled = async (guardianEmail, whatsappSentAt) => {
  if (!GOOGLE_CALENDAR_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
    log('WARN', 'calendar_check_skip', { reason: 'Env vars do Calendar não configuradas' });
    return false;
  }

  try {
    const auth = new google.auth.JWT(
      SERVICE_ACCOUNT_EMAIL,
      null,
      SERVICE_ACCOUNT_PRIVATE_KEY,
      ['https://www.googleapis.com/auth/calendar.readonly']
    );

    const calendar = google.calendar({ version: 'v3', auth });

    // Janela de busca: desde o envio do WhatsApp até 60 dias à frente
    const timeMin = new Date(whatsappSentAt).toISOString();
    const timeMax = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const response = await calendar.events.list({
      calendarId: GOOGLE_CALENDAR_ID,
      timeMin,
      timeMax,
      singleEvents: true,
      maxResults: 100,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    const normalizedEmail = guardianEmail.trim().toLowerCase();

    const matchedEvent = events.find((event) =>
      event.attendees?.some(
        (attendee) => attendee.email?.toLowerCase() === normalizedEmail
      )
    );

    const booked = !!matchedEvent;

    log('INFO', 'calendar_check_result', {
      guardianEmail,
      eventsChecked: events.length,
      booked,
    });

    return booked ? matchedEvent : false;
  } catch (error) {
    log('ERROR', 'calendar_check_failed', {
      guardianEmail,
      error: error.message,
    });
    // Em caso de erro na API, não assume que agendou — deixa o follow-up ocorrer
    return false;
  }
};

// ─── Intervalos configuráveis (editáveis pelo CEO em /automacoes) ──────────
// Lidos de configuracoes_sistema.scheduler_intervalos com fallback nos
// defaults históricos. INVARIANTE (guard de CI): clamp 1h–720h — a config
// jamais pode zerar o delay (envio imediato) nem congelar o fluxo >30 dias.
const DEFAULT_FU1_HORAS = 48;
const DEFAULT_FU2_HORAS = 168;

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
      fu1Horas: clampHoras(valor.followup_1_horas, DEFAULT_FU1_HORAS),
      fu2Horas: clampHoras(valor.followup_2_horas, DEFAULT_FU2_HORAS),
    };
  } catch (e) {
    // Config indisponível JAMAIS para o scheduler — usa os defaults históricos
    log('WARN', 'intervalos_fallback', { error: e.message });
    return { fu1Horas: DEFAULT_FU1_HORAS, fu2Horas: DEFAULT_FU2_HORAS };
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

// ─── Buscar leads pendentes de follow-up ───────────────────────
const fetchFollowupLeads = async (followupNumber, executionStartTime) => {
  const isFollowup1 = followupNumber === 1;

  // Toggle on/off em /automacoes (ausente = ativo); desligado → sem envio,
  // leads seguem elegíveis e são pegos quando reativar.
  const ativas = await fetchAtivas();
  if (isFollowup1 ? ativas.followup_1 === false : ativas.followup_2 === false) {
    log('WARN', 'followup_desativado_skip', { followupNumber });
    return [];
  }

  // Follow-up 1: Nh (default 48h) após whatsapp_sent_at, sem followup_1_sent_at
  // Follow-up 2: Nh (default 168h/7d) após whatsapp_sent_at, com followup_1_sent_at, sem followup_2_sent_at
  const intervalos = await fetchIntervalos();
  const hoursThreshold = isFollowup1 ? intervalos.fu1Horas : intervalos.fu2Horas;
  log('INFO', 'intervalos_em_uso', { followupNumber, hoursThreshold });
  const cutoffTime = new Date(Date.now() - hoursThreshold * 60 * 60 * 1000).toISOString();

  const baseFilters = [
    'qualification_classification=in.(QUENTE,MORNO)',
    `whatsapp_sent_at=lt.${cutoffTime}`,
    'whatsapp_sent_at=not.is.null',
    'meeting_scheduled=not.is.true',  // IS NOT TRUE captura FALSE e NULL
    // Somente leads de timing ideal recebem follow-up 48h/7d. Leads em
    // muito_cedo/tarde_demais seguem fluxo próprio (early_potential/late_timing
    // + scheduled_return em novembro), e o follow-up "agende a reunião" seria
    // contraditório com a mensagem que já receberam. Paridade com o Bucket A
    // de process-pending-whatsapp.
    'or=(timing_status.is.null,timing_status.eq.ideal)',
    isFollowup1 ? 'followup_1_sent_at=is.null' : 'followup_2_sent_at=is.null',
  ];

  if (!isFollowup1) {
    // Follow-up 2 só ocorre se o follow-up 1 já foi enviado
    baseFilters.push('followup_1_sent_at=not.is.null');
    // Garante que followup_1 foi enviado em execução ANTERIOR, nunca na mesma execução.
    // Evita que um lead com whatsapp_sent_at > 168h receba followup_1 e followup_2 no mesmo ciclo.
    if (executionStartTime) {
      // Espaçamento mínimo de 24h entre fu1 e fu2 — estritamente mais forte
      // que o guard original de "execução anterior" (executionStartTime ≈ now):
      // além de impedir fu1+fu2 no mesmo ciclo, impede fu2 ~1h após um fu1
      // tardio (ex.: followup_1 desligado por dias em /automacoes e reativado).
      const fu1MinGapIso = new Date(
        Math.min(new Date(executionStartTime).getTime(), Date.now() - 24 * 60 * 60 * 1000)
      ).toISOString();
      baseFilters.push(`followup_1_sent_at=lt.${fu1MinGapIso}`);
    }
  }

  const filters = baseFilters.join('&');
  const url = `${SUPABASE_URL}/rest/v1/form_submissions?${filters}&select=*&order=whatsapp_sent_at.asc&limit=20`;

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
    throw new Error(`Supabase GET followup ${followupNumber}: ${result.statusCode} ${result.body}`);
  }

  return JSON.parse(result.body);
};

// ─── Marcar reunião como agendada no Supabase ──────────────────
// Prefere id=eq.${submissionId} (cirúrgico). Fallback case-insensitive.
const markMeetingScheduled = async (submissionId, email, athleteName) => {
  let url;
  if (submissionId) {
    url = `${SUPABASE_URL}/rest/v1/form_submissions?id=eq.${encodeURIComponent(submissionId)}`;
  } else {
    url = `${SUPABASE_URL}/rest/v1/form_submissions`
      + `?email=ilike.${encodeURIComponent((email || '').trim())}`
      + `&athlete_name=ilike.${encodeURIComponent((athleteName || '').trim())}`;
  }

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
    meeting_scheduled: true,
    meeting_scheduled_at: new Date().toISOString(),
  }));

  if (result.statusCode >= 400) {
    throw new Error(`Supabase PATCH meeting_scheduled: ${result.statusCode} ${result.body}`);
  }

  return true;
};

// ─── Marcar follow-up como enviado no Supabase (CAS atômico) ───
// Inclui o filtro `column=is.null` na query para garantir atomicidade:
// somente a instância que chegar primeiro consegue fazer o PATCH —
// a segunda encontra 0 rows atualizadas e sabe que deve pular o lead.
// Isso elimina race conditions mesmo com execuções simultâneas.
//
// Usa id=eq.${submissionId} como filtro principal (cirúrgico, sem
// problemas de case-sensitivity). Fallback case-insensitive se id ausente.
const markFollowupSent = async (submissionId, email, athleteName, followupNumber) => {
  const column = followupNumber === 1 ? 'followup_1_sent_at' : 'followup_2_sent_at';

  let url;
  if (submissionId) {
    url = `${SUPABASE_URL}/rest/v1/form_submissions`
      + `?id=eq.${encodeURIComponent(submissionId)}`
      + `&${column}=is.null`;
  } else {
    url = `${SUPABASE_URL}/rest/v1/form_submissions`
      + `?email=ilike.${encodeURIComponent((email || '').trim())}`
      + `&athlete_name=ilike.${encodeURIComponent((athleteName || '').trim())}`
      + `&${column}=is.null`;
  }

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
    [column]: new Date().toISOString(),
  }));

  if (result.statusCode >= 400) {
    throw new Error(`Supabase PATCH ${column}: ${result.statusCode} ${result.body}`);
  }

  // Retorna true se atualizou (fomos os primeiros), false se outra instância ganhou a corrida
  const updated = JSON.parse(result.body);
  return Array.isArray(updated) && updated.length > 0;
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

// ─── Disparar envio de WhatsApp de follow-up ──────────────────
const triggerFollowupWhatsApp = async (lead, followupNumber) => {
  const messageType = followupNumber === 1 ? 'followup_1' : 'followup_2';

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
  };
};

// ─── Processar lote de follow-ups ──────────────────────────────
const processFollowupBatch = async (followupNumber, executionStartTime) => {
  const leads = await fetchFollowupLeads(followupNumber, executionStartTime);

  if (leads.length === 0) {
    log('INFO', `no_followup_${followupNumber}_leads`);
    return { processed: 0, sent: 0, skipped: 0, failed: 0, results: [] };
  }

  log('INFO', `followup_${followupNumber}_leads_found`, { count: leads.length });

  const results = [];

  for (const lead of leads) {
    try {
      log('INFO', `processing_followup_${followupNumber}`, {
        email: lead.email,
        athlete: lead.athlete_name,
        whatsappSentAt: lead.whatsapp_sent_at,
      });

      // Verifica se o responsável já agendou a reunião via Google Calendar
      const emailToCheck = lead.guardian_email || lead.email;
      const bookedEvent = await checkMeetingScheduled(emailToCheck, lead.whatsapp_sent_at);

      if (bookedEvent) {
        log('INFO', 'meeting_already_scheduled', {
          email: lead.email,
          athlete: lead.athlete_name,
          followup: followupNumber,
        });

        const meetingScheduledAt = new Date().toISOString();
        await markMeetingScheduled(lead.id, lead.email, lead.athlete_name);

        // Update CRM deal to reuniao_marcada if it exists
        try {
          // Find the atleta linked to this form_submission
          const atletaRes = await fetch(
            `${SUPABASE_URL}/rest/v1/atletas?form_submission_id=eq.${lead.id}&deleted_at=is.null&select=id`,
            {
              headers: {
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Accept-Profile': SUPABASE_SCHEMA,
              },
            }
          );
          const atletas = await atletaRes.json();

          if (atletas && atletas.length > 0) {
            const atletaId = atletas[0].id;

            // Find the active deal for this atleta
            const dealRes = await fetch(
              `${SUPABASE_URL}/rest/v1/deals?atleta_id=eq.${atletaId}&etapa=eq.lead&deleted_at=is.null&select=id`,
              {
                headers: {
                  'apikey': SUPABASE_SERVICE_KEY,
                  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                  'Accept-Profile': SUPABASE_SCHEMA,
                },
              }
            );
            const deals = await dealRes.json();

            if (deals && deals.length > 0) {
              const dealId = deals[0].id;

              // Move deal to reuniao_marcada
              const updateRes = await fetch(
                `${SUPABASE_URL}/rest/v1/deals?id=eq.${dealId}`,
                {
                  method: 'PATCH',
                  headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'Content-Profile': SUPABASE_SCHEMA,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    etapa: 'reuniao_marcada',
                    etapa_anterior: 'lead',
                    google_calendar_event_id: bookedEvent.id || bookedEvent.htmlLink || 'detected',
                    next_action: 'Preparar para reunião',
                    data_proxima_acao: bookedEvent.start?.dateTime?.split('T')[0] || new Date().toISOString().split('T')[0],
                    reuniao_agendada_at: new Date().toISOString(),
                    reuniao_data: bookedEvent.start?.dateTime || bookedEvent.start?.date || null,
                    reuniao_link: bookedEvent.htmlLink || bookedEvent.hangoutLink || null,
                  }),
                }
              );

              if (updateRes.ok) {
                log('INFO', 'deal_moved_to_reuniao', { dealId, atletaId, submissionId: lead.id });
              } else {
                log('WARN', 'deal_update_failed', { dealId, status: updateRes.status });
              }
            }
          }
        } catch (err) {
          log('WARN', 'crm_deal_update_error', { error: err.message, submissionId: lead.id });
        }

        // Sync Sheets: linha reflete meeting_scheduled = true imediatamente
        await triggerSyncLeads({
          ...lead,
          meeting_scheduled: true,
          meeting_scheduled_at: meetingScheduledAt,
        });

        results.push({
          email: lead.email,
          athlete: lead.athlete_name,
          status: 'meeting_scheduled',
        });

        // Delay mesmo quando skipa, para não sobrecarregar o Calendar API
        if (leads.indexOf(lead) < leads.length - 1) {
          const randomDelay = 5000 + Math.floor(Math.random() * 5000);
          await delay(randomDelay);
        }
        continue;
      }

      // CAS atômico: marca ANTES de enviar com filtro IS NULL na query.
      // PostgreSQL garante que só 1 instância vence: a que chegar primeiro
      // atualiza 1 row (marked=true) e envia; a segunda recebe 0 rows
      // (marked=false) e pula — impossível duplicar mesmo com N instâncias simultâneas.
      const marked = await markFollowupSent(lead.id, lead.email, lead.athlete_name, followupNumber);

      if (!marked) {
        log('INFO', `followup_${followupNumber}_already_processed`, {
          email: lead.email,
          athlete: lead.athlete_name,
          reason: 'Outra instância concorrente já marcou este lead',
        });

        results.push({
          email: lead.email,
          athlete: lead.athlete_name,
          status: 'already_processed',
        });

        continue;
      }

      // Somos a instância que ganhou o CAS — podemos enviar com segurança
      const followupSentAt = new Date().toISOString();
      const followupColumn = followupNumber === 1 ? 'followup_1_sent_at' : 'followup_2_sent_at';
      const whatsappResult = await triggerFollowupWhatsApp(lead, followupNumber);

      log('INFO', `followup_${followupNumber}_whatsapp_result`, {
        email: lead.email,
        statusCode: whatsappResult.statusCode,
      });

      // Registro em automacao_runs (aba Execuções) — estado TERMINAL, APÓS o
      // resultado real do envio (CAS perdido/meeting_scheduled não registram).
      await registrarRunSistema({
        automacaoId: followupNumber === 1 ? RUN_FOLLOWUP_1_ID : RUN_FOLLOWUP_2_ID,
        ok: whatsappResult.statusCode < 400,
        lead,
        acoes: [{
          tipo: followupNumber === 1 ? 'followup_1' : 'followup_2',
          status: whatsappResult.statusCode < 400 ? 'ok' : 'falha',
          detalhe: `template followup_${followupNumber} (HTTP ${whatsappResult.statusCode})`,
        }],
      });

      // Sync Sheets: DB já foi marcado pelo CAS — sincroniza independente do resultado do WhatsApp
      await triggerSyncLeads({ ...lead, [followupColumn]: followupSentAt });

      if (whatsappResult.statusCode < 400) {
        results.push({
          email: lead.email,
          athlete: lead.athlete_name,
          status: `followup_${followupNumber}_sent`,
        });
      } else {
        log('ERROR', `followup_${followupNumber}_send_failed`, {
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

    } catch (leadError) {
      log('ERROR', `followup_${followupNumber}_lead_error`, {
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

    // Delay anti-ban entre leads (45-60s)
    if (leads.indexOf(lead) < leads.length - 1) {
      const randomDelay = 45000 + Math.floor(Math.random() * 15000);
      log('INFO', 'delay_between_leads', { delayMs: randomDelay, followup: followupNumber });
      await delay(randomDelay);
    }
  }

  return {
    processed: results.length,
    sent: results.filter(r => r.status.endsWith('_sent')).length,
    skipped: results.filter(r => r.status === 'meeting_scheduled').length,
    failed: results.filter(r => r.status === 'failed' || r.status === 'error').length,
    results,
  };
};

// ─── Cloud Function principal ──────────────────────────────────
functions.http('processFollowupWhatsApp', async (req, res) => {
  const startTime = Date.now();

  // Auth FAIL-CLOSED: secret obrigatório — os jobs do Cloud Scheduler enviam
  // o header x-webhook-secret (infra/scheduler.sh).
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed', { ip: req.ip });
    return res.status(401).send({ success: false, error: 'Unauthorized' });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SEND_WHATSAPP_URL) {
      throw new Error('Variáveis de ambiente obrigatórias não configuradas');
    }

    // executionStartTime: registrado ANTES de qualquer batch para servir como cutoff.
    // O filtro `followup_1_sent_at < executionStartTime` no batch 2 garante que leads
    // cujo followup_1 foi marcado NESTA execução não sejam imediatamente elegíveis para
    // followup_2 — evitando o envio de 2 mensagens em um único ciclo do scheduler.
    const executionStartTime = new Date().toISOString();
    log('INFO', 'followup_scheduler_start', { timestamp: executionStartTime });

    // Processa follow-up 1 (48h) e follow-up 2 (7 dias) em sequência
    const followup1 = await processFollowupBatch(1, executionStartTime);

    // Pequena pausa entre os dois batches
    if (followup1.processed > 0) {
      await delay(5000);
    }

    const followup2 = await processFollowupBatch(2, executionStartTime);

    const durationMs = Date.now() - startTime;
    const totalProcessed = followup1.processed + followup2.processed;

    log('INFO', 'followup_scheduler_complete', {
      followup1: { processed: followup1.processed, sent: followup1.sent, skipped: followup1.skipped, failed: followup1.failed },
      followup2: { processed: followup2.processed, sent: followup2.sent, skipped: followup2.skipped, failed: followup2.failed },
      totalProcessed,
      durationMs,
    });

    return res.status(200).send({
      success: true,
      followup1,
      followup2,
      totalProcessed,
      durationMs,
    });

  } catch (error) {
    log('CRITICAL', 'followup_scheduler_failed', {
      error: error.message,
      durationMs: Date.now() - startTime,
    });

    return res.status(500).send({
      success: false,
      error: 'Erro no processamento de follow-ups',
    });
  }
});
