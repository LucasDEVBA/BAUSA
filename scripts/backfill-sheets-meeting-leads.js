#!/usr/bin/env node
/**
 * Backfill Sheets: leads afetados pelo bug do calendar-webhook.
 *
 * CONTEXTO DO BUG
 * ----------------
 * Entre 2026-04-10 (deploy do calendar-webhook) e a data desta correção,
 * sempre que uma reunião era detectada via Google Calendar, o calendar-webhook
 * chamava sync-elite-leads com um payload incompleto (apenas 7 campos vindos
 * do SELECT em findLeadByContact). O sync-leads/buildRow trata campos undefined
 * como string vazia, então a linha A-BG do Google Sheets era reescrita
 * apagando endereço, esporte, escola, qualificação, follow-ups e UTMs.
 *
 * O QUE ESTE SCRIPT FAZ
 * ---------------------
 * 1. Lê do Supabase TODOS os campos (SELECT *) dos leads com
 *    meeting_scheduled=true e meeting_scheduled_at >= CUTOFF_DATE.
 * 2. Para cada lead, chama o sync-elite-leads em PRD com payload COMPLETO.
 * 3. O sync-leads encontra a linha existente por (email, athlete_name) e
 *    atualiza A-BG com todos os dados corretos.
 *
 * GARANTIAS DE SEGURANÇA
 * ----------------------
 * - sync-leads NÃO envia WhatsApp/e-mail — só escreve no Sheets.
 * - Operação 100% idempotente (findExistingRow + UPDATE, nunca duplica).
 * - Throttle de 1500ms entre chamadas (limite Sheets API: 300 writes/min).
 * - Fail-fast: aborta após 3 erros consecutivos para investigar.
 * - --dry-run NÃO chama sync-leads, apenas lista o que seria feito.
 *
 * USO
 * ---
 *   # Listar (sem efeito):
 *   SUPABASE_URL=https://...supabase.co SUPABASE_KEY=eyJ... \
 *     node scripts/backfill-sheets-meeting-leads.js --dry-run
 *
 *   # Executar (com auth do sync-leads):
 *   SUPABASE_URL=... SUPABASE_KEY=... \
 *   SYNC_LEADS_URL=https://...cloudfunctions.net/sync-elite-leads \
 *   WEBHOOK_SECRET=... \
 *     node scripts/backfill-sheets-meeting-leads.js --execute
 *
 *   # Testar 1 lead específico antes do batch:
 *   ... --execute --ids=412dc627-76af-4a47-981f-e84d6f05fac5
 */

'use strict';

const https = require('https');
const { URL } = require('url');

// ─── Configuração via env ─────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const SYNC_LEADS_URL = process.env.SYNC_LEADS_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';
const CUTOFF_DATE = process.env.CUTOFF_DATE || '2026-04-10';
const THROTTLE_MS = Number.parseInt(process.env.THROTTLE_MS || '1500', 10);
const MAX_CONSECUTIVE_FAILURES = 3;

// ─── Args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isExecute = args.includes('--execute');
const isVerbose = args.includes('--verbose');
const idsArg = args.find((a) => a.startsWith('--ids='));
const onlyIds = idsArg ? idsArg.replace('--ids=', '').split(',').filter(Boolean) : null;

// ─── Validações ────────────────────────────────────────────────────
const fail = (msg) => {
  console.error(`ERRO: ${msg}`);
  process.exit(1);
};

if (!isDryRun && !isExecute) fail('passe --dry-run ou --execute.');
if (isDryRun && isExecute) fail('não use --dry-run e --execute juntos.');
if (!SUPABASE_URL || !SUPABASE_KEY) fail('SUPABASE_URL e SUPABASE_KEY são obrigatórios.');
if (isExecute && (!SYNC_LEADS_URL || !WEBHOOK_SECRET)) {
  fail('SYNC_LEADS_URL e WEBHOOK_SECRET são obrigatórios para --execute.');
}

// ─── Log estruturado ───────────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, action, ...details }));
};

// ─── HTTPS helper com timeout ──────────────────────────────────────
const httpRequest = (urlStr, options, body = null) =>
  new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: 30000,
      },
      (res) => {
        let chunks = '';
        res.on('data', (c) => {
          chunks += c;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode, body: chunks }));
      },
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout (30s)'));
    });
    if (body) req.write(body);
    req.end();
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Busca leads afetados no Supabase ──────────────────────────────
const fetchAffectedLeads = async () => {
  let query;
  if (onlyIds && onlyIds.length > 0) {
    query = `id=in.(${onlyIds.join(',')})&select=*`;
  } else {
    query =
      `meeting_scheduled=eq.true` +
      `&meeting_scheduled_at=gte.${CUTOFF_DATE}` +
      `&select=*&order=meeting_scheduled_at.asc`;
  }
  const url = `${SUPABASE_URL}/rest/v1/form_submissions?${query}`;
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
  if (SUPABASE_SCHEMA !== 'public') headers['Accept-Profile'] = SUPABASE_SCHEMA;

  const result = await httpRequest(url, { method: 'GET', headers });
  if (result.statusCode >= 400) {
    throw new Error(`Supabase GET ${result.statusCode}: ${result.body.slice(0, 300)}`);
  }
  return JSON.parse(result.body);
};

// ─── Chama sync-elite-leads com payload completo ───────────────────
const syncLead = async (lead) => {
  const body = JSON.stringify({ record: lead });
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'x-webhook-secret': WEBHOOK_SECRET,
  };
  const result = await httpRequest(SYNC_LEADS_URL, { method: 'POST', headers }, body);
  if (result.statusCode >= 400) {
    throw new Error(`sync-leads ${result.statusCode}: ${result.body.slice(0, 300)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(result.body);
  } catch {
    parsed = { raw: result.body.slice(0, 200) };
  }
  return parsed;
};

// ─── Sumário compacto de um lead (para logs) ───────────────────────
const summarize = (lead) => ({
  id: lead.id,
  athlete: lead.athlete_name,
  guardian: lead.guardian_name,
  email: lead.email,
  country: lead.address_country,
  city: lead.address_city,
  classification: lead.qualification_classification,
  position: lead.position,
  school: lead.current_school,
  meeting_at: lead.meeting_scheduled_at,
  whatsapp_sent: !!lead.whatsapp_sent_at,
});

// ─── Main ──────────────────────────────────────────────────────────
(async () => {
  log('INFO', 'backfill_start', {
    mode: isDryRun ? 'dry-run' : 'execute',
    cutoffDate: CUTOFF_DATE,
    throttleMs: THROTTLE_MS,
    schema: SUPABASE_SCHEMA,
    filter: onlyIds ? { ids: onlyIds } : 'meeting_scheduled=true since cutoff',
  });

  const leads = await fetchAffectedLeads();
  log('INFO', 'leads_loaded', { count: leads.length });

  if (leads.length === 0) {
    log('INFO', 'no_leads_to_process');
    return;
  }

  if (isVerbose) {
    log('INFO', 'sample_first_lead_keys', { keys: Object.keys(leads[0]).sort() });
  }

  // Validação mínima do payload — todos devem ter id, email, athlete_name
  for (const lead of leads) {
    if (!lead.id || !lead.email || !lead.athlete_name) {
      log('CRITICAL', 'invalid_lead_skipping_all', {
        id: lead.id,
        email: lead.email,
        athlete: lead.athlete_name,
      });
      process.exit(2);
    }
  }

  if (isDryRun) {
    for (const lead of leads) {
      log('INFO', 'dry_run_lead', summarize(lead));
    }
    log('INFO', 'dry_run_complete', {
      count: leads.length,
      note: 'Nenhuma chamada ao sync-leads foi feita. Para executar de verdade, use --execute.',
    });
    return;
  }

  // EXECUTE
  let ok = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  const failures = [];

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    try {
      const result = await syncLead(lead);
      log('INFO', 'sync_ok', {
        i: i + 1,
        total: leads.length,
        id: lead.id,
        athlete: lead.athlete_name,
        action: result.action || 'unknown',
        row: result.row || null,
      });
      ok++;
      consecutiveFailures = 0;
    } catch (err) {
      log('ERROR', 'sync_failed', {
        i: i + 1,
        id: lead.id,
        athlete: lead.athlete_name,
        error: err.message,
      });
      failed++;
      consecutiveFailures++;
      failures.push({ id: lead.id, athlete: lead.athlete_name, error: err.message });

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        log('CRITICAL', 'too_many_consecutive_failures_aborting', {
          consecutiveFailures,
          processedSoFar: i + 1,
          totalLeads: leads.length,
        });
        break;
      }
    }

    // Throttle entre chamadas (não no último)
    if (i < leads.length - 1) {
      await sleep(THROTTLE_MS);
    }
  }

  log('INFO', 'backfill_complete', {
    success: ok,
    failed,
    total: leads.length,
    durationApproxSeconds: Math.round(((leads.length - 1) * THROTTLE_MS) / 1000),
    failedLeads: failures.length > 0 ? failures : undefined,
  });

  if (failed > 0) process.exit(1);
})().catch((err) => {
  log('CRITICAL', 'fatal_error', { error: err.message, stack: err.stack });
  process.exit(1);
});
