const functions = require('@google-cloud/functions-framework');
const https = require('https');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════════════════════
// send-remarketing — disparo controlado de campanha de re-marketing (Z-API)
// ════════════════════════════════════════════════════════════════════════
//
// Recebe { campanha_id, dryRun }. Busca os envios PENDENTES da campanha e
// dispara via Z-API (texto livre), com SALVAGUARDAS anti-ban obrigatórias:
//   - Horário seguro: 09h–20h BRT (fora disso, não envia)
//   - Limite diário: LIMITE_DIARIO por campanha (conta últimas 24h)
//   - Throttle aleatório: 30–45s entre envios (ritmo humano)
//   - Batch por invocação: MAX_POR_INVOCACAO (cabe no timeout) — cron continua
//   - CAS atômico em enviado_at: nunca reenvia o mesmo destinatário
//   - Opt-out: telefone em remarketing_optout é pulado
//
// dryRun=true: NÃO envia, retorna a contagem + amostra de quem receberia.
//
// Idempotente: re-rodar continua de onde parou (envios pendentes).
// Acionada pelo Engine (1ª leva) + Cloud Scheduler a cada 15 min (continua).
// ════════════════════════════════════════════════════════════════════════

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';
const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

// E-mail (canal alternativo — Resend primário, Brevo fallback)
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'Bolsa Atleta USA <contato@bolsaatletausa.com>';
const LOGO_URL = process.env.LOGO_URL || 'https://nikrlikwghqcxcjzthmc.supabase.co/storage/v1/object/public/public-assets/logo-bsa.jpg';
const UNSUBSCRIBE_URL = process.env.UNSUBSCRIBE_URL || '';

// ─── Salvaguardas (ritmo MODERADO — definido pelo CEO) ─────────────────
const LIMITE_DIARIO = Number(process.env.REMKTG_LIMITE_DIARIO || 120);
const THROTTLE_MIN_MS = Number(process.env.REMKTG_THROTTLE_MIN || 30000);
const THROTTLE_MAX_MS = Number(process.env.REMKTG_THROTTLE_MAX || 45000);
const HORARIO_INICIO = 9;   // BRT
const HORARIO_FIM = 20;     // BRT (exclusivo às 20h59 — usamos < 20)
const MAX_POR_INVOCACAO = Number(process.env.REMKTG_MAX_BATCH || 10);
// E-mail não tem risco de ban como o WhatsApp: limite maior, throttle menor, sem horário restrito.
const EMAIL_LIMITE_DIARIO = Number(process.env.REMKTG_EMAIL_LIMITE_DIARIO || 500);
const EMAIL_THROTTLE_MS = Number(process.env.REMKTG_EMAIL_THROTTLE || 2500);
const EMAIL_MAX_POR_INVOCACAO = Number(process.env.REMKTG_EMAIL_MAX_BATCH || 30);

const log = (level, action, details = {}) => console.log(JSON.stringify({ level, action, ...details }));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const throttleAleatorio = () => THROTTLE_MIN_MS + Math.floor((THROTTLE_MAX_MS - THROTTLE_MIN_MS) * (Date.now() % 1000) / 1000);

const httpRequest = (url, options, postData) => {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: options.method || 'GET', headers: options.headers || {} },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ statusCode: res.statusCode, body: b })); },
    );
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Request timeout (20s)')); });
    if (postData) req.write(postData);
    req.end();
  });
};

// ─── Supabase REST ─────────────────────────────────────────────────────
const supaHeaders = (write) => ({
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  [write ? 'Content-Profile' : 'Accept-Profile']: SUPABASE_SCHEMA,
});
const supaGet = async (pq) => {
  const r = await httpRequest(`${SUPABASE_URL}/rest/v1/${pq}`, { method: 'GET', headers: supaHeaders(false) });
  if (r.statusCode >= 400) throw new Error(`Supabase GET ${pq}: ${r.statusCode} ${r.body}`);
  return JSON.parse(r.body || '[]');
};
const supaPatch = async (pq, body, prefer) => {
  const h = supaHeaders(true);
  if (prefer) h.Prefer = prefer;
  const r = await httpRequest(`${SUPABASE_URL}/rest/v1/${pq}`, { method: 'PATCH', headers: h }, JSON.stringify(body));
  if (r.statusCode >= 400) throw new Error(`Supabase PATCH ${pq}: ${r.statusCode} ${r.body}`);
  return prefer ? JSON.parse(r.body || '[]') : null;
};

// ─── Z-API (texto livre) ───────────────────────────────────────────────
const formatPhone = (phone) => {
  if (!phone) return null;
  const original = String(phone).trim();
  const isE164 = original.startsWith('+');
  let cleaned = original.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
  if (!isE164 && cleaned.length <= 11) cleaned = '55' + cleaned;
  return cleaned.length < 12 ? null : cleaned;
};

const enviarZApi = async (phone, message) => {
  const formatted = formatPhone(phone);
  if (!formatted) return { success: false, error: 'Número inválido' };
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;
  const result = await httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
  }, JSON.stringify({ phone: formatted, message }));
  if (result.statusCode >= 400) return { success: false, error: `Z-API HTTP ${result.statusCode}` };
  return { success: true };
};

// Imagem com legenda (/send-image) — image aceita URL pública.
const enviarZApiImagem = async (phone, imageUrl, caption) => {
  const formatted = formatPhone(phone);
  if (!formatted) return { success: false, error: 'Número inválido' };
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-image`;
  const result = await httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
  }, JSON.stringify({ phone: formatted, image: imageUrl, caption: caption || '' }));
  if (result.statusCode >= 400) return { success: false, error: `Z-API HTTP ${result.statusCode}` };
  return { success: true };
};

// Link com preview rico (/send-link) — card clicável = CTA confiável.
const enviarZApiLink = async (phone, message, linkUrl, title, description, image) => {
  const formatted = formatPhone(phone);
  if (!formatted) return { success: false, error: 'Número inválido' };
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-link`;
  const result = await httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Client-Token': ZAPI_CLIENT_TOKEN },
  }, JSON.stringify({
    phone: formatted,
    message,
    linkUrl,
    title: title || '',
    linkDescription: description || '',
    image: image || '',
  }));
  if (result.statusCode >= 400) return { success: false, error: `Z-API HTTP ${result.statusCode}` };
  return { success: true };
};

// Despacha conforme o tipo da campanha (texto | imagem | link).
// Fallback defensivo para texto se faltar a mídia (não quebra o disparo).
const enviarPorTipo = async (campanha, telefone, env) => {
  const corpo = personalizar(campanha.mensagem || '', env);
  if (campanha.tipo_mensagem === 'imagem' && campanha.imagem_url) {
    return enviarZApiImagem(telefone, campanha.imagem_url, corpo);
  }
  if (campanha.tipo_mensagem === 'link' && campanha.link_url) {
    return enviarZApiLink(
      telefone, corpo, campanha.link_url,
      campanha.link_titulo, campanha.link_descricao, campanha.link_imagem,
    );
  }
  return enviarZApi(telefone, corpo);
};

// ─── Helpers de salvaguarda ────────────────────────────────────────────
const horaBRT = () => (new Date().getUTCHours() - 3 + 24) % 24;
const dentroHorarioSeguro = () => {
  const h = horaBRT();
  return h >= HORARIO_INICIO && h < HORARIO_FIM;
};

const personalizar = (mensagem, env) =>
  mensagem
    .replace(/\{nome\}/g, (env.nome || '').trim().split(/\s+/)[0] || 'tudo bem')
    .replace(/\{esporte\}/g, (env.esporte || 'seu esporte').trim());

// ─── E-mail (Resend primário + Brevo fallback) ─────────────────────────
const sanitizeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const parseFromEmail = (f) => {
  const m = String(f).match(/^(.+)\s*<(.+)>$/);
  return { name: m ? m[1].trim() : 'Bolsa Atleta USA', email: m ? m[2].trim() : 'contato@bolsaatletausa.com' };
};

const emailViaResend = async (to, subject, html) => {
  const r = await httpRequest('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  }, JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }));
  if (r.statusCode >= 400) throw new Error(`Resend ${r.statusCode}: ${r.body}`);
  return 'resend';
};
const emailViaBrevo = async (to, subject, html) => {
  const from = parseFromEmail(FROM_EMAIL);
  const r = await httpRequest('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
  }, JSON.stringify({ sender: from, to: [{ email: to }], subject, htmlContent: html }));
  if (r.statusCode >= 400) throw new Error(`Brevo ${r.statusCode}: ${r.body}`);
  return 'brevo';
};
const enviarEmail = async (to, subject, html) => {
  if (!to || !to.includes('@')) return { success: false, error: 'E-mail inválido' };
  for (const p of [{ fn: emailViaResend, on: !!RESEND_API_KEY }, { fn: emailViaBrevo, on: !!BREVO_API_KEY }]) {
    if (!p.on) continue;
    try { await p.fn(to, subject, html); return { success: true }; }
    catch (e) { log('WARN', 'email_provider_fail', { error: e.message }); await delay(400); }
  }
  return { success: false, error: 'Falha em todos os provedores de e-mail' };
};

// Link de descadastro com token HMAC (mesmo formato da CF remarketing-unsubscribe).
const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unsubLink = (email) => {
  if (!UNSUBSCRIBE_URL || !WEBHOOK_SECRET || !email) return '';
  const sig = b64url(crypto.createHmac('sha256', WEBHOOK_SECRET).update(email).digest());
  return `${UNSUBSCRIBE_URL}?t=${encodeURIComponent(`${b64url(email)}.${sig}`)}`;
};

// HTML do e-mail de re-marketing: logo + imagem opcional + corpo + CTA opcional + descadastro.
const renderEmailRemktg = (campanha, env) => {
  const corpoHtml = sanitizeHtml(personalizar(campanha.mensagem || '', env)).replace(/\n/g, '<br>');
  const img = campanha.imagem_url
    ? `<tr><td style="padding:0 0 16px 0;"><img src="${campanha.imagem_url}" alt="" style="width:100%;max-width:600px;display:block;border-radius:8px;"></td></tr>`
    : '';
  const cta = campanha.link_url
    ? `<tr><td style="padding:24px 0 4px 0;text-align:center;"><a href="${campanha.link_url}" style="display:inline-block;background:linear-gradient(90deg,#1A365D 0%,#2C5282 100%);color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;">${sanitizeHtml(campanha.link_titulo || 'Saiba mais')}</a></td></tr>`
    : '';
  const unsub = unsubLink((env.email || '').toLowerCase());
  const unsubHtml = unsub ? `<br><a href="${unsub}" style="color:#A0AEC0;text-decoration:underline;">Descadastrar destes e-mails</a>` : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;"><tr><td align="center" style="padding:40px 20px;">
<table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,.1);" cellpadding="0" cellspacing="0">
<tr><td style="padding:32px 40px;text-align:center;background:linear-gradient(135deg,#1A365D 0%,#2C5282 100%);border-radius:12px 12px 0 0;">
<img src="${LOGO_URL}" alt="Bolsa Atleta USA" style="max-width:200px;height:auto;display:block;margin:0 auto;"></td></tr>
<tr><td style="padding:32px 40px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${img}
<tr><td style="color:#2D3748;font-size:16px;line-height:1.7;">${corpoHtml}</td></tr>${cta}</table></td></tr>
<tr><td style="padding:24px 40px;background:#F7FAFC;border-radius:0 0 12px 12px;border-top:1px solid #E2E8F0;text-align:center;">
<p style="margin:0;font-size:12px;color:#718096;line-height:1.6;">&copy; ${new Date().getFullYear()} Bolsa Atleta USA${unsubHtml}</p></td></tr>
</table></td></tr></table></body></html>`;
};

// ─── Processa UMA campanha (1 batch) ───────────────────────────────────
const processarCampanha = async (campanhaId, dryRun) => {
    const camps = await supaGet(`remarketing_campanhas?id=eq.${campanhaId}&select=id,segmento,mensagem,status,tipo_mensagem,imagem_url,link_url,link_titulo,link_descricao,link_imagem,canal,assunto&deleted_at=is.null`);
    if (!camps.length) return { error: 'Campanha não encontrada', notFound: true };
    const campanha = camps[0];
    const canal = campanha.canal || 'whatsapp';

    const pendentes = await supaGet(
      `remarketing_envios?campanha_id=eq.${campanhaId}&status=eq.pendente&enviado_at=is.null&select=id,telefone,email,nome,esporte&order=created_at.asc&limit=500`,
    );

    // ── DRY-RUN: não envia, só reporta ──
    if (dryRun) {
      log('INFO', 'remktg_dryrun', { campanhaId, canal, tipo: campanha.tipo_mensagem, pendentes: pendentes.length });
      return {
        dryRun: true,
        canal,
        tipo: campanha.tipo_mensagem || 'texto',
        pendentes: pendentes.length,
        amostra: pendentes.slice(0, 5).map((e) => ({
          nome: e.nome,
          contato: canal === 'email'
            ? (e.email ? e.email.replace(/(.{2}).*(@.*)/, '$1***$2') : '—')
            : (e.telefone ? e.telefone.slice(0, 4) + '****' : '—'),
        })),
        mensagemPreview: personalizar(campanha.mensagem || '', pendentes[0] || {}),
      };
    }

    if (canal === 'email') {
      if (!RESEND_API_KEY && !BREVO_API_KEY) throw new Error('E-mail não configurado (Resend/Brevo)');
    } else if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      throw new Error('Z-API não configurada');
    }

    // ── Salvaguarda: horário seguro (só WhatsApp; e-mail pode sair a qualquer hora) ──
    if (canal !== 'email' && !dentroHorarioSeguro()) {
      log('INFO', 'remktg_skip_horario', { campanhaId, horaBRT: horaBRT() });
      return { skipped: 'fora_horario_seguro', horaBRT: horaBRT() };
    }

    // ── Salvaguarda: limite diário (enviados nas últimas 24h) ──
    const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const enviados24h = await supaGet(
      `remarketing_envios?campanha_id=eq.${campanhaId}&status=eq.enviado&enviado_at=gte.${desde24h}&select=id`,
    );
    const limiteDiario = canal === 'email' ? EMAIL_LIMITE_DIARIO : LIMITE_DIARIO;
    const restanteHoje = Math.max(0, limiteDiario - enviados24h.length);
    if (restanteHoje === 0) {
      log('INFO', 'remktg_limite_diario', { campanhaId, canal, enviados24h: enviados24h.length });
      return { skipped: 'limite_diario', enviados24h: enviados24h.length };
    }

    if (campanha.status === 'rascunho') {
      await supaPatch(`remarketing_campanhas?id=eq.${campanhaId}`, { status: 'enviando' });
    }

    const maxBatch = canal === 'email' ? EMAIL_MAX_POR_INVOCACAO : MAX_POR_INVOCACAO;
    const aProcessar = pendentes.slice(0, Math.min(maxBatch, restanteHoje));
    let enviados = 0, erros = 0, optouts = 0;

    for (const envio of aProcessar) {
      const contato = canal === 'email' ? (envio.email || '') : (envio.telefone || '');
      if (!contato) {
        await supaPatch(`remarketing_envios?id=eq.${envio.id}`, { status: 'erro', erro: 'sem contato', enviado_at: new Date().toISOString() });
        erros += 1;
        continue;
      }

      // Opt-out (por canal: telefone ou e-mail)
      const optPath = canal === 'email'
        ? `remarketing_optout_email?email=eq.${encodeURIComponent(contato.toLowerCase())}&select=email`
        : `remarketing_optout?telefone=eq.${encodeURIComponent(contato)}&select=telefone`;
      const opt = await supaGet(optPath);
      if (opt.length) {
        await supaPatch(`remarketing_envios?id=eq.${envio.id}`, { status: 'optout', enviado_at: new Date().toISOString() });
        optouts += 1;
        continue;
      }

      // CAS atômico: reserva o envio antes de disparar (idempotência)
      const reserva = await supaPatch(
        `remarketing_envios?id=eq.${envio.id}&enviado_at=is.null`,
        { enviado_at: new Date().toISOString() },
        'return=representation',
      );
      if (!Array.isArray(reserva) || reserva.length === 0) continue; // outra instância pegou

      const r = canal === 'email'
        ? await enviarEmail(contato, campanha.assunto || 'Bolsa Atleta USA', renderEmailRemktg(campanha, envio))
        : await enviarPorTipo(campanha, contato, envio);

      if (r.success) {
        await supaPatch(`remarketing_envios?id=eq.${envio.id}`, { status: 'enviado' });
        enviados += 1;
      } else {
        await supaPatch(`remarketing_envios?id=eq.${envio.id}`, { status: 'erro', erro: r.error });
        erros += 1;
      }

      await delay(canal === 'email' ? EMAIL_THROTTLE_MS : throttleAleatorio());
    }

    const aindaPendentes = pendentes.length - aProcessar.length;
    if (aindaPendentes === 0) {
      await supaPatch(`remarketing_campanhas?id=eq.${campanhaId}`, { status: 'concluida' });
    }

    log('INFO', 'remktg_batch_complete', { campanhaId, enviados, erros, optouts, restantes: aindaPendentes });
    return { enviados, erros, optouts, restantes: aindaPendentes };
};

// ─── Handler: 2 modos ───────────────────────────────────────────────────
//  - com campanha_id  → processa essa campanha (chamada do Engine; dryRun opcional)
//  - sem campanha_id   → processa TODAS as campanhas 'enviando' (Cloud Scheduler)
functions.http('sendRemarketing', async (req, res) => {
  // Auth FAIL-CLOSED: secret obrigatório — os jobs do Cloud Scheduler enviam
  // o header x-webhook-secret (infra/scheduler.sh).
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false, error: 'Unauthorized' });
  }
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase não configurado');

    const campanhaId = req.body?.campanha_id;
    const dryRun = req.body?.dryRun === true;

    if (campanhaId) {
      const out = await processarCampanha(campanhaId, dryRun);
      if (out.notFound) return res.status(404).send({ success: false, error: out.error });
      return res.status(200).send({ success: true, ...out });
    }

    // Modo cron: processa todas as campanhas em andamento
    const ativas = await supaGet(`remarketing_campanhas?status=eq.enviando&deleted_at=is.null&select=id&limit=20`);
    const resultados = [];
    for (const c of ativas) {
      const out = await processarCampanha(c.id, false);
      resultados.push({ campanha: c.id, ...out });
    }
    log('INFO', 'remktg_cron_complete', { campanhas: ativas.length });
    return res.status(200).send({ success: true, campanhas: ativas.length, resultados });
  } catch (error) {
    log('ERROR', 'remktg_failed', { error: error.message });
    return res.status(500).send({ success: false, error: error.message });
  }
});
