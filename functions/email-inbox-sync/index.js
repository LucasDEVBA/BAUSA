/**
 * email-inbox-sync — espelha o Gmail da contato@ em public.emails_mensagens.
 *
 * Cron (Cloud Scheduler 15 min) + on-demand (Engine, botão "Sincronizar").
 * Lê a caixa via Gmail API com a service account IMPERSONANDO o usuário
 * (domain-wide delegation, scope gmail.readonly — grant no Admin Console).
 *
 * Fluxo por tick:
 *   1. janela: última varredura (configuracoes_sistema.email_inbox_state,
 *      chave SEEDADA em migration) com overlap de 1h; primeira vez = 7 dias.
 *   2. users.messages.list (INBOX + SENT; -spam -trash -chat), pagina até 5x.
 *   3. anti-join local por gmail_message_id (UNIQUE no banco é o guard final;
 *      INSERT com resolution=ignore-duplicates → idempotente).
 *   4. users.messages.get (metadata + corpo text/plain) → linha com direção
 *      (From = contato@ → enviado/gmail; senão recebido), lead casado por
 *      e-mail em form_submissions (deleted_at IS NULL).
 *   5. heartbeat em email_inbox_state (observabilidade F2).
 *
 * Sem DWD concedido, o token falha com unauthorized_client → 500 com log
 * claro 'dwd_ausente' (o check scheduler_jobs do monitor pega a falha).
 */

const functions = require('@google-cloud/functions-framework');
const https = require('https');
const crypto = require('crypto');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = 'public'; // Engine lê public em todo ambiente
const SERVICE_ACCOUNT_EMAIL = process.env.SERVICE_ACCOUNT_EMAIL;
const RAW_KEY = process.env.SERVICE_ACCOUNT_PRIVATE_KEY || '';
const SERVICE_ACCOUNT_PRIVATE_KEY = RAW_KEY
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\\\\n/g, '\n');
const GMAIL_USER = process.env.GMAIL_USER || 'contato@bolsaatletausa.com';

const PRIMEIRA_JANELA_DIAS = 7;
const OVERLAP_MS = 60 * 60 * 1000;      // 1h de sobreposição entre ticks
const MAX_PAGINAS = 5;                   // 5 × 100 mensagens por tick
const MAX_NOVAS_POR_TICK = 120;          // teto de GETs de detalhe
const MAX_CORPO_CHARS = 50000;
const STATE_CHAVE = 'email_inbox_state';

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
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout (20s)')); });
    if (postData) req.write(postData);
    req.end();
  });

// ─── Supabase REST ──────────────────────────────────────────────
const sb = async (path, method = 'GET', body = null, prefer = null) => {
  const payload = body ? JSON.stringify(body) : null;
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  headers[method === 'GET' ? 'Accept-Profile' : 'Content-Profile'] = SUPABASE_SCHEMA;
  if (prefer) headers.Prefer = prefer;
  if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
  const res = await httpRequest(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers }, payload);
  if (res.statusCode >= 400) throw new Error(`supabase ${path}: ${res.statusCode} ${res.body.slice(0, 200)}`);
  return res.body ? JSON.parse(res.body || '[]') : [];
};

// ─── Token Gmail: JWT RS256 assinado na unha (zero deps) ───────
const b64u = (buf) => Buffer.from(buf).toString('base64url');

const gmailToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64u(JSON.stringify({
    iss: SERVICE_ACCOUNT_EMAIL,
    sub: GMAIL_USER, // impersonação via domain-wide delegation
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const assinatura = signer.sign(SERVICE_ACCOUNT_PRIVATE_KEY).toString('base64url');
  const jwt = `${header}.${claims}.${assinatura}`;

  const postData = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`;
  const res = await httpRequest('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, postData);
  if (res.statusCode >= 400) {
    if (/unauthorized_client/.test(res.body)) {
      log('ERROR', 'dwd_ausente', {
        fix: `Admin Console > Segurança > Delegação de domínio: autorizar o client da SA com o scope gmail.readonly`,
      });
      throw new Error('DWD não concedido para gmail.readonly');
    }
    throw new Error(`token gmail: ${res.statusCode} ${res.body.slice(0, 200)}`);
  }
  return JSON.parse(res.body).access_token;
};

const gmail = async (token, path) => {
  const res = await httpRequest(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(GMAIL_USER)}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.statusCode >= 400) throw new Error(`gmail ${path.split('?')[0]}: ${res.statusCode} ${res.body.slice(0, 200)}`);
  return JSON.parse(res.body);
};

// ─── Parsing ────────────────────────────────────────────────────
const headerDe = (payload, nome) => {
  const h = (payload?.headers || []).find((x) => x.name?.toLowerCase() === nome.toLowerCase());
  return h?.value || '';
};

const extrairEmail = (v) => {
  const m = String(v || '').match(/<([^>]+)>/);
  const bruto = (m ? m[1] : String(v || '').split(',')[0]).trim().toLowerCase();
  return /\S+@\S+\.\S+/.test(bruto) ? bruto : '';
};

const decodeBody = (data) => {
  try { return Buffer.from(String(data), 'base64url').toString('utf8'); } catch { return ''; }
};

// text/plain preferido; cai para text/html sem tags como último recurso.
const extrairCorpo = (payload) => {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decodeBody(payload.body.data);
  const fila = [...(payload.parts || [])];
  let html = '';
  while (fila.length) {
    const p = fila.shift();
    if (p.mimeType === 'text/plain' && p.body?.data) return decodeBody(p.body.data);
    if (p.mimeType === 'text/html' && p.body?.data && !html) html = decodeBody(p.body.data);
    if (p.parts) fila.push(...p.parts);
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) html = decodeBody(payload.body.data);
  return html ? html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
};

// ─── Estado (heartbeat F2) ──────────────────────────────────────
const lerEstado = async () => {
  try {
    const rows = await sb(`configuracoes_sistema?chave=eq.${STATE_CHAVE}&select=valor`);
    const v = rows[0]?.valor;
    return v && typeof v === 'object' ? v : {};
  } catch (e) {
    log('WARN', 'estado_leitura_falhou', { error: e.message });
    return {};
  }
};

const salvarEstado = async (estado) => {
  try {
    await sb(`configuracoes_sistema?chave=eq.${STATE_CHAVE}`, 'PATCH', { valor: estado }, 'return=minimal');
  } catch (e) {
    // Telemetria fail-open — nunca quebra o sync.
    log('WARN', 'estado_salvar_falhou', { error: e.message });
  }
};

// ─── Sync ───────────────────────────────────────────────────────
const sincronizar = async () => {
  const token = await gmailToken();
  const estado = await lerEstado();

  const desdeMs = estado.ultima_varredura_ms
    ? Number(estado.ultima_varredura_ms) - OVERLAP_MS
    : Date.now() - PRIMEIRA_JANELA_DIAS * 24 * 60 * 60 * 1000;
  const inicioTickMs = Date.now();

  const q = encodeURIComponent(`after:${Math.floor(desdeMs / 1000)} -in:spam -in:trash -in:chat`);
  let ids = [];
  let pageToken = '';
  for (let p = 0; p < MAX_PAGINAS; p++) {
    const lista = await gmail(token, `messages?q=${q}&maxResults=100&includeSpamTrash=false${pageToken ? `&pageToken=${pageToken}` : ''}`);
    ids.push(...(lista.messages || []).map((m) => m.id));
    pageToken = lista.nextPageToken || '';
    if (!pageToken) break;
  }
  if (ids.length === 0) {
    await salvarEstado({ ...estado, ultima_varredura_ms: inicioTickMs, verificado_em: new Date().toISOString(), novas: 0 });
    return { listadas: 0, novas: 0 };
  }

  // Anti-join local (o UNIQUE do banco cobre corridas)
  const existentes = new Set();
  for (let i = 0; i < ids.length; i += 100) {
    const fatia = ids.slice(i, i + 100);
    const rows = await sb(`emails_mensagens?select=gmail_message_id&gmail_message_id=in.(${fatia.map((x) => `"${x}"`).join(',')})`);
    rows.forEach((r) => existentes.add(r.gmail_message_id));
  }
  const novas = ids.filter((id) => !existentes.has(id)).slice(0, MAX_NOVAS_POR_TICK);

  let inseridas = 0;
  for (const id of novas) {
    try {
      const msg = await gmail(token, `messages/${id}?format=full`);
      const de = extrairEmail(headerDe(msg.payload, 'From'));
      const para = extrairEmail(headerDe(msg.payload, 'To')) || GMAIL_USER;
      const assunto = headerDe(msg.payload, 'Subject') || '(sem assunto)';
      const quando = msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : new Date().toISOString();
      const direcao = de === GMAIL_USER.toLowerCase() ? 'enviado' : 'recebido';
      const contraparte = direcao === 'recebido' ? de : para;

      let formSubmissionId = null;
      if (contraparte) {
        try {
          const leads = await sb(`form_submissions?select=id&email=eq.${encodeURIComponent(contraparte)}&deleted_at=is.null&order=submitted_at.desc&limit=1`);
          formSubmissionId = leads[0]?.id ?? null;
        } catch (e) {
          log('WARN', 'lead_match_falhou', { error: e.message });
        }
      }

      const corpo = extrairCorpo(msg.payload).slice(0, MAX_CORPO_CHARS);
      await sb('emails_mensagens', 'POST', {
        direcao,
        origem: 'gmail',
        de_email: de || GMAIL_USER,
        para_email: para,
        assunto: assunto.slice(0, 500),
        corpo_text: corpo || null,
        snippet: String(msg.snippet || '').slice(0, 300) || null,
        form_submission_id: formSubmissionId,
        provider: 'gmail',
        gmail_message_id: id,
        gmail_thread_id: msg.threadId || null,
        mensagem_em: quando,
      }, 'resolution=ignore-duplicates,return=minimal');
      inseridas++;
    } catch (e) {
      log('WARN', 'mensagem_falhou', { id, error: e.message });
    }
  }

  await salvarEstado({
    ultima_varredura_ms: inicioTickMs,
    verificado_em: new Date().toISOString(),
    listadas: ids.length,
    novas: inseridas,
  });
  return { listadas: ids.length, novas: inseridas };
};

functions.http('emailInboxSync', async (req, res) => {
  // Fail-closed: sem secret configurado, ninguém aciona o sync.
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ ok: false });
  }
  if (req.method !== 'POST') return res.status(405).send('method not allowed');

  const t0 = Date.now();
  try {
    const r = await sincronizar();
    log('INFO', 'sync_ok', { ...r, durationMs: Date.now() - t0 });
    return res.status(200).send({ ok: true, ...r });
  } catch (e) {
    log('ERROR', 'sync_falhou', { error: e.message, durationMs: Date.now() - t0 });
    return res.status(500).send({ ok: false, error: e.message });
  }
});
