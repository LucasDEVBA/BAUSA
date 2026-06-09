const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ════════════════════════════════════════════════════════════════════════
// sync-meta-spend — CAC Fase 2A: ingere o gasto de anúncios da Meta
// ════════════════════════════════════════════════════════════════════════
//
// Acionada pelo Cloud Scheduler (diário). Puxa o gasto agregado da conta de
// anúncios da Meta (Marketing API, Ads Insights) por mês e faz UPSERT em
// investimentos_marketing (canal='meta', source='meta_api'). O dashboard
// /analytics/cac já é agnóstico a `source` — passa a exibir o gasto real
// da Meta automaticamente, sem input manual.
//
// Sincroniza o mês atual + N-1 meses anteriores (Meta reajusta gasto após o
// fechamento). Idempotente: UPSERT em (mes, canal, source).
//
// Auth (System User token, NÃO expira): META_ACCESS_TOKEN. Conta: META_AD_ACCOUNT_ID.
// ⚠️ valor_gasto é BRL; assume conta de anúncios em BRL (loga account_currency
//    e alerta se ≠ BRL — conversão de moeda é trabalho futuro).
// ════════════════════════════════════════════════════════════════════════

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID; // ex.: act_123 ou 123
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const MESES_SYNC = Math.max(1, Number(process.env.META_SYNC_MESES || 2)); // mês atual + (N-1) anteriores

const log = (level, action, details = {}) => console.log(JSON.stringify({ level, action, ...details }));

const httpRequest = (url, options, postData) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: options.method || 'GET', headers: options.headers || {} },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ statusCode: res.statusCode, body: b })); },
    );
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout (30s)')); });
    if (postData) req.write(postData);
    req.end();
  });

// ─── Supabase REST (upsert) ────────────────────────────────────────────
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

// ─── Meta Ads Insights (gasto agregado da conta no período) ─────────────
const fetchMetaSpend = async (since, until) => {
  const acct = String(META_AD_ACCOUNT_ID).startsWith('act_') ? META_AD_ACCOUNT_ID : `act_${META_AD_ACCOUNT_ID}`;
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  const url =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${acct}/insights` +
    `?fields=spend,impressions,clicks,account_currency&time_range=${timeRange}` +
    `&access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`;
  const r = await httpRequest(url, { method: 'GET' });
  if (r.statusCode >= 400) throw new Error(`Meta API ${r.statusCode}: ${r.body.slice(0, 300)}`);
  const json = JSON.parse(r.body || '{}');
  return Array.isArray(json.data) && json.data.length ? json.data[0] : null;
};

// Mês de referência i meses atrás: { since: 'YYYY-MM-01', until: 'YYYY-MM-último' }
const mesRange = (mesesAtras) => {
  const now = new Date();
  const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - mesesAtras, 1));
  const last = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0));
  return { since: ref.toISOString().slice(0, 10), until: last.toISOString().slice(0, 10) };
};

functions.http('syncMetaSpend', async (req, res) => {
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
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
      const { since, until } = mesRange(i);
      const insight = await fetchMetaSpend(since, until);
      const spend = insight ? Number(insight.spend || 0) : 0;
      const impressions = insight ? Number(insight.impressions || 0) : 0;
      const clicks = insight ? Number(insight.clicks || 0) : 0;
      const currency = insight ? insight.account_currency : null;

      if (currency && currency !== 'BRL') {
        log('WARN', 'meta_currency_nao_brl', { currency, mes: since });
      }

      await supaUpsert('investimentos_marketing?on_conflict=mes,canal,source', {
        mes: since,
        canal: 'meta',
        source: 'meta_api',
        valor_gasto: Number.isFinite(spend) ? spend : 0,
        impressoes: Number.isFinite(impressions) ? impressions : 0,
        cliques: Number.isFinite(clicks) ? clicks : 0,
        observacao: `Meta API ${META_GRAPH_VERSION} (${currency || '?'}) — sync ${new Date().toISOString()}`,
      });

      log('INFO', 'meta_sync_mes', { mes: since, spend, impressions, clicks, currency });
      resultados.push({ mes: since, spend, impressions, clicks, currency });
    }

    log('INFO', 'meta_sync_complete', { meses: resultados.length });
    return res.status(200).send({ success: true, resultados });
  } catch (error) {
    log('ERROR', 'meta_sync_failed', { error: error.message });
    return res.status(500).send({ success: false, error: error.message });
  }
});
