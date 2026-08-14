/**
 * fluxo-engine — motor de execução dos Fluxos (o "ManyChat" próprio).
 *
 * Dois modos, no mesmo serviço:
 *   POST /  { evento: {...} }   → ENTRADA: um gatilho aconteceu (comentário,
 *                                 novo seguidor, DM, mensagem no WhatsApp).
 *   POST /  { tick: true }      → TICK: retoma execuções com `retomar_em`
 *                                 vencido (blocos `delay`) e expira as que
 *                                 ficaram sem resposta.
 *
 * Invariantes (travados por tests/fluxo-engine-invariants.test.js):
 *   • Só executa fluxo ATIVO e de canal DISPONÍVEL — instagram não envia até
 *     o App Review de instagram_business_manage_messages.
 *   • CAS no claim da execução (lock_until) — dois ticks concorrentes nunca
 *     avançam a mesma execução.
 *   • Idempotência da ENTRADA por UNIQUE(fluxo_id, contato_id, dedupe_key).
 *   • Bloco de IA SEMPRE tem fallback textual — IA fora do ar não trava fluxo.
 *   • Anti-loop: teto de blocos por ciclo (um `proximo_id` circular não roda
 *     para sempre).
 */

const functions = require('@google-cloud/functions-framework');
const https = require('https');

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// O Engine LÊ public em todo ambiente (mesma decisão das outras CFs que
// alimentam telas) — ver memória cf-schema-public-para-engine.
const SUPABASE_SCHEMA = 'public';
const SEND_WHATSAPP_URL = process.env.SEND_WHATSAPP_URL;

const INSTAGRAM_TOKEN = process.env.INSTAGRAM_TOKEN;
const INSTAGRAM_GRAPH = 'https://graph.instagram.com';

// Canais que conseguem ENVIAR. O Instagram só entra quando o token existir —
// e o token só existe depois do App Review de instagram_business_manage_messages.
// Isso torna o gate AUTOMÁTICO: nada de "esqueci de ligar a flag" nem de
// prometer envio que a Meta ainda não autoriza. Sem env, o Set fica só com
// whatsapp (travado por guard).
const CANAIS_ENVIO = new Set(['whatsapp']);
if (INSTAGRAM_TOKEN) CANAIS_ENVIO.add('instagram');

const MAX_BLOCOS_POR_CICLO = 25;      // anti-loop
const LOCK_MS = 2 * 60 * 1000;        // claim de 2 min
const ESPERA_MAX_HORAS = 48;          // sem resposta em 48h = abandonada
const MAX_EXECUCOES_POR_TICK = 200;

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
    req.setTimeout(options.timeoutMs || 30000, () => {
      req.destroy();
      reject(new Error(`Request timeout (${(options.timeoutMs || 30000) / 1000}s)`));
    });
    if (postData) req.write(postData);
    req.end();
  });

// ─── Supabase REST ──────────────────────────────────────────────
const sb = async (path, { method = 'GET', body = null, prefer = null } = {}) => {
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
  if (method === 'GET') headers['Accept-Profile'] = SUPABASE_SCHEMA;
  else headers['Content-Profile'] = SUPABASE_SCHEMA;
  if (prefer) headers.Prefer = prefer;

  const payload = body ? JSON.stringify(body) : null;
  if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

  const res = await httpRequest(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, timeoutMs: 20000 }, payload);
  if (res.statusCode >= 400) throw new Error(`supabase ${path}: ${res.statusCode} ${res.body.slice(0, 300)}`);
  try {
    return res.body ? JSON.parse(res.body) : [];
  } catch {
    return [];
  }
};

const registrarEvento = async (execucaoId, fluxoId, blocoId, tipo, detalhe = {}) => {
  try {
    await sb('fluxo_eventos', {
      method: 'POST',
      body: { execucao_id: execucaoId, fluxo_id: fluxoId, bloco_id: blocoId, tipo, detalhe },
    });
  } catch (e) {
    // Telemetria NUNCA derruba o fluxo (fail-open, padrão da casa).
    log('WARN', 'evento_falhou', { tipo, error: e.message });
  }
};

// ─── ESCOPO: quem pode acionar fluxo (gate do CEO) ──────────────
// Decisão do CEO (2026-08-13): "conecte, mas funcional só no momento em que eu
// quiser, com um chat ou grupo específicos ou global".
//
// FAIL-CLOSED por definição: chave ausente, JSON inválido, erro de leitura ou
// modo desconhecido ⇒ NÃO dispara. Ligar é sempre gesto explícito. O escopo
// mora AQUI (motor) e não no zapi-inbox porque é o motor que envia — checar na
// borda seria conselho; checar aqui é garantia.
//
// configuracoes_sistema.chave = 'fluxos_escopo'
//   { modo: 'desligado' | 'lista' | 'global', telefones: [], grupos: [] }
const ESCOPO_CHAVE = 'fluxos_escopo';
const ESCOPO_TTL_MS = 60_000;
let escopoCache = { valor: null, em: 0 };

// tail-10 = mesma normalização usada no matching de telefone do projeto
// (DDI/9º dígito variam entre o que o lead digita e o que a Z-API devolve).
const tail10 = (v) => String(v || '').replace(/\D/g, '').slice(-10);

const lerEscopo = async () => {
  const agora = Date.now();
  if (escopoCache.valor && agora - escopoCache.em < ESCOPO_TTL_MS) return escopoCache.valor;
  try {
    const rows = await sb(`configuracoes_sistema?chave=eq.${ESCOPO_CHAVE}&select=valor`);
    const bruto = rows[0]?.valor;
    const v = typeof bruto === 'string' ? JSON.parse(bruto) : bruto;
    const valor = v && typeof v === 'object' ? v : { modo: 'desligado' };
    escopoCache = { valor, em: agora };
    return valor;
  } catch (e) {
    log('WARN', 'escopo_leitura_falhou', { error: e.message });
    return { modo: 'desligado' }; // fail-closed
  }
};

/** true = este contato/grupo pode acionar fluxos agora. */
const escopoPermite = (escopo, externoId, ehGrupo) => {
  const modo = escopo && typeof escopo.modo === 'string' ? escopo.modo : 'desligado';
  if (modo === 'global') return true;
  if (modo !== 'lista') return false; // 'desligado' e qualquer valor estranho
  const lista = ehGrupo ? escopo.grupos : escopo.telefones;
  if (!Array.isArray(lista) || lista.length === 0) return false;
  if (ehGrupo) {
    // grupo_id às vezes vem com sufixo @g.us e às vezes não — normalizar as 2 pontas
    const alvo = String(externoId || '').replace(/@.*$/, '');
    return lista.some((g) => String(g || '').replace(/@.*$/, '') === alvo);
  }
  const alvo = tail10(externoId);
  return alvo.length >= 8 && lista.some((t) => tail10(t) === alvo);
};

// ─── Normalização de texto p/ casar palavra-chave ───────────────
const normalizar = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

const casaPalavra = (texto, palavras, match) => {
  if (!Array.isArray(palavras) || palavras.length === 0) return true; // sem filtro = qualquer
  const t = normalizar(texto);
  return palavras.some((p) => {
    const w = normalizar(p);
    if (!w) return false;
    if (match === 'exato') return t === w;
    if (match === 'comeca_com') return t.startsWith(w);
    return t.includes(w);
  });
};

// ─── Render de variáveis no texto ───────────────────────────────
// Só substitui o que EXISTE; token desconhecido é removido em vez de chegar
// literal ao contato (mensagem com "{nome}" cru é pior que sem nada).
const render = (texto, variaveis, contato) => {
  const fonte = { ...(variaveis || {}), nome: contato?.nome || variaveis?.nome || '', username: contato?.username || '' };
  return String(texto || '')
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, k) => {
      const v = fonte[k];
      return v === undefined || v === null ? '' : String(v);
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// ─── Validação dos campos de captura ────────────────────────────
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const validarCampo = (campo, valor) => {
  const v = String(valor || '').trim();
  if (!v) return { ok: false, motivo: 'vazio' };
  if (campo === 'email') {
    return RE_EMAIL.test(v) ? { ok: true, valor: v.toLowerCase() } : { ok: false, motivo: 'email_invalido' };
  }
  if (campo === 'telefone') {
    const digitos = v.replace(/\D/g, '');
    return digitos.length >= 10 && digitos.length <= 15
      ? { ok: true, valor: digitos }
      : { ok: false, motivo: 'telefone_invalido' };
  }
  if (campo === 'instagram') return { ok: true, valor: v.replace(/^@/, '') };
  return { ok: true, valor: v };
};

// ─── Envio por canal ────────────────────────────────────────────
const enviarMensagem = async (canal, contato, texto) => {
  if (!CANAIS_ENVIO.has(canal)) {
    // Não é erro: é canal ainda não liberado. O fluxo registra e para.
    return { enviado: false, motivo: 'canal_indisponivel' };
  }
  if (canal === 'whatsapp') {
    if (!SEND_WHATSAPP_URL) return { enviado: false, motivo: 'sem_url' };
    // send-whatsapp custom exige `record.athlete_name` (contrato validado lá).
    const payload = JSON.stringify({
      record: { athlete_name: contato.nome || contato.username || 'Contato' },
      messageType: 'meeting_confirmed',
      customMessage: texto,
      phone: contato.externo_id,
    });
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
    if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;
    const r = await httpRequest(SEND_WHATSAPP_URL, { method: 'POST', headers, timeoutMs: 60000 }, payload);
    if (r.statusCode >= 400) throw new Error(`send-whatsapp: ${r.statusCode} ${r.body.slice(0, 200)}`);
    return { enviado: true };
  }
  if (canal === 'instagram') {
    // Send API do Instagram: POST /me/messages { recipient:{id}, message:{text} }.
    // O `id` é o IGSID do contato (o mesmo que chega no webhook) — não o @.
    const payload = JSON.stringify({
      recipient: { id: contato.externo_id },
      message: { text: texto },
    });
    const r = await httpRequest(
      `${INSTAGRAM_GRAPH}/v23.0/me/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          Authorization: `Bearer ${INSTAGRAM_TOKEN}`,
        },
        timeoutMs: 30000,
      },
      payload
    );
    if (r.statusCode >= 400) {
      // Fora da janela de 24h a Meta recusa (erro 10/551). Não é bug nosso:
      // é política da plataforma — registrar com clareza p/ a métrica não
      // confundir "recusado por política" com "falha de sistema".
      const janela = /\b(10|551)\b/.test(r.body) || /outside.*window/i.test(r.body);
      if (janela) return { enviado: false, motivo: 'fora_janela_24h' };
      throw new Error(`instagram send: ${r.statusCode} ${r.body.slice(0, 200)}`);
    }
    return { enviado: true };
  }
  return { enviado: false, motivo: 'canal_desconhecido' };
};

// ─── Execução de UM bloco ───────────────────────────────────────
// Retorna { proximoId, parar, aguardando } — quem decide o caminho é o bloco.
const executarBloco = async (ctx, bloco) => {
  const { execucao, fluxo, contato } = ctx;
  await registrarEvento(execucao.id, fluxo.id, bloco.id, 'bloco_executado', { tipo: bloco.tipo });
  const c = bloco.conteudo || {};

  switch (bloco.tipo) {
    case 'mensagem':
    case 'pergunta':
    case 'botoes':
    case 'captura': {
      let texto = render(c.texto, execucao.variaveis, contato);
      if (bloco.tipo === 'botoes' && Array.isArray(c.opcoes) && c.opcoes.length > 0) {
        texto += `\n\n${c.opcoes.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;
      }
      const r = await enviarMensagem(fluxo.canal, contato, texto);
      if (r.enviado) {
        await registrarEvento(execucao.id, fluxo.id, bloco.id, 'mensagem_enviada', { chars: texto.length });
      } else {
        await registrarEvento(execucao.id, fluxo.id, bloco.id, 'erro', { motivo: r.motivo });
        return { parar: true, motivo: r.motivo };
      }
      // Blocos que esperam resposta param aqui — a retomada vem pela entrada.
      if (bloco.tipo === 'pergunta' || bloco.tipo === 'botoes' || bloco.tipo === 'captura') {
        return { aguardando: true };
      }
      return { proximoId: bloco.proximo_id };
    }

    case 'delay': {
      const minutos = Number(c.minutos) || 1;
      return { agendarEm: new Date(Date.now() + minutos * 60_000).toISOString(), proximoId: bloco.proximo_id };
    }

    case 'tag': {
      const atuais = new Set(Array.isArray(contato.tags) ? contato.tags : []);
      for (const t of c.adicionar || []) atuais.add(String(t));
      for (const t of c.remover || []) atuais.delete(String(t));
      const tags = [...atuais];
      await sb(`fluxo_contatos?id=eq.${contato.id}`, { method: 'PATCH', body: { tags } });
      contato.tags = tags;
      await registrarEvento(execucao.id, fluxo.id, bloco.id, 'tag_aplicada', { tags });
      return { proximoId: bloco.proximo_id };
    }

    case 'condicao': {
      const valor = normalizar(execucao.variaveis?.[c.campoComparado] ?? '');
      const ramo = (bloco.ramos || []).find((r) => normalizar(r.valor) === valor);
      return { proximoId: ramo?.blocoId ?? bloco.proximo_id };
    }

    case 'ia_resposta': {
      // Sem IA configurada → fallback textual (invariante: nunca trava).
      const texto = render(c.fallback || c.texto || '', execucao.variaveis, contato);
      if (texto) {
        const r = await enviarMensagem(fluxo.canal, contato, texto);
        if (r.enviado) await registrarEvento(execucao.id, fluxo.id, bloco.id, 'mensagem_enviada', { fallback: true });
      }
      return { proximoId: bloco.proximo_id };
    }

    case 'ia_condicao': {
      // Fail-safe: sem classificação confiável, segue o caminho padrão.
      return { proximoId: bloco.proximo_id };
    }

    case 'handoff': {
      await registrarEvento(execucao.id, fluxo.id, bloco.id, 'handoff', { destinatario: c.destinatario || null });
      return { parar: true, status: 'handoff' };
    }

    case 'acao_crm':
      return { proximoId: bloco.proximo_id };

    case 'fim':
    default:
      return { parar: true, status: 'concluida' };
  }
};

// ─── Avança a execução até parar/aguardar ───────────────────────
const avancar = async (ctx, blocoInicialId) => {
  const { execucao, fluxo } = ctx;
  const blocos = new Map(ctx.blocos.map((b) => [b.id, b]));
  let atual = blocoInicialId;
  let passos = 0;

  while (atual && passos < MAX_BLOCOS_POR_CICLO) {
    passos += 1;
    const bloco = blocos.get(atual);
    if (!bloco) break;

    let r;
    try {
      r = await executarBloco(ctx, bloco);
    } catch (e) {
      log('ERROR', 'bloco_falhou', { execucao: execucao.id, bloco: bloco.id, error: e.message });
      await registrarEvento(execucao.id, fluxo.id, bloco.id, 'erro', { erro: e.message.slice(0, 300) });
      await sb(`fluxo_execucoes?id=eq.${execucao.id}`, {
        method: 'PATCH',
        body: { status: 'erro', erro: e.message.slice(0, 500), lock_until: null },
      });
      return { status: 'erro', passos };
    }

    if (r.aguardando) {
      await sb(`fluxo_execucoes?id=eq.${execucao.id}`, {
        method: 'PATCH',
        body: {
          status: 'aguardando_resposta',
          bloco_atual_id: bloco.id,
          retomar_em: new Date(Date.now() + ESPERA_MAX_HORAS * 3600_000).toISOString(),
          lock_until: null,
        },
      });
      return { status: 'aguardando_resposta', passos };
    }
    if (r.agendarEm) {
      await sb(`fluxo_execucoes?id=eq.${execucao.id}`, {
        method: 'PATCH',
        body: { status: 'ativa', bloco_atual_id: r.proximoId ?? null, retomar_em: r.agendarEm, lock_until: null },
      });
      return { status: 'agendada', passos };
    }
    if (r.parar) {
      const status = r.status || 'concluida';
      await sb(`fluxo_execucoes?id=eq.${execucao.id}`, {
        method: 'PATCH',
        body: {
          status,
          bloco_atual_id: null,
          retomar_em: null,
          lock_until: null,
          concluida_em: new Date().toISOString(),
        },
      });
      await registrarEvento(execucao.id, fluxo.id, bloco.id, status === 'concluida' ? 'concluiu' : 'handoff', {});
      return { status, passos };
    }
    atual = r.proximoId ?? null;
  }

  // Sem próximo bloco = fim natural do ramo.
  await sb(`fluxo_execucoes?id=eq.${execucao.id}`, {
    method: 'PATCH',
    body: {
      status: 'concluida',
      bloco_atual_id: null,
      retomar_em: null,
      lock_until: null,
      concluida_em: new Date().toISOString(),
    },
  });
  await registrarEvento(execucao.id, fluxo.id, null, 'concluiu', { passos });
  return { status: 'concluida', passos };
};

// ─── Contato (upsert por canal+id externo) ──────────────────────
const obterContato = async (canal, externoId, nome, username) => {
  const existentes = await sb(
    `fluxo_contatos?canal=eq.${canal}&externo_id=eq.${encodeURIComponent(externoId)}&select=*`
  );
  if (existentes.length > 0) {
    await sb(`fluxo_contatos?id=eq.${existentes[0].id}`, {
      method: 'PATCH',
      body: { ultimo_contato_at: new Date().toISOString() },
    });
    return existentes[0];
  }
  const criados = await sb('fluxo_contatos', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      canal,
      externo_id: externoId,
      nome: nome || null,
      username: username || null,
      ultimo_contato_at: new Date().toISOString(),
    },
  });
  return criados[0];
};

const carregarBlocos = async (fluxoId) => {
  const rows = await sb(`fluxo_blocos?fluxo_id=eq.${fluxoId}&select=*&order=ordem.asc`);
  return rows.map((b) => ({
    ...b,
    ramos: Array.isArray(b.ramos) ? b.ramos : [],
    conteudo: b.conteudo && typeof b.conteudo === 'object' ? b.conteudo : {},
  }));
};

// ─── ENTRADA: um gatilho aconteceu ──────────────────────────────
const processarEvento = async (evento) => {
  const canal = String(evento.canal || '');
  const gatilho = String(evento.gatilho || '');
  const externoId = String(evento.externoId || '');
  const texto = String(evento.texto || '');
  if (!canal || !gatilho || !externoId) return { ok: false, motivo: 'evento_incompleto' };

  // GATE DO CEO — fail-closed. Antes de qualquer consulta a fluxo.
  const escopo = await lerEscopo();
  if (!escopoPermite(escopo, externoId, evento.ehGrupo === true)) {
    return { ok: true, disparados: 0, motivo: 'fora_do_escopo' };
  }

  const fluxos = await sb(
    `fluxos?ativo=eq.true&deleted_at=is.null&canal=eq.${canal}&gatilho=eq.${gatilho}&select=*`
  );
  if (fluxos.length === 0) return { ok: true, disparados: 0, motivo: 'nenhum_fluxo' };

  const contato = await obterContato(canal, externoId, evento.nome, evento.username);
  if (!contato) return { ok: false, motivo: 'contato_falhou' };
  if (contato.optin === false || contato.optout_at) {
    return { ok: true, disparados: 0, motivo: 'optout' };
  }

  let disparados = 0;
  for (const fluxo of fluxos) {
    const cfg = fluxo.gatilho_config && typeof fluxo.gatilho_config === 'object' ? fluxo.gatilho_config : {};
    if (!casaPalavra(texto, cfg.palavras, cfg.match)) continue;
    if (cfg.postAlvo && evento.postId && String(cfg.postAlvo) !== String(evento.postId)) continue;
    if (!fluxo.bloco_inicial_id) continue;

    // Teto por hora (anti-ban / anti-rajada)
    const desde = new Date(Date.now() - 3600_000).toISOString();
    const recentes = await sb(
      `fluxo_execucoes?fluxo_id=eq.${fluxo.id}&iniciada_em=gte.${desde}&select=id`
    );
    if (recentes.length >= (Number(fluxo.limite_hora) || 60)) {
      log('WARN', 'limite_hora_atingido', { fluxo: fluxo.id, recentes: recentes.length });
      continue;
    }

    // Reentrada: já passou por aqui recentemente?
    if (Number(fluxo.reentrada_horas) > 0) {
      const corte = new Date(Date.now() - Number(fluxo.reentrada_horas) * 3600_000).toISOString();
      const anteriores = await sb(
        `fluxo_execucoes?fluxo_id=eq.${fluxo.id}&contato_id=eq.${contato.id}&iniciada_em=gte.${corte}&select=id`
      );
      if (anteriores.length > 0) continue;
    } else {
      const anteriores = await sb(
        `fluxo_execucoes?fluxo_id=eq.${fluxo.id}&contato_id=eq.${contato.id}&select=id&limit=1`
      );
      if (anteriores.length > 0) continue;
    }

    // Idempotência da entrada (mesmo comentário/DM não dispara 2x).
    let execucao;
    try {
      const criadas = await sb('fluxo_execucoes', {
        method: 'POST',
        prefer: 'return=representation',
        body: {
          fluxo_id: fluxo.id,
          contato_id: contato.id,
          status: 'ativa',
          dedupe_key: evento.dedupeKey || null,
          variaveis: {},
          lock_until: new Date(Date.now() + LOCK_MS).toISOString(),
        },
      });
      execucao = criadas[0];
    } catch (e) {
      if (/duplicate key|23505/i.test(e.message)) continue; // já processado
      throw e;
    }
    if (!execucao) continue;

    await registrarEvento(execucao.id, fluxo.id, null, 'entrou', { gatilho, texto: texto.slice(0, 120) });
    const blocos = await carregarBlocos(fluxo.id);
    await avancar({ execucao: { ...execucao, variaveis: {} }, fluxo, contato, blocos }, fluxo.bloco_inicial_id);
    disparados += 1;
  }

  return { ok: true, disparados };
};

// ─── RESPOSTA a uma execução que aguardava ──────────────────────
const processarResposta = async (evento) => {
  const canal = String(evento.canal || '');
  const externoId = String(evento.externoId || '');
  const texto = String(evento.texto || '');

  // Mesmo gate na RESPOSTA: tirar um contato do escopo interrompe a conversa
  // em andamento (senão o "desligar" só valeria para conversas novas).
  const escopo = await lerEscopo();
  if (!escopoPermite(escopo, externoId, evento.ehGrupo === true)) {
    return { ok: true, retomadas: 0, motivo: 'fora_do_escopo' };
  }

  const contatos = await sb(
    `fluxo_contatos?canal=eq.${canal}&externo_id=eq.${encodeURIComponent(externoId)}&select=*`
  );
  if (contatos.length === 0) return { ok: true, retomadas: 0 };
  const contato = contatos[0];

  const agora = new Date().toISOString();
  const execucoes = await sb(
    `fluxo_execucoes?contato_id=eq.${contato.id}&status=eq.aguardando_resposta` +
      `&or=(lock_until.is.null,lock_until.lt.${agora})&select=*&order=iniciada_em.desc&limit=1`
  );
  if (execucoes.length === 0) return { ok: true, retomadas: 0 };
  const execucao = execucoes[0];

  // CAS: só avança quem conseguir cravar o lock.
  const travadas = await sb(
    `fluxo_execucoes?id=eq.${execucao.id}&status=eq.aguardando_resposta`,
    {
      method: 'PATCH',
      prefer: 'return=representation',
      body: { lock_until: new Date(Date.now() + LOCK_MS).toISOString(), status: 'ativa' },
    }
  );
  if (travadas.length === 0) return { ok: true, retomadas: 0 };

  const fluxos = await sb(`fluxos?id=eq.${execucao.fluxo_id}&select=*`);
  if (fluxos.length === 0) return { ok: true, retomadas: 0 };
  const fluxo = fluxos[0];
  const blocos = await carregarBlocos(fluxo.id);
  const bloco = blocos.find((b) => b.id === execucao.bloco_atual_id);
  if (!bloco) return { ok: true, retomadas: 0 };

  const variaveis = execucao.variaveis && typeof execucao.variaveis === 'object' ? execucao.variaveis : {};
  const c = bloco.conteudo || {};
  let proximoId = bloco.proximo_id;

  await registrarEvento(execucao.id, fluxo.id, bloco.id, 'resposta_recebida', { chars: texto.length });

  if (bloco.tipo === 'pergunta' && c.variavel) {
    variaveis[c.variavel] = texto;
  } else if (bloco.tipo === 'botoes') {
    const opcoes = Array.isArray(c.opcoes) ? c.opcoes : [];
    const t = normalizar(texto);
    // Aceita o número ("2") ou o texto da opção — o contato responde dos dois jeitos.
    const porNumero = Number(t) >= 1 && Number(t) <= opcoes.length ? opcoes[Number(t) - 1] : null;
    const escolhida = porNumero || opcoes.find((o) => normalizar(o) === t || t.includes(normalizar(o)));
    if (escolhida) {
      if (c.variavel) variaveis[c.variavel] = escolhida;
      await registrarEvento(execucao.id, fluxo.id, bloco.id, 'botao_clicado', { opcao: escolhida });
      const ramo = (bloco.ramos || []).find((r) => normalizar(r.valor) === normalizar(escolhida));
      if (ramo?.blocoId) proximoId = ramo.blocoId;
    }
  } else if (bloco.tipo === 'captura' && c.campo) {
    const v = validarCampo(c.campo, texto);
    if (!v.ok) {
      // Repete o bloco: resposta inválida não avança nem descarta o contato.
      await sb(`fluxo_execucoes?id=eq.${execucao.id}`, {
        method: 'PATCH',
        body: { status: 'aguardando_resposta', lock_until: null },
      });
      const aviso =
        c.campo === 'email'
          ? 'Hmm, esse e-mail não parece válido. Pode conferir e mandar de novo?'
          : 'Não consegui ler esse dado. Pode mandar de novo?';
      await enviarMensagem(fluxo.canal, contato, aviso);
      return { ok: true, retomadas: 1, revalidacao: true };
    }
    if (c.variavel) variaveis[c.variavel] = v.valor;
    const campos = contato.campos && typeof contato.campos === 'object' ? contato.campos : {};
    campos[c.campo] = v.valor;
    await sb(`fluxo_contatos?id=eq.${contato.id}`, { method: 'PATCH', body: { campos } });
    await registrarEvento(execucao.id, fluxo.id, bloco.id, 'campo_capturado', { campo: c.campo });
  }

  await sb(`fluxo_execucoes?id=eq.${execucao.id}`, { method: 'PATCH', body: { variaveis } });
  await avancar({ execucao: { ...execucao, variaveis }, fluxo, contato, blocos }, proximoId);
  return { ok: true, retomadas: 1 };
};

// ─── TICK: retoma delays e expira esperas ───────────────────────
const rodarTick = async () => {
  const agora = new Date().toISOString();
  const pendentes = await sb(
    `fluxo_execucoes?status=in.(ativa,aguardando_resposta)&retomar_em=lte.${agora}` +
      `&or=(lock_until.is.null,lock_until.lt.${agora})&select=*&limit=${MAX_EXECUCOES_POR_TICK}`
  );

  let retomadas = 0;
  let expiradas = 0;
  for (const execucao of pendentes) {
    if (execucao.status === 'aguardando_resposta') {
      // Esperou demais → abandonada (métrica honesta de onde o funil vaza).
      await sb(`fluxo_execucoes?id=eq.${execucao.id}&status=eq.aguardando_resposta`, {
        method: 'PATCH',
        body: { status: 'abandonada', retomar_em: null, lock_until: null },
      });
      await registrarEvento(execucao.id, execucao.fluxo_id, execucao.bloco_atual_id, 'abandonou', {});
      expiradas += 1;
      continue;
    }

    const travadas = await sb(`fluxo_execucoes?id=eq.${execucao.id}&status=eq.ativa`, {
      method: 'PATCH',
      prefer: 'return=representation',
      body: { lock_until: new Date(Date.now() + LOCK_MS).toISOString() },
    });
    if (travadas.length === 0) continue;

    const fluxos = await sb(`fluxos?id=eq.${execucao.fluxo_id}&select=*`);
    const contatos = await sb(`fluxo_contatos?id=eq.${execucao.contato_id}&select=*`);
    if (fluxos.length === 0 || contatos.length === 0) continue;
    const blocos = await carregarBlocos(execucao.fluxo_id);
    await avancar(
      {
        execucao: { ...execucao, variaveis: execucao.variaveis || {} },
        fluxo: fluxos[0],
        contato: contatos[0],
        blocos,
      },
      execucao.bloco_atual_id
    );
    retomadas += 1;
  }
  return { retomadas, expiradas, avaliadas: pendentes.length };
};

// ─── HTTP ───────────────────────────────────────────────────────
functions.http('fluxoEngine', async (req, res) => {
  // Fail-closed: sem secret configurado, ninguém entra.
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log('ERROR', 'sem_supabase');
    return res.status(500).send({ success: false, error: 'Supabase não configurado' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  try {
    if (body.tick === true) {
      const r = await rodarTick();
      log('info', 'tick_ok', r);
      return res.status(200).send({ success: true, ...r });
    }
    if (body.evento && typeof body.evento === 'object') {
      const r = body.evento.resposta === true
        ? await processarResposta(body.evento)
        : await processarEvento(body.evento);
      log('info', 'evento_ok', { gatilho: body.evento.gatilho, ...r });
      return res.status(200).send({ success: true, ...r });
    }
    return res.status(400).send({ success: false, error: 'Informe { tick: true } ou { evento: {...} }' });
  } catch (e) {
    log('ERROR', 'unhandled', { error: e.message });
    return res.status(500).send({ success: false, error: e.message });
  }
});

// Export p/ o guard de CI inspecionar as regras puras sem subir o servidor.
module.exports = { casaPalavra, normalizar, render, validarCampo, escopoPermite, CANAIS_ENVIO };
