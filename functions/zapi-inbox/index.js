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

// Id do grupo na Z-API: em grupo o `phone` do payload é o id do grupo
// (ex.: '1203...@g.us' ou '5511...-1203...@g.us'). Normaliza tirando só o
// sufixo '@...' (mantém hífen de ids legados) → chave estável em UNIQUE(grupo_id).
const cleanGroupId = (v) => String(v || '').trim().split('@')[0].trim();

const toEpochMs = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1_000_000_000_000 ? Math.round(n * 1000) : Math.round(n);
};

const TIPOS_MIDIA = ['image', 'audio', 'video', 'document', 'sticker', 'location', 'contact', 'reaction'];

const isHttpUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v.trim());

/** Primeira URL http válida dentre os candidatos (shapes variam por versão). */
function primeiraUrl(...cands) {
  for (const c of cands) if (isHttpUrl(c)) return c.trim();
  return null;
}

/** Extrai { tipo, texto, mediaUrl, mimeType, fileName } — texto puro ou mídia. */
function extrairConteudo(p) {
  // Z-API alterna entre text.message e body conforme o endpoint/versão
  // (mesmo comportamento documentado em apps/crm/src/lib/whatsapp-espelho.ts).
  const textoPuro =
    (p.text && typeof p.text.message === 'string' ? p.text.message.trim() : '') ||
    (typeof p.body === 'string' ? p.body.trim() : '');
  if (textoPuro) return { tipo: 'text', texto: textoPuro, mediaUrl: null, mimeType: null, fileName: null };
  for (const t of TIPOS_MIDIA) {
    const m = p[t];
    if (m && typeof m === 'object') {
      const caption = typeof m.caption === 'string' ? m.caption.trim() : '';
      // A URL da mídia vem em `${tipo}Url` (imageUrl/audioUrl/…) ou variantes.
      const mediaUrl = primeiraUrl(
        m[`${t}Url`], m.url, m.imageUrl, m.audioUrl, m.videoUrl,
        m.documentUrl, m.stickerUrl, m.fileUrl,
      );
      const mimeType =
        (typeof m.mimeType === 'string' && m.mimeType) ||
        (typeof m.mimetype === 'string' && m.mimetype) ||
        null;
      const fileName =
        (typeof m.fileName === 'string' && m.fileName) ||
        (typeof m.title === 'string' && m.title) ||
        null;
      return { tipo: t, texto: caption || null, mediaUrl, mimeType, fileName };
    }
  }
  return { tipo: 'other', texto: null, mediaUrl: null, mimeType: null, fileName: null };
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

  const { tipo, texto, mediaUrl, mimeType, fileName } = extrairConteudo(p);
  const momment = toEpochMs(p.momment);
  return {
    message_id: messageId,
    phone,
    from_me: p.fromMe === true || p.fromMe === 'true',
    tipo,
    texto,
    media_url: mediaUrl,
    mime_type: mimeType,
    media_filename: fileName,
    sender_name:
      (typeof p.senderName === 'string' && p.senderName.trim()) ||
      (typeof p.chatName === 'string' && p.chatName.trim()) ||
      null,
    momment: momment ? new Date(momment).toISOString() : null,
    status: typeof p.status === 'string' && p.status ? p.status : null,
  };
}

/**
 * Normaliza um webhook de MENSAGEM DE GRUPO; null = não é mensagem de grupo
 * espelhável. A existência do grupo é sempre registrada (id + nome); o CONTEÚDO
 * só é gravado quando o CEO ligou a captura (decidido pela RPC, não aqui).
 */
function normalizarGrupo(p) {
  if (!p || typeof p !== 'object') return null;
  // Mesma allowlist do 1:1: status/presença/conexão de grupo não viram registro.
  if (typeof p.type === 'string' && !TIPOS_CALLBACK_MENSAGEM.includes(p.type)) return null;
  if (p.isGroup !== true && p.isGroup !== 'true') return null;

  const grupoId = cleanGroupId(p.phone);
  const messageId = typeof p.messageId === 'string' && p.messageId ? p.messageId : null;
  // Sem id do grupo → nada a fazer (não dá p/ registrar existência nem casar UNIQUE).
  if (!grupoId) return null;

  const { tipo, texto, mediaUrl, mimeType, fileName } = extrairConteudo(p);
  const momment = toEpochMs(p.momment);
  return {
    grupo_id: grupoId,
    // chatName é o nome do grupo (senderName/participantPhone = quem falou dentro).
    nome: (typeof p.chatName === 'string' && p.chatName.trim()) || null,
    message_id: messageId,
    from_me: p.fromMe === true || p.fromMe === 'true',
    tipo,
    texto,
    media_url: mediaUrl,
    mime_type: mimeType,
    media_filename: fileName,
    participante_nome:
      (typeof p.senderName === 'string' && p.senderName.trim()) || null,
    participante_phone: cleanPhone(p.participantPhone) || null,
    momment: momment ? new Date(momment).toISOString() : null,
  };
}

// ─── Re-hospedagem de mídia (bucket próprio — URLs da Z-API expiram) ─────
// As URLs de mídia da Z-API (backblazeb2) morrem em ~semanas. No ingest,
// baixamos o arquivo e subimos no bucket PRIVADO `whatsapp-midia`; a linha
// ganha media_path (media_url segue como fallback legado). FAIL-OPEN total:
// qualquer falha aqui devolve null e a mensagem é gravada como antes — o
// webhook JAMAIS quebra por causa de mídia.
const MEDIA_REHOST_MAX_BYTES = 15 * 1024 * 1024; // paridade com o bucket (15MB)
const MEDIA_DOWNLOAD_TIMEOUT_MS = 10000;
const MEDIA_BUCKET = 'whatsapp-midia';

const EXT_POR_MIME = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac',
  'video/mp4': 'mp4', 'video/3gpp': '3gp', 'application/pdf': 'pdf',
};

const extensaoMidia = (mimeType, fileName, url) => {
  const mime = String(mimeType || '').split(';')[0].trim().toLowerCase();
  if (EXT_POR_MIME[mime]) return EXT_POR_MIME[mime];
  const doNome = String(fileName || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  if (doNome) return doNome[1];
  try {
    const doPath = new URL(url).pathname.toLowerCase().match(/\.([a-z0-9]{1,8})$/);
    if (doPath) return doPath[1];
  } catch { /* URL inválida já foi filtrada antes */ }
  return 'bin';
};

const sanitizarSegmento = (s) => String(s || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);

/** Download binário (Buffer) com teto de bytes, timeout e até 2 redirects. */
const baixarBinario = (url, redirectsRestantes = 2) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get(
      { hostname: u.hostname, path: u.pathname + u.search },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirectsRestantes <= 0) return reject(new Error('redirects excedidos'));
          return resolve(baixarBinario(new URL(res.headers.location, url).toString(), redirectsRestantes - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`download HTTP ${res.statusCode}`));
        }
        const declarado = Number(res.headers['content-length']);
        if (Number.isFinite(declarado) && declarado > MEDIA_REHOST_MAX_BYTES) {
          req.destroy();
          return reject(new Error('midia acima do teto'));
        }
        const chunks = [];
        let total = 0;
        res.on('data', (c) => {
          total += c.length;
          if (total > MEDIA_REHOST_MAX_BYTES) {
            req.destroy();
            return reject(new Error('midia acima do teto'));
          }
          chunks.push(c);
        });
        res.on('end', () =>
          resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] || null }),
        );
      },
    );
    req.on('error', reject);
    req.setTimeout(MEDIA_DOWNLOAD_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error(`download timeout (${MEDIA_DOWNLOAD_TIMEOUT_MS}ms)`));
    });
  });

/**
 * Baixa a mídia da Z-API e sobe no bucket próprio. Retorna o media_path ou
 * null (fail-open — NUNCA lança). Path: `<chave>/<message_id>.<ext>`.
 */
async function rehospedarMidia({ chave, messageId, mediaUrl, mimeType, fileName }) {
  try {
    if (!isHttpUrl(mediaUrl)) return null;
    const seg = sanitizarSegmento(chave);
    const nome = sanitizarSegmento(messageId);
    if (!seg || !nome) return null;

    const { buffer, contentType } = await baixarBinario(mediaUrl);
    if (!buffer || buffer.length === 0) return null;

    const ext = extensaoMidia(mimeType || contentType, fileName, mediaUrl);
    const mediaPath = `${seg}/${nome}.${ext}`;

    const up = await httpRequest(
      `${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${encodeURIComponent(seg)}/${encodeURIComponent(`${nome}.${ext}`)}`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': mimeType || contentType || 'application/octet-stream',
          'x-upsert': 'true', // retry da Z-API re-sobe o mesmo path sem erro 409
        },
      },
      buffer,
    );
    if (up.statusCode >= 400) throw new Error(`storage upload HTTP ${up.statusCode}`);

    log('INFO', 'midia_rehospedada', { path: mediaPath, bytes: buffer.length });
    return mediaPath;
  } catch (err) {
    // Sem URL no log (querystring pode carregar token da Z-API); erro curto.
    log('WARN', 'midia_rehost_failed', { chave: maskPhone(String(chave)), error: err.message });
    return null;
  }
}

// ─── Ingestão de grupo (RPC atômica + idempotente) ───────────────────────
// A RPC public.whatsapp_grupo_ingest faz, numa transação: upsert do grupo
// (existência SEMPRE registrada) + INSERT da mensagem SÓ se capturar=true, com
// incremento do contador apenas quando a linha foi de fato inserida
// (ON CONFLICT message_id DO NOTHING → reprocessar não duplica nem conta em
// dobro). Retorna { capturar, inserted }.
async function ingestGrupo(g) {
  const chamarRpc = (incluirMediaPath) => {
    const args = {
      p_grupo_id: g.grupo_id,
      p_nome: g.nome,
      p_message_id: g.message_id,
      p_from_me: g.from_me,
      p_tipo: g.tipo,
      p_texto: g.texto,
      p_media_url: g.media_url,
      p_mime_type: g.mime_type,
      p_media_filename: g.media_filename,
      p_participante_nome: g.participante_nome,
      p_participante_phone: g.participante_phone,
      p_momment: g.momment,
    };
    if (incluirMediaPath) args.p_media_path = g.media_path;
    return httpRequest(
      `${SUPABASE_URL}/rest/v1/rpc/whatsapp_grupo_ingest`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Content-Profile': SUPABASE_SCHEMA,
          Accept: 'application/json',
        },
      },
      JSON.stringify(args),
    );
  };

  const comMediaPath = Boolean(g.media_path);
  let r = await chamarRpc(comMediaPath);
  if (r.statusCode >= 400) {
    // NÃO logar o body cru (pode conter o texto da mensagem = PII).
    let pgCode = 'unknown';
    try { pgCode = JSON.parse(r.body).code || 'unknown'; } catch { /* body não-JSON */ }
    // Janela pré-migration: RPC ainda sem p_media_path (PGRST202 = função com
    // esses args não existe) → re-tenta sem o campo (mensagem > mídia).
    if (comMediaPath && pgCode === 'PGRST202') {
      log('WARN', 'rpc_sem_media_path_retry', { grupoId: maskPhone(g.grupo_id) });
      r = await chamarRpc(false);
    }
    if (r.statusCode >= 400) {
      let pgCode2 = 'unknown';
      try { pgCode2 = JSON.parse(r.body).code || 'unknown'; } catch { /* body não-JSON */ }
      throw new Error(`Supabase rpc grupo ${r.statusCode} (code ${pgCode2})`);
    }
  }
  try { return JSON.parse(r.body) || {}; } catch { return {}; }
}

// ─── Vínculo automático grupo → família ──────────────────────────────────
// Um grupo recém-capturado tenta se vincular sozinho ao atleta certo pelo
// telefone do PARTICIPANTE que falou (tail-10 vs atletas/responsaveis).
// Regras de segurança:
//   - CAS `atleta_id=is.null` no PATCH: o vínculo manual do CEO SEMPRE vence
//     (nunca sobrescrevemos um vínculo existente — nem em corrida).
//   - Match ambíguo (2+ atletas) → não vincula (melhor sem vínculo que errado).
//   - Throttle em memória por grupo (10min) — não consulta o banco a cada msg.
//   - Falha aqui NUNCA quebra o webhook (best-effort, só log).
const vinculoUltimaTentativa = new Map();
const VINCULO_THROTTLE_MS = 10 * 60 * 1000;

const supaGet = async (pathAndQuery) => {
  const r = await httpRequest(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Accept-Profile': SUPABASE_SCHEMA,
    },
  });
  if (r.statusCode >= 400) throw new Error(`GET ${pathAndQuery.split('?')[0]} HTTP ${r.statusCode}`);
  const rows = JSON.parse(r.body);
  return Array.isArray(rows) ? rows : [];
};

async function tentarVinculoAutomatico(g) {
  const tail = (g.participante_phone || '').slice(-10);
  if (tail.length < 9) return;

  const agora = Date.now();
  if (agora - (vinculoUltimaTentativa.get(g.grupo_id) || 0) < VINCULO_THROTTLE_MS) return;
  vinculoUltimaTentativa.set(g.grupo_id, agora);

  // Grupo já vinculado? Nada a fazer.
  const grupoRows = await supaGet(
    `whatsapp_grupos?grupo_id=eq.${encodeURIComponent(g.grupo_id)}&select=atleta_id&limit=1`,
  );
  if (!grupoRows[0] || grupoRows[0].atleta_id) return;

  // 1) Participante é o próprio atleta?
  let atletaId = null;
  const atletas = await supaGet(
    `atletas?whatsapp=like.*${encodeURIComponent(tail)}&deleted_at=is.null&select=id&limit=2`,
  );
  if (atletas.length === 1) {
    atletaId = atletas[0].id;
  } else if (atletas.length === 0) {
    // 2) Participante é o responsável? (responsável com 2+ atletas = ambíguo)
    const resps = await supaGet(
      `responsaveis?whatsapp=like.*${encodeURIComponent(tail)}&deleted_at=is.null&select=id&limit=2`,
    );
    if (resps.length === 1) {
      const filhos = await supaGet(
        `atletas?responsavel_id=eq.${encodeURIComponent(resps[0].id)}&deleted_at=is.null&select=id&limit=2`,
      );
      if (filhos.length === 1) atletaId = filhos[0].id;
    }
  }
  if (!atletaId) return;

  // experiencia_id best-effort (o grupo pode nascer antes do pós-venda)
  let experienciaId = null;
  try {
    const exps = await supaGet(
      `crm_experiencia?atleta_id=eq.${encodeURIComponent(atletaId)}&select=id&limit=1`,
    );
    experienciaId = exps[0]?.id ?? null;
  } catch { /* opcional */ }

  const patchBody = JSON.stringify({ atleta_id: atletaId, experiencia_id: experienciaId });
  const patch = await httpRequest(
    // CAS: só vincula se AINDA estiver sem vínculo (manual do CEO vence sempre)
    `${SUPABASE_URL}/rest/v1/whatsapp_grupos?grupo_id=eq.${encodeURIComponent(g.grupo_id)}&atleta_id=is.null`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Profile': SUPABASE_SCHEMA,
        Prefer: 'return=minimal',
      },
    },
    patchBody,
  );
  if (patch.statusCode >= 400) throw new Error(`PATCH vinculo HTTP ${patch.statusCode}`);

  log('INFO', 'grupo_vinculado_automatico', {
    grupoId: maskPhone(g.grupo_id),
    atletaId,
    temExperiencia: !!experienciaId,
  });
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

    // ── Grupo: registra a existência sempre; conteúdo só com opt-in (RPC) ──
    const grupo = normalizarGrupo(payload);
    if (grupo) {
      // Re-hospedagem ANTES da RPC (fail-open: null mantém o fluxo antigo)
      if (grupo.media_url) {
        grupo.media_path = await rehospedarMidia({
          chave: grupo.grupo_id,
          messageId: grupo.message_id,
          mediaUrl: grupo.media_url,
          mimeType: grupo.mime_type,
          fileName: grupo.media_filename,
        });
      }
      const out = await ingestGrupo(grupo);
      log('INFO', 'grupo_ingerido', {
        grupoId: maskPhone(grupo.grupo_id),
        capturar: out.capturar === true,
        gravada: out.inserted === true,
        fromMe: grupo.from_me,
        tipo: grupo.tipo,
      });
      // Vínculo automático grupo→família (best-effort, nunca quebra o webhook)
      try {
        await tentarVinculoAutomatico(grupo);
      } catch (vincErr) {
        log('WARN', 'grupo_vinculo_auto_failed', {
          grupoId: maskPhone(grupo.grupo_id),
          error: vincErr.message,
        });
      }
      return res.status(200).send({ success: true, grupo: true });
    }

    // ── 1:1 (fluxo original, 100% intacto — grupos já saíram acima) ──
    const row = normalizarMensagem(payload);
    if (!row) {
      // Callback de status/presença — reconhece e encerra (sem retry).
      log('INFO', 'callback_ignorado', { tipoCallback });
      return res.status(200).send({ success: true, ignored: true });
    }

    // Re-hospedagem da mídia 1:1 (fail-open: null → grava só media_url como antes)
    if (row.media_url) {
      const mediaPath = await rehospedarMidia({
        chave: row.phone,
        messageId: row.message_id,
        mediaUrl: row.media_url,
        mimeType: row.mime_type,
        fileName: row.media_filename,
      });
      if (mediaPath) row.media_path = mediaPath;
    }

    const inserir = (linha) =>
      httpRequest(
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
        JSON.stringify(linha),
      );

    let r = await inserir(row);
    if (r.statusCode >= 400) {
      // NÃO logar o body cru: em violação de constraint o Postgres devolve a
      // linha inteira no DETAIL (phone + texto da mensagem = PII).
      let pgCode = 'unknown';
      try { pgCode = JSON.parse(r.body).code || 'unknown'; } catch { /* body não-JSON */ }
      // Janela pré-migration: coluna media_path ainda não existe (PGRST204 /
      // 42703) → re-tenta sem o campo (mensagem > mídia).
      if (row.media_path && (pgCode === 'PGRST204' || pgCode === '42703')) {
        log('WARN', 'insert_sem_media_path_retry', { phone: maskPhone(row.phone) });
        const { media_path: _descartado, ...semMediaPath } = row;
        r = await inserir(semMediaPath);
      }
      if (r.statusCode >= 400) {
        let pgCode2 = 'unknown';
        try { pgCode2 = JSON.parse(r.body).code || 'unknown'; } catch { /* body não-JSON */ }
        throw new Error(`Supabase insert ${r.statusCode} (code ${pgCode2})`);
      }
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
