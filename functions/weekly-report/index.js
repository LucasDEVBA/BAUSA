const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ════════════════════════════════════════════════════════════════════════
// weekly-report — Relatório semanal automático por email (CEO + Head)
// Cron: segunda 08:00 BRT (Cloud Scheduler). Trigger HTTP + x-webhook-secret.
//
// Monta um resumo dos últimos 7 dias (novos leads, qualificados, deals
// fechados, contratos, gasto/CAC, alertas, famílias em crise) e envia por
// email aos user_profiles ativos com papel ceo/head_sucesso.
//
// Padrões reusados (skill bausa-cloud-function):
//  - log estruturado JSON
//  - email via Resend (primário) + Brevo (fallback) — espelho de send-messages
//  - Supabase REST com Accept-Profile por ambiente
// ════════════════════════════════════════════════════════════════════════

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Bolsa Atleta USA <contato@bolsaatletausa.com>';
const ENGINE_URL = process.env.ENGINE_URL || 'https://bolsaatletausa.com';

const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── HTTPS genérico ─────────────────────────────────────────────────────
const httpRequest = (options, postData) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout (15s)')); });
    if (postData) req.write(postData);
    req.end();
  });
};

// ─── Supabase REST (PATCH) — sinal observável weekly_report_state ───────
// Antes, a ausência do e-mail de segunda era o ÚNICO sintoma de falha
// (detecção 100% humana — auditoria 2026-07-19). FAIL-OPEN: telemetria
// nunca quebra o envio do relatório.
const salvarReportState = async (state) => {
  try {
    const postData = JSON.stringify({ valor: state });
    const url = new URL(`${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=eq.weekly_report_state`);
    const result = await httpRequest({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Profile': SUPABASE_SCHEMA,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        Prefer: 'return=minimal',
      },
    }, postData);
    if (result.statusCode >= 400) log('WARN', 'report_state_save_failed', { statusCode: result.statusCode });
  } catch (e) {
    log('WARN', 'report_state_save_failed', { error: e.message });
  }
};

// ─── Supabase REST (GET) ────────────────────────────────────────────────
const supaGet = async (pathAndQuery) => {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`);
  const result = await httpRequest({
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept-Profile': SUPABASE_SCHEMA,
      'Content-Type': 'application/json',
    },
  });
  if (result.statusCode >= 400) {
    throw new Error(`Supabase GET ${pathAndQuery}: ${result.statusCode} ${result.body}`);
  }
  return JSON.parse(result.body || '[]');
};

// ─── Email: Resend (primário) + Brevo (fallback) ───────────────────────
const parseFromEmail = (raw) => {
  const m = raw.match(/^(.*)<(.+)>$/);
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: 'Bolsa Atleta USA', email: raw.trim() };
};

const sendViaResend = async (to, subject, html) => {
  const postData = JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html });
  const result = await httpRequest({
    hostname: 'api.resend.com', path: '/emails', method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
  }, postData);
  if (result.statusCode >= 400) throw new Error(`Resend HTTP ${result.statusCode}: ${result.body}`);
  return { provider: 'resend', statusCode: result.statusCode };
};

const sendViaBrevo = async (to, subject, html) => {
  const from = parseFromEmail(FROM_EMAIL);
  const postData = JSON.stringify({ sender: { name: from.name, email: from.email }, to: [{ email: to }], subject, htmlContent: html });
  const result = await httpRequest({
    hostname: 'api.brevo.com', path: '/v3/smtp/email', method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
  }, postData);
  if (result.statusCode >= 400) throw new Error(`Brevo HTTP ${result.statusCode}: ${result.body}`);
  return { provider: 'brevo', statusCode: result.statusCode };
};

const sendEmailWithFallback = async (to, subject, html) => {
  if (!to || !to.includes('@')) {
    log('WARN', 'email_skip', { reason: 'email inválido', to: to || 'null' });
    return { success: false };
  }
  const providers = [
    { name: 'resend', fn: sendViaResend, available: !!RESEND_API_KEY },
    { name: 'brevo', fn: sendViaBrevo, available: !!BREVO_API_KEY },
  ];
  for (const p of providers) {
    if (!p.available) continue;
    try {
      const r = await p.fn(to, subject, html);
      log('INFO', 'email_sent', { provider: r.provider, to });
      return { success: true, provider: r.provider };
    } catch (e) {
      log('ERROR', 'email_failed', { provider: p.name, to, error: e.message });
      await delay(500);
    }
  }
  log('CRITICAL', 'all_providers_failed', { to });
  return { success: false };
};

// ─── Coleta de KPIs dos últimos 7 dias ─────────────────────────────────
const fetchWeeklyKPIs = async () => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM

  const [
    novosLeads,
    deals7d,
    contratos7d,
    dealsAtivos,
    parcelasAtrasadas,
    crises,
    gastoMes,
  ] = await Promise.all([
    supaGet(`form_submissions?select=qualification_classification&submitted_at=gte.${since}`),
    supaGet(`deals?select=etapa,updated_at&deleted_at=is.null&updated_at=gte.${since}`),
    supaGet(`contratos_financeiros?select=valor_total&deleted_at=is.null&created_at=gte.${since}`),
    supaGet('deals?select=next_action&deleted_at=is.null&etapa=not.in.(perdido,concluido,cancelamento_solicitado)'),
    supaGet('parcelas?select=valor&status=eq.atrasado&deleted_at=is.null'),
    supaGet('crm_experiencia?select=id&status=eq.crise&deleted_at=is.null'),
    supaGet(`investimentos_marketing?select=valor_gasto&deleted_at=is.null&mes=gte.${monthPrefix}-01`),
  ]);

  const leadsQualificados = novosLeads.filter((l) =>
    ['QUENTE', 'MORNO'].includes(l.qualification_classification),
  ).length;
  const dealsFechados = deals7d.filter((d) => d.etapa === 'concluido').length;
  const receitaNova = contratos7d.reduce((s, c) => s + Number(c.valor_total || 0), 0);
  const dealsSemAcao = dealsAtivos.filter(
    (d) => d.next_action == null || String(d.next_action).trim() === '',
  ).length;
  const valorAtrasado = parcelasAtrasadas.reduce((s, p) => s + Number(p.valor || 0), 0);
  const gastoMarketingMes = gastoMes.reduce((s, g) => s + Number(g.valor_gasto || 0), 0);

  return {
    novosLeads: novosLeads.length,
    leadsQualificados,
    dealsFechados,
    contratosNovos: contratos7d.length,
    receitaNova,
    dealsAtivos: dealsAtivos.length,
    dealsSemAcao,
    parcelasAtrasadas: parcelasAtrasadas.length,
    valorAtrasado,
    familiasEmCrise: crises.length,
    gastoMarketingMes,
  };
};

// ─── Destinatários: user_profiles ativos ceo/head_sucesso ──────────────
const fetchRecipients = async () => {
  const rows = await supaGet('user_profiles?select=email,papel,nome&ativo=is.true&papel=in.(ceo,head_sucesso)');
  return rows.filter((r) => r.email && r.email.includes('@'));
};

// ─── Template HTML ──────────────────────────────────────────────────────
const brl = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR')}`;

const buildReportHtml = (kpis, weekLabel, nome) => {
  const row = (label, value, hint) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#333;font-size:14px">${label}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#0c1527;font-size:15px;font-weight:700;text-align:right">${value}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;color:#888;font-size:12px">${hint || ''}</td>
    </tr>`;
  const alertColor = kpis.familiasEmCrise > 0 || kpis.dealsSemAcao > 0 ? '#8e1824' : '#1a7f37';
  return `<!DOCTYPE html><html><body style="margin:0;background:#f3f5fa;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:24px">
    <div style="background:linear-gradient(135deg,#8e1824,#476bc0);border-radius:14px 14px 0 0;padding:24px">
      <h1 style="margin:0;color:#fff;font-size:20px">Relatório Semanal — BAUSA</h1>
      <p style="margin:6px 0 0;color:#e8ecf6;font-size:13px">${weekLabel}</p>
    </div>
    <div style="background:#fff;border-radius:0 0 14px 14px;padding:8px 0 16px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
      <p style="padding:16px 14px 4px;margin:0;color:#3b4a68;font-size:14px">Olá${nome ? `, ${nome}` : ''}. Resumo dos últimos 7 dias:</p>
      <table style="width:100%;border-collapse:collapse;margin-top:8px">
        ${row('Novos leads', kpis.novosLeads, `${kpis.leadsQualificados} qualificados (QUENTE/MORNO)`)}
        ${row('Deals fechados', kpis.dealsFechados, 'na semana')}
        ${row('Contratos novos', kpis.contratosNovos, brl(kpis.receitaNova))}
        ${row('Gasto marketing (mês)', brl(kpis.gastoMarketingMes), 'acumulado do mês')}
      </table>
      <p style="padding:18px 14px 4px;margin:0;color:${alertColor};font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">⚠ Atenção</p>
      <table style="width:100%;border-collapse:collapse">
        ${row('Deals ativos sem próxima ação', `${kpis.dealsSemAcao} / ${kpis.dealsAtivos}`, 'definir next action')}
        ${row('Parcelas atrasadas', kpis.parcelasAtrasadas, brl(kpis.valorAtrasado))}
        ${row('Famílias em crise', kpis.familiasEmCrise, kpis.familiasEmCrise > 0 ? 'ação imediata' : 'tudo ok')}
      </table>
      <div style="text-align:center;padding:22px 14px 8px">
        <a href="${ENGINE_URL}" style="display:inline-block;background:#476bc0;color:#fff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600">Abrir o BAUSA Engine</a>
      </div>
      <p style="padding:8px 14px 0;margin:0;color:#aab;font-size:11px;text-align:center">Relatório automático · enviado toda segunda 08h</p>
    </div>
  </div></body></html>`;
};

// ─── Handler ────────────────────────────────────────────────────────────
functions.http('weeklyReport', async (req, res) => {
  // Auth: valida o secret APENAS se o header foi enviado (chamadas externas).
  // Auth FAIL-CLOSED: secret obrigatório — os jobs do Cloud Scheduler enviam
  // o header x-webhook-secret (infra/scheduler.sh).
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false, error: 'Unauthorized' });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_URL/SUPABASE_SERVICE_KEY não configuradas');
    }

    log('INFO', 'weekly_report_start', {});
    const [kpis, recipients] = await Promise.all([fetchWeeklyKPIs(), fetchRecipients()]);

    if (recipients.length === 0) {
      log('WARN', 'no_recipients', { reason: 'Nenhum user_profile ativo ceo/head_sucesso' });
      return res.status(200).send({ success: true, sent: 0, reason: 'no_recipients' });
    }

    const now = new Date();
    const ini = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    const weekLabel = `Semana de ${fmt(ini)} a ${fmt(now)}`;
    const subject = `📊 Relatório Semanal BAUSA — ${weekLabel}`;

    let sent = 0;
    for (const r of recipients) {
      const html = buildReportHtml(kpis, weekLabel, r.nome);
      const result = await sendEmailWithFallback(r.email, subject, html);
      if (result.success) sent += 1;
      await delay(400);
    }

    log('INFO', 'weekly_report_complete', { sent, total: recipients.length, kpis });

    // Sinal observável — SÓ com sent>0: se todos os providers falharam, o
    // estado fica velho de propósito para o check weekly_report_atrasado acusar.
    if (sent > 0) {
      await salvarReportState({ last_sent_at: new Date().toISOString(), sent, total: recipients.length });
    }

    return res.status(200).send({ success: true, sent, total: recipients.length });
  } catch (error) {
    log('ERROR', 'weekly_report_failed', { error: error.message });
    return res.status(500).send({ success: false, error: error.message });
  }
});
