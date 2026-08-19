/**
 * email-events — receptor dos webhooks do Resend (métricas de e-mail).
 *
 * O Resend chama esta função a cada evento do ciclo de vida de um e-mail
 * (sent, delivered, opened, clicked, bounced, complained). Cada evento vira
 * um timestamp em public.emails_mensagens, casando por resend_email_id.
 *
 * Invariantes (travados por tests/email-invariants.test.js):
 *   • Assinatura svix verificada sobre o corpo CRU (req.rawBody) —
 *     FAIL-CLOSED: sem RESEND_WEBHOOK_SECRET, nenhum evento é aceito.
 *     A URL é pública (o Resend não manda header custom) — a assinatura é a
 *     única prova de origem, mesma classe do instagram-webhook.
 *   • email.sent de um envio que NÃO está na tabela (confirmações do
 *     messenger-service, régua, weekly-report…) cria um stub
 *     (origem='automacao') idempotente — cobertura de métricas para TODO
 *     e-mail Resend sem tocar nas CFs que enviam.
 *   • Timestamps de funil só andam para FRENTE: aberto_at/clicado_at gravam
 *     o PRIMEIRO evento (updates com is.null), nunca sobrescrevem.
 *   • Resposta 200 mesmo para evento desconhecido/sem linha — o Resend faz
 *     retry em >=400 e um evento não-mapeado não pode virar tempestade.
 */

const functions = require('@google-cloud/functions-framework');
const https = require('https');
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// Métricas vivem em public em todo ambiente (mesmo racional do fluxo-engine).
const SUPABASE_SCHEMA = 'public';
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;
const FROM_EMAIL_DEFAULT = 'contato@bolsaatletausa.com';

// Tolerância de relógio da assinatura svix (replay window).
const SVIX_TOLERANCE_S = 300;

const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

const httpRequest = (url, options = {}, postData = null) =>
  new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout (15s)')); });
    if (postData) req.write(postData);
    req.end();
  });

const sb = async (path, method, body) => {
  const payload = body ? JSON.stringify(body) : null;
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: method === 'POST' ? 'resolution=ignore-duplicates,return=minimal' : 'return=representation',
  };
  headers[method === 'GET' ? 'Accept-Profile' : 'Content-Profile'] = SUPABASE_SCHEMA;
  if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
  const res = await httpRequest(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers }, payload);
  if (res.statusCode >= 400) throw new Error(`supabase ${path}: ${res.statusCode} ${res.body.slice(0, 200)}`);
  return res.body ? JSON.parse(res.body || '[]') : [];
};

// ─── Verificação svix (Resend) sobre o corpo CRU ───────────────
// signedContent = `${svix-id}.${svix-timestamp}.${rawBody}`;
// chave = base64decode(secret sem o prefixo 'whsec_');
// esperado = base64(hmacSHA256(chave, signedContent)).
// O header svix-signature pode listar várias ("v1,<sig> v1,<sig2>").
const verificarAssinatura = (req) => {
  if (!RESEND_WEBHOOK_SECRET) return { ok: false, motivo: 'secret_ausente' };
  const id = req.headers['svix-id'];
  const ts = req.headers['svix-timestamp'];
  const sigHeader = req.headers['svix-signature'];
  if (!id || !ts || !sigHeader) return { ok: false, motivo: 'headers_ausentes' };

  const skew = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(skew) || skew > SVIX_TOLERANCE_S) {
    return { ok: false, motivo: 'timestamp_fora_da_janela' };
  }

  const raw = req.rawBody ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));
  const chave = Buffer.from(RESEND_WEBHOOK_SECRET.replace(/^whsec_/, ''), 'base64');
  const esperado = crypto
    .createHmac('sha256', chave)
    .update(Buffer.concat([Buffer.from(`${id}.${ts}.`), raw]))
    .digest();

  const candidatas = String(sigHeader)
    .split(/\s+/)
    .map((p) => p.split(',')[1])
    .filter(Boolean);
  for (const c of candidatas) {
    let cand;
    try { cand = Buffer.from(c, 'base64'); } catch { continue; }
    if (cand.length === esperado.length && crypto.timingSafeEqual(cand, esperado)) {
      return { ok: true };
    }
  }
  return { ok: false, motivo: 'assinatura_invalida' };
};

// evento Resend → coluna de timestamp (primeiro evento vence)
const EVENTO_COLUNA = {
  'email.delivered': 'entregue_at',
  'email.opened': 'aberto_at',
  'email.clicked': 'clicado_at',
  'email.bounced': 'bounce_at',
  'email.complained': 'reclamado_at',
};

functions.http('emailEvents', async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('method not allowed');

  const veredito = verificarAssinatura(req);
  if (!veredito.ok) {
    log('WARN', 'assinatura_rejeitada', { motivo: veredito.motivo });
    return res.status(401).send({ ok: false });
  }

  try {
    const evento = req.body || {};
    const tipo = String(evento.type || '');
    const dados = evento.data || {};
    const emailId = String(dados.email_id || '');
    if (!emailId) {
      log('WARN', 'evento_sem_email_id', { tipo });
      return res.status(200).send({ ok: true, motivo: 'sem_email_id' });
    }

    const quando = evento.created_at || new Date().toISOString();

    if (tipo === 'email.sent') {
      // Stub idempotente: e-mail Resend enviado por qualquer CF ganha linha
      // (o compositor já grava a dele — o UNIQUE resolve o duplicado).
      const para = Array.isArray(dados.to) ? String(dados.to[0] || '') : String(dados.to || '');
      await sb('emails_mensagens', 'POST', {
        direcao: 'enviado',
        origem: 'automacao',
        de_email: String(dados.from || FROM_EMAIL_DEFAULT),
        para_email: para,
        assunto: String(dados.subject || ''),
        provider: 'resend',
        resend_email_id: emailId,
        mensagem_em: quando,
      });
      log('INFO', 'evento_sent_registrado', { emailId });
      return res.status(200).send({ ok: true });
    }

    const coluna = EVENTO_COLUNA[tipo];
    if (!coluna) {
      log('INFO', 'evento_ignorado', { tipo, emailId });
      return res.status(200).send({ ok: true, motivo: 'tipo_nao_mapeado' });
    }

    const patch = { [coluna]: quando, updated_at: new Date().toISOString() };
    if (tipo === 'email.bounced') {
      const motivo = dados.bounce?.message || dados.bounce?.subType || 'bounce';
      patch.falha_motivo = String(motivo).slice(0, 300);
    }

    // Primeiro evento vence (coluna is.null) — reaberturas não sobrescrevem.
    const atualizadas = await sb(
      `emails_mensagens?resend_email_id=eq.${encodeURIComponent(emailId)}&${coluna}=is.null`,
      'PATCH',
      patch
    );
    log('INFO', 'evento_aplicado', { tipo, emailId, linhas: atualizadas.length });
    return res.status(200).send({ ok: true, linhas: atualizadas.length });
  } catch (e) {
    log('ERROR', 'evento_falhou', { error: e.message });
    // 500 → o Resend faz retry com backoff (evento não se perde).
    return res.status(500).send({ ok: false });
  }
});
