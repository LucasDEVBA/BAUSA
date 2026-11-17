const functions = require('@google-cloud/functions-framework');
const https = require('https');

const {
  CLASSES_QUALIFICADAS,
  JANELA_MAX_MS,
  MOTIVOS_ADIAR,
  PREFIXO_DESCARTE,
  classificarErroMeta,
  montarEvento,
  resumirErroMeta,
} = require('./capi');

// ════════════════════════════════════════════════════════════════════════
// meta-capi — API de Conversões do Meta: evento LeadQualificado
// ════════════════════════════════════════════════════════════════════════
//
// Cloud Scheduler (a cada 30 min). Pega cadastros QUENTE/MORNO ENVIADOS e
// qualificados nos últimos ~7 dias que ainda não foram mandados e envia UM
// evento LeadQualificado por lead ao Pixel (POST /{PIXEL_ID}/events).
// Objetivo: ensinar o algoritmo do Meta o que é lead BOM e, depois, otimizar
// campanha por esse evento em vez de "Lead" bruto. FRIO/INVALIDO/INCOMPLETO
// nunca saem.
//
// NÃO é outreach: não fala com o lead, não depende do gate de aprovação
// (o sinal é a classificação da IA — o Meta só aceita evento de até 7 dias).
//
// Travas:
//   - Auth fail-closed (x-webhook-secret).
//   - Sem META_PIXEL_ID + META_CAPI_TOKEN = não envia nada (heartbeat
//     configurado=false). Config manual, pós-deploy.
//   - Fora de PRD (schema ≠ public) SÓ envia com META_TEST_EVENT_CODE.
//   - Modo TESTE nunca consome o lead: depois do envio de teste ele volta à
//     fila — tirar o código de teste manda os eventos reais da janela.
//   - Exatamente-uma-vez: CAS em meta_capi_lq_sent_at com erro='em_envio'
//     (marca ANTES de enviar). Marca 'em_envio' com 15 min+ = execução que
//     morreu no meio → é retomada (event_id = lq_<id> deduplica no Meta).
//   - Disjuntor: erro de credencial/Pixel ou Meta fora PARA o tick sem gastar
//     tentativa de ninguém (senão uma pane de 2h queimaria a fila inteira).
//     Só recusa do DADO de um lead gasta tentativa (teto 5).
//   - Token no header Authorization (nunca na URL, nunca no log).
//   - Dados de MENOR (atleta) nunca saem — ver capi.js.
//
// Sinal observável: heartbeat configuracoes_sistema.meta_capi_last_tick_at
// (check meta_capi_frescor no monitor-health e na /observabilidade).
// ════════════════════════════════════════════════════════════════════════

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';
const META_PIXEL_ID = process.env.META_PIXEL_ID;
const META_CAPI_TOKEN = process.env.META_CAPI_TOKEN;
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || null;
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';

const MAX_TENTATIVAS = 5;
const LOTE_MAX = 50;
const ERRO_MAX = 300;
const PIXEL_ID_RE = /^\d{5,20}$/;
const EM_ENVIO = 'em_envio';
const TESTE_ENVIADO = 'teste_enviado';
const RETOMADA_MS = 15 * 60 * 1000;
// Timeout da CF = 300s: para de pegar lead novo bem antes de ser morta.
const ORCAMENTO_MS = 200 * 1000;
const TIMEOUT_SUPABASE_MS = 20 * 1000;
const TIMEOUT_META_MS = 15 * 1000;

// SELECT explícito: só o que o evento usa (sem campos do atleta além do
// WhatsApp, que serve APENAS para descartar o fallback no telefone do responsável).
const COLUNAS = [
  'id',
  'qualification_classification',
  'qualified_at',
  'submitted_at',
  'email',
  'guardian_email',
  'guardian_email_2',
  'guardian_name',
  'guardian_whatsapp',
  'guardian_whatsapp_2',
  'athlete_whatsapp',
  'address_city',
  'address_state',
  'address_cep',
  'address_country',
  'landing_url',
  'user_agent',
  'ip_address',
  'meta_fbp',
  'meta_fbc',
  'meta_capi_lq_tentativas',
].join(',');

const log = (level, action, details = {}) => console.log(JSON.stringify({ level, action, ...details }));

const httpRequest = (url, options, postData, timeoutMs = TIMEOUT_SUPABASE_MS) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: options.method || 'GET', headers: options.headers || {} },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: b }));
      },
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timeout (${timeoutMs / 1000}s)`));
    });
    if (postData) req.write(postData);
    req.end();
  });

const supaHeaders = (escrita) => ({
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  [escrita ? 'Content-Profile' : 'Accept-Profile']: SUPABASE_SCHEMA,
});

/** PATCH em 1 cadastro com filtros extras (CAS). Devolve as linhas afetadas. */
const patchLead = async (id, filtrosExtras, campos) => {
  const body = JSON.stringify(campos);
  const r = await httpRequest(
    `${SUPABASE_URL}/rest/v1/form_submissions?id=eq.${encodeURIComponent(id)}${filtrosExtras}&select=id`,
    {
      method: 'PATCH',
      headers: { ...supaHeaders(true), 'Content-Length': Buffer.byteLength(body), Prefer: 'return=representation' },
    },
    body,
  );
  if (r.statusCode >= 400) throw new Error(`Supabase PATCH ${r.statusCode}: ${r.body.slice(0, 200)}`);
  return JSON.parse(r.body || '[]');
};

/** Livre = nunca marcado OU marca 'em_envio' de execução que morreu (15 min+). */
const filtroLivre = (agoraMs) =>
  `&or=(meta_capi_lq_sent_at.is.null,and(meta_capi_lq_erro.eq.${EM_ENVIO},` +
  `meta_capi_lq_sent_at.lt.${new Date(agoraMs - RETOMADA_MS).toISOString()}))`;

const buscarCandidatos = async (agoraMs) => {
  const desde = encodeURIComponent(new Date(agoraMs - JANELA_MAX_MS).toISOString());
  const url =
    `${SUPABASE_URL}/rest/v1/form_submissions?select=${COLUNAS}` +
    `&qualification_classification=in.(${CLASSES_QUALIFICADAS.join(',')})` +
    `&qualified_at=gte.${desde}` +
    // Requalificação renova qualified_at de cadastro antigo: a janela vale
    // também para o ENVIO do formulário.
    `&submitted_at=gte.${desde}` +
    filtroLivre(agoraMs) +
    `&meta_capi_lq_tentativas=lt.${MAX_TENTATIVAS}` +
    `&deleted_at=is.null` +
    `&order=qualified_at.asc&limit=${LOTE_MAX}`;
  const r = await httpRequest(url, { method: 'GET', headers: supaHeaders(false) });
  if (r.statusCode >= 400) throw new Error(`Supabase GET candidatos ${r.statusCode}: ${r.body.slice(0, 200)}`);
  return JSON.parse(r.body || '[]');
};

const enviarEvento = async (evento) => {
  const corpo = { data: [evento] };
  if (META_TEST_EVENT_CODE) corpo.test_event_code = META_TEST_EVENT_CODE;
  const postData = JSON.stringify(corpo);
  let r;
  try {
    r = await httpRequest(
      `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PIXEL_ID}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${META_CAPI_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      postData,
      TIMEOUT_META_MS,
    );
  } catch (e) {
    return { ok: false, tipo: 'transitorio', erro: e.message };
  }
  if (r.statusCode >= 400) {
    return { ok: false, tipo: classificarErroMeta(r.statusCode, r.body), erro: resumirErroMeta(r.statusCode, r.body) };
  }
  let json = {};
  try {
    json = JSON.parse(r.body || '{}');
  } catch {
    return { ok: false, tipo: 'transitorio', erro: 'resposta do Meta ilegível' };
  }
  if (json.events_received !== 1) {
    return { ok: false, tipo: 'dado', erro: `events_received=${json.events_received ?? 'ausente'}` };
  }
  return { ok: true, fbtraceId: json.fbtrace_id || null };
};

/** Heartbeat anterior — só para carregar `ja_configurado` (fail-open → {}). */
const lerTickAnterior = async () => {
  try {
    const r = await httpRequest(
      `${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=eq.meta_capi_last_tick_at&select=valor`,
      { method: 'GET', headers: supaHeaders(false) },
    );
    if (r.statusCode >= 400) return {};
    const linhas = JSON.parse(r.body || '[]');
    return (Array.isArray(linhas) && linhas[0] && linhas[0].valor) || {};
  } catch {
    return {};
  }
};

// Heartbeat (TODO tick, mesmo sem config/candidatos). FAIL-OPEN: telemetria
// nunca derruba o envio. Só agregados — nada de lead aqui.
const registrarTick = async (resumo) => {
  try {
    const anterior = await lerTickAnterior();
    const postData = JSON.stringify({
      valor: {
        at: new Date().toISOString(),
        // Já esteve configurada alguma vez? Se a config SUMIR depois (redeploy
        // sem o token), o monitor acusa em vez de "pular" para sempre.
        ja_configurado: anterior.ja_configurado === true || resumo.configurado === true,
        ...resumo,
      },
    });
    const r = await httpRequest(
      `${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=eq.meta_capi_last_tick_at`,
      {
        method: 'PATCH',
        headers: { ...supaHeaders(true), 'Content-Length': Buffer.byteLength(postData), Prefer: 'return=minimal' },
      },
      postData,
    );
    if (r.statusCode >= 400) log('WARN', 'meta_capi_tick_save_failed', { statusCode: r.statusCode });
  } catch (e) {
    log('WARN', 'meta_capi_tick_save_failed', { error: e.message });
  }
};

/** Devolve o lead à fila sem gastar tentativa (pane do Meta / config / teste). */
const devolverSemGastar = (id, erro) =>
  patchLead(id, '', { meta_capi_lq_sent_at: null, meta_capi_lq_erro: erro ? String(erro).slice(0, ERRO_MAX) : null });

/**
 * Processa 1 lead. Retorna { resultado, interromper?, erro? }:
 *   resultado ∈ enviado | teste | falha | descartado | adiado | pulado | simulado
 *   interromper ∈ 'config' | 'transitorio' (para o tick inteiro)
 */
const processarLead = async (lead, agoraMs, dryRun) => {
  const { evento, erro } = montarEvento(lead, agoraMs);
  if (erro && MOTIVOS_ADIAR.has(erro)) return { resultado: 'adiado' };
  if (erro) {
    if (!dryRun) {
      // Descarte PERMANENTE: esgota as tentativas para o lead sair da fila.
      await patchLead(lead.id, filtroLivre(agoraMs), {
        meta_capi_lq_tentativas: MAX_TENTATIVAS,
        meta_capi_lq_erro: `${PREFIXO_DESCARTE}${erro}`,
      });
    }
    log('INFO', 'meta_capi_descartado', { submissionId: lead.id, motivo: erro });
    return { resultado: 'descartado' };
  }
  if (dryRun) return { resultado: 'simulado' };

  // CAS: marca ANTES de enviar. Vazio = outra execução levou o lead.
  const tomado = await patchLead(
    lead.id,
    `${filtroLivre(agoraMs)}&meta_capi_lq_tentativas=lt.${MAX_TENTATIVAS}`,
    { meta_capi_lq_sent_at: new Date().toISOString(), meta_capi_lq_erro: EM_ENVIO },
  );
  if (tomado.length === 0) {
    log('INFO', 'meta_capi_cas_perdido', { submissionId: lead.id });
    return { resultado: 'pulado' };
  }

  const r = await enviarEvento(evento);

  if (r.ok && META_TEST_EVENT_CODE) {
    // Modo teste: o evento foi para "Testar eventos" — o lead NÃO é consumido.
    await devolverSemGastar(lead.id, TESTE_ENVIADO);
    log('INFO', 'meta_capi_teste_enviado', { submissionId: lead.id, fbtraceId: r.fbtraceId });
    return { resultado: 'teste' };
  }

  if (r.ok) {
    try {
      await patchLead(lead.id, '', { meta_capi_lq_erro: null });
    } catch (e) {
      // O evento JÁ saiu: falhar aqui só deixa 'em_envio' — a retomada reenvia
      // em 15 min e o Meta deduplica pelo event_id. Não é falha de envio.
      log('WARN', 'meta_capi_confirmacao_falhou', { submissionId: lead.id, error: e.message });
    }
    log('INFO', 'meta_capi_enviado', {
      submissionId: lead.id,
      classe: lead.qualification_classification,
      fbtraceId: r.fbtraceId,
      comFbc: Boolean(evento.user_data.fbc),
      comFbp: Boolean(evento.user_data.fbp),
      comIp: Boolean(evento.user_data.client_ip_address),
    });
    return { resultado: 'enviado' };
  }

  if (r.tipo === 'config' || r.tipo === 'transitorio') {
    // Não é culpa deste lead: devolve sem gastar tentativa e para o tick.
    await devolverSemGastar(lead.id, r.erro);
    log('ERROR', 'meta_capi_interrompido', { submissionId: lead.id, tipo: r.tipo, erro: r.erro });
    return { resultado: 'falha', interromper: r.tipo, erro: r.erro };
  }

  // Recusa do DADO deste lead: devolve à fila com +1 tentativa (o CAS acima
  // garante que só esta execução segura o lead).
  const tentativas = (Number(lead.meta_capi_lq_tentativas) || 0) + 1;
  await patchLead(lead.id, '', {
    meta_capi_lq_sent_at: null,
    meta_capi_lq_tentativas: tentativas,
    meta_capi_lq_erro: String(r.erro).slice(0, ERRO_MAX),
  });
  log('ERROR', 'meta_capi_falhou', { submissionId: lead.id, tentativas, erro: r.erro });
  return { resultado: 'falha', erro: r.erro };
};

functions.http('metaCapi', async (req, res) => {
  // Auth FAIL-CLOSED: o job do Cloud Scheduler manda x-webhook-secret.
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false, error: 'Unauthorized' });
  }

  const dryRun = req.body?.dry_run === true;
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Supabase não configurado');

    const configurado = Boolean(META_PIXEL_ID && META_CAPI_TOKEN && PIXEL_ID_RE.test(String(META_PIXEL_ID)));
    if (!configurado) {
      log('INFO', 'meta_capi_nao_configurado');
      if (!dryRun) await registrarTick({ configurado: false });
      return res.status(200).send({ success: true, skipped: 'nao_configurado' });
    }
    // UAT/DEV nunca manda evento REAL para o Pixel de produção.
    if (SUPABASE_SCHEMA !== 'public' && !META_TEST_EVENT_CODE) {
      log('WARN', 'meta_capi_fora_de_prd_sem_test_code', { schema: SUPABASE_SCHEMA });
      if (!dryRun) await registrarTick({ configurado: false, motivo: 'fora_de_prd_sem_test_code' });
      return res.status(200).send({ success: true, skipped: 'fora_de_prd_sem_test_code' });
    }

    const inicio = Date.now();
    const candidatos = await buscarCandidatos(inicio);
    const contagem = { enviado: 0, teste: 0, falha: 0, descartado: 0, adiado: 0, pulado: 0, simulado: 0 };
    let interrompido = null;
    let ultimoErro = null;
    let restantes = 0;
    for (let i = 0; i < candidatos.length; i++) {
      if (Date.now() - inicio > ORCAMENTO_MS) {
        restantes = candidatos.length - i;
        log('WARN', 'meta_capi_orcamento_esgotado', { restantes });
        break;
      }
      const lead = candidatos[i];
      try {
        const r = await processarLead(lead, Date.now(), dryRun);
        contagem[r.resultado] += 1;
        if (r.erro) ultimoErro = r.erro;
        if (r.interromper) {
          interrompido = r.interromper;
          restantes = candidatos.length - i - 1;
          break;
        }
      } catch (e) {
        contagem.falha += 1;
        ultimoErro = e.message;
        log('ERROR', 'meta_capi_lead_erro', { submissionId: lead.id, error: e.message });
      }
    }

    const resumo = {
      configurado: true,
      teste: Boolean(META_TEST_EVENT_CODE),
      candidatos: candidatos.length,
      enviados: contagem.enviado,
      testes: contagem.teste,
      falhas: contagem.falha,
      descartados: contagem.descartado,
      interrompido,
      ultimo_erro: ultimoErro ? String(ultimoErro).slice(0, ERRO_MAX) : null,
    };
    if (!dryRun) await registrarTick(resumo);
    log('INFO', 'meta_capi_tick', { ...resumo, dryRun, restantes, adiados: contagem.adiado, simulados: contagem.simulado });
    return res.status(200).send({ success: true, dryRun, ...resumo, restantes, simulados: contagem.simulado });
  } catch (error) {
    log('ERROR', 'meta_capi_failed', { error: error.message });
    return res.status(500).send({ success: false, error: error.message });
  }
});
