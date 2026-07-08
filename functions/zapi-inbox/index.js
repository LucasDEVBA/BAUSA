const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ════════════════════════════════════════════════════════════════════════
// zapi-inbox — espelho do WhatsApp: recebe os webhooks da Z-API e grava cada
// mensagem (recebida E enviada, via notifySentByMe) em whatsapp_mensagens.
// ════════════════════════════════════════════════════════════════════════
//
// Por quê: a instância Z-API é multi-device e NÃO fornece histórico por API
// (400 "Does not work in multi device version"). O histórico do Engine passa
// a existir AQUI, do momento da ativação do webhook em diante.
//
// A instância Z-API é única (compartilhada) → o stream é dado de PRODUÇÃO:
// SUPABASE_SCHEMA deve ser 'public' mesmo na função -uat (documentado em
// docs/ATIVACAO.md). Engine PRD e preview leem de public.
//
// Auth: a Z-API não envia headers customizados → token na query string
// (?token=WEBHOOK_SECRET), validado contra o env. Idempotência: UNIQUE
// (message_id) + Prefer: resolution=ignore-duplicates (Z-API faz retry).
// Resposta sempre 200 para payloads não-mensagem (evita retry-storm).
// ════════════════════════════════════════════════════════════════════════

// Token DEDICADO desta função (não o WEBHOOK_SECRET compartilhado): ele viaja
// na query string e o Cloud Run loga a URL — vazar este token não compromete
// os webhooks das demais funções. Setado manualmente via gcloud (ATIVACAO.md).
const ZAPI_INBOX_TOKEN = process.env.ZAPI_INBOX_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// HARDCODED de propósito: a instância Z-API é única → o stream é SEMPRE dado
// de produção, mesmo na função -uat. Env var aqui seria regressão silenciosa:
// o deploy UAT injeta SUPABASE_SCHEMA=uat em todas as funções e desviaria o
// stream p/ uat.whatsapp_mensagens enquanto o Engine lê public.
const SUPABASE_SCHEMA = 'public';

// Só callbacks de MENSAGEM viram linha; status/presença/conexão são ignorados
// (sem allowlist, um webhook de status apontado aqui viraria linhas 'other').
const TIPOS_CALLBACK_MENSAGEM = ['ReceivedCallback', 'SentCallback'];

const PHONE_MIN = 10;
const PHONE_MAX = 15;

const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

const maskPhone = (digits) =>
  digits && digits.length > 4 ? `***${digits.slice(-4)}` : '***';

const httpRequest = (url, options, postData) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: options.method || 'GET', headers: options.headers || {} },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ statusCode: res.statusCode, body: b })); },
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timeout (15s)')); });
    if (postData) req.write(postData);
    req.end();
  });

// ─── Normalização do payload Z-API (defensiva — shapes variam) ──────────

const cleanPhone = (v) => String(v || '').replace(/\D/g, '');

const toEpochMs = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1_000_000_000_000 ? Math.round(n * 1000) : Math.round(n);
};

const TIPOS_MIDIA = ['image', 'audio', 'video', 'document', 'sticker', 'location', 'contact', 'reaction'];

/** Extrai { tipo, texto } do payload — texto puro, caption de mídia, ou null. */
function extrairConteudo(p) {
  // Z-API alterna entre text.message e body conforme o endpoint/versão
  // (mesmo comportamento documentado em apps/crm/src/lib/whatsapp-espelho.ts).
  const textoPuro =
    (p.text && typeof p.text.message === 'string' ? p.text.message.trim() : '') ||
    (typeof p.body === 'string' ? p.body.trim() : '');
  if (textoPuro) return { tipo: 'text', texto: textoPuro };
  for (const t of TIPOS_MIDIA) {
    if (p[t] && typeof p[t] === 'object') {
      const caption = typeof p[t].caption === 'string' ? p[t].caption.trim() : '';
      return { tipo: t, texto: caption || null };
    }
  }
  return { tipo: 'other', texto: null };
}

/** Normaliza um webhook de mensagem; null = payload que não é mensagem espelhável. */
function normalizarMensagem(p) {
  if (!p || typeof p !== 'object') return null;
  // Allowlist: callbacks de status/presença/conexão têm type próprio e não
  // devem virar linha. type ausente → tenta normalizar (variantes da Z-API).
  if (typeof p.type === 'string' && !TIPOS_CALLBACK_MENSAGEM.includes(p.type)) return null;
  const messageId = typeof p.messageId === 'string' && p.messageId ? p.messageId : null;
  const phone = cleanPhone(p.phone);
  // Sem id/telefone individual válido (grupos têm sufixo/ids longos) → ignora.
  if (!messageId || phone.length < PHONE_MIN || phone.length > PHONE_MAX) return null;
  if (p.isGroup === true || p.isGroup === 'true') return null;

  const { tipo, texto } = extrairConteudo(p);
  const momment = toEpochMs(p.momment);
  return {
    message_id: messageId,
    phone,
    from_me: p.fromMe === true || p.fromMe === 'true',
    tipo,
    texto,
    sender_name:
      (typeof p.senderName === 'string' && p.senderName.trim()) ||
      (typeof p.chatName === 'string' && p.chatName.trim()) ||
      null,
    momment: momment ? new Date(momment).toISOString() : null,
    status: typeof p.status === 'string' && p.status ? p.status : null,
  };
}

// ─── Handler ─────────────────────────────────────────────────────────────

functions.http('zapiInbox', async (req, res) => {
  // Z-API não envia headers customizados → token dedicado na query string
  // (fail-closed: sem ZAPI_INBOX_TOKEN configurado, nega tudo).
  if (!ZAPI_INBOX_TOKEN || req.query.token !== ZAPI_INBOX_TOKEN) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false, error: 'Unauthorized' });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase não configurado');

    const payload = req.body || {};
    const tipoCallback = typeof payload.type === 'string' ? payload.type : 'desconhecido';

    const row = normalizarMensagem(payload);
    if (!row) {
      // Callback de status/presença/grupo — reconhece e encerra (sem retry).
      log('INFO', 'callback_ignorado', { tipoCallback });
      return res.status(200).send({ success: true, ignored: true });
    }

    const r = await httpRequest(
      `${SUPABASE_URL}/rest/v1/whatsapp_mensagens?on_conflict=message_id`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Content-Profile': SUPABASE_SCHEMA,
          Prefer: 'resolution=ignore-duplicates,return=minimal',
        },
      },
      JSON.stringify(row),
    );
    if (r.statusCode >= 400) {
      // NÃO logar o body cru: em violação de constraint o Postgres devolve a
      // linha inteira no DETAIL (phone + texto da mensagem = PII).
      let pgCode = 'unknown';
      try { pgCode = JSON.parse(r.body).code || 'unknown'; } catch { /* body não-JSON */ }
      throw new Error(`Supabase insert ${r.statusCode} (code ${pgCode})`);
    }

    log('INFO', 'mensagem_gravada', {
      phone: maskPhone(row.phone),
      fromMe: row.from_me,
      tipo: row.tipo,
    });
    return res.status(200).send({ success: true });
  } catch (error) {
    log('ERROR', 'inbox_failed', { error: error.message });
    // 500 → a Z-API re-tenta; UNIQUE(message_id) garante que não duplica.
    return res.status(500).send({ success: false, error: error.message });
  }
});
