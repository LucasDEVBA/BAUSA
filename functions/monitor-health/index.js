const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ─── Configuração ─────────────────────────────────────────────
// Watchdog do funil (Cloud Scheduler a cada 30 min) — v2 pós-incidente
// 2026-07-15/17 (Z-API caída 2 dias sem detecção): "ausência de erro ≠
// funcionando" — os checks buscam sinais POSITIVOS de vida. Checks:
//   qualificacao_travada · fila_whatsapp_presa · runs_erro (originais)
//   zapi_conexao         — estado REAL da instância (GET /status)
//   envios_sem_espelho   — *_sent_at recente sem SentCallback espelhado
//   entrada_zero         — 0 submissões em 24h (formulário/funil parado)
//   chatbot_erro         — erros do chatbot autônomo (condicional modo≠off)
//   remarketing_presa    — campanha 'enviando' sem progresso
//   regua_cobranca       — parcela atrasada sem nenhum marco da régua
//   experiencia_nps      — NPS elegível sem envio além do prazo
//   meta_frescor         — heartbeat do sync Meta parado (não é idade do gasto)
//   transcricao_faltante — reunião realizada sem transcrição capturada
//   runs_presos          — runs pendentes/retry vencido (engine parada)
// Alertas: WhatsApp (Z-API) + notificação in-app + E-MAIL (Resend→Brevo, canal
// INDEPENDENTE da Z-API — se a falha for a própria Z-API, só o e-mail chega).
// COOLDOWN de 6h por check (configuracoes_sistema.monitor_state).
// `monitor_checks_desativados` (array de chaves) suprime checks de features
// pausadas de propósito (ex.: régua/NPS) — filtrado ANTES do cooldown.
// HEARTBEAT: todo tick de produção grava `monitor_last_tick_at` — o dead-man
// (workflow GitHub Actions) alerta se o tick sumir. Instância UAT/dry NÃO
// grava o tick (não pode mascarar um monitor de produção morto).
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
// Token do canal Instagram (Fluxos). Config manual — ausente = canal desligado.
const INSTAGRAM_TOKEN      = process.env.INSTAGRAM_TOKEN;
// Canal de e-mail (config manual pós-deploy — o CI só seta WEBHOOK_SECRET)
const RESEND_API_KEY       = process.env.RESEND_API_KEY;
const BREVO_API_KEY        = process.env.BREVO_API_KEY;
const FROM_EMAIL           = process.env.FROM_EMAIL || 'Bolsa Atleta USA <contato@bolsaatletausa.com>';
const ENGINE_URL           = (process.env.ENGINE_URL || 'https://bolsa-atleta-crm.vercel.app').replace(/\/+$/, '');
const { emailMonitor, emailAprovacaoPendente } = require('./templates');

// Os DADOS monitorados são os de produção — sempre public (padrão do Engine).
const DATA_SCHEMA = 'public';

const QUALIFICACAO_TRAVADA_HORAS = 2;
const APROVACAO_PENDENTE_HORAS = 24;  // lead esperando decisão do CEO além disso = alerta
const FILA_FOLGA_HORAS = 4;        // além do intervalo configurado do scheduler
const INTERVALO_DEFAULT_HORAS = 22;
const RUNS_ERRO_JANELA_HORAS = 6;
const RUNS_ERRO_MINIMO = 3;
const JANELA_MAX_DIAS = 7;         // ignora pendências históricas antigas
const COOLDOWN_HORAS = 6;
// Espelho (versão enxuta do check da tela /observabilidade)
const ESPELHO_JANELA_HORAS = 6;    // marcas de envio consideradas
const ESPELHO_MARGEM_MIN = 5;      // janela antes da marca
const ESPELHO_POS_MIN = 15;        // janela depois da marca
const ESPELHO_IDADE_MIN_MIN = 10;  // lag normal do webhook — recente demais não é suspeito
const ENTRADA_ZERO_HORAS = 24;
const CHATBOT_ERRO_MINIMO = 3;
const REMARKETING_PRESA_HORAS = 2;
const REGUA_FOLGA_DIAS = 2;
const NPS_PRAZO_DIAS = 181;        // 180d de jornada + 24h de folga
const META_TICK_MAX_HORAS = 26; // job diário 06h BRT + folga (padrão billing)
const TRANSCRICAO_FOLGA_HORAS = 24;
const RUNS_PRESOS_HORAS = 2;       // engine roda 1x/h — 2h sem consumir = parada
// Sinais criados na F2 (fluxos que antes não deixavam rastro)
const WATCH_EXPIRACAO_FOLGA_HORAS = 24;  // alerta ANTES do watch do Google morrer
const WATCH_RENOVACAO_MAX_DIAS = 8;      // cron é a cada 6 dias — 8d sem renovar = parado
const SHEETS_SYNC_FOLGA_HORAS = 2;
const WEEKLY_REPORT_MAX_DIAS = 8;        // relatório é semanal
const BILLING_TICK_MAX_HORAS = 26;       // régua é diária

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

/** Busca linhas (o monitor só contava; o aviso de aprovação precisa dos nomes). */
const buscar = async (pathAndQuery) => {
  const result = await httpRequest(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: 'GET',
    headers: supaHeaders(),
  });
  if (result.statusCode >= 400) {
    throw new Error(`select ${pathAndQuery.split('?')[0]} HTTP ${result.statusCode}`);
  }
  try {
    const linhas = JSON.parse(result.body);
    return Array.isArray(linhas) ? linhas : [];
  } catch {
    return [];
  }
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

/** PATCH genérico de uma chave de configuracoes_sistema (fail-open: só loga). */
const salvarConfigKey = async (chave, valor) => {
  const postData = JSON.stringify({ valor });
  const result = await httpRequest(
    `${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=eq.${chave}`,
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
    log('WARN', 'config_save_failed', { chave, statusCode: result.statusCode });
  }
};

const salvarMonitorState = (state) => salvarConfigKey('monitor_state', state);

/**
 * HEARTBEAT do dead-man's switch (workflow GitHub Actions): gravado em TODO
 * tick de PRODUÇÃO real. Gate crítico: instância UAT ou dry-run NÃO grava —
 * um monitor de produção morto não pode ser mascarado por outra instância.
 * O valor contém APENAS campos agregados seguros (a chave é legível por anon
 * via policy restrita do dead-man — nunca incluir dados de leads aqui).
 */
const registrarTick = async (falhas, checksTotal, durationMs, dryRun) => {
  if (SUPABASE_SCHEMA !== 'public' || dryRun) return;
  await salvarConfigKey('monitor_last_tick_at', {
    at: new Date().toISOString(),
    falhas,
    checks_total: checksTotal,
    duration_ms: durationMs,
  });
};

// ─── E-mail (Resend primário → Brevo fallback) ────────────────
// Canal de alerta INDEPENDENTE da Z-API — quando a falha é a própria Z-API,
// o WhatsApp de alerta cai junto e o e-mail é o único que chega.
const parseFromEmail = (raw) => {
  const m = String(raw).match(/^(.*)<(.+)>$/);
  return m
    ? { name: m[1].trim(), email: m[2].trim() }
    : { name: 'Bolsa Atleta USA', email: String(raw).trim() };
};

const sendViaResend = async (to, subject, html) => {
  const postData = JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html });
  const result = await httpRequest('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, postData);
  if (result.statusCode >= 400) throw new Error(`Resend HTTP ${result.statusCode}`);
  return true;
};

const sendViaBrevo = async (to, subject, html) => {
  const from = parseFromEmail(FROM_EMAIL);
  const postData = JSON.stringify({
    sender: { name: from.name, email: from.email },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });
  const result = await httpRequest('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, postData);
  if (result.statusCode >= 400) throw new Error(`Brevo HTTP ${result.statusCode}`);
  return true;
};

const sendEmailWithFallback = async (to, subject, html) => {
  const providers = [
    { name: 'resend', fn: sendViaResend, available: !!RESEND_API_KEY },
    { name: 'brevo', fn: sendViaBrevo, available: !!BREVO_API_KEY },
  ];
  for (const p of providers) {
    if (!p.available) continue;
    try {
      await p.fn(to, subject, html);
      log('INFO', 'monitor_email_sent', { provider: p.name, to });
      return true;
    } catch (error) {
      log('WARN', 'monitor_email_failed', { provider: p.name, error: error.message });
    }
  }
  return false;
};

/** Destinatários de alerta: CEO/CTO ativos com e-mail. */
const fetchAlertRecipients = async () => {
  try {
    const result = await httpRequest(
      `${SUPABASE_URL}/rest/v1/user_profiles?papel=in.(ceo,cto)&ativo=is.true&select=email`,
      { method: 'GET', headers: supaHeaders() },
    );
    if (result.statusCode >= 400) return [];
    const rows = JSON.parse(result.body || '[]');
    return rows.map((r) => r.email).filter((e) => typeof e === 'string' && e.includes('@'));
  } catch (error) {
    log('WARN', 'monitor_recipients_failed', { error: error.message });
    return [];
  }
};

// ─── Sinais positivos de vida (lições do incidente 2026-07-15/17) ──
/** Estado REAL da conexão Z-API — a Z-API caída aceita envios com 200. */
const checkZapiConexao = async () => {
  if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
    return { ok: true, valor: 0, detalhe: 'Z-API não configurada nesta instância (check pulado)' };
  }
  try {
    const result = await httpRequest(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/status`,
      { method: 'GET', headers: { 'Client-Token': ZAPI_CLIENT_TOKEN }, timeoutMs: 15000 },
    );
    const data = JSON.parse(result.body || '{}');
    const ok = data.connected === true && data.smartphoneConnected === true;
    return {
      ok,
      valor: ok ? 0 : 1,
      detalhe: ok
        ? 'Instância Z-API conectada'
        : `Z-API DESCONECTADA (${data.error || `connected=${data.connected}`}) — mensagens NÃO estão sendo entregues`,
    };
  } catch (error) {
    return { ok: false, valor: 1, detalhe: `Z-API sem resposta: ${error.message}` };
  }
};

/**
 * Saúde do token do Instagram.
 *
 * Por que existe: o token de Instagram Login expira (tipicamente 60 dias) e a
 * Meta NÃO expõe a data — `debug_token` recusa o app do Instagram nos dois
 * hosts. Sem este check, o vencimento se manifestaria como o canal parando de
 * responder, calado, exatamente como a Z-API caída de 2026-07. Um GET barato
 * a cada tick troca "descobrir num mês" por "descobrir em 30 minutos".
 *
 * Distingue token inválido (4xx = crítico, alguém precisa regerar) de rede
 * fora (mensagem diferente) — alerta que não diz o que fazer vira ruído, e
 * ruído vira check suprimido.
 */
const checkInstagramToken = async () => {
  if (!INSTAGRAM_TOKEN) {
    return { ok: true, valor: 0, detalhe: 'Canal Instagram não configurado nesta instância (check pulado)' };
  }
  try {
    const result = await httpRequest('https://graph.instagram.com/v23.0/me?fields=id,username', {
      method: 'GET',
      headers: { Authorization: `Bearer ${INSTAGRAM_TOKEN}` },
      timeoutMs: 15000,
    });
    if (result.statusCode === 200) {
      const data = JSON.parse(result.body || '{}');
      return { ok: true, valor: 0, detalhe: `Token do Instagram válido (@${data.username || data.id || '?'})` };
    }
    let motivo = `HTTP ${result.statusCode}`;
    try {
      const erro = JSON.parse(result.body || '{}').error || {};
      if (erro.message) motivo = erro.message;
    } catch {
      // corpo não-JSON: o status já basta para o diagnóstico
    }
    return {
      ok: false,
      valor: 1,
      detalhe:
        `TOKEN DO INSTAGRAM INVÁLIDO/EXPIRADO (${motivo}) — o canal IG dos Fluxos parou de enviar. ` +
        'Regenerar em developers.facebook.com > Instagram > Configuração da API e atualizar INSTAGRAM_TOKEN.',
    };
  } catch (error) {
    return { ok: false, valor: 1, detalhe: `API do Instagram sem resposta: ${error.message}` };
  }
};

const COLUNAS_ENVIO = [
  'whatsapp_sent_at',
  'followup_1_sent_at',
  'followup_2_sent_at',
  'scheduled_followup_sent_at',
];

// A Z-API espelha número BR ora com, ora sem o nono dígito
// (5548999202289 no cadastro vs 554899202289 no SentCallback) — comparar um
// único tail-10 gera falso positivo "sem espelho" com a mensagem entregue
// (incidente 2026-08-15, 5 leads). Cada número vira o conjunto de tails das
// duas grafias.
const tailsDe = (phone) => {
  if (typeof phone !== 'string') return [];
  const d = phone.replace(/\D/g, '');
  if (d.length < 8) return [];
  const variantes = [d];
  if (/^55\d{2}9\d{8}$/.test(d)) variantes.push(d.slice(0, 4) + d.slice(5));
  else if (/^55\d{10}$/.test(d)) variantes.push(d.slice(0, 4) + '9' + d.slice(4));
  return variantes.map((v) => v.slice(-10));
};

/**
 * Envio marcado sem espelho de entrega (versão enxuta do check da tela):
 * todo envio real gera SentCallback em whatsapp_mensagens (from_me). Uma
 * marca *_sent_at sem espelho no telefone do lead = a Z-API aceitou (200)
 * e não entregou — a assinatura exata do incidente fundador.
 */
const checkEnviosSemEspelho = async () => {
  const desde = isoAtras(ESPELHO_JANELA_HORAS);
  const selects = `id,athlete_name,athlete_whatsapp,guardian_whatsapp,${COLUNAS_ENVIO.join(',')}`;
  // order + limit: sem order o PostgREST devolve um subconjunto arbitrário e
  // a lista de flagados muda a cada tick (o alerta "flapava" entre 6 e 2).
  const marcasRes = await Promise.all(COLUNAS_ENVIO.map((col) =>
    httpRequest(
      `${SUPABASE_URL}/rest/v1/form_submissions?select=${selects}&${col}=gt.${encodeURIComponent(desde)}&order=${col}.desc&limit=50`,
      { method: 'GET', headers: supaHeaders() },
    ),
  ));
  const marcas = [];
  marcasRes.forEach((r, i) => {
    if (r.statusCode >= 400) throw new Error(`espelho marcas HTTP ${r.statusCode}`);
    for (const row of JSON.parse(r.body || '[]')) {
      const tails = [...tailsDe(row.athlete_whatsapp), ...tailsDe(row.guardian_whatsapp)];
      marcas.push({ nome: row.athlete_name, quandoMs: Date.parse(row[COLUNAS_ENVIO[i]]), tails });
    }
  });
  if (marcas.length === 0) {
    return { ok: true, valor: 0, detalhe: `Nenhum envio marcado nas últimas ${ESPELHO_JANELA_HORAS}h` };
  }

  const minIso = new Date(Math.min(...marcas.map((m) => m.quandoMs)) - ESPELHO_MARGEM_MIN * 60000).toISOString();
  const espRes = await httpRequest(
    `${SUPABASE_URL}/rest/v1/whatsapp_mensagens?select=phone,created_at&from_me=is.true&created_at=gt.${encodeURIComponent(minIso)}&order=created_at.desc&limit=500`,
    { method: 'GET', headers: supaHeaders() },
  );
  if (espRes.statusCode >= 400) throw new Error(`espelho HTTP ${espRes.statusCode}`);
  const espelho = JSON.parse(espRes.body || '[]').map((e) => ({
    tails: tailsDe(e.phone),
    ms: Date.parse(e.created_at),
  }));

  const limiteIdade = Date.now() - ESPELHO_IDADE_MIN_MIN * 60000;
  const nomes = [];
  for (const m of marcas) {
    if (m.quandoMs > limiteIdade) continue; // webhook pode só estar atrasado
    const tem = espelho.some((e) =>
      e.tails.some((t) => m.tails.includes(t)) &&
      e.ms >= m.quandoMs - ESPELHO_MARGEM_MIN * 60000 &&
      e.ms <= m.quandoMs + ESPELHO_POS_MIN * 60000);
    if (!tem) nomes.push(m.nome);
  }
  return {
    ok: nomes.length === 0,
    valor: nomes.length,
    detalhe: nomes.length === 0
      ? `Todos os ${marcas.length} envios das últimas ${ESPELHO_JANELA_HORAS}h têm espelho de entrega`
      : `${nomes.length} envio(s) SEM espelho de entrega (Z-API aceitou e não entregou?): ${nomes.slice(0, 5).join(', ')}`,
  };
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
        link: '/observabilidade',
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

/**
 * Executor de um check com isolamento de falha: um erro de query NUNCA
 * derruba o watchdog inteiro — vira um check ok=false com o motivo (o
 * PostgREST devolve erro sem lançar em outros lugares; aqui somos nós que
 * lançamos no `contar`, então o catch é obrigatório).
 */
const checkSeguro = async (chave, fn) => {
  try {
    const r = await fn();
    return { chave, ...r };
  } catch (error) {
    return { chave, ok: false, valor: -1, detalhe: `verificação falhou: ${error.message}` };
  }
};

// ─── Aviso da fila de aprovação (evento próprio, não é "monitor") ─────
// A fila é retenção PROPOSITAL: enquanto o CEO não decide, o lead não entra
// no pipeline nem recebe mensagem. Por isso este aviso é o único que nasce
// com WhatsApp ligado — e traz NOME e link direto, em vez de "N leads
// pendentes", que obriga a abrir o sistema para saber de quem se trata.
const alertarAprovacaoPendente = async (canais) => {
  const cfg = canais.lead_aguardando_aprovacao || {};
  if (cfg.inapp === false && cfg.email !== true && cfg.whatsapp !== true) return 0;

  const limite = encodeURIComponent(isoAtras(APROVACAO_PENDENTE_HORAS));
  const rows = await buscar(
    `form_submissions?select=athlete_name,qualification_classification,qualified_at` +
      `&aprovacao_status=eq.pendente&qualification_classification=in.(QUENTE,MORNO)` +
      `&qualified_at=lt.${limite}&order=qualified_at.asc&limit=10`,
  );
  if (!Array.isArray(rows) || rows.length === 0) return 0;

  const agora = Date.now();
  const leads = rows.map((r) => ({
    nome: r.athlete_name,
    classificacao: r.qualification_classification,
    esperandoHoras: r.qualified_at
      ? Math.floor((agora - Date.parse(r.qualified_at)) / 3600000)
      : null,
  }));
  const maisAntigo = leads[0]?.esperandoHoras ?? null;
  const urlAprovacoes = `${ENGINE_URL}/leads?aprovacoes=1`;
  const n = leads.length;

  if (cfg.inapp !== false) {
    await criarNotificacoesInApp(
      n === 1 ? '1 lead aguardando aprovação' : `${n} leads aguardando aprovação`,
      leads.map((l) => `${l.nome} (${l.classificacao})`).join(', '),
    );
  }

  if (cfg.whatsapp === true) {
    const lista = leads
      .slice(0, 5)
      .map((l) => `• *${l.nome}* — ${l.classificacao}${l.esperandoHoras != null ? ` · há ${l.esperandoHoras}h` : ''}`)
      .join('\n');
    const extra = n > 5 ? `\n_...e mais ${n - 5}_` : '';
    // Curta de propósito: quem, quão quente, e o link. O texto explicando
    // o custo de não decidir cansava na 3ª vez que chegava.
    const msg =
      `👋 *${n === 1 ? 'Tem 1 lead' : `Tem ${n} leads`} esperando sua aprovação*\n\n` +
      `${lista}${extra}\n\n` +
      `Aprovar agora 👉 ${urlAprovacoes}`;
    await sendWhatsAppCeo(msg);
  }

  if (cfg.email === true) {
    const html = emailAprovacaoPendente({ leads, urlAprovacoes, horas: maisAntigo });
    const assunto = n === 1
      ? '1 lead esperando sua aprovação'
      : `${n} leads esperando sua aprovação`;
    for (const to of await fetchAlertRecipients()) {
      await sendEmailWithFallback(to, assunto, html);
    }
  }

  log('INFO', 'alerta_aprovacao_pendente', { leads: n, canais: cfg });
  return n;
};


// ─── Cloud Scheduler API via metadata server (sem dependência nova) ────
// Motivação (incidente 2026-08-15): o chatbot-autonomo falhou a cada tick
// por 24h com "Supabase não configurado" e NENHUM check percebeu — o check
// de negócio lê a tabela de decisões, e a CF morria ANTES de gravar nela.
// O único sinal era o status.code=13 no job do Scheduler, que ninguém olha.
// Este caminho lê a fonte que restou: o resultado da última tentativa de
// cada job. Pega qualquer CF quebrada na infraestrutura, não só o chatbot.
const http = require('http');

const metadataToken = () =>
  new Promise((resolve, reject) => {
    const req = http.get(
      {
        host: 'metadata.google.internal',
        path: '/computeMetadata/v1/instance/service-accounts/default/token',
        headers: { 'Metadata-Flavor': 'Google' },
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(body).access_token); }
          catch (e) { reject(new Error(`token metadata: ${e.message}`)); }
        });
      },
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('metadata timeout')); });
  });

const metadataProjectId = () =>
  new Promise((resolve, reject) => {
    const req = http.get(
      {
        host: 'metadata.google.internal',
        path: '/computeMetadata/v1/project/project-id',
        headers: { 'Metadata-Flavor': 'Google' },
        timeout: 5000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve(body.trim()));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('metadata timeout')); });
  });

const listarJobsScheduler = async () => {
  const [token, projectId] = await Promise.all([metadataToken(), metadataProjectId()]);
  const r = await httpRequest(
    `https://cloudscheduler.googleapis.com/v1/projects/${projectId}/locations/us-central1/jobs?pageSize=100`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
  );
  if (r.statusCode >= 400) throw new Error(`scheduler API HTTP ${r.statusCode}`);
  return (JSON.parse(r.body || '{}').jobs) || [];
};

const runChecks = async () => {
  const desdeJanela = isoAtras(JANELA_MAX_DIAS * 24);

  // Intervalo real do scheduler (fail-open p/ default)
  const intervalos = await lerConfig('scheduler_intervalos');
  const intervaloHoras = Number(intervalos.whatsapp_inicial_horas) || INTERVALO_DEFAULT_HORAS;
  const limiteFila = intervaloHoras + FILA_FOLGA_HORAS;

  return Promise.all([
    // ── Originais ────────────────────────────────────────────
    checkSeguro('qualificacao_travada', async () => {
      const n = await contar(
        `form_submissions?select=id&qualification_classification=is.null` +
          `&submitted_at=lt.${encodeURIComponent(isoAtras(QUALIFICACAO_TRAVADA_HORAS))}` +
          `&submitted_at=gt.${encodeURIComponent(desdeJanela)}`,
      );
      return { ok: n === 0, valor: n, detalhe: `${n} lead(s) sem qualificação Gemini há ${QUALIFICACAO_TRAVADA_HORAS}h+` };
    }),
    checkSeguro('fila_whatsapp_presa', async () => {
      // Paridade com o scheduler: leads aguardando aprovação humana
      // (aprovacao_status != aprovado) NÃO são fila presa — estão retidos
      // de propósito pelo gate do CEO.
      const n = await contar(
        `form_submissions?select=id&qualification_classification=in.(QUENTE,MORNO)` +
          `&whatsapp_sent_at=is.null` +
          `&qualified_at=lt.${encodeURIComponent(isoAtras(limiteFila))}` +
          `&qualified_at=gt.${encodeURIComponent(desdeJanela)}` +
          `&or=(timing_status.is.null,timing_status.eq.ideal)` +
          `&aprovacao_status=eq.aprovado`,
      );
      return { ok: n === 0, valor: n, detalhe: `${n} lead(s) QUENTE/MORNO aprovados sem o WhatsApp inicial há ${limiteFila}h+` };
    }),
    checkSeguro('aprovacao_pendente_antiga', async () => {
      // A fila de aprovação é retenção PROPOSITAL — mas pendente esquecido é
      // SLA invisível (antes o lead saía em 22h automático). Alerta quando a
      // decisão demora além do razoável.
      const n = await contar(
        `form_submissions?select=id&aprovacao_status=eq.pendente` +
          `&qualification_classification=in.(QUENTE,MORNO)` +
          `&qualified_at=lt.${encodeURIComponent(isoAtras(APROVACAO_PENDENTE_HORAS))}` +
          `&qualified_at=gt.${encodeURIComponent(desdeJanela)}`,
      );
      return { ok: n === 0, valor: n, detalhe: `${n} lead(s) aguardando aprovação do CEO há ${APROVACAO_PENDENTE_HORAS}h+` };
    }),
    checkSeguro('runs_erro', async () => {
      const n = await contar(
        `automacao_runs?select=id&status=eq.erro` +
          `&created_at=gt.${encodeURIComponent(isoAtras(RUNS_ERRO_JANELA_HORAS))}`,
      );
      return { ok: n < RUNS_ERRO_MINIMO, valor: n, detalhe: `${n} erro(s) de automação nas últimas ${RUNS_ERRO_JANELA_HORAS}h` };
    }),

    // ── Anti-incidente (Z-API caída com envios fantasma) ─────
    checkSeguro('zapi_conexao', checkZapiConexao),
    checkSeguro('envios_sem_espelho', checkEnviosSemEspelho),
    // Mesma classe do zapi_conexao: credencial de canal que morre em silêncio.
    checkSeguro('instagram_token', checkInstagramToken),

    // ── Funil de entrada ─────────────────────────────────────
    checkSeguro('entrada_zero', async () => {
      const n = await contar(
        `form_submissions?select=id&submitted_at=gt.${encodeURIComponent(isoAtras(ENTRADA_ZERO_HORAS))}`,
      );
      return {
        ok: n > 0,
        valor: n,
        detalhe: n > 0
          ? `${n} submissão(ões) nas últimas ${ENTRADA_ZERO_HORAS}h`
          : `ZERO submissões em ${ENTRADA_ZERO_HORAS}h — formulário/funil de entrada possivelmente parado (mídia queimando sem lead)`,
      };
    }),

    // ── Chatbot autônomo (condicional: só quando modo ≠ off) ─
    checkSeguro('chatbot_erro', async () => {
      const cfg = await lerConfig('chatbot_autonomo');
      const modo = cfg.modo;
      if (modo !== 'sombra' && modo !== 'ativo') {
        return { ok: true, valor: 0, detalhe: 'chatbot autônomo off — check pulado' };
      }
      const desde6h = encodeURIComponent(isoAtras(RUNS_ERRO_JANELA_HORAS));
      const [erros, falhasEnvio] = await Promise.all([
        contar(`chatbot_autonomo_log?select=id&decisao=eq.erro&created_at=gt.${desde6h}`),
        contar(`chatbot_autonomo_log?select=id&decisao=eq.respondeu&enviado=is.false&created_at=gt.${desde6h}`),
      ]);
      const soma = erros + falhasEnvio;
      return {
        ok: soma < CHATBOT_ERRO_MINIMO,
        valor: soma,
        detalhe: `chatbot (${modo}): ${erros} erro(s) + ${falhasEnvio} resposta(s) sem envio nas últimas ${RUNS_ERRO_JANELA_HORAS}h`,
      };
    }),

    // ── Re-marketing ─────────────────────────────────────────
    checkSeguro('remarketing_presa', async () => {
      const n = await contar(
        `remarketing_campanhas?select=id&status=eq.enviando&deleted_at=is.null` +
          `&updated_at=lt.${encodeURIComponent(isoAtras(REMARKETING_PRESA_HORAS))}`,
      );
      return {
        ok: n === 0,
        valor: n,
        detalhe: `${n} campanha(s) em 'enviando' sem progresso há ${REMARKETING_PRESA_HORAS}h+ (cron de disparo parado?)`,
      };
    }),

    // ── Régua de cobrança (suprimível via monitor_checks_desativados
    //    enquanto o job billing-reminders estiver pausado de propósito) ──
    checkSeguro('regua_cobranca', async () => {
      const corte = isoAtras(REGUA_FOLGA_DIAS * 24).slice(0, 10);
      const n = await contar(
        `parcelas?select=id&status=eq.atrasado&deleted_at=is.null` +
          `&vencimento=lt.${corte}` +
          `&regua_dneg3_at=is.null&regua_d0_at=is.null&regua_d1_at=is.null` +
          `&regua_d3_at=is.null&regua_d7_at=is.null&regua_d15_at=is.null`,
      );
      return {
        ok: n === 0,
        valor: n,
        detalhe: `${n} parcela(s) atrasada(s) ${REGUA_FOLGA_DIAS}d+ sem NENHUM marco da régua de cobrança`,
      };
    }),

    // ── NPS pós-venda (suprimível enquanto o job estiver pausado) ──
    checkSeguro('experiencia_nps', async () => {
      const n = await contar(
        `crm_experiencia?select=id&fase=in.(embarcado_inicial,acompanhamento)` +
          `&nps_enviado_at=is.null` +
          `&created_at=lt.${encodeURIComponent(isoAtras(NPS_PRAZO_DIAS * 24))}`,
      );
      return { ok: n === 0, valor: n, detalhe: `${n} família(s) elegível(is) a NPS sem envio além do prazo (+24h folga)` };
    }),

    // ── CAC Meta: VIDA DO SYNC via heartbeat meta_sync_last_tick_at ──
    // NÃO usar idade do gasto (MAX(meta_ads_campanha.data)) aqui: campanhas
    // pausadas = gasto 0 = data velha com sync PERFEITO — alerta enganoso
    // ("token expirado?") que levou à supressão de 2026-08-10. O gasto velho
    // é sinal informativo SÓ na tela; o alerta automático mede o sync em si.
    checkSeguro('meta_frescor', async () => {
      const tick = await lerConfig('meta_sync_last_tick_at');
      if (!tick.at) {
        return { ok: true, valor: 0, detalhe: 'sync Meta nunca tickou (config pendente) — check pulado' };
      }
      const horas = Math.floor((Date.now() - Date.parse(tick.at)) / 3600000);
      return {
        ok: horas <= META_TICK_MAX_HORAS,
        valor: horas,
        detalhe: `último sync Meta há ${horas}h${horas > META_TICK_MAX_HORAS ? ' — job parado ou token inválido (CAC/DRE congelados)' : ''}`,
      };
    }),

    // ── A3: CPL real × CPL alvo dos planos executados (SÓ NOTIFICA) ──
    // Decisão do CEO (2026-08-11): a automação NUNCA pausa campanha sozinha —
    // avisa e o corte é clique humano no /ads. Compara o CPL dos últimos 30d
    // da campanha VINCULADA (ads_planos.campanha_id) com o alvo do plano.
    checkSeguro('ads_cpl_alvo', async () => {
      const r = await httpRequest(
        `${SUPABASE_URL}/rest/v1/ads_planos?select=titulo,campanha_id,plano` +
          `&status=eq.executado&campanha_id=not.is.null&deleted_at=is.null&limit=10`,
        { method: 'GET', headers: supaHeaders() },
      );
      if (r.statusCode >= 400) throw new Error(`ads_planos HTTP ${r.statusCode}`);
      const planos = JSON.parse(r.body || '[]');
      if (planos.length === 0) {
        return { ok: true, valor: 0, detalhe: 'nenhum plano executado vinculado a campanha — check pulado' };
      }

      const corteDia = isoAtras(30 * 24).slice(0, 10);
      const corteTs = isoAtras(30 * 24);
      const estourados = [];
      for (const p of planos) {
        const alvo = Number(p.plano && p.plano.cplAlvo && p.plano.cplAlvo.valorBrl);
        const cid = String(p.campanha_id || '').trim();
        if (!Number.isFinite(alvo) || alvo <= 0 || !cid) continue;

        const gRes = await httpRequest(
          `${SUPABASE_URL}/rest/v1/meta_ads_campanha?select=valor_gasto&campanha_id=eq.${cid}&data=gte.${corteDia}`,
          { method: 'GET', headers: supaHeaders() },
        );
        const gasto = (JSON.parse(gRes.body || '[]')).reduce((s, row) => s + (Number(row.valor_gasto) || 0), 0);
        if (gasto <= 0) continue; // sem entrega = nada a cobrar

        const leads = await contar(`form_submissions?select=id&utm_id=eq.${cid}&submitted_at=gte.${encodeURIComponent(corteTs)}`);
        const cpl = leads > 0 ? gasto / leads : null;
        // Sem leads: só acusa depois de gastar 3x o alvo (evita alarme no 1º dia)
        const estourou = cpl === null ? gasto > alvo * 3 : cpl > alvo * 1.3;
        if (estourou) {
          estourados.push(`"${String(p.titulo).slice(0, 40)}": CPL ${cpl === null ? 'sem leads' : 'R$' + cpl.toFixed(0)} vs alvo R$${alvo}`);
        }
      }
      return {
        ok: estourados.length === 0,
        valor: estourados.length,
        detalhe: estourados.length
          ? `CPL ACIMA DO ALVO — avaliar cortar/ajustar no /ads: ${estourados.join('; ')}`
          : `${planos.length} plano(s) vinculado(s) dentro do alvo`,
      };
    }),

    // ── Transcrições do Meet (condicional: sem histórico = config pendente) ──
    checkSeguro('transcricao_faltante', async () => {
      const temAlguma = await contar('reunioes_transcricoes?select=id&limit=1');
      if (temAlguma === 0) {
        return { ok: true, valor: 0, detalhe: 'nenhuma transcrição capturada ainda (config pendente) — check pulado' };
      }
      const result = await httpRequest(
        `${SUPABASE_URL}/rest/v1/deals?select=google_calendar_event_id&etapa=eq.reuniao_realizada` +
          `&google_calendar_event_id=not.is.null&deleted_at=is.null` +
          `&updated_at=gt.${encodeURIComponent(isoAtras(JANELA_MAX_DIAS * 24))}` +
          `&updated_at=lt.${encodeURIComponent(isoAtras(TRANSCRICAO_FOLGA_HORAS))}&limit=50`,
        { method: 'GET', headers: supaHeaders() },
      );
      if (result.statusCode >= 400) throw new Error(`deals HTTP ${result.statusCode}`);
      const ids = JSON.parse(result.body || '[]').map((d) => d.google_calendar_event_id).filter(Boolean);
      if (ids.length === 0) return { ok: true, valor: 0, detalhe: 'nenhuma reunião realizada aguardando transcrição' };
      const capturadas = await httpRequest(
        `${SUPABASE_URL}/rest/v1/reunioes_transcricoes?select=google_event_id&google_event_id=in.(${ids.map(encodeURIComponent).join(',')})`,
        { method: 'GET', headers: supaHeaders() },
      );
      if (capturadas.statusCode >= 400) throw new Error(`transcricoes HTTP ${capturadas.statusCode}`);
      const capturadasSet = new Set(JSON.parse(capturadas.body || '[]').map((t) => t.google_event_id));
      const faltantes = ids.filter((id) => !capturadasSet.has(id)).length;
      return {
        ok: faltantes === 0,
        valor: faltantes,
        detalhe: `${faltantes} reunião(ões) realizadas há ${TRANSCRICAO_FOLGA_HORAS}h+ sem transcrição capturada`,
      };
    }),

    // ── Watch do Google Calendar (sinal criado na F2) ────────
    // A falha mais silenciosa do sistema: watch expira em ≤7d e o push morre.
    checkSeguro('calendar_watch_expirando', async () => {
      const state = await lerConfig('calendar_watch_state');
      if (!state.expiration) {
        return { ok: true, valor: 0, detalhe: 'aguardando primeiro sinal do renew-calendar-watch (config pendente) — check pulado' };
      }
      const expMs = Date.parse(state.expiration);
      const renovadoMs = Date.parse(state.renewed_at || 0);
      const expiraEmH = Math.floor((expMs - Date.now()) / 3600000);
      const renovadoHaDias = Number.isFinite(renovadoMs) ? Math.floor((Date.now() - renovadoMs) / 86400000) : 999;
      const ok = expMs > Date.now() + WATCH_EXPIRACAO_FOLGA_HORAS * 3600000 && renovadoHaDias <= WATCH_RENOVACAO_MAX_DIAS;
      return {
        ok,
        valor: ok ? 0 : 1,
        detalhe: ok
          ? `watch do Calendar saudável (expira em ${expiraEmH}h)`
          : `watch do Calendar ${expMs < Date.now() ? 'EXPIRADO' : `expira em ${expiraEmH}h`} (última renovação há ${renovadoHaDias}d) — detecção de reuniões vai morrer em silêncio`,
      };
    }),

    // ── Google Sheets dessincronizado (sinal criado na F2) ───
    checkSeguro('sheets_sync_pendente', async () => {
      const n = await contar(
        `form_submissions?select=id&sheets_synced_at=is.null` +
          `&submitted_at=lt.${encodeURIComponent(isoAtras(SHEETS_SYNC_FOLGA_HORAS))}` +
          `&submitted_at=gt.${encodeURIComponent(desdeJanela)}`,
      );
      return {
        ok: n === 0,
        valor: n,
        detalhe: `${n} lead(s) há ${SHEETS_SYNC_FOLGA_HORAS}h+ sem sync no Google Sheets (planilha dessincronizada?)`,
      };
    }),

    // ── Relatório semanal (sinal criado na F2) ───────────────
    checkSeguro('weekly_report_atrasado', async () => {
      const state = await lerConfig('weekly_report_state');
      if (!state.last_sent_at) {
        return { ok: true, valor: 0, detalhe: 'aguardando primeiro envio do weekly-report — check pulado' };
      }
      const dias = Math.floor((Date.now() - Date.parse(state.last_sent_at)) / 86400000);
      return {
        ok: dias <= WEEKLY_REPORT_MAX_DIAS,
        valor: dias,
        detalhe: `último relatório semanal enviado há ${dias}d${dias > WEEKLY_REPORT_MAX_DIAS ? ' — job parado ou providers de e-mail falhando' : ''}`,
      };
    }),

    // ── Régua de cobrança parada (heartbeat criado na F2) ────
    checkSeguro('billing_tick_atrasado', async () => {
      const state = await lerConfig('billing_last_tick_at');
      if (!state.at) {
        return { ok: true, valor: 0, detalhe: 'régua de cobrança nunca tickou (job pausado de propósito) — check pulado' };
      }
      const horas = Math.floor((Date.now() - Date.parse(state.at)) / 3600000);
      return {
        ok: horas <= BILLING_TICK_MAX_HORAS,
        valor: horas,
        detalhe: `último tick da régua de cobrança há ${horas}h${horas > BILLING_TICK_MAX_HORAS ? ' — job pausado/quebrado (parcelas sem cobrança)' : ''}`,
      };
    }),

    // ── Engine de automações parada (runs presos) ────────────
    checkSeguro('runs_presos', async () => {
      const [pendentes, retryVencido] = await Promise.all([
        contar(`automacao_runs?select=id&status=eq.pendente&created_at=lt.${encodeURIComponent(isoAtras(RUNS_PRESOS_HORAS))}`),
        contar(`automacao_runs?select=id&status=eq.erro&proxima_tentativa_at=lt.${encodeURIComponent(isoAtras(RUNS_PRESOS_HORAS))}`),
      ]);
      const soma = pendentes + retryVencido;
      return {
        ok: soma === 0,
        valor: soma,
        detalhe: `${pendentes} run(s) pendentes ${RUNS_PRESOS_HORAS}h+ e ${retryVencido} retry(s) vencidos — engine de automações possivelmente parada`,
      };
    }),

    // ── Saúde POR automação — auto-instrumentação (F4) ───────
    // SÓ regras DETERMINÍSTICAS aqui (erro crônico, presos, agendamento/SLA
    // de silêncio, nunca-rodou): a heurística de baseline/mediana existe
    // apenas na tela /observabilidade/automacoes — o alerta automático NUNCA
    // acorda o CEO com heurística.
    checkSeguro('automacoes_saude', async () => {
      const [autosRes, runsRes] = await Promise.all([
        httpRequest(
          `${SUPABASE_URL}/rest/v1/automacoes?select=id,nome,gatilho,gatilho_config,updated_at&ativo=is.true&deleted_at=is.null`,
          { method: 'GET', headers: supaHeaders() },
        ),
        httpRequest(
          `${SUPABASE_URL}/rest/v1/automacao_runs?select=automacao_id,status,created_at,proxima_tentativa_at` +
            `&created_at=gt.${encodeURIComponent(isoAtras(31 * 24))}&order=created_at.desc&limit=1000`,
          { method: 'GET', headers: supaHeaders() },
        ),
      ]);
      if (autosRes.statusCode >= 400) throw new Error(`automacoes HTTP ${autosRes.statusCode}`);
      if (runsRes.statusCode >= 400) throw new Error(`automacao_runs HTTP ${runsRes.statusCode}`);
      const autos = JSON.parse(autosRes.body || '[]');
      const runs = JSON.parse(runsRes.body || '[]');

      const porAuto = {};
      for (const r of runs) (porAuto[r.automacao_id] = porAuto[r.automacao_id] || []).push(r);

      const agora = Date.now();
      const cortePreso = agora - RUNS_PRESOS_HORAS * 3600000;
      const corte7d = agora - 7 * 86400000;
      const FREQ_H = { diaria: 24, semanal: 168, mensal: 744 };
      const problemas = [];

      for (const a of autos) {
        const rs = porAuto[a.id] || []; // desc
        const motivos = [];

        const tres = rs.slice(0, 3);
        if (tres.length === 3 && tres.every((r) => r.status === 'erro')) motivos.push('3 erros consecutivos');
        const rs7d = rs.filter((r) => Date.parse(r.created_at) >= corte7d);
        const erros7d = rs7d.filter((r) => r.status === 'erro').length;
        if (motivos.length === 0 && rs7d.length >= 6 && erros7d / rs7d.length >= 0.5) {
          motivos.push(`taxa de erro ${Math.round((erros7d / rs7d.length) * 100)}%/7d`);
        }

        const presos = rs.filter((r) =>
          (r.status === 'pendente' && Date.parse(r.created_at) < cortePreso) ||
          (r.status === 'erro' && r.proxima_tentativa_at && Date.parse(r.proxima_tentativa_at) < cortePreso)).length;
        if (presos > 0) motivos.push(`${presos} run(s) presos`);

        const cfg = a.gatilho_config || {};
        const sla = typeof cfg.sla_horas === 'number' && cfg.sla_horas >= 1 && cfg.sla_horas <= 720 ? cfg.sla_horas : null;
        const ultimaMs = rs[0] ? Date.parse(rs[0].created_at) : null;
        const idadeH = ultimaMs !== null ? (agora - ultimaMs) / 3600000 : null;
        const carenciaOk = Date.parse(a.updated_at) < agora - 48 * 3600000;

        if (a.gatilho === 'agendamento') {
          const esperadoH = (FREQ_H[cfg.frequencia] || 24) + 6;
          if (idadeH !== null && idadeH > esperadoH) motivos.push(`agendamento sem run há ${Math.floor(idadeH)}h`);
          if (idadeH === null && carenciaOk) motivos.push('agendamento sem NENHUM run em 30d');
        }
        if (sla !== null) {
          if (idadeH !== null && idadeH > sla) motivos.push(`SLA de silêncio ${sla}h estourado (${Math.floor(idadeH)}h)`);
          if (idadeH === null && carenciaOk) motivos.push(`SLA ${sla}h definido e nenhum run em 30d`);
        }

        if (motivos.length > 0) problemas.push(`${a.nome} (${motivos.join('; ')})`);
      }

      return {
        ok: problemas.length === 0,
        valor: problemas.length,
        detalhe: problemas.length === 0
          ? `${autos.length} automação(ões) ativas saudáveis (regras determinísticas)`
          : `${problemas.length} automação(ões) com problema: ${problemas.slice(0, 3).join(' · ')}${problemas.length > 3 ? '…' : ''}`,
      };
    }),
    checkSeguro('scheduler_jobs', async () => {
      // Só jobs de PRODUÇÃO habilitados: -uat/-dev têm ambiente próprio e
      // PAUSED é decisão consciente do CEO (billing, NPS) — não é falha.
      const jobs = await listarJobsScheduler();
      const falhando = jobs.filter((j) => {
        const nome = String(j.name || '').split('/').pop();
        if (/-uat$|-dev$/.test(nome)) return false;
        if (j.state !== 'ENABLED') return false;
        if (!j.lastAttemptTime) return false; // nunca rodou — nada a julgar
        // status vazio = última tentativa OK; code presente = falhou
        return j.status && typeof j.status.code === 'number' && j.status.code !== 0;
      });
      const nomes = falhando.map((j) => String(j.name).split('/').pop());
      // Sinal F2 para a tela /observabilidade: o Engine roda no Vercel e não
      // alcança o metadata server do GCP — ele lê este estado, não a API.
      // Best-effort: falha na gravação não derruba o check.
      try {
        await salvarConfigKey('scheduler_jobs_state', {
          verificado_em: new Date().toISOString(),
          falhando: nomes,
        });
      } catch (e) {
        log('WARN', 'scheduler_state_gravacao_falhou', { error: e.message });
      }
      return {
        ok: falhando.length === 0,
        valor: falhando.length,
        detalhe: falhando.length
          ? `job(s) do Scheduler falhando na última tentativa: ${nomes.join(', ')}`
          : 'todos os jobs de produção com última tentativa OK',
      };
    }),
  ]);
};

// ─── Cloud Function principal ─────────────────────────────────
functions.http('monitorHealth', async (req, res) => {
  // Auth FAIL-CLOSED: secret obrigatório — os jobs do Cloud Scheduler enviam
  // o header x-webhook-secret (infra/scheduler.sh).
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false });
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

    // Checks suprimidos de propósito (features pausadas — ex.: régua/NPS).
    // Filtrado ANTES do cooldown: check desativado nunca vira alerta.
    const desativadosRaw = await lerConfig('monitor_checks_desativados');
    const desativados = new Set(Array.isArray(desativadosRaw) ? desativadosRaw : []);

    const checks = await runChecks();
    // A fila de aprovação sai por um aviso próprio (com nomes e link), então
    // não entra no alerta genérico do monitor — senão o CEO recebe o mesmo
    // fato duas vezes, com textos diferentes.
    const todasFalhas = checks.filter((c) => !c.ok && c.chave !== 'aprovacao_pendente_antiga');
    const suprimidas = todasFalhas.filter((c) => desativados.has(c.chave));
    const falhas = todasFalhas.filter((c) => !desativados.has(c.chave));
    if (suprimidas.length > 0) {
      log('INFO', 'monitor_checks_suprimidos', { chaves: suprimidas.map((c) => c.chave) });
    }

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
        // Canais por evento + severidade por check (Configurações →
        // Notificações). Antes TODA falha saía por WhatsApp E e-mail — virou
        // ruído, e alerta que o CEO para de ler não protege nada.
        const canais = await lerConfig('notificacoes_canais');
        const severidades = await lerConfig('monitor_severidades');
        // Check sem classificação = 'atencao': novo check nasce silencioso de
        // propósito (melhor descobrir que faltou classificar do que acordar
        // o CEO à toa).
        const criticos = paraAlertar.filter((c) => severidades[c.chave] === 'critico');
        const atencao = paraAlertar.filter((c) => severidades[c.chave] !== 'critico');

        let enviado = false;
        let emailsEnviados = 0;
        const recipients = await fetchAlertRecipients();

        for (const [grupo, lista] of [['monitor_critico', criticos], ['monitor_atencao', atencao]]) {
          if (lista.length === 0) continue;
          const cfg = canais[grupo] || {};
          const critico = grupo === 'monitor_critico';
          const linhas = lista.map((c) => `• ${c.detalhe}`).join('\n');
          const titulo = critico ? 'Monitor BAUSA — algo parou' : 'Monitor BAUSA — atenção no funil';

          if (cfg.inapp !== false) {
            await criarNotificacoesInApp(titulo, linhas);
          }
          if (cfg.whatsapp === true) {
            const msg = `${critico ? '🚨' : '⚠️'} *${titulo}*\n\n${linhas}\n\n${ENGINE_URL}/observabilidade`;
            if (await sendWhatsAppCeo(msg)) enviado = true;
          }
          if (cfg.email === true) {
            const html = emailMonitor({
              critico,
              itens: lista.map((c) => c.detalhe),
              urlObservabilidade: `${ENGINE_URL}/observabilidade`,
            });
            for (const to of recipients) {
              if (await sendEmailWithFallback(to, `${critico ? '🚨' : '⚠️'} ${titulo}`, html)) emailsEnviados += 1;
            }
          }
        }
        alertasEnviados = paraAlertar.length;

        const novoState = { ...state, ultimo_alerta: { ...ultimo } };
        for (const c of paraAlertar) novoState.ultimo_alerta[c.chave] = new Date().toISOString();
        await salvarMonitorState(novoState);

        log(enviado || emailsEnviados > 0 ? 'INFO' : 'WARN', 'monitor_alerta', {
          checks: paraAlertar.map((c) => c.chave),
          whatsappEnviado: enviado,
          emailsEnviados,
        });
      } else {
        log('INFO', 'monitor_alerta_em_cooldown', { falhas: falhas.map((c) => c.chave) });
      }
    }

    // Aviso da fila de aprovação — canais próprios, independe do cooldown
    // do monitor (é ação do CEO, não falha de sistema).
    let aprovacoesAvisadas = 0;
    if (!dryRun && !alertasDesligados) {
      try {
        aprovacoesAvisadas = await alertarAprovacaoPendente(await lerConfig('notificacoes_canais'));
      } catch (err) {
        log('WARN', 'alerta_aprovacao_falhou', { erro: err.message });
      }
    }

    const durationMs = Date.now() - startTime;
    log('INFO', 'monitor_health_complete', {
      aprovacoesAvisadas,
      dryRun,
      alertasDesligados,
      falhas: falhas.length,
      suprimidas: suprimidas.length,
      alertasEnviados,
      durationMs,
    });

    // Heartbeat do dead-man — TODO tick de produção real, com ou sem falhas.
    await registrarTick(falhas.length, checks.length, durationMs, dryRun);

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
