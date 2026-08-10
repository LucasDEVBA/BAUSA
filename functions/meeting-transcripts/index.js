const functions = require('@google-cloud/functions-framework');
const https = require('https');
const { google } = require('googleapis');

// ─── Configuração ─────────────────────────────────────────────
// Cron (Cloud Scheduler a cada 2h): captura a transcrição nativa do
// Google Meet das reuniões com leads. O Meet gera um Google Doc no Drive
// do organizador ("Meet Recordings") e o ANEXA ao evento do Calendar
// (event.attachments[]) minutos/horas após a reunião. Este job:
//   1. busca deals com reunião detectada (google_calendar_event_id) nos
//      últimos 30 dias sem transcrição capturada (anti-join REST);
//   2. lê o evento no Calendar e procura o anexo de transcript;
//   3. exporta o Doc como text/plain via Drive API (requer a pasta
//      "Meet Recordings" compartilhada com a service account — leitor);
//   4. (opcional) resume via Gemini 2.5 Flash se GEMINI_API_KEY existir;
//   5. INSERT idempotente em reunioes_transcricoes (UNIQUE google_event_id
//      → 409 = já capturada, ok).
const WEBHOOK_SECRET        = process.env.WEBHOOK_SECRET;
const SUPABASE_URL          = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
// SEMPRE 'public' (NÃO usar a env, que o deploy UAT injeta como 'uat'). As
// reuniões/deals reais e o Calendar do CEO vivem em public, e o BAUSA Engine lê
// as transcrições de public em todos os ambientes — mesmo padrão da zapi-inbox
// (index.js:33). Sem isto, a função UAT busca uat.deals (inexistente → PGRST205)
// e falha em toda execução.
const SUPABASE_SCHEMA       = 'public';
const SERVICE_ACCOUNT_EMAIL = process.env.SERVICE_ACCOUNT_EMAIL;
const GOOGLE_CALENDAR_ID    = process.env.GOOGLE_CALENDAR_ID;
const GEMINI_API_KEY        = process.env.GEMINI_API_KEY; // opcional (resumo)
const RAW_KEY               = process.env.SERVICE_ACCOUNT_PRIVATE_KEY || '';
const SERVICE_ACCOUNT_PRIVATE_KEY = RAW_KEY
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\\\\n/g, '\n');

// Limites operacionais
const MAX_CANDIDATES_PER_RUN = 20;      // deals PROCESSADOS por tick
// Busca larga: o limit da query vem ANTES do anti-join — com >20 reunioes ja
// capturadas na janela, um limit estreito esconderia as novas (starvation,
// mesma classe dos incidentes de elegibilidade). Filtra depois, processa 20.
const FETCH_LIMIT = 200;
const LOOKBACK_DAYS = 30;               // janela de reuniões consideradas
const MAX_TRANSCRIPT_CHARS = 300000;    // teto do texto persistido
const MAX_GEMINI_INPUT_CHARS = 150000;  // teto do trecho enviado ao Gemini (2.5 Flash tem contexto de sobra)

// Anexo de transcript: Doc do Google com título de transcrição
// ("Transcript", "Transcrição"/"Transcricao" ou "Notes by Gemini").
const TRANSCRIPT_TITLE_RE = /transcript|transcri[çc][ãa]o|notes by gemini|anota[çc][õo]es (do|de) gemini|notas (do|de) gemini/i;
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

// Instruções DEFAULT do resumo — editáveis em /automacoes (configuracoes_
// sistema.transcricao_resumo_prompt.instrucoes; espelho em apps/crm/src/lib/
// automacoes/transcricao-resumo-prompt.ts — manter em sincronia). Fail-open:
// qualquer falha/ausência da config usa este texto.
const RESUMO_INSTRUCOES_DEFAULT = `Você é assistente comercial da Bolsa Atleta USA (assessoria de bolsas esportivas em instituições americanas).

Abaixo está a transcrição de uma reunião comercial entre o consultor e a família de um atleta (lead). Resuma em 5 a 8 linhas, em português, cobrindo: contexto da família, principais dúvidas/objeções, sinais de interesse ou risco, e próximos passos combinados. Seja objetivo e factual — não invente nada que não esteja na transcrição.`;

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

// ─── Auth Google (Calendar + Drive readonly) ──────────────────
const buildGoogleAuth = () => new google.auth.JWT(
  SERVICE_ACCOUNT_EMAIL,
  undefined,
  SERVICE_ACCOUNT_PRIVATE_KEY,
  [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
);

// ─── Supabase REST helpers ────────────────────────────────────
const supabaseHeaders = (profileHeader) => ({
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  [profileHeader]: SUPABASE_SCHEMA,
});

// Candidatos: deals com evento de Calendar salvo pelo calendar-webhook
// (google_calendar_event_id) e reunião detectada na janela de 30 dias.
// 'detected' é o fallback histórico do webhook quando o event.id faltou —
// não é um id real, então é excluído.
const fetchCandidateDeals = async () => {
  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/deals` +
    `?select=id,google_calendar_event_id,reuniao_agendada_at,reuniao_data,atleta:atletas(form_submission_id)` +
    `&google_calendar_event_id=not.is.null` +
    `&google_calendar_event_id=neq.detected` +
    `&deleted_at=is.null` +
    `&reuniao_agendada_at=gte.${encodeURIComponent(sinceIso)}` +
    `&order=reuniao_agendada_at.asc` +
    `&limit=${FETCH_LIMIT}`;

  const result = await httpRequest(url, {
    method: 'GET',
    headers: supabaseHeaders('Accept-Profile'),
  });

  if (result.statusCode >= 400) {
    throw new Error(`Supabase deals HTTP ${result.statusCode}: ${result.body.substring(0, 200)}`);
  }

  const deals = JSON.parse(result.body);
  return Array.isArray(deals) ? deals : [];
};

// Anti-join: quais desses eventos já têm transcrição capturada?
const fetchCapturedEventIds = async (eventIds) => {
  if (eventIds.length === 0) return new Set();

  const inList = encodeURIComponent(`(${eventIds.map((id) => `"${id}"`).join(',')})`);
  const url = `${SUPABASE_URL}/rest/v1/reunioes_transcricoes` +
    `?select=google_event_id&google_event_id=in.${inList}`;

  const result = await httpRequest(url, {
    method: 'GET',
    headers: supabaseHeaders('Accept-Profile'),
  });

  if (result.statusCode >= 400) {
    throw new Error(`Supabase transcricoes HTTP ${result.statusCode}: ${result.body.substring(0, 200)}`);
  }

  const rows = JSON.parse(result.body);
  return new Set((Array.isArray(rows) ? rows : []).map((r) => r.google_event_id));
};

// ─── Config editável do resumo (/automacoes) — fail-open ─────
// Lê instrucoes + toggle num único fetch por tick. Qualquer falha devolve o
// default (a captura de transcrição NUNCA depende disto).
const fetchResumoConfig = async () => {
  const fallback = { instrucoes: RESUMO_INSTRUCOES_DEFAULT, ativo: true };
  try {
    const url = `${SUPABASE_URL}/rest/v1/configuracoes_sistema` +
      `?select=chave,valor&chave=in.(transcricao_resumo_prompt,sistema_automacoes_ativas)`;
    const result = await httpRequest(url, {
      method: 'GET',
      headers: supabaseHeaders('Accept-Profile'),
    });
    // HTTP de erro vira exceção → o catch loga (padrão *_fallback das CFs):
    // sem isso, um 401/403 persistente deixaria edições da UI sem efeito e
    // sem nenhum log para diagnosticar.
    if (result.statusCode >= 400) {
      throw new Error(`GET configuracoes_sistema HTTP ${result.statusCode}`);
    }
    const rows = JSON.parse(result.body);
    if (!Array.isArray(rows)) throw new Error('config: resposta não-array');

    const porChave = {};
    for (const r of rows) porChave[r.chave] = r.valor || {};
    const instrucoes = typeof porChave.transcricao_resumo_prompt?.instrucoes === 'string' &&
      porChave.transcricao_resumo_prompt.instrucoes.trim()
      ? porChave.transcricao_resumo_prompt.instrucoes.trim()
      : RESUMO_INSTRUCOES_DEFAULT;
    // Toggle fail-open: ausente = ativo; só `false` explícito desliga
    // (padrão deny `=== false` — guard tests/sistema-automacoes-ativas).
    const desligado = porChave.sistema_automacoes_ativas?.resumo_transcricao === false;
    return { instrucoes, ativo: !desligado };
  } catch (err) {
    // Padrão do guard sistema-automacoes-ativas: log + degrada p/ default
    log('WARN', 'sistema_config_fallback', { error: err.message });
    return fallback;
  }
};

// ─── Resumo via Gemini (bônus — só com GEMINI_API_KEY) ────────
// Mesma config obrigatória do qualify-lead (temperature 0.2, JSON).
// Qualquer falha → resumo null, sem quebrar a captura.
const summarizeTranscript = async (transcriptText, instrucoes) => {
  if (!GEMINI_API_KEY || !transcriptText || !transcriptText.trim()) return null;

  // head+tail: os proximos passos combinados ficam no FIM da reuniao
  const excerpt = transcriptText.length <= MAX_GEMINI_INPUT_CHARS
    ? transcriptText
    : transcriptText.slice(0, MAX_GEMINI_INPUT_CHARS / 2) + "\n[...]\n" + transcriptText.slice(-MAX_GEMINI_INPUT_CHARS / 2);
  const prompt = `${instrucoes || RESUMO_INSTRUCOES_DEFAULT}

TRANSCRIÇÃO:
${excerpt}

FORMATO OBRIGATÓRIO DE RESPOSTA — retorne APENAS o JSON abaixo, sem markdown, sem backticks, sem texto adicional:
{"resumo":"Resumo em 5-8 linhas"}`;

  const postData = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const result = await httpRequest(url, {
      method: 'POST',
      timeoutMs: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, postData);

    if (result.statusCode >= 400) {
      throw new Error(`Gemini HTTP ${result.statusCode}: ${result.body.substring(0, 200)}`);
    }

    const response = JSON.parse(result.body);
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini retornou resposta vazia');

    const parsed = JSON.parse(text);
    const resumo = typeof parsed.resumo === 'string' ? parsed.resumo.trim() : '';
    return resumo || null;
  } catch (error) {
    log('WARN', 'gemini_summary_failed', { error: error.message });
    return null;
  }
};

// ─── INSERT idempotente (UNIQUE google_event_id) ──────────────
// Retorna 'inserted' | 'duplicate'. 409 = outra execução já capturou — ok.
const insertTranscript = async (row) => {
  const url = `${SUPABASE_URL}/rest/v1/reunioes_transcricoes`;
  const postData = JSON.stringify(row);

  const result = await httpRequest(url, {
    method: 'POST',
    headers: {
      ...supabaseHeaders('Content-Profile'),
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Prefer': 'return=minimal',
    },
  }, postData);

  if (result.statusCode === 409) return 'duplicate';
  if (result.statusCode >= 400) {
    throw new Error(`Supabase insert HTTP ${result.statusCode}: ${result.body.substring(0, 200)}`);
  }
  return 'inserted';
};

// ─── Busca a linha já capturada de UM evento (modo sob demanda) ───
const fetchTranscriptRowByEventId = async (eventId) => {
  const url = `${SUPABASE_URL}/rest/v1/reunioes_transcricoes` +
    `?select=deal_id,form_submission_id,google_event_id,doc_url,transcript_text,resumo,capturada_at` +
    `&google_event_id=eq.${encodeURIComponent(eventId)}&limit=1`;
  const result = await httpRequest(url, {
    method: 'GET',
    headers: supabaseHeaders('Accept-Profile'),
  });
  if (result.statusCode >= 400) {
    throw new Error(`Supabase transcricao HTTP ${result.statusCode}: ${result.body.substring(0, 200)}`);
  }
  const rows = JSON.parse(result.body);
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Captura sob demanda de UM evento (chamada pelo Engine) ───
// POST {eventId, dealId?, formSubmissionId?} — usada pela aba Reunião para
// puxar a transcrição de QUALQUER reunião do lead (não só a vinculada ao
// deal). Reusa os mesmos helpers do cron; idempotente pelo UNIQUE do banco.
// Statuses: already | captured | not_ready | access_denied | event_not_found.
const captureSingleEvent = async ({ eventId, dealId, formSubmissionId }) => {
  // 1. Já capturada? Devolve direto (caminho quente do clique repetido).
  const existente = await fetchTranscriptRowByEventId(eventId);
  if (existente) return { status: 'already', transcript: existente };

  const auth = buildGoogleAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  const drive = google.drive({ version: 'v3', auth });

  // 2. Evento + anexo de transcript
  let event;
  try {
    const eventRes = await calendar.events.get({ calendarId: GOOGLE_CALENDAR_ID, eventId });
    event = eventRes.data;
  } catch (err) {
    log('WARN', 'targeted_event_fetch_failed', { eventId, error: err.message });
    return { status: 'event_not_found' };
  }

  const attachment = (event.attachments || []).find((a) =>
    a.mimeType === GOOGLE_DOC_MIME &&
    TRANSCRIPT_TITLE_RE.test(a.title || ''));

  if (!attachment || !attachment.fileId) {
    return { status: 'not_ready' };
  }

  // 3. Exportar o Doc como texto puro
  let transcriptText;
  try {
    const exportRes = await drive.files.export(
      { fileId: attachment.fileId, mimeType: 'text/plain' },
      { responseType: 'text' },
    );
    transcriptText = typeof exportRes.data === 'string' ? exportRes.data : String(exportRes.data ?? '');
  } catch (err) {
    const code = err.code || err.response?.status;
    if (code === 403 || code === 404) {
      log('WARN', 'targeted_transcript_access_denied', {
        eventId,
        fileId: attachment.fileId,
        statusCode: code,
        fix: `Compartilhe a pasta "Meet Recordings" do Drive do organizador com ${SERVICE_ACCOUNT_EMAIL} (acesso Leitor).`,
      });
      return { status: 'access_denied' };
    }
    throw err;
  }

  if (transcriptText.length > MAX_TRANSCRIPT_CHARS) {
    log('WARN', 'targeted_transcript_truncated', { eventId, originalChars: transcriptText.length });
    transcriptText = transcriptText.slice(0, MAX_TRANSCRIPT_CHARS);
  }

  // 4. Resumo opcional + INSERT idempotente (mesmo caminho do cron)
  const resumoCfg = await fetchResumoConfig();
  const resumo = resumoCfg.ativo
    ? await summarizeTranscript(transcriptText, resumoCfg.instrucoes)
    : null;

  const row = {
    deal_id: UUID_RE.test(dealId || '') ? dealId : null,
    form_submission_id: UUID_RE.test(formSubmissionId || '') ? formSubmissionId : null,
    google_event_id: eventId,
    doc_url: attachment.fileUrl ?? null,
    transcript_text: transcriptText,
    resumo,
    capturada_at: new Date().toISOString(),
  };
  const outcome = await insertTranscript(row);

  if (outcome === 'duplicate') {
    // Corrida com o cron: outra execução inseriu entre o passo 1 e agora.
    const rowExistente = await fetchTranscriptRowByEventId(eventId);
    return { status: 'already', transcript: rowExistente ?? row };
  }

  log('INFO', 'targeted_transcript_captured', {
    eventId,
    dealId: row.deal_id,
    transcriptChars: transcriptText.length,
    hasResumo: !!resumo,
  });
  return { status: 'captured', transcript: row };
};

// ─── Cloud Function principal ─────────────────────────────────
functions.http('meetingTranscripts', async (req, res) => {
  // Auth FAIL-CLOSED: secret obrigatório — os jobs do Cloud Scheduler enviam
  // o header x-webhook-secret (infra/scheduler.sh).
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false, error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const counters = {
    candidates: 0,
    captured: 0,
    notReady: 0,
    accessDenied: 0,
    duplicates: 0,
    errors: 0,
  };

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_URL/SUPABASE_SERVICE_KEY não configuradas');
    }
    if (!GOOGLE_CALENDAR_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
      throw new Error('Env vars do Google (Calendar/Service Account) não configuradas');
    }

    // ── Modo sob demanda: POST {eventId, dealId?, formSubmissionId?} ──
    // Chamado pela aba Reunião do Engine para UM evento específico. O modo
    // cron (sem eventId no body) segue inalterado logo abaixo.
    const targetedEventId = typeof req.body?.eventId === 'string' ? req.body.eventId.trim() : '';
    if (targetedEventId) {
      if (targetedEventId.length < 5 || targetedEventId.length > 1024 || /\s/.test(targetedEventId)) {
        return res.status(400).send({ success: false, error: 'eventId inválido' });
      }
      const resultado = await captureSingleEvent({
        eventId: targetedEventId,
        dealId: typeof req.body?.dealId === 'string' ? req.body.dealId : null,
        formSubmissionId: typeof req.body?.formSubmissionId === 'string' ? req.body.formSubmissionId : null,
      });
      log('INFO', 'targeted_request_complete', {
        eventId: targetedEventId,
        status: resultado.status,
        durationMs: Date.now() - startTime,
      });
      return res.status(200).send({ success: true, ...resultado });
    }

    log('INFO', 'meeting_transcripts_start', {
      schema: SUPABASE_SCHEMA,
      hasGemini: !!GEMINI_API_KEY,
      now: new Date().toISOString(),
    });

    const deals = await fetchCandidateDeals();

    // Dedup por evento (defensivo — 2 deals nunca deveriam apontar p/ o
    // mesmo evento, mas o UNIQUE do banco é por google_event_id).
    const byEvent = new Map();
    for (const deal of deals) {
      if (!byEvent.has(deal.google_calendar_event_id)) {
        byEvent.set(deal.google_calendar_event_id, deal);
      }
    }

    const capturedIds = await fetchCapturedEventIds(Array.from(byEvent.keys()));
    const pending = Array.from(byEvent.values())
      .filter((deal) => !capturedIds.has(deal.google_calendar_event_id))
      .slice(0, MAX_CANDIDATES_PER_RUN);

    counters.candidates = pending.length;
    log('INFO', 'candidates_found', {
      dealsInWindow: deals.length,
      alreadyCaptured: capturedIds.size,
      pending: pending.length,
    });

    // Config editável do resumo (1 fetch por tick; fail-open p/ default)
    const resumoCfg = await fetchResumoConfig();
    if (!resumoCfg.ativo) {
      log('INFO', 'resumo_desativado_skip', { note: 'captura segue; só o resumo é pulado' });
    }

    const auth = buildGoogleAuth();
    const calendar = google.calendar({ version: 'v3', auth });
    const drive = google.drive({ version: 'v3', auth });

    for (const deal of pending) {
      const eventId = deal.google_calendar_event_id;

      try {
        // Reunião ainda não aconteceu → transcrição impossível, pula.
        if (deal.reuniao_data && new Date(deal.reuniao_data) > new Date()) {
          counters.notReady++;
          continue;
        }

        // 1. Evento no Calendar → anexos
        let event;
        try {
          const eventRes = await calendar.events.get({
            calendarId: GOOGLE_CALENDAR_ID,
            eventId,
          });
          event = eventRes.data;
        } catch (err) {
          // Evento apagado/inacessível: não é fatal para o tick.
          log('WARN', 'calendar_event_fetch_failed', {
            eventId,
            dealId: deal.id,
            error: err.message,
          });
          counters.errors++;
          continue;
        }

        const attachment = (event.attachments || []).find((a) =>
          a.mimeType === GOOGLE_DOC_MIME &&
          TRANSCRIPT_TITLE_RE.test(a.title || ''));

        // Sem anexo ainda: a transcrição demora minutos/horas — o próximo
        // tick pega. Silencioso por design (só contador).
        if (!attachment || !attachment.fileId) {
          counters.notReady++;
          continue;
        }

        // 2. Exportar o Doc como texto puro via Drive API
        let transcriptText;
        try {
          const exportRes = await drive.files.export(
            { fileId: attachment.fileId, mimeType: 'text/plain' },
            { responseType: 'text' },
          );
          transcriptText = typeof exportRes.data === 'string'
            ? exportRes.data
            : String(exportRes.data ?? '');
        } catch (err) {
          const code = err.code || err.response?.status;
          if (code === 403 || code === 404) {
            // Doc não compartilhado com a service account. Passo manual:
            // compartilhar a pasta "Meet Recordings" do Drive do CEO com
            // SERVICE_ACCOUNT_EMAIL como leitor.
            log('WARN', 'transcript_access_denied', {
              eventId,
              dealId: deal.id,
              fileId: attachment.fileId,
              statusCode: code,
              fix: `Compartilhe a pasta "Meet Recordings" do Drive do organizador com ${SERVICE_ACCOUNT_EMAIL} (acesso Leitor) para liberar a exportação.`,
            });
            counters.accessDenied++;
          } else {
            log('WARN', 'transcript_export_failed', {
              eventId,
              dealId: deal.id,
              error: err.message,
            });
            counters.errors++;
          }
          continue;
        }

        if (transcriptText.length > MAX_TRANSCRIPT_CHARS) {
          log('WARN', 'transcript_truncated', {
            eventId,
            originalChars: transcriptText.length,
            keptChars: MAX_TRANSCRIPT_CHARS,
          });
          transcriptText = transcriptText.slice(0, MAX_TRANSCRIPT_CHARS);
        }

        // 3. Resumo opcional via Gemini (falha → null, nunca aborta)
        const resumo = resumoCfg.ativo
          ? await summarizeTranscript(transcriptText, resumoCfg.instrucoes)
          : null;

        // 4. INSERT idempotente
        const outcome = await insertTranscript({
          deal_id: deal.id,
          form_submission_id: deal.atleta?.form_submission_id ?? null,
          google_event_id: eventId,
          doc_url: attachment.fileUrl ?? null,
          transcript_text: transcriptText,
          resumo,
          capturada_at: new Date().toISOString(),
        });

        if (outcome === 'duplicate') {
          counters.duplicates++;
          log('INFO', 'transcript_already_captured', { eventId, dealId: deal.id });
        } else {
          counters.captured++;
          log('INFO', 'transcript_captured', {
            eventId,
            dealId: deal.id,
            formSubmissionId: deal.atleta?.form_submission_id ?? null,
            transcriptChars: transcriptText.length,
            hasResumo: !!resumo,
          });
        }
      } catch (err) {
        // Erro isolado num deal nunca derruba o tick inteiro.
        counters.errors++;
        log('ERROR', 'candidate_failed', {
          eventId,
          dealId: deal.id,
          error: err.message,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    log('INFO', 'meeting_transcripts_complete', { ...counters, durationMs });

    return res.status(200).send({ success: true, ...counters, durationMs });
  } catch (error) {
    log('ERROR', 'meeting_transcripts_error', { error: error.message, ...counters });
    return res.status(500).send({ success: false, error: error.message, ...counters });
  }
});
