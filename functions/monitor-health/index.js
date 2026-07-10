const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ─── Configuração ─────────────────────────────────────────────
// Watchdog do funil (Cloud Scheduler a cada 30 min): detecta silêncio que
// custa dinheiro — "ausência de erro ≠ funcionando". Checa:
//   1. qualificacao_travada — leads novos sem classe Gemini há 2h+ (funil de
//      entrada parado; foi exatamente o incidente do modelo deprecado).
//   2. fila_whatsapp_presa — QUENTE/MORNO elegíveis sem o WhatsApp inicial
//      além do intervalo configurado + folga (scheduler parado/quebrado).
//   3. runs_erro — 3+ erros de automação nas últimas 6h.
// Alerta o CEO por WhatsApp (Z-API) + notificação in-app, com COOLDOWN de 6h
// por check (estado em configuracoes_sistema.monitor_state) — sem spam.
//
// SÓ AGE EM PRODUÇÃO: os dados observados vivem em public; a instância UAT
// (SUPABASE_SCHEMA=uat) roda em modo dry (loga e responde, não alerta) para
// não duplicar alertas. `?dry=1` força dry-run em qualquer ambiente.
const WEBHOOK_SECRET       = process.env.WEBHOOK_SECRET;
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA      = process.env.SUPABASE_SCHEMA || 'public';
const ZAPI_INSTANCE_ID     = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN           = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN    = process.env.ZAPI_CLIENT_TOKEN;
const CEO_WHATSAPP         = process.env.CEO_WHATSAPP || '';

// Os DADOS monitorados são os de produção — sempre public (padrão do Engine).
const DATA_SCHEMA = 'public';

const QUALIFICACAO_TRAVADA_HORAS = 2;
const FILA_FOLGA_HORAS = 4;        // além do intervalo configurado do scheduler
const INTERVALO_DEFAULT_HORAS = 22;
const RUNS_ERRO_JANELA_HORAS = 6;
const RUNS_ERRO_MINIMO = 3;
const JANELA_MAX_DIAS = 7;         // ignora pendências históricas antigas
const COOLDOWN_HORAS = 6;

// ─── Log estruturado ──────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// ─── HTTP helper (resolve headers também — p/ Content-Range) ──
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
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (postData) req.write(postData);
    req.end();
  });
};

const supaHeaders = (extra = {}) => ({
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Accept-Profile': DATA_SCHEMA,
  ...extra,
});

/** COUNT exato via Content-Range (HEAD-like: select=id&limit=1). */
const contar = async (pathAndQuery) => {
  const result = await httpRequest(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: 'GET',
    headers: supaHeaders({ 'Prefer': 'count=exact', 'Range': '0-0' }),
  });
  if (result.statusCode >= 400) {
    throw new Error(`count ${pathAndQuery.split('?')[0]} HTTP ${result.statusCode}`);
  }
  const range = String(result.headers['content-range'] || '');
  const total = parseInt(range.split('/')[1], 10);
  return Number.isFinite(total) ? total : 0;
};

/** Lê o valor de uma chave de configuracoes_sistema (fail-open → {}). */
const lerConfig = async (chave) => {
  try {
    const result = await httpRequest(
      `${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=eq.${chave}&select=valor`,
      { method: 'GET', headers: supaHeaders() },
    );
    if (result.statusCode >= 400) throw new Error(`config HTTP ${result.statusCode}`);
    const rows = JSON.parse(result.body);
    return (Array.isArray(rows) && rows[0]?.valor) || {};
  } catch (error) {
    // Padrão do guard sistema-automacoes-ativas: log + degrada p/ default
    log('WARN', 'sistema_config_fallback', { chave, error: error.message });
    return {};
  }
};

const salvarMonitorState = async (state) => {
  const postData = JSON.stringify({ valor: state });
  const result = await httpRequest(
    `${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=eq.monitor_state`,
    {
      method: 'PATCH',
      headers: supaHeaders({
        'Content-Profile': DATA_SCHEMA,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Prefer': 'return=minimal',
      }),
    },
    postData,
  );
  if (result.statusCode >= 400) {
    log('WARN', 'monitor_state_save_failed', { statusCode: result.statusCode });
  }
};

// ─── Alertas ──────────────────────────────────────────────────
const sendWhatsAppCeo = async (message) => {
  if (!CEO_WHATSAPP || !ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    log('WARN', 'zapi_skip', { hasCeo: !!CEO_WHATSAPP, hasZapi: !!ZAPI_INSTANCE_ID });
    return false;
  }
  try {
    const postData = JSON.stringify({ phone: CEO_WHATSAPP, message });
    const result = await httpRequest(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Client-Token': ZAPI_CLIENT_TOKEN,
        },
      },
      postData,
    );
    return result.statusCode < 400;
  } catch (error) {
    log('WARN', 'zapi_send_failed', { error: error.message });
    return false;
  }
};

const criarNotificacoesInApp = async (titulo, mensagem) => {
  try {
    // Destinatários: CEO/CTO ativos (user_profiles.id = auth.users.id)
    const result = await httpRequest(
      `${SUPABASE_URL}/rest/v1/user_profiles?papel=in.(ceo,cto)&ativo=is.true&select=id`,
      { method: 'GET', headers: supaHeaders() },
    );
    if (result.statusCode >= 400) return;
    const users = JSON.parse(result.body);
    if (!Array.isArray(users) || users.length === 0) return;

    const postData = JSON.stringify(
      users.map((u) => ({
        destinatario_id: u.id,
        titulo,
        mensagem,
        tipo: 'monitor',
        severidade: 'critica',
        link: '/automacoes-monitor',
      })),
    );
    await httpRequest(`${SUPABASE_URL}/rest/v1/notificacoes`, {
      method: 'POST',
      headers: supaHeaders({
        'Content-Profile': DATA_SCHEMA,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Prefer': 'return=minimal',
      }),
    }, postData);
  } catch (error) {
    log('WARN', 'notificacao_inapp_failed', { error: error.message });
  }
};

// ─── Checks ───────────────────────────────────────────────────
const isoAtras = (horas) => new Date(Date.now() - horas * 3600000).toISOString();

const runChecks = async () => {
  const desdeJanela = isoAtras(JANELA_MAX_DIAS * 24);

  // Intervalo real do scheduler (fail-open p/ default)
  const intervalos = await lerConfig('scheduler_intervalos');
  const intervaloHoras = Number(intervalos.whatsapp_inicial_horas) || INTERVALO_DEFAULT_HORAS;
  const limiteFila = intervaloHoras + FILA_FOLGA_HORAS;

  const [qualificacaoTravada, filaPresa, runsErro] = await Promise.all([
    // 1. Leads sem classe Gemini há 2h+ (janela de 7d)
    contar(
      `form_submissions?select=id&qualification_classification=is.null` +
        `&submitted_at=lt.${encodeURIComponent(isoAtras(QUALIFICACAO_TRAVADA_HORAS))}` +
        `&submitted_at=gt.${encodeURIComponent(desdeJanela)}`,
    ),
    // 2. QUENTE/MORNO timing ideal sem WhatsApp além do intervalo + folga
    contar(
      `form_submissions?select=id&qualification_classification=in.(QUENTE,MORNO)` +
        `&whatsapp_sent_at=is.null` +
        `&qualified_at=lt.${encodeURIComponent(isoAtras(limiteFila))}` +
        `&qualified_at=gt.${encodeURIComponent(desdeJanela)}` +
        `&or=(timing_status.is.null,timing_status.eq.ideal)`,
    ),
    // 3. Erros de automação nas últimas 6h
    contar(
      `automacao_runs?select=id&status=eq.erro` +
        `&created_at=gt.${encodeURIComponent(isoAtras(RUNS_ERRO_JANELA_HORAS))}`,
    ),
  ]);

  return [
    {
      chave: 'qualificacao_travada',
      ok: qualificacaoTravada === 0,
      valor: qualificacaoTravada,
      detalhe: `${qualificacaoTravada} lead(s) sem qualificação Gemini há ${QUALIFICACAO_TRAVADA_HORAS}h+`,
    },
    {
      chave: 'fila_whatsapp_presa',
      ok: filaPresa === 0,
      valor: filaPresa,
      detalhe: `${filaPresa} lead(s) QUENTE/MORNO sem o WhatsApp inicial há ${limiteFila}h+`,
    },
    {
      chave: 'runs_erro',
      ok: runsErro < RUNS_ERRO_MINIMO,
      valor: runsErro,
      detalhe: `${runsErro} erro(s) de automação nas últimas ${RUNS_ERRO_JANELA_HORAS}h`,
    },
  ];
};

// ─── Cloud Function principal ─────────────────────────────────
functions.http('monitorHealth', async (req, res) => {
  // Scheduler chama sem secret; chamadas com secret também aceitas
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret']) {
    if (req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
      log('WARN', 'auth_failed');
      return res.status(401).send({ success: false });
    }
  }

  const startTime = Date.now();
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_URL/SUPABASE_SERVICE_KEY não configuradas');
    }

    // Dry-run: instância não-PRD (evita alerta duplicado) ou ?dry=1
    const dryRun = SUPABASE_SCHEMA !== 'public' || req.query?.dry === '1';

    // Toggle editável em /automacoes (fail-open: ausente = ativo)
    const ativas = await lerConfig('sistema_automacoes_ativas');
    const alertasDesligados = ativas.monitor_alertas === false;

    const checks = await runChecks();
    const falhas = checks.filter((c) => !c.ok);

    let alertasEnviados = 0;
    if (falhas.length > 0 && !dryRun && !alertasDesligados) {
      // Cooldown por check (estado em monitor_state)
      const state = await lerConfig('monitor_state');
      const ultimo = state.ultimo_alerta || {};
      const agora = Date.now();
      const paraAlertar = falhas.filter((c) => {
        const t = Date.parse(ultimo[c.chave] || 0);
        return !Number.isFinite(t) || agora - t > COOLDOWN_HORAS * 3600000;
      });

      if (paraAlertar.length > 0) {
        const linhas = paraAlertar.map((c) => `• ${c.detalhe}`).join('\n');
        const msg =
          `⚠️ *Monitor BAUSA — atenção no funil*\n\n${linhas}\n\n` +
          `Ver detalhes: bolsa-atleta-crm → Monitor de automações.`;
        const enviado = await sendWhatsAppCeo(msg);
        await criarNotificacoesInApp('Monitor: atenção no funil', linhas);
        alertasEnviados = paraAlertar.length;

        const novoState = { ...state, ultimo_alerta: { ...ultimo } };
        for (const c of paraAlertar) novoState.ultimo_alerta[c.chave] = new Date().toISOString();
        await salvarMonitorState(novoState);

        log(enviado ? 'INFO' : 'WARN', 'monitor_alerta', {
          checks: paraAlertar.map((c) => c.chave),
          whatsappEnviado: enviado,
        });
      } else {
        log('INFO', 'monitor_alerta_em_cooldown', { falhas: falhas.map((c) => c.chave) });
      }
    }

    const durationMs = Date.now() - startTime;
    log('INFO', 'monitor_health_complete', {
      dryRun,
      alertasDesligados,
      falhas: falhas.length,
      alertasEnviados,
      durationMs,
    });

    return res.status(200).send({
      success: true,
      dryRun,
      checks,
      alertasEnviados,
      durationMs,
    });
  } catch (error) {
    log('ERROR', 'monitor_health_error', { error: error.message });
    return res.status(500).send({ success: false, error: error.message });
  }
});
