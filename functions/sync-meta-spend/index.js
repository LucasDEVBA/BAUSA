const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ════════════════════════════════════════════════════════════════════════
// sync-meta-spend — CAC Fase 2B: ingere o gasto de Meta Ads POR CAMPANHA/DIA
// ════════════════════════════════════════════════════════════════════════
//
// Acionada pelo Cloud Scheduler (diário 06h BRT). Puxa da Marketing API
// (Ads Insights, level=campaign, time_increment=1) o gasto por campanha e dia
// e grava em DUAS camadas:
//   1. meta_ads_campanha  — 1 linha por (dia, campanha) → ROI exato por
//      campanha (cruza campanha_id ↔ form_submissions.utm_id). Idempotente
//      por UNIQUE(data, campanha_id).
//   2. investimentos_marketing — rollup mensal (canal='meta', source='meta_api')
//      = fonte única dos TOTAIS do CAC e do DRE. Idempotente por
//      UNIQUE(mes, canal, source).
//
// Sincroniza o mês atual + N-1 anteriores (Meta reajusta gasto pós-fechamento).
// Segue paginação (paging.next). Auth: META_ACCESS_TOKEN (System User, não
// expira). Conta: META_AD_ACCOUNT_ID. Assume conta BRL (loga se ≠ BRL).
// ════════════════════════════════════════════════════════════════════════

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID; // ex.: act_123 ou 123
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const MESES_SYNC = Math.max(1, Number(process.env.META_SYNC_MESES || 2));
const MAX_PAGINAS = 50; // trava de segurança na paginação

const log = (level, action, details = {}) => console.log(JSON.stringify({ level, action, ...details }));

const httpRequest = (url, options, postData) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: options.method || 'GET', headers: options.headers || {} },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ statusCode: res.statusCode, body: b })); },
    );
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Request timeout (60s)')); });
    if (postData) req.write(postData);
    req.end();
  });

const supaUpsert = async (pathWithConflict, body) => {
  const r = await httpRequest(`${SUPABASE_URL}/rest/v1/${pathWithConflict}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Content-Profile': SUPABASE_SCHEMA,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
  }, JSON.stringify(body));
  if (r.statusCode >= 400) throw new Error(`Supabase upsert ${r.statusCode}: ${r.body}`);
};

// ─── Meta Ads Insights por campanha/dia (segue paginação) ───────────────
const fetchInsightsCampanhaDia = async (since, until) => {
  const acct = String(META_AD_ACCOUNT_ID).startsWith('act_') ? META_AD_ACCOUNT_ID : `act_${META_AD_ACCOUNT_ID}`;
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  let url =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${acct}/insights` +
    `?level=campaign&time_increment=1` +
    `&fields=campaign_id,campaign_name,spend,impressions,clicks,account_currency` +
    `&time_range=${timeRange}&limit=200&access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;

  const rows = [];
  let pagina = 0;
  for (; pagina < MAX_PAGINAS && url; pagina++) {
    const r = await httpRequest(url, { method: 'GET' });
    if (r.statusCode >= 400) throw new Error(`Meta API ${r.statusCode}: ${r.body.slice(0, 300)}`);
    const json = JSON.parse(r.body || '{}');
    if (Array.isArray(json.data)) rows.push(...json.data);
    url = json.paging && json.paging.next ? json.paging.next : null;
  }
  // Truncou no teto de páginas e ainda há mais: NÃO silenciar (dado incompleto).
  if (url) log('WARN', 'meta_paginacao_truncada', { paginas: pagina, linhas: rows.length, since, until });
  return rows;
};

const mesRange = (mesesAtras) => {
  const now = new Date();
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - mesesAtras, 1));
  const last = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
  return { since: ref.toISOString().slice(0, 10), until: last.toISOString().slice(0, 10), mes01: ref.toISOString().slice(0, 10) };
};

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

functions.http('syncMetaSpend', async (req, res) => {
  // Auth FAIL-CLOSED: secret obrigatório — os jobs do Cloud Scheduler enviam
  // o header x-webhook-secret (infra/scheduler.sh).
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false, error: 'Unauthorized' });
  }
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase não configurado');
    if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
      throw new Error('Meta não configurada (META_ACCESS_TOKEN / META_AD_ACCOUNT_ID)');
    }

    const resultados = [];
    for (let i = 0; i < MESES_SYNC; i++) {
      const { since, until, mes01 } = mesRange(i);
      const linhas = await fetchInsightsCampanhaDia(since, until);

      let totalSpend = 0;
      let totalImp = 0;
      let totalClk = 0;
      let currency = null;

      for (const l of linhas) {
        currency = currency || l.account_currency || null;
        const dia = l.date_start; // com time_increment=1, date_start = o dia
        if (!dia || !l.campaign_id) continue;
        const spend = num(l.spend);
        const imp = num(l.impressions);
        const clk = num(l.clicks);
        totalSpend += spend;
        totalImp += imp;
        totalClk += clk;

        // Detalhe por campanha/dia
        await supaUpsert('meta_ads_campanha?on_conflict=data,campanha_id', {
          data: dia,
          campanha_id: String(l.campaign_id),
          campanha_nome: l.campaign_name || null,
          valor_gasto: spend,
          impressoes: imp,
          cliques: clk,
          source: 'meta_api',
        });
      }

      if (currency && currency !== 'BRL') log('WARN', 'meta_currency_nao_brl', { currency, mes: mes01 });

      // Rollup mensal → fonte única dos TOTAIS (CAC/DRE)
      await supaUpsert('investimentos_marketing?on_conflict=mes,canal,source', {
        mes: mes01,
        canal: 'meta',
        source: 'meta_api',
        valor_gasto: totalSpend,
        impressoes: totalImp,
        cliques: totalClk,
        observacao: `Meta API ${META_GRAPH_VERSION} (${currency || '?'}) — ${linhas.length} linhas campanha/dia — sync ${new Date().toISOString()}`,
      });

      log('INFO', 'meta_sync_mes', { mes: mes01, linhas: linhas.length, totalSpend, totalImp, totalClk, currency });
      resultados.push({ mes: mes01, linhas: linhas.length, totalSpend, totalImp, totalClk, currency });
    }

    log('INFO', 'meta_sync_complete', { meses: resultados.length });
    return res.status(200).send({ success: true, resultados });
  } catch (error) {
    log('ERROR', 'meta_sync_failed', { error: error.message });
    return res.status(500).send({ success: false, error: error.message });
  }
});
