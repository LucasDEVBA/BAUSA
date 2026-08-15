/**
 * instagram-webhook — porta de entrada dos eventos do Instagram.
 *
 * A Meta chama esta função quando alguém comenta, manda DM, responde Story ou
 * menciona o perfil. Traduzimos o payload dela para o formato do fluxo-engine
 * (que é agnóstico de canal) e repassamos.
 *
 * Dois métodos, como o protocolo da Meta exige:
 *   GET  → handshake de assinatura (devolve hub.challenge)
 *   POST → eventos, autenticados por HMAC SHA-256 no header X-Hub-Signature-256
 *
 * SEGURANÇA (o webhook é PÚBLICO — a Meta precisa alcançá-lo sem secret nosso):
 *   • A assinatura HMAC é a ÚNICA prova de que o POST veio da Meta. Sem
 *     APP_SECRET configurado, recusamos TUDO (fail-closed) — um webhook aberto
 *     aceitaria evento forjado e dispararia DM em nome da marca.
 *   • Comparação da assinatura em tempo constante (timingSafeEqual).
 *   • O corpo CRU é obrigatório para o HMAC — JSON re-serializado muda bytes
 *     (espaços/ordem) e invalidaria a assinatura correta.
 *
 * Esta CF NÃO envia mensagem: ela só traduz e encaminha. Quem decide disparo é
 * o fluxo-engine (fluxo ativo + gate de escopo + canal liberado).
 */

const functions = require('@google-cloud/functions-framework');
const crypto = require('crypto');
const https = require('https');

const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN;
const FLUXO_ENGINE_URL = process.env.FLUXO_ENGINE_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
/**
 * IDs da NOSSA conta — usados p/ ignorar o eco das nossas próprias mensagens.
 *
 * Aceita LISTA separada por vírgula de propósito: a mesma conta tem dois ids
 * na Meta (`user_id` da conta profissional, 178414…, e o `id` com escopo de
 * app, 281517…) e a documentação se contradiz sobre qual chega no webhook —
 * a página de Get Started diz que `entry.id` é o profissional, mas os exemplos
 * de `messaging_postbacks`/`messaging_referral` usam o placeholder
 * `<INSTAGRAM_SCOPED_ID>` no MESMO campo. Aceitar os dois custa nada e fecha a
 * porta do loop; depender de um só é apostar em qual página está certa.
 */
const IG_USER_IDS = new Set(
  String(process.env.IG_USER_ID || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

const ehMinhaConta = (id) => IG_USER_IDS.has(String(id));

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
    req.setTimeout(options.timeoutMs || 20000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (postData) req.write(postData);
    req.end();
  });

/** HMAC SHA-256 do corpo CRU contra o header da Meta, em tempo constante. */
function assinaturaValida(rawBody, header) {
  if (!APP_SECRET) return false; // fail-closed: sem segredo, nada entra
  if (typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const esperado = crypto.createHmac('sha256', APP_SECRET).update(rawBody).digest('hex');
  const recebido = header.slice('sha256='.length);
  const a = Buffer.from(esperado, 'utf8');
  const b = Buffer.from(recebido, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Traduz um `entry` do Instagram em eventos do fluxo-engine.
 * Um POST da Meta pode trazer vários entries e cada um vários changes.
 */
function traduzirEntry(entry) {
  const eventos = [];

  // Fail-closed, no mesmo espírito do APP_SECRET: sem saber QUEM SOMOS não dá
  // para distinguir o eco da nossa mensagem da mensagem de um lead — e o preço
  // do erro é a conta conversando sozinha em loop. Sem os ids, não traduz nada.
  if (IG_USER_IDS.size === 0) {
    log('ERROR', 'ig_user_id_ausente', { motivo: 'anti-loop sem referência — evento descartado' });
    return eventos;
  }

  // ── Mensagens diretas (campo `messaging`) ──
  for (const m of entry.messaging || []) {
    // `is_echo` é a marca que a própria Meta põe no eco do que NÓS enviamos.
    // Segunda barreira independente do id: se um dos dois falhar, o outro segura.
    if (m.message?.is_echo === true) continue;
    const remetente = m.sender?.id;
    if (!remetente || ehMinhaConta(remetente)) continue; // eco da nossa própria msg
    const texto = m.message?.text || '';
    const mid = m.message?.mid || null;

    // Resposta a Story vem com reply_to.story — intenção mais alta que DM comum.
    const ehStory = Boolean(m.message?.reply_to?.story);
    const base = { canal: 'instagram', externoId: String(remetente), texto, dedupeKey: mid };

    // Manda como RESPOSTA (continua conversa) e como ENTRADA (pode abrir fluxo).
    eventos.push({ ...base, resposta: true });
    eventos.push({ ...base, gatilho: ehStory ? 'resposta_story' : 'dm_palavra_chave' });
  }

  // ── Comentários e menções (campo `changes`) ──
  for (const c of entry.changes || []) {
    const v = c.value || {};
    if (c.field === 'comments') {
      const autor = v.from?.id;
      if (!autor || ehMinhaConta(autor)) continue; // não reagir ao próprio comentário
      eventos.push({
        canal: 'instagram',
        externoId: String(autor),
        username: v.from?.username || null,
        texto: v.text || '',
        // media.media_product_type distingue REELS de FEED quando presente
        gatilho: v.media?.media_product_type === 'REELS' ? 'comentario_reels' : 'comentario_post',
        postId: v.media?.id || null,
        comentarioId: v.id || null,
        dedupeKey: v.id || null,
      });
    }
    if (c.field === 'mentions') {
      // Só o autor de verdade. O fallback antigo (`|| v.comment_id`) pegava um
      // id de OUTRO namespace: viraria destinatário inválido de DM e um contato
      // fantasma no funil. Sem autor identificável não há a quem responder.
      const autor = v.from?.id;
      if (!autor || ehMinhaConta(autor)) continue; // nem menção da própria conta
      eventos.push({
        canal: 'instagram',
        externoId: String(autor),
        texto: v.text || '',
        gatilho: 'mencao_story',
        dedupeKey: v.media_id || v.comment_id || null,
      });
    }
  }

  return eventos;
}

async function repassar(evento) {
  if (!FLUXO_ENGINE_URL || !WEBHOOK_SECRET) return;
  const payload = JSON.stringify({ evento });
  await httpRequest(
    FLUXO_ENGINE_URL,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'x-webhook-secret': WEBHOOK_SECRET,
      },
      timeoutMs: 15000,
    },
    payload
  );
}

functions.http('instagramWebhook', async (req, res) => {
  // ── Handshake de assinatura do webhook ──
  if (req.method === 'GET') {
    const modo = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (!VERIFY_TOKEN || modo !== 'subscribe' || token !== VERIFY_TOKEN) {
      log('WARN', 'verify_failed', { modo });
      return res.status(403).send('Forbidden');
    }
    log('info', 'verify_ok');
    return res.status(200).send(String(challenge ?? ''));
  }

  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // rawBody é preenchido pelo functions-framework; sem ele não há como validar
  // o HMAC (re-serializar o JSON mudaria os bytes e quebraria a assinatura).
  const raw = req.rawBody || (typeof req.body === 'string' ? Buffer.from(req.body) : null);
  if (!raw) {
    log('ERROR', 'sem_raw_body');
    return res.status(400).send({ success: false });
  }
  if (!assinaturaValida(raw, req.headers['x-hub-signature-256'])) {
    log('WARN', 'assinatura_invalida');
    return res.status(401).send({ success: false });
  }

  let corpo;
  try {
    corpo = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).send({ success: false });
  }
  if (corpo.object !== 'instagram') {
    // Objeto que não é nosso — reconhece p/ a Meta não re-tentar eternamente.
    return res.status(200).send({ success: true, ignored: true });
  }

  let repassados = 0;
  for (const entry of corpo.entry || []) {
    for (const evento of traduzirEntry(entry)) {
      try {
        await repassar(evento);
        repassados += 1;
      } catch (e) {
        // Não devolvemos erro à Meta: ela re-tentaria o LOTE inteiro e
        // reprocessaria eventos já entregues. O dedupeKey protege duplicata,
        // mas re-tentar em massa é ruído — melhor logar e seguir.
        log('WARN', 'repasse_falhou', { gatilho: evento.gatilho, error: e.message });
      }
    }
  }

  log('info', 'webhook_ok', { entries: (corpo.entry || []).length, repassados });
  return res.status(200).send({ success: true, repassados });
});

// Export p/ o guard testar as regras puras sem subir servidor.
module.exports = { assinaturaValida, traduzirEntry };
