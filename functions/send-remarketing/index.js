const functions = require('@google-cloud/functions-framework');
const https = require('https');

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

// ─── Salvaguardas (ritmo MODERADO — definido pelo CEO) ─────────────────
const LIMITE_DIARIO = Number(process.env.REMKTG_LIMITE_DIARIO || 120);
const THROTTLE_MIN_MS = Number(process.env.REMKTG_THROTTLE_MIN || 30000);
const THROTTLE_MAX_MS = Number(process.env.REMKTG_THROTTLE_MAX || 45000);
const HORARIO_INICIO = 9;   // BRT
const HORARIO_FIM = 20;     // BRT (exclusivo às 20h59 — usamos < 20)
const MAX_POR_INVOCACAO = Number(process.env.REMKTG_MAX_BATCH || 10);

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

// ─── Processa UMA campanha (1 batch) ───────────────────────────────────
const processarCampanha = async (campanhaId, dryRun) => {
    const camps = await supaGet(`remarketing_campanhas?id=eq.${campanhaId}&select=id,segmento,mensagem,status,tipo_mensagem,imagem_url,link_url,link_titulo,link_descricao,link_imagem&deleted_at=is.null`);
    if (!camps.length) return { error: 'Campanha não encontrada', notFound: true };
    const campanha = camps[0];

    const pendentes = await supaGet(
      `remarketing_envios?campanha_id=eq.${campanhaId}&status=eq.pendente&enviado_at=is.null&select=id,telefone,nome,esporte&order=created_at.asc&limit=500`,
    );

    // ── DRY-RUN: não envia, só reporta ──
    if (dryRun) {
      log('INFO', 'remktg_dryrun', { campanhaId, tipo: campanha.tipo_mensagem, pendentes: pendentes.length });
      return {
        dryRun: true,
        tipo: campanha.tipo_mensagem || 'texto',
        pendentes: pendentes.length,
        amostra: pendentes.slice(0, 5).map((e) => ({ nome: e.nome, telefone: e.telefone ? e.telefone.slice(0, 4) + '****' : '—' })),
        mensagemPreview: personalizar(campanha.mensagem || '', pendentes[0] || {}),
      };
    }

    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) throw new Error('Z-API não configurada');

    // ── Salvaguarda: horário seguro ──
    if (!dentroHorarioSeguro()) {
      log('INFO', 'remktg_skip_horario', { campanhaId, horaBRT: horaBRT() });
      return { skipped: 'fora_horario_seguro', horaBRT: horaBRT() };
    }

    // ── Salvaguarda: limite diário (enviados nas últimas 24h) ──
    const desde24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const enviados24h = await supaGet(
      `remarketing_envios?campanha_id=eq.${campanhaId}&status=eq.enviado&enviado_at=gte.${desde24h}&select=id`,
    );
    const restanteHoje = Math.max(0, LIMITE_DIARIO - enviados24h.length);
    if (restanteHoje === 0) {
      log('INFO', 'remktg_limite_diario', { campanhaId, enviados24h: enviados24h.length });
      return { skipped: 'limite_diario', enviados24h: enviados24h.length };
    }

    if (campanha.status === 'rascunho') {
      await supaPatch(`remarketing_campanhas?id=eq.${campanhaId}`, { status: 'enviando' });
    }

    const aProcessar = pendentes.slice(0, Math.min(MAX_POR_INVOCACAO, restanteHoje));
    let enviados = 0, erros = 0, optouts = 0;

    for (const envio of aProcessar) {
      // Opt-out
      const opt = await supaGet(`remarketing_optout?telefone=eq.${encodeURIComponent(envio.telefone)}&select=telefone`);
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

      const r = await enviarPorTipo(campanha, envio.telefone, envio);
      if (r.success) {
        await supaPatch(`remarketing_envios?id=eq.${envio.id}`, { status: 'enviado' });
        enviados += 1;
      } else {
        await supaPatch(`remarketing_envios?id=eq.${envio.id}`, { status: 'erro', erro: r.error });
        erros += 1;
      }

      await delay(throttleAleatorio());
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
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret'] && req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
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
