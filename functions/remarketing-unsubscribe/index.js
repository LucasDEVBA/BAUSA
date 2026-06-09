const functions = require('@google-cloud/functions-framework');
const https = require('https');
const crypto = require('crypto');

// ════════════════════════════════════════════════════════════════════════
// remarketing-unsubscribe — endpoint PÚBLICO de descadastro de e-mail (LGPD)
// ════════════════════════════════════════════════════════════════════════
// O rodapé de todo e-mail de re-marketing tem um link para esta função com um
// token assinado (HMAC). Ao clicar, o e-mail é gravado em
// remarketing_optout_email e a CF send-remarketing passa a pular esse contato.
//
// Token = base64url(email) + "." + base64url(HMAC-SHA256(email, WEBHOOK_SECRET))
// — impede que alguém descadastre e-mails arbitrários (precisa do segredo).
// allow-unauthenticated (público); a autenticação é o próprio token.
// ════════════════════════════════════════════════════════════════════════

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';

const log = (level, action, details = {}) => console.log(JSON.stringify({ level, action, ...details }));

const httpRequest = (url, options, postData) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: options.method || 'GET', headers: options.headers || {} },
      (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ statusCode: res.statusCode, body: b })); },
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    if (postData) req.write(postData);
    req.end();
  });

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

const assinar = (email) => b64url(crypto.createHmac('sha256', WEBHOOK_SECRET).update(email).digest());

// Verifica o token e retorna o e-mail, ou null se inválido.
const emailDoToken = (token) => {
  if (!token || !token.includes('.')) return null;
  const [encEmail, sig] = token.split('.');
  let email;
  try { email = fromB64url(encEmail); } catch { return null; }
  if (!email || !email.includes('@')) return null;
  const esperado = assinar(email);
  // timing-safe (comprimentos iguais)
  if (sig.length !== esperado.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(esperado))) return null;
  return email.toLowerCase();
};

const pagina = (titulo, msg, ok) => `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titulo}</title></head>
<body style="margin:0;background:#f4f4f4;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:48px 20px;">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,.1);" cellpadding="0" cellspacing="0">
<tr><td style="padding:40px;text-align:center;">
<div style="font-size:40px;margin-bottom:8px;">${ok ? '✅' : '⚠️'}</div>
<h1 style="margin:0 0 12px;color:#1A365D;font-size:22px;">${titulo}</h1>
<p style="margin:0;color:#4A5568;font-size:15px;line-height:1.6;">${msg}</p>
<p style="margin:24px 0 0;font-size:12px;color:#A0AEC0;">Bolsa Atleta USA</p>
</td></tr></table></td></tr></table></body></html>`;

functions.http('remarketingUnsubscribe', async (req, res) => {
  res.set('Content-Type', 'text/html; charset=utf-8');
  try {
    const token = req.query?.t || req.body?.t;
    const email = emailDoToken(token);
    if (!email) {
      log('WARN', 'unsub_invalid_token');
      return res.status(400).send(pagina('Link inválido', 'Este link de descadastro é inválido ou expirou.', false));
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase não configurado');

    const r = await httpRequest(`${SUPABASE_URL}/rest/v1/remarketing_optout_email`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Profile': SUPABASE_SCHEMA,
        Prefer: 'resolution=ignore-duplicates',
      },
    }, JSON.stringify({ email, motivo: 'descadastro via link' }));

    if (r.statusCode >= 400) throw new Error(`Supabase ${r.statusCode}: ${r.body}`);

    log('INFO', 'unsub_ok', { email });
    return res.status(200).send(
      pagina('Descadastro confirmado', 'Você não receberá mais e-mails de re-marketing da Bolsa Atleta USA. Sentiremos sua falta! 💙', true),
    );
  } catch (e) {
    log('ERROR', 'unsub_failed', { error: e.message });
    return res.status(500).send(pagina('Ops', 'Não foi possível processar agora. Tente novamente em instantes.', false));
  }
});
