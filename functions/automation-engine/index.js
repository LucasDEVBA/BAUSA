/**
 * automation-engine — executa as automações criadas no BAU Engine (/automacoes).
 *
 * Trigger: Cloud Scheduler (1x/hora). Fluxo por tick:
 *   1. Materializa gatilhos de TEMPO (deal parado, parcela vencendo/atrasada,
 *      família sem contato, tarefa vencida, etapa de onboarding atrasada) em
 *      automacao_runs 'pendente' — com dedup one-shot por (automacao, origem).
 *      O gatilho 'agendamento' (recorrente diário/semanal/mensal em hora BRT
 *      fixa) usa dedup POR PERÍODO (bucket em contexto->>periodo) e
 *      materializa runs SEM origem. Gatilhos de EVENTO (lead qualificado,
 *      etapa de deal, temperatura vermelha, NPS registrado, crise, indicação
 *      convertida) são materializados por trigger no banco.
 *   2. Processa a fila de runs (pendente + erro com retry vencido) com CAS
 *      atômico; avalia condições; executa ações; grava resultado.
 *   3. Ação ia_prompt (Gemini): retry+fallback+deadline por run e teto
 *      IA_MAX_PER_TICK; o texto vira notificação/tarefa interna — a IA NUNCA
 *      envia mensagem externa (guard tests/automation-engine-ia.test.js).
 *
 * INVARIANTES (skill bausa-scheduler-safety — guard de CI):
 *   - Ação enviar_whatsapp reaplica elegibilidade: FRIO NUNCA recebe —
 *     qualification_classification IN ('QUENTE','MORNO') sempre; timing por
 *     template (ideal vs alternativo, nunca misturados); follow-ups exigem
 *     meeting_scheduled IS NOT TRUE; colunas *_sent_at com CAS no lead.
 *     A engine espaça envios de leads distintos (45-60s anti-ban); o
 *     send-whatsapp cuida do delay atleta↔responsável do mesmo lead.
 *   - Ação enviar_whatsapp_custom (texto livre ao responsável) reaplica a
 *     MESMA regra de classe: ['QUENTE','MORNO'] obrigatório — FRIO NUNCA
 *     recebe, nem mensagem custom (guard de CI cobre a cláusula).
 *   - Ação enviar_email_custom (texto livre por e-mail, via caminho
 *     customEmail do send-messages) reaplica a MESMA regra de classe —
 *     FRIO nunca recebe outreach automático por nenhum canal (guard de CI
 *     cobre a cláusula). Sem delay anti-ban: e-mail não tem risco de ban.
 *   - CAS antes de qualquer efeito: o run é claimado (pendente→executando)
 *     com filtro de status na URL; 0 rows = outra instância venceu → pula.
 */

const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ─── Configuração via variáveis de ambiente ─────────────────────
const WEBHOOK_SECRET       = process.env.WEBHOOK_SECRET;
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SEND_WHATSAPP_URL    = process.env.SEND_WHATSAPP_URL;
const SEND_MESSAGES_URL    = process.env.SEND_MESSAGES_URL;
// Ação ia_prompt (opcional — config manual pós-deploy): sem a key, runs com
// ação de IA marcam erro claro sem afetar as demais automações do tick.
const GEMINI_API_KEY       = process.env.GEMINI_API_KEY;
// Schema do Supabase: 'public' em PRD, 'uat' em UAT, 'dev' em DEV
const SUPABASE_SCHEMA      = process.env.SUPABASE_SCHEMA || 'public';

// Limites do tick (protegem timeout de 540s)
const RUN_LIMIT = 20;              // runs processados por tick
const MATERIALIZE_LIMIT = 100;     // registros elegíveis por automação de tempo
const TICK_BUDGET_MS = 360000;     // 6min — folga p/ o pior caso (POST 90s + delay) caber nos 540s
const ORPHAN_MINUTES = 15;         // run 'executando' sem update há 15min = órfão (crash/timeout)
const WHATSAPP_DELAY_MS = () => 45000 + Math.floor(Math.random() * 15000); // 45-60s anti-ban

// Teto de execuções de IA por tick: cada run de IA custa até IA_DEADLINE_MS —
// acima do teto, o run é ADIADO (fica pendente, sem claim) e roda no próximo
// tick, logando o excedente. Protege o timeout de 540s da engine.
// Conta ia_prompt (ação) E ia_condicao (passo) juntos — ambos consomem a Gemini.
const IA_MAX_PER_TICK = 10;

// Fluxo por PASSOS (ordenado): teto de passos por automação (cabe no tick) —
// espelha PASSOS_MAX do Zod do builder. O teto de passos de IA por automação
// (ia_condicao + ia_prompt) é imposto no Zod (PASSOS_IA_MAX): mantém cada run
// dentro do orçamento de tempo e abaixo do IA_MAX_PER_TICK.
const PASSOS_MAX = 12;

// ─── Log estruturado ────────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// ─── Requisição HTTPS genérica com timeout ──────────────────────
const httpRequest = (url, options, postData) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(options.timeoutMs || 30000, () => {
      req.destroy();
      reject(new Error(`Request timeout (${(options.timeoutMs || 30000) / 1000}s)`));
    });

    if (postData) req.write(postData);
    req.end();
  });
};

// ─── Delay entre envios (anti-ban) ──────────────────────────────
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Cliente Gemini resiliente (ação ia_prompt) ─────────────────
// Port do padrão validado do qualify-lead (chamarModeloGemini +
// callGeminiWithResilience): retry com backoff+jitter em transitórios
// (429/5xx/rede/timeout), fallback p/ modelo GA de capacidade separada e
// DEADLINE por run de IA (IA_DEADLINE_MS) — a engine processa vários runs
// por tick e não pode estourar o próprio timeout (TICK_BUDGET_MS cobre o
// agregado; o teto IA_MAX_PER_TICK limita o total de chamadas).
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const GEMINI_ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
const IA_TIMEOUT_MS = 15000;             // por tentativa
const IA_DEADLINE_MS = 30000;            // orçamento total por run de IA
const IA_MAX_TENTATIVAS_POR_MODELO = 2;
const IA_BACKOFF_BASE_MS = 1000;
const IA_MAX_OUTPUT_TOKENS = 1024;       // texto simples, sem JSON mode
// ia_condicao é um GATE: só precisa de 'SIM'/'NAO'. Teto de saída pequeno +
// thinking DESLIGADO (thinkingBudget:0) — sem isso um modelo com "thinking"
// gastaria todo o orçamento pensando e devolveria texto vazio (gotcha do
// gemini-2.5-*), que o parser leria como não-SIM (fail-closed) e o gate NUNCA
// prosseguiria. Com thinking off, os poucos tokens saem como a resposta.
const IA_CONDICAO_MAX_OUTPUT_TOKENS = 16;
const STATUS_TRANSIENTE = new Set([429, 500, 502, 503, 504]);

// 'retry' → transitório: re-tenta o mesmo modelo (com backoff)
// 'pular' → modelo indisponível (404 model-not-found): próximo modelo já
// 'fatal' → request/credencial inválidos (400/401/403): aborta imediatamente
class GeminiCallError extends Error {
  constructor(message, categoria = 'fatal') {
    super(message);
    this.name = 'GeminiCallError';
    this.categoria = categoria;
  }
}

const iaBackoffMs = (tentativa) => {
  const base = IA_BACKOFF_BASE_MS * 2 ** (tentativa - 1);
  return base + Math.floor(Math.random() * IA_BACKOFF_BASE_MS);
};

const chamarModeloGemini = async (model, postData, timeoutMs) => {
  let result;
  try {
    result = await httpRequest(GEMINI_ENDPOINT(model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeoutMs,
    }, postData);
  } catch (err) {
    // Timeout/erro de rede do httpRequest são transitórios
    throw new GeminiCallError(err.message, 'retry');
  }

  if (result.statusCode >= 400) {
    const body = (result.body || '').trim();
    let categoria;
    if (STATUS_TRANSIENTE.has(result.statusCode)) {
      categoria = 'retry';
    } else if (result.statusCode === 404) {
      // Corpo vazio = rate-limit de edge do free-tier (transitório → retry).
      // Corpo com erro = model-not-found → pula p/ o próximo modelo.
      categoria = body ? 'pular' : 'retry';
    } else {
      categoria = 'fatal';
    }
    throw new GeminiCallError(
      `Gemini HTTP ${result.statusCode}: ${body.substring(0, 200)}`,
      categoria
    );
  }

  return result;
};

const callGeminiWithResilience = async (postData) => {
  const inicio = Date.now();
  const restante = () => IA_DEADLINE_MS - (Date.now() - inicio);
  let ultimoErro = null;

  for (const model of GEMINI_MODELS) {
    for (let tentativa = 1; tentativa <= IA_MAX_TENTATIVAS_POR_MODELO; tentativa++) {
      if (restante() <= 0) {
        log('ERROR', 'ia_deadline_exceeded', { model, deadlineMs: IA_DEADLINE_MS });
        throw ultimoErro || new GeminiCallError('IA excedeu o orçamento de tempo do run', 'retry');
      }
      try {
        const result = await chamarModeloGemini(
          model,
          postData,
          Math.min(IA_TIMEOUT_MS, restante())
        );
        return { result, modelUsed: model };
      } catch (err) {
        const gerr = err instanceof GeminiCallError ? err : new GeminiCallError(err.message, 'retry');
        ultimoErro = gerr;
        if (gerr.categoria === 'fatal') {
          log('ERROR', 'ia_fatal_error', { model, tentativa, error: gerr.message });
          throw gerr;
        }
        if (gerr.categoria === 'pular') {
          log('WARN', 'ia_model_skip', { model, tentativa, error: gerr.message });
          break; // modelo indisponível → próximo modelo já
        }
        log('WARN', 'ia_will_retry', { model, tentativa, error: gerr.message });
        if (tentativa < IA_MAX_TENTATIVAS_POR_MODELO && restante() > IA_BACKOFF_BASE_MS) {
          await delay(Math.min(iaBackoffMs(tentativa), Math.max(0, restante() - 500)));
        }
      }
    }
  }

  log('ERROR', 'ia_exhausted_retries', {
    models: GEMINI_MODELS,
    lastErr: ultimoErro ? ultimoErro.message : null,
  });
  throw ultimoErro || new GeminiCallError('Falha ao chamar a Gemini após retries', 'retry');
};

// ─── Helpers Supabase REST (PostgREST) ──────────────────────────
const sbHeaders = (write = false) => {
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  };
  if (write) {
    headers['Content-Profile'] = SUPABASE_SCHEMA;
    headers['Prefer'] = 'return=representation';
  } else {
    headers['Accept-Profile'] = SUPABASE_SCHEMA;
  }
  return headers;
};

const sbGet = async (pathAndQuery) => {
  const result = await httpRequest(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: 'GET',
    headers: sbHeaders(false),
  });
  if (result.statusCode >= 400) {
    throw new Error(`Supabase GET ${pathAndQuery.split('?')[0]}: ${result.statusCode} ${result.body}`);
  }
  return JSON.parse(result.body);
};

const sbPost = async (table, payload) => {
  const result = await httpRequest(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders(true),
  }, JSON.stringify(payload));
  if (result.statusCode >= 400) {
    throw new Error(`Supabase POST ${table}: ${result.statusCode} ${result.body}`);
  }
  return JSON.parse(result.body);
};

const sbPatch = async (pathAndQuery, payload) => {
  const result = await httpRequest(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: 'PATCH',
    headers: sbHeaders(true),
  }, JSON.stringify(payload));
  if (result.statusCode >= 400) {
    throw new Error(`Supabase PATCH ${pathAndQuery.split('?')[0]}: ${result.statusCode} ${result.body}`);
  }
  return JSON.parse(result.body);
};

// ─── Config da engine (configuracoes_sistema.automacao_engine) ──
const DEFAULT_ENGINE_CONFIG = {
  max_tentativas: 3,
  retry_backoff_min_s: 60,
  retry_backoff_max_s: 3600,
};

const fetchEngineConfig = async () => {
  try {
    const rows = await sbGet('configuracoes_sistema?chave=eq.automacao_engine&select=valor');
    return { ...DEFAULT_ENGINE_CONFIG, ...(rows[0]?.valor || {}) };
  } catch (e) {
    log('WARN', 'engine_config_fallback', { error: e.message });
    return DEFAULT_ENGINE_CONFIG;
  }
};

// ─── Dedup one-shot em lote: origens que JÁ têm run desta automação ──
const fetchExistingOrigens = async (automacaoId, origemIds) => {
  if (origemIds.length === 0) return new Set();
  const rows = await sbGet(
    `automacao_runs?automacao_id=eq.${automacaoId}`
    + `&gatilho_origem_id=in.(${origemIds.join(',')})`
    + '&select=gatilho_origem_id'
  );
  return new Set(rows.map((r) => r.gatilho_origem_id));
};

// ─── Materialização dos gatilhos de TEMPO ───────────────────────
const isoDaysAgo = (dias) => new Date(Date.now() - dias * 86400000).toISOString();
// Datas de vencimento (DATE) comparam em BRT — sem o offset, entre 21h e
// meia-noite BRT a data UTC já virou e a régua D-N adiantaria/perderia 1 dia.
const BRT_OFFSET_MS = 3 * 3600 * 1000;
const dateInDays = (dias) => new Date(Date.now() - BRT_OFFSET_MS + dias * 86400000).toISOString().slice(0, 10);
const todayDate = () => dateInDays(0);

// "Relógio BRT": Date deslocada cujos campos UTC representam o horário de
// parede em Brasília (mesmo truque do dateInDays acima).
const nowBRT = () => new Date(Date.now() - BRT_OFFSET_MS);

// Bucket de semana ISO 8601 ('YYYY-Www') p/ dedup do agendamento semanal.
// Recebe uma Date "relógio BRT" (campos UTC = hora de parede BRT).
const isoWeekBucket = (brt) => {
  const d = new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // quinta-feira da semana ISO
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

// Config numérica {dias} dos finders de janela — default histórico: 1 dia.
const configDias = (config) =>
  Number(config?.dias) > 0 ? Number(config.dias) : 1;

// Cada finder recebe o gatilho_config da automação e retorna
// [{ origemId, tabela, contexto }] de registros elegíveis.
const TIME_TRIGGER_FINDERS = {
  deal_parado_etapa: async (config) => {
    const dias = configDias(config);
    // aguardando_timing fica parado POR DESIGN (retomada em novembro) — excluir.
    const rows = await sbGet(
      'deals?select=id,atleta_id,etapa,responsavel_id,updated_at'
      + '&etapa=not.in.(concluido,perdido,cancelamento_solicitado,projeto_futuro,aguardando_timing)'
      + `&updated_at=lt.${encodeURIComponent(isoDaysAgo(dias))}`
      + `&deleted_at=is.null&limit=${MATERIALIZE_LIMIT}`
    );
    return rows.map((d) => ({
      origemId: d.id,
      tabela: 'deals',
      contexto: {
        deal_id: d.id, atleta_id: d.atleta_id, etapa: d.etapa,
        responsavel_id: d.responsavel_id, dias_parado: dias,
      },
    }));
  },

  parcela_vencendo: async (config) => {
    const dias = configDias(config);
    // Enum status_parcela: previsto|recebido|atrasado|cancelado — cobrança só
    // faz sentido fora de recebido/cancelado (não existe valor 'pago').
    const rows = await sbGet(
      'parcelas?select=id,contrato_id,valor,vencimento,status'
      + '&status=not.in.(recebido,cancelado)&recebido_at=is.null&deleted_at=is.null'
      + `&vencimento=gte.${todayDate()}&vencimento=lte.${dateInDays(dias)}`
      + `&limit=${MATERIALIZE_LIMIT}`
    );
    return rows.map((p) => ({
      origemId: p.id,
      tabela: 'parcelas',
      contexto: {
        parcela_id: p.id, contrato_id: p.contrato_id,
        valor: p.valor, vencimento: p.vencimento,
      },
    }));
  },

  parcela_atrasada: async (config) => {
    const dias = configDias(config);
    const rows = await sbGet(
      'parcelas?select=id,contrato_id,valor,vencimento,status'
      + '&status=not.in.(recebido,cancelado)&recebido_at=is.null&deleted_at=is.null'
      + `&vencimento=lte.${dateInDays(-dias)}`
      + `&limit=${MATERIALIZE_LIMIT}`
    );
    return rows.map((p) => ({
      origemId: p.id,
      tabela: 'parcelas',
      contexto: {
        parcela_id: p.id, contrato_id: p.contrato_id,
        valor: p.valor, vencimento: p.vencimento, dias_atraso: dias,
      },
    }));
  },

  familia_sem_contato: async (config) => {
    const dias = configDias(config);
    const limite = encodeURIComponent(isoDaysAgo(dias));
    const rows = await sbGet(
      'crm_experiencia?select=id,atleta_id,deal_id,fase,status,data_ultimo_contato,created_at'
      + '&fase=neq.encerrado&deleted_at=is.null'
      + `&or=(data_ultimo_contato.lt.${limite},and(data_ultimo_contato.is.null,created_at.lt.${limite}))`
      + `&limit=${MATERIALIZE_LIMIT}`
    );
    return rows.map((e) => ({
      origemId: e.id,
      tabela: 'crm_experiencia',
      contexto: {
        experiencia_id: e.id, atleta_id: e.atleta_id, deal_id: e.deal_id,
        fase: e.fase, status: e.status, dias_sem_contato: dias,
      },
    }));
  },

  tarefa_vencida: async (config) => {
    const dias = configDias(config);
    // criada_automaticamente=false: automação de tarefa vencida NUNCA olha
    // tarefas criadas por automação — evita loop infinito de tarefas.
    const rows = await sbGet(
      'tarefas?select=id,titulo,prioridade,responsavel_id,deal_id,atleta_id,experiencia_id,prazo'
      + '&status=in.(pendente,em_andamento)&criada_automaticamente=eq.false&deleted_at=is.null'
      + `&prazo=lt.${encodeURIComponent(isoDaysAgo(dias))}`
      + `&limit=${MATERIALIZE_LIMIT}`
    );
    return rows.map((t) => ({
      origemId: t.id,
      tabela: 'tarefas',
      contexto: {
        tarefa_id: t.id, tarefa_titulo: t.titulo, prioridade: t.prioridade,
        responsavel_id: t.responsavel_id, deal_id: t.deal_id,
        atleta_id: t.atleta_id, experiencia_id: t.experiencia_id,
      },
    }));
  },

  // Etapa de onboarding com prazo estourado há X dias, ainda pendente/em
  // andamento, de instância ativa (em_andamento, não deletada). Dedup =
  // one-shot por (automacao, etapa) — mesmo mecanismo do deal_parado_etapa
  // (fetchExistingOrigens): a etapa só materializa 1 run por automação, sem
  // coluna nova. Embed aninhado traz atleta/deal/fase da família (contexto
  // compatível com notificação/tarefa e com as ações de lead).
  onboarding_etapa_atrasada: async (config) => {
    const dias = configDias(config);
    const rows = await sbGet(
      'onboarding_etapa_estado?select=id,instancia_id,titulo,ordem,prazo,status,'
      + 'onboarding_instancias!inner(experiencia_id,responsavel_id,status,deleted_at,'
      + 'crm_experiencia(atleta_id,deal_id,fase))'
      + '&status=in.(pendente,em_andamento)'
      + `&prazo=lt.${encodeURIComponent(isoDaysAgo(dias))}`
      + '&onboarding_instancias.status=eq.em_andamento'
      + '&onboarding_instancias.deleted_at=is.null'
      + `&limit=${MATERIALIZE_LIMIT}`
    );
    return rows.map((e) => {
      const inst = e.onboarding_instancias || {};
      const exp = inst.crm_experiencia || {};
      return {
        origemId: e.id,
        tabela: 'onboarding_etapa_estado',
        contexto: {
          etapa_estado_id: e.id, instancia_id: e.instancia_id,
          etapa_titulo: e.titulo, etapa_ordem: e.ordem, prazo: e.prazo,
          experiencia_id: inst.experiencia_id, responsavel_id: inst.responsavel_id,
          atleta_id: exp.atleta_id, deal_id: exp.deal_id, fase: exp.fase,
          dias_apos_prazo: dias,
        },
      };
    });
  },

  // Gatilho recorrente genérico (rotinas do CEO): dispara em hora BRT fixa,
  // com frequência diária, semanal (dia_semana 0-6, dom=0) ou mensal
  // (dia_mes 1-28). Dispara SOMENTE quando a hora BRT atual === config.hora —
  // a engine roda no minuto 30 de cada hora, logo há exatamente 1 tick por
  // hora e 1 match por dia. O run NÃO tem lead/deal no contexto: ações de
  // WhatsApp/mover_deal retornam 'ignorado' (sem atleta_id/deal_id) — os usos
  // são criar_tarefa e criar_notificacao (rotinas recorrentes). hitsLoopGuard
  // com origem null retorna false (não bloqueia). Dedup POR PERÍODO (bucket
  // em contexto.periodo) em materializeTimeTriggers — não por origem.
  agendamento: async (config) => {
    const hora = Number(config?.hora);
    if (!Number.isInteger(hora) || hora < 0 || hora > 23) return [];
    const brt = nowBRT(); // campos UTC = relógio de parede BRT
    if (brt.getUTCHours() !== hora) return [];

    const frequencia = config?.frequencia || 'diaria';
    let periodo;
    if (frequencia === 'diaria') {
      periodo = brt.toISOString().slice(0, 10);                  // YYYY-MM-DD
    } else if (frequencia === 'semanal') {
      if (brt.getUTCDay() !== Number(config?.dia_semana)) return [];
      periodo = isoWeekBucket(brt);                               // YYYY-Www
    } else if (frequencia === 'mensal') {
      if (brt.getUTCDate() !== Number(config?.dia_mes)) return [];
      periodo = brt.toISOString().slice(0, 7);                    // YYYY-MM
    } else {
      return [];
    }

    return [{
      origemId: null,
      tabela: null,
      contexto: { periodo, agendamento: true },
    }];
  },
};

// ─── Dedup POR PERÍODO (só gatilho agendamento) ──────────────────
// Runs de agendamento não têm origem — a chave de idempotência é o bucket
// do período (dia/semana/mês BRT) gravado em contexto.periodo. PostgREST
// suporta o filtro JSON contexto->>periodo=eq.<bucket>.
const existsRunNoPeriodo = async (automacaoId, periodo) => {
  const rows = await sbGet(
    `automacao_runs?automacao_id=eq.${automacaoId}`
    + `&contexto->>periodo=eq.${encodeURIComponent(periodo)}`
    + '&select=id&limit=1'
  );
  return rows.length > 0;
};

const materializeTimeTriggers = async (automacoes) => {
  let created = 0;
  for (const auto of automacoes) {
    const finder = TIME_TRIGGER_FINDERS[auto.gatilho];
    if (!finder) continue; // gatilhos de evento são materializados por trigger no banco

    try {
      const candidatos = await finder(auto.gatilho_config || {});

      // Dedup: agendamento não tem origem — dedup pelo bucket do período;
      // os demais gatilhos de tempo deduplicam one-shot por (automacao, origem).
      let elegiveis;
      if (auto.gatilho === 'agendamento') {
        elegiveis = [];
        for (const c of candidatos) {
          if (!(await existsRunNoPeriodo(auto.id, c.contexto.periodo))) elegiveis.push(c);
        }
      } else {
        const jaMaterializados = await fetchExistingOrigens(auto.id, candidatos.map((c) => c.origemId));
        elegiveis = candidatos.filter((c) => !jaMaterializados.has(c.origemId));
      }

      for (const c of elegiveis) {
        await sbPost('automacao_runs', {
          automacao_id: auto.id,
          status: 'pendente',
          gatilho_origem_tabela: c.tabela,
          gatilho_origem_id: c.origemId,
          contexto: c.contexto,
        });
        created++;
      }
      log('INFO', 'time_trigger_materialized', {
        automacao: auto.nome, gatilho: auto.gatilho, candidatos: candidatos.length,
      });
    } catch (e) {
      log('ERROR', 'time_trigger_failed', { automacao: auto.nome, gatilho: auto.gatilho, error: e.message });
    }
  }
  return created;
};

// ─── Avaliação de condições ─────────────────────────────────────
// Resolve o valor de um campo a partir do contexto do run, buscando registros
// relacionados quando necessário (classificação Gemini, plano do contrato...).
const resolveCampo = async (campo, contexto) => {
  if (contexto[campo] !== undefined && contexto[campo] !== null) return contexto[campo];

  if (campo === 'classificacao' && contexto.atleta_id) {
    const rows = await sbGet(`atletas?id=eq.${contexto.atleta_id}&select=classificacao_gemini`);
    return rows[0]?.classificacao_gemini ?? null;
  }
  if (campo === 'etapa' && contexto.deal_id) {
    const rows = await sbGet(`deals?id=eq.${contexto.deal_id}&select=etapa`);
    return rows[0]?.etapa ?? null;
  }
  if (campo === 'plano' && contexto.contrato_id) {
    const rows = await sbGet(`contratos_financeiros?id=eq.${contexto.contrato_id}&select=plano`);
    return rows[0]?.plano ?? null;
  }
  if (campo === 'fase' && contexto.experiencia_id) {
    const rows = await sbGet(`crm_experiencia?id=eq.${contexto.experiencia_id}&select=fase`);
    return rows[0]?.fase ?? null;
  }
  return null;
};

const evaluateCondicoes = async (condicoes, contexto) => {
  for (const cond of condicoes || []) {
    const atual = await resolveCampo(cond.campo, contexto);
    const esperado = cond.valor;
    let ok;
    switch (cond.operador) {
      case 'eq':  ok = String(atual) === String(esperado); break;
      case 'neq': ok = String(atual) !== String(esperado); break;
      case 'in':  ok = Array.isArray(esperado) && esperado.map(String).includes(String(atual)); break;
      case 'gt':  ok = Number(atual) > Number(esperado); break;
      case 'gte': ok = Number(atual) >= Number(esperado); break;
      case 'lt':  ok = Number(atual) < Number(esperado); break;
      case 'lte': ok = Number(atual) <= Number(esperado); break;
      default: ok = false;
    }
    if (!ok) return { pass: false, campo: cond.campo, atual, esperado };
  }
  return { pass: true };
};

// ─── Interpolação simples em títulos/mensagens ──────────────────
const interpolate = async (texto, contexto) => {
  if (!texto || !texto.includes('{atleta_nome}')) return texto;
  if (!contexto.atleta_id) return texto.replace(/\{atleta_nome\}/g, 'atleta');
  try {
    const rows = await sbGet(`atletas?id=eq.${contexto.atleta_id}&select=nome_completo`);
    return texto.replace(/\{atleta_nome\}/g, rows[0]?.nome_completo || 'atleta');
  } catch {
    return texto.replace(/\{atleta_nome\}/g, 'atleta');
  }
};

// ─── Execução das ações ─────────────────────────────────────────
const MODULO_POR_TABELA = {
  deals: 'comercial',
  parcelas: 'financeiro',
  crm_experiencia: 'experiencia',
  tarefas: 'comercial',
  onboarding_etapa_estado: 'experiencia',
  indicacoes: 'comercial',
};

const resolveDestinatarios = async (destinatario, contexto) => {
  if (destinatario === 'responsavel') {
    let responsavelId = contexto.responsavel_id;
    if (!responsavelId && contexto.deal_id) {
      const rows = await sbGet(`deals?id=eq.${contexto.deal_id}&select=responsavel_id`);
      responsavelId = rows[0]?.responsavel_id;
    }
    if (responsavelId) return [responsavelId];
    // fallback: CEO (registro sem responsável não pode perder a notificação)
    destinatario = 'ceo';
  }
  const papelFilter = destinatario === 'ceo' ? 'papel=in.(ceo,cto)' : 'papel=eq.head_sucesso';
  const rows = await sbGet(`user_profiles?${papelFilter}&ativo=eq.true&select=id`);
  return rows.map((r) => r.id);
};

// ─── Ação ia_prompt: contexto factual (whitelist) + nomes do lead ──────────
// Só campos NÃO sensíveis do contexto do run entram no prompt (nunca ids,
// telefone, e-mail, endereço). NUNCA logar o prompt inteiro — só métricas.
const IA_CONTEXTO_CAMPOS = {
  etapa: 'Etapa do deal',
  etapa_de: 'Etapa anterior do deal',
  etapa_para: 'Nova etapa do deal',
  dias_parado: 'Dias parado na etapa',
  fase: 'Fase da experiência',
  status: 'Status da família',
  temperatura_de: 'Temperatura anterior',
  temperatura_para: 'Temperatura atual',
  nps_nota: 'Nota NPS (0-10)',
  indicador_nome: 'Indicador (quem indicou)',
  indicado_nome: 'Indicado (novo lead)',
  valor: 'Valor da parcela (R$)',
  vencimento: 'Vencimento da parcela',
  dias_atraso: 'Dias de atraso',
  dias_sem_contato: 'Dias sem contato',
  tarefa_titulo: 'Tarefa',
  prioridade: 'Prioridade da tarefa',
  etapa_titulo: 'Etapa do onboarding',
  etapa_ordem: 'Ordem da etapa do onboarding',
  prazo: 'Prazo da etapa do onboarding',
  dias_apos_prazo: 'Dias após o prazo',
  status_de: 'Status anterior da indicação',
  status_para: 'Status da indicação',
  periodo: 'Período do agendamento',
};

// ─── Agents de IA: prompt referenciado por agent_id (cache por tick) ─────
// Plataforma de Agents (F5): ação ia_prompt e passo ia_condicao podem apontar
// um agent CUSTOM (tabela agents) — o prompt do agent substitui as instruções
// inline. Filtro SEMPRE ativo+deleted_at+capacidade `automacao`; erro/ausência
// → null (o chamador cai no prompt inline — fallback GARANTIDO, o run nunca
// quebra por agent). NUNCA amplia a whitelist de contexto (IA_CONTEXTO_CAMPOS)
// e NUNCA loga o prompt (conteúdo autoral do CEO — só métricas).
const resolveAgentPrompt = async (agentId, cache) => {
  if (!agentId) return null;
  if (Object.prototype.hasOwnProperty.call(cache, agentId)) return cache[agentId];
  let prompt = null;
  try {
    const rows = await sbGet(
      `agents?id=eq.${agentId}&ativo=is.true&deleted_at=is.null`
      + '&capacidades=cs.%7Bautomacao%7D&select=prompt'
    );
    prompt = (rows[0] && typeof rows[0].prompt === 'string' && rows[0].prompt.trim()) || null;
  } catch (e) {
    log('WARN', 'agent_lookup_failed', { agentId, error: e.message });
  }
  cache[agentId] = prompt;
  return prompt;
};

// Nomes p/ os placeholders {atleta_nome}/{responsavel_nome} do prompt/título.
const resolveNomesLead = async (contexto) => {
  const nomes = { atleta: null, responsavel: null };
  if (!contexto.atleta_id) return nomes;
  try {
    const rows = await sbGet(`atletas?id=eq.${contexto.atleta_id}&select=nome_completo,form_submission_id`);
    nomes.atleta = rows[0]?.nome_completo || null;
    const fsId = rows[0]?.form_submission_id;
    if (fsId) {
      const fs = await sbGet(`form_submissions?id=eq.${fsId}&select=guardian_name`);
      nomes.responsavel = fs[0]?.guardian_name || null;
    }
  } catch (e) {
    log('WARN', 'ia_nomes_lookup_failed', { error: e.message });
  }
  return nomes;
};

// ─── Passo ia_condicao: a IA decide SIM/NÃO (GATE, fail-closed) ─────────────
// A IA avalia o CONTEXTO factual do registro (MESMA whitelist IA_CONTEXTO_CAMPOS
// + nomes do ia_prompt) + o critério do CEO e responde SIM/NÃO. É DECISÓRIA e
// NUNCA envia nada externo (sem SEND_*/customMessage/customEmail — guard de CI).
// Retorno estritamente booleano: TRUE só se a resposta normalizada começar com
// 'SIM' (ou 'YES'); qualquer outra coisa (ou parse vazio) → FALSE. O ERRO da
// chamada é propagado (throw) para o chamador decidir — que também é
// fail-closed (na dúvida, NÃO prossegue). Conta no MESMO teto IA_MAX_PER_TICK
// (tickState.iaCalls++). Deadline por chamada = IA_DEADLINE_MS (callGemini...).
const avaliarIaCondicao = async (prompt, contexto, tickState) => {
  tickState.iaCalls++;

  const nomes = await resolveNomesLead(contexto);
  const vars = {
    '{atleta_nome}': nomes.atleta || 'atleta',
    '{responsavel_nome}': nomes.responsavel || 'responsável',
  };
  let instrucoes = String(prompt || '');
  for (const [placeholder, valor] of Object.entries(vars)) {
    instrucoes = instrucoes.split(placeholder).join(valor);
  }

  // Bloco de contexto factual — só campos da whitelist (não sensíveis).
  const linhasContexto = [];
  if (nomes.atleta) linhasContexto.push(`Atleta: ${nomes.atleta}`);
  if (nomes.responsavel) linhasContexto.push(`Responsável: ${nomes.responsavel}`);
  for (const [campo, rotulo] of Object.entries(IA_CONTEXTO_CAMPOS)) {
    const v = contexto[campo];
    if (v !== undefined && v !== null && v !== '') linhasContexto.push(`${rotulo}: ${v}`);
  }

  const promptFinal =
    `${instrucoes}\n\n`
    + 'CONTEXTO FACTUAL DO REGISTRO (dados do CRM — use apenas o que for relevante):\n'
    + `${linhasContexto.length > 0 ? linhasContexto.join('\n') : '(sem dados adicionais)'}\n\n`
    + 'Decida objetivamente com base no critério acima e no contexto. '
    + 'Responda APENAS com SIM ou NAO (sem pontuação, sem explicação).';

  const postData = JSON.stringify({
    contents: [{ parts: [{ text: promptFinal }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: IA_CONDICAO_MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  // NUNCA logar o prompt inteiro — só métricas.
  log('INFO', 'ia_condicao_start', { promptChars: promptFinal.length, contextoLinhas: linhasContexto.length });
  const { result, modelUsed } = await callGeminiWithResilience(postData);

  let texto = '';
  try {
    const parsed = JSON.parse(result.body);
    const parts = parsed?.candidates?.[0]?.content?.parts || [];
    texto = parts.map((pt) => pt.text || '').join('').trim();
  } catch (e) {
    texto = ''; // parse inválido → normalizado vazio → FALSE (fail-closed)
  }
  const normalizado = texto.toUpperCase().replace(/[^A-Z]/g, '');
  // Igualdade EXATA (não startsWith): "SIMPLESMENTE"/"SIMILAR" não podem
  // abrir o gate — num gate fail-closed, só "SIM"/"YES" limpo prossegue.
  const passou = normalizado === 'SIM' || normalizado === 'YES';
  log('INFO', 'ia_condicao_done', { modelUsed, passou, resposta: texto.slice(0, 20) });
  return { passou, modelUsed, resposta: texto.slice(0, 40) };
};

// INVARIANTES de elegibilidade do WhatsApp (guard de CI cobre estas cláusulas).
// Espelha as regras dos schedulers: classe Gemini sempre; timing por template;
// casColumn = coluna *_sent_at marcada com CAS ANTES do envio (idempotência no
// LEAD, não só no run — evita duplicar com os schedulers e com retries);
// requires = colunas que precisam estar preenchidas (régua: FU1 exige initial).
// meeting_confirmed NÃO é suportado: o send-whatsapp exige customMessage+phone
// nesse caminho — sem eles, cairia no template initial errado.
const TEMPLATE_TIMING = {
  initial:          { timing: 'ideal', requireNoMeeting: false, casColumn: 'whatsapp_sent_at', requires: [] },
  followup_1:       { timing: 'ideal', requireNoMeeting: true, casColumn: 'followup_1_sent_at', requires: ['whatsapp_sent_at'] },
  followup_2:       { timing: 'ideal', requireNoMeeting: true, casColumn: 'followup_2_sent_at', requires: ['whatsapp_sent_at', 'followup_1_sent_at'] },
  early_potential:  { timing: 'alternativo', requireNoMeeting: false, casColumn: 'whatsapp_sent_at', requires: [] },
  late_timing:      { timing: 'alternativo', requireNoMeeting: false, casColumn: 'whatsapp_sent_at', requires: [] },
  scheduled_return: { timing: 'muito_cedo', requireNoMeeting: false, casColumn: 'scheduled_followup_sent_at', requires: [] },
};

const checkWhatsappEligibility = (submission, template) => {
  // Invariante 1: FRIO NUNCA recebe mensagem automática — nenhum template.
  const classificacao = submission.qualification_classification;
  if (!['QUENTE', 'MORNO'].includes(classificacao)) {
    return { eligible: false, reason: `classificacao ${classificacao || 'ausente'} — só QUENTE/MORNO` };
  }

  // Invariante 2: timing correto por template (fluxos nunca se misturam).
  const rules = TEMPLATE_TIMING[template];
  if (!rules) return { eligible: false, reason: `template não suportado: ${template}` };
  const timing = submission.timing_status;
  if (rules.timing === 'ideal' && !(timing === null || timing === undefined || timing === 'ideal')) {
    return { eligible: false, reason: `timing ${timing} não é ideal` };
  }
  if (rules.timing === 'alternativo' && !['muito_cedo', 'tarde_demais'].includes(timing)) {
    return { eligible: false, reason: `timing ${timing} não é alternativo` };
  }
  if (rules.timing === 'muito_cedo' && timing !== 'muito_cedo') {
    return { eligible: false, reason: `timing ${timing} não é muito_cedo` };
  }
  // scheduled_return respeita a DATA agendada (regra do process-scheduled-followups):
  // "voltamos como combinamos" só depois de scheduled_followup_at.
  if (template === 'scheduled_return') {
    const agendado = submission.scheduled_followup_at;
    if (!agendado || new Date(agendado) > new Date()) {
      return { eligible: false, reason: 'antes da data de retomada agendada (scheduled_followup_at)' };
    }
  }

  // Invariante 3: quem agendou reunião não recebe cobrança de agendamento.
  if (rules.requireNoMeeting && submission.meeting_scheduled === true) {
    return { eligible: false, reason: 'meeting_scheduled = true' };
  }

  // Invariante 4: idempotência no lead — template já enviado não repete,
  // e a régua respeita a ordem (FU1 pressupõe initial; FU2 pressupõe FU1).
  if (submission[rules.casColumn] != null) {
    return { eligible: false, reason: `${rules.casColumn} já preenchido — não repete` };
  }
  for (const col of rules.requires) {
    if (submission[col] == null) {
      return { eligible: false, reason: `${col} ausente — fora da ordem da régua` };
    }
  }

  return { eligible: true, casColumn: rules.casColumn };
};

// CAS canônico no LEAD (padrão markWhatsAppSent/markFollowupSent): marca a
// coluna ANTES do envio com filtro `=is.null` — 0 rows = outra instância
// (ou um scheduler) venceu → pular. Falha posterior não reprocessa.
const claimLeadColumn = async (fsId, column) => {
  const updated = await sbPatch(
    `form_submissions?id=eq.${fsId}&${column}=is.null`,
    { [column]: new Date().toISOString() }
  );
  return Array.isArray(updated) && updated.length > 0;
};

// tickState: estado compartilhado do tick ({ iaCalls }) — conta as execuções
// de IA p/ o teto IA_MAX_PER_TICK (o defer acontece ANTES do claim, no loop).
const executeAcao = async (acao, contexto, runId, tickState) => {
  const p = acao.parametros || {};

  if (acao.tipo === 'criar_tarefa') {
    const titulo = await interpolate(p.titulo, contexto);
    await sbPost('tarefas', {
      titulo,
      descricao: p.descricao || null,
      responsavel_id: p.responsavel_id,
      prazo: new Date(Date.now() + (Number(p.prazo_dias) || 0) * 86400000).toISOString(),
      prioridade: p.prioridade,
      modulo_origem: MODULO_POR_TABELA[contexto.__tabela] || 'comercial',
      deal_id: contexto.deal_id || null,
      atleta_id: contexto.atleta_id || null,
      experiencia_id: contexto.experiencia_id || null,
      criada_automaticamente: true,
      automacao_run_id: runId,
    });
    return { tipo: acao.tipo, status: 'ok', detalhe: titulo };
  }

  if (acao.tipo === 'criar_notificacao') {
    const titulo = await interpolate(p.titulo, contexto);
    const mensagem = await interpolate(p.mensagem, contexto);
    const destinatarios = await resolveDestinatarios(p.destinatario, contexto);
    for (const destinatarioId of destinatarios) {
      await sbPost('notificacoes', {
        destinatario_id: destinatarioId,
        titulo,
        mensagem,
        tipo: 'automacao',
        severidade: p.severidade,
        deal_id: contexto.deal_id || null,
        automacao_run_id: runId,
      });
    }
    return { tipo: acao.tipo, status: 'ok', detalhe: `${destinatarios.length} destinatário(s)` };
  }

  if (acao.tipo === 'enviar_whatsapp') {
    if (!SEND_WHATSAPP_URL) {
      return { tipo: acao.tipo, status: 'erro', detalhe: 'SEND_WHATSAPP_URL não configurada' };
    }
    if (!contexto.atleta_id) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'contexto sem atleta_id' };
    }
    const atletas = await sbGet(`atletas?id=eq.${contexto.atleta_id}&select=form_submission_id`);
    const fsId = atletas[0]?.form_submission_id;
    if (!fsId) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'atleta sem form_submission (cadastro manual)' };
    }
    // SELECT * de propósito: o send-whatsapp usa o registro completo do lead
    // (nome, telefones, timing, agenda) — leitura parcial já causou data loss.
    const submissions = await sbGet(`form_submissions?id=eq.${fsId}&select=*`);
    const submission = submissions[0];
    if (!submission) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'form_submission não encontrada' };
    }

    const elig = checkWhatsappEligibility(submission, p.template);
    if (!elig.eligible) {
      log('INFO', 'whatsapp_skip_eligibility', { runId, template: p.template, reason: elig.reason });
      return { tipo: acao.tipo, status: 'ignorado', detalhe: elig.reason };
    }

    // CAS no lead ANTES do envio — protege contra scheduler concorrente,
    // retry do run e re-disparo da mesma automação.
    if (!(await claimLeadColumn(fsId, elig.casColumn))) {
      log('INFO', 'whatsapp_skip_cas', { runId, template: p.template, casColumn: elig.casColumn });
      return { tipo: acao.tipo, status: 'ignorado', detalhe: `CAS perdido em ${elig.casColumn}` };
    }

    const payload = JSON.stringify({ record: submission, messageType: p.template });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

    const result = await httpRequest(
      SEND_WHATSAPP_URL,
      { method: 'POST', headers, timeoutMs: 90000 },
      payload
    );
    if (result.statusCode >= 400) {
      throw new Error(`send-whatsapp: ${result.statusCode} ${result.body.slice(0, 300)}`);
    }
    return { tipo: acao.tipo, status: 'ok', detalhe: `template ${p.template}` };
  }

  // Texto livre ao RESPONSÁVEL do lead (única opção do MVP). Usa o caminho
  // de mensagem custom do send-whatsapp (messageType meeting_confirmed +
  // customMessage + phone → /send-text a UM telefone, sem template).
  if (acao.tipo === 'enviar_whatsapp_custom') {
    if (!SEND_WHATSAPP_URL) {
      return { tipo: acao.tipo, status: 'erro', detalhe: 'SEND_WHATSAPP_URL não configurada' };
    }
    if (!contexto.atleta_id) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'contexto sem atleta_id' };
    }
    const atletas = await sbGet(`atletas?id=eq.${contexto.atleta_id}&select=form_submission_id`);
    const fsId = atletas[0]?.form_submission_id;
    if (!fsId) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'atleta sem form_submission (cadastro manual)' };
    }
    // SELECT * de propósito: o record completo vai no payload (o send-whatsapp
    // valida athlete_name e reaplica o próprio filtro FRIO como defesa extra).
    const submissions = await sbGet(`form_submissions?id=eq.${fsId}&select=*`);
    const submission = submissions[0];
    if (!submission) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'form_submission não encontrada' };
    }

    // INVARIANTE (guard de CI): FRIO NUNCA recebe mensagem automática —
    // nem texto custom. Mesma cláusula do checkWhatsappEligibility.
    const classificacao = submission.qualification_classification;
    if (!['QUENTE', 'MORNO'].includes(classificacao)) {
      log('INFO', 'whatsapp_custom_skip_classe', {
        runId, classificacao: classificacao || 'ausente',
      });
      return {
        tipo: acao.tipo, status: 'ignorado',
        detalhe: `classificacao ${classificacao || 'ausente'} — só QUENTE/MORNO`,
      };
    }

    // Destinatário MVP: responsável — telefone guardian_whatsapp do lead
    // (mesmo campo que o send-whatsapp usa para o fluxo do responsável).
    const phone = submission.guardian_whatsapp;
    if (!phone) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'lead sem guardian_whatsapp' };
    }

    // Render dos placeholders via split/join (padrão renderTemplate do
    // send-whatsapp). Mensagem vazia após render → nunca envia.
    const vars = {
      '{atleta_nome}': submission.athlete_name || 'Atleta',
      '{responsavel_nome}': submission.guardian_name || 'Responsável',
    };
    let mensagem = String(p.mensagem || '');
    for (const [placeholder, valor] of Object.entries(vars)) {
      mensagem = mensagem.split(placeholder).join(valor);
    }
    if (!mensagem.trim()) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'mensagem vazia' };
    }

    // Idempotência (trade-off documentado): mensagens custom NÃO têm coluna
    // *_sent_at no lead — não há CAS de lead como nos templates. A proteção é
    // run one-shot (dedup na materialização) + CAS do claim do run + loop
    // guard (3+ disparos da mesma origem em 24h). Janela residual: crash
    // entre o POST e o finishRun pode reenviar 1x na recuperação de órfão —
    // aceitável para mensagem informativa. NUNCA usar esta ação no lugar da
    // régua initial/follow-up (essa tem CAS por coluna no lead).
    //
    // Link/mídia opcionais (I2): com link_url o send-whatsapp troca o
    // /send-text pelo /send-link (card clicável com título/imagem — mesmo
    // contrato do sendLink dos templates). Sem link_url, o payload é
    // byte-idêntico ao histórico (fallback /send-text intacto). URLs só
    // seguem se http(s) — Zod valida na entrada; isto protege contra lixo
    // gravado direto no banco (e o send-whatsapp revalida, defesa dupla).
    const httpUrl = (v) =>
      (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) ? v.trim() : undefined;
    const linkUrl = httpUrl(p.link_url);
    const payload = JSON.stringify({
      record: submission,
      messageType: 'meeting_confirmed',
      customMessage: mensagem,
      phone,
      ...(linkUrl ? {
        linkUrl,
        linkTitle: p.link_titulo || undefined,
        linkImage: httpUrl(p.imagem_url),
      } : {}),
    });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

    const result = await httpRequest(
      SEND_WHATSAPP_URL,
      { method: 'POST', headers, timeoutMs: 90000 },
      payload
    );
    if (result.statusCode >= 400) {
      throw new Error(`send-whatsapp (custom): ${result.statusCode} ${result.body.slice(0, 300)}`);
    }
    return { tipo: acao.tipo, status: 'ok', detalhe: 'texto custom ao responsável' };
  }

  // Texto livre por E-MAIL ao responsável do lead. Usa o caminho customEmail
  // do send-messages ({ customEmail: { to, subject, text } } → Resend→Brevo
  // com wrapper HTML leve). Mesma política de classe do WhatsApp custom.
  if (acao.tipo === 'enviar_email_custom') {
    if (!SEND_MESSAGES_URL) {
      return { tipo: acao.tipo, status: 'erro', detalhe: 'SEND_MESSAGES_URL não configurada' };
    }
    if (!contexto.atleta_id) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'contexto sem atleta_id' };
    }
    const atletas = await sbGet(`atletas?id=eq.${contexto.atleta_id}&select=form_submission_id`);
    const fsId = atletas[0]?.form_submission_id;
    if (!fsId) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'atleta sem form_submission (cadastro manual)' };
    }
    // SELECT * de propósito (padrão das ações de mensageria): registro
    // completo do lead — leitura parcial já causou data loss em incidente.
    const submissions = await sbGet(`form_submissions?id=eq.${fsId}&select=*`);
    const submission = submissions[0];
    if (!submission) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'form_submission não encontrada' };
    }

    // INVARIANTE (guard de CI): FRIO NUNCA recebe outreach automático —
    // nem por e-mail. Mesma cláusula do WhatsApp custom, ANTES do POST.
    const classificacao = submission.qualification_classification;
    if (!['QUENTE', 'MORNO'].includes(classificacao)) {
      log('INFO', 'email_custom_skip_classe', {
        runId, classificacao: classificacao || 'ausente',
      });
      return {
        tipo: acao.tipo, status: 'ignorado',
        detalhe: `classificacao ${classificacao || 'ausente'} — só QUENTE/MORNO`,
      };
    }

    // E-mail do lead: campo `email` do form_submission — o campo validado e
    // obrigatório do formulário (mesma extração do send-messages/qualify-lead;
    // guardian_email é opcional e frequentemente igual — dedup same_email).
    const email = submission.email;
    if (!email || !email.includes('@')) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'lead sem e-mail válido' };
    }

    // Render dos placeholders via split/join (padrão do WhatsApp custom) —
    // no assunto E na mensagem. Vazio após render → nunca envia.
    const vars = {
      '{atleta_nome}': submission.athlete_name || 'Atleta',
      '{responsavel_nome}': submission.guardian_name || 'Responsável',
    };
    let assunto = String(p.assunto || '');
    let mensagem = String(p.mensagem || '');
    for (const [placeholder, valor] of Object.entries(vars)) {
      assunto = assunto.split(placeholder).join(valor);
      mensagem = mensagem.split(placeholder).join(valor);
    }
    if (!assunto.trim() || !mensagem.trim()) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'assunto/mensagem vazios' };
    }

    // Idempotência (trade-off documentado, igual ao WhatsApp custom): e-mail
    // custom NÃO tem coluna *_sent_at no lead — não há CAS de lead. A
    // proteção é run one-shot (dedup na materialização) + CAS do claim do
    // run + loop guard (3+ disparos da mesma origem em 24h). Janela residual:
    // crash entre o POST e o finishRun pode reenviar 1x na recuperação de
    // órfão — aceitável para e-mail informativo. Sem delay anti-ban: e-mail
    // não tem risco de ban do WhatsApp (a ação NÃO conta como whatsappSent).
    //
    // Link/mídia opcionais (I2): imageUrl é embutida no topo do corpo e
    // linkUrl vira botão/CTA (rótulo linkTitle) no wrapper HTML do
    // send-messages. Ausentes → payload idêntico ao histórico. URLs só
    // seguem se http(s) — evita 400 (e retry inútil) por lixo no banco;
    // o send-messages revalida e ainda tem guarda de scheme no render.
    const emailHttpUrl = (v) =>
      (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) ? v.trim() : undefined;
    const payload = JSON.stringify({
      customEmail: {
        to: email,
        subject: assunto,
        text: mensagem,
        imageUrl: emailHttpUrl(p.imagem_url),
        linkUrl: emailHttpUrl(p.link_url),
        linkTitle: p.link_titulo || undefined,
      },
    });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    };
    if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;

    const result = await httpRequest(
      SEND_MESSAGES_URL,
      { method: 'POST', headers, timeoutMs: 60000 },
      payload
    );
    if (result.statusCode >= 400) {
      throw new Error(`send-messages (custom): ${result.statusCode} ${result.body.slice(0, 300)}`);
    }
    return { tipo: acao.tipo, status: 'ok', detalhe: 'e-mail custom ao responsável' };
  }

  // Ação de IA (ia_prompt): Gemini gera texto a partir das instruções do CEO
  // + bloco de CONTEXTO factual do registro do run. SEGURANÇA POR DESIGN: o
  // texto gerado NUNCA sai por canal externo — vira notificação in-app ou
  // tarefa interna (o CEO revisa e envia). Por isso este bloco NÃO referencia
  // URL de envio (SEND_*) — guard de CI tests/automation-engine-ia.test.js.
  if (acao.tipo === 'ia_prompt') {
    if (!GEMINI_API_KEY) {
      // Fail-clear: run marca erro com mensagem acionável, sem afetar as
      // demais automações/ações do tick.
      return { tipo: acao.tipo, status: 'erro', detalhe: 'IA não configurada (GEMINI_API_KEY)' };
    }
    tickState.iaCalls++;

    const nomes = await resolveNomesLead(contexto);
    const vars = {
      '{atleta_nome}': nomes.atleta || 'atleta',
      '{responsavel_nome}': nomes.responsavel || 'responsável',
    };
    // Agent plugável (F5): o prompt do agent substitui as instruções inline;
    // agent ausente/inativo/sem a capacidade → fallback GARANTIDO p.prompt.
    const agentPrompt = await resolveAgentPrompt(p.agent_id, tickState.agentCache);
    const agenteFallback = Boolean(p.agent_id) && !agentPrompt;
    if (agenteFallback) log('WARN', 'agent_fallback_prompt', { runId, agentId: p.agent_id });
    let instrucoes = String(agentPrompt || p.prompt || '');
    let titulo = String(p.titulo || '');
    for (const [placeholder, valor] of Object.entries(vars)) {
      instrucoes = instrucoes.split(placeholder).join(valor);
      titulo = titulo.split(placeholder).join(valor);
    }
    if (!instrucoes.trim() || !titulo.trim()) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'prompt/título vazios' };
    }

    // Bloco de contexto factual — só campos da whitelist (não sensíveis)
    const linhasContexto = [];
    if (nomes.atleta) linhasContexto.push(`Atleta: ${nomes.atleta}`);
    if (nomes.responsavel) linhasContexto.push(`Responsável: ${nomes.responsavel}`);
    for (const [campo, rotulo] of Object.entries(IA_CONTEXTO_CAMPOS)) {
      const v = contexto[campo];
      if (v !== undefined && v !== null && v !== '') linhasContexto.push(`${rotulo}: ${v}`);
    }

    const promptFinal =
      `${instrucoes}\n\n`
      + 'CONTEXTO FACTUAL DO REGISTRO (dados do CRM — use apenas o que for relevante):\n'
      + `${linhasContexto.length > 0 ? linhasContexto.join('\n') : '(sem dados adicionais)'}\n\n`
      + 'Responda em português do Brasil, em texto simples e direto (sem JSON, sem tabelas).';

    const postData = JSON.stringify({
      contents: [{ parts: [{ text: promptFinal }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: IA_MAX_OUTPUT_TOKENS },
    });
    // NUNCA logar o prompt inteiro — só métricas de tamanho/modelo.
    log('INFO', 'ia_prompt_start', {
      runId, promptChars: promptFinal.length, contextoLinhas: linhasContexto.length,
    });
    const { result, modelUsed } = await callGeminiWithResilience(postData);

    let texto = '';
    try {
      const parsed = JSON.parse(result.body);
      const parts = parsed?.candidates?.[0]?.content?.parts || [];
      texto = parts.map((pt) => pt.text || '').join('').trim();
    } catch (e) {
      throw new Error(`resposta Gemini inválida: ${e.message}`);
    }
    if (!texto) throw new Error('resposta vazia da IA');
    log('INFO', 'ia_prompt_done', { runId, modelUsed, respostaChars: texto.length });

    const destinatarios = await resolveDestinatarios(p.destinatario, contexto);
    if (destinatarios.length === 0) {
      return { tipo: acao.tipo, status: 'erro', detalhe: 'nenhum usuário ativo para receber o resultado' };
    }

    if (p.resultado === 'tarefa') {
      await sbPost('tarefas', {
        titulo: titulo.slice(0, 200),
        descricao: texto,
        responsavel_id: destinatarios[0],
        prazo: new Date(Date.now() + 2 * 86400000).toISOString(),
        prioridade: 'media',
        modulo_origem: MODULO_POR_TABELA[contexto.__tabela] || 'comercial',
        deal_id: contexto.deal_id || null,
        atleta_id: contexto.atleta_id || null,
        experiencia_id: contexto.experiencia_id || null,
        criada_automaticamente: true,
        automacao_run_id: runId,
      });
      return {
        tipo: acao.tipo, status: 'ok',
        detalhe: `IA (${modelUsed}) → tarefa "${titulo.slice(0, 60)}"`,
        ...(agenteFallback ? { agente_fallback: true } : {}),
      };
    }

    for (const destinatarioId of destinatarios) {
      await sbPost('notificacoes', {
        destinatario_id: destinatarioId,
        titulo: titulo.slice(0, 200),
        mensagem: texto,
        tipo: 'automacao',
        severidade: 'media',
        deal_id: contexto.deal_id || null,
        automacao_run_id: runId,
      });
    }
    return {
      tipo: acao.tipo, status: 'ok',
      detalhe: `IA (${modelUsed}) → notificação (${destinatarios.length} destinatário(s))`,
      ...(agenteFallback ? { agente_fallback: true } : {}),
    };
  }

  if (acao.tipo === 'mover_deal') {
    if (!contexto.deal_id) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'contexto sem deal_id' };
    }
    // next_action obrigatória (regra inviolável nº 2 — o Zod do builder já exige)
    const updated = await sbPatch(`deals?id=eq.${contexto.deal_id}&deleted_at=is.null`, {
      etapa: p.etapa_destino,
      next_action: p.next_action,
      data_proxima_acao: dateInDays(Number(p.proxima_acao_dias) || 0),
    });
    if (!Array.isArray(updated) || updated.length === 0) {
      return { tipo: acao.tipo, status: 'ignorado', detalhe: 'deal não encontrado/deletado' };
    }
    return { tipo: acao.tipo, status: 'ok', detalhe: `→ ${p.etapa_destino}` };
  }

  return { tipo: acao.tipo, status: 'erro', detalhe: 'tipo de ação desconhecido' };
};

// ─── Processamento da fila de runs ──────────────────────────────
const claimRun = async (run) => {
  // CAS atômico: só a instância que fizer o PATCH com o estado atual na URL
  // ganha o run. O filtro de tentativas torna o re-claim de órfãos
  // (executando→executando) atômico também: o primeiro bump invalida o filtro
  // do segundo. 0 rows = outra instância venceu → pular.
  const updated = await sbPatch(
    `automacao_runs?id=eq.${run.id}&status=eq.${run.status}&tentativas=eq.${run.tentativas || 0}`,
    { status: 'executando', tentativas: (run.tentativas || 0) + 1 }
  );
  return Array.isArray(updated) && updated.length > 0;
};

const finishRun = async (runId, status, resultado, proximaTentativa) => {
  await sbPatch(`automacao_runs?id=eq.${runId}`, {
    status,
    resultado,
    executado_at: new Date().toISOString(),
    proxima_tentativa_at: proximaTentativa || null,
  });
};

// Anti-loop de eventos: se a MESMA (automação, origem) já disparou 3+ vezes
// nas últimas 24h (ex.: duas automações de mover_deal em ping-pong), corta.
const LOOP_GUARD_MAX_24H = 3;
const hitsLoopGuard = async (run) => {
  if (!run.gatilho_origem_id) return false;
  const rows = await sbGet(
    `automacao_runs?automacao_id=eq.${run.automacao_id}`
    + `&gatilho_origem_id=eq.${run.gatilho_origem_id}`
    + `&id=neq.${run.id}`
    + `&created_at=gte.${encodeURIComponent(isoDaysAgo(1))}`
    + `&select=id&limit=${LOOP_GUARD_MAX_24H}`
  );
  return rows.length >= LOOP_GUARD_MAX_24H;
};

const retryOrExhaust = async (run, engineConfig, resultado) => {
  const tentativas = (run.tentativas || 0) + 1;
  const esgotado = tentativas >= engineConfig.max_tentativas;
  const backoffS = Math.min(
    engineConfig.retry_backoff_min_s * Math.pow(2, tentativas - 1),
    engineConfig.retry_backoff_max_s
  );
  await finishRun(
    run.id, 'erro',
    { ...resultado, tentativas, esgotado },
    esgotado ? null : new Date(Date.now() + backoffS * 1000).toISOString()
  );
};

// Total de chamadas de IA que UMA automação faz por run — usado no defer do
// teto IA_MAX_PER_TICK ANTES de claimar o run. No fluxo por passos conta
// ia_condicao (gate) + ia_prompt (ação); no legado, só as ações ia_prompt.
const contarChamadasIA = (auto) => {
  if (!auto) return 0;
  const passos = auto.passos || [];
  if (passos.length > 0) {
    return passos.filter(
      (p) => p && (p.tipo === 'ia_condicao' || (p.tipo === 'acao' && p.acao && p.acao.tipo === 'ia_prompt')),
    ).length;
  }
  return (auto.acoes || []).filter((a) => a.tipo === 'ia_prompt').length;
};

// ─── Fluxo por PASSOS (ordenado, novo) ──────────────────────────────────────
// Executa auto.passos na ordem: condicao/ia_condicao que FALHA → run 'ignorado'
// (o fluxo para); acao → executa e continua. Preserva CAS/anti-ban/retry das
// ações (reusa executeAcao). Só é chamado quando auto.passos é não-vazio — sem
// passos, processRun cai no fluxo LEGADO idêntico ao histórico (backward-compat).
const processarPassos = async (run, auto, contexto, engineConfig, tickState) => {
  const resultados = [];
  let houveErro = false;
  let whatsappSent = false;
  // Alguma ação (com possível side-effect externo) já rodou? Se sim, um erro
  // transitório num gate posterior NÃO pode ir p/ retry (re-executaria a ação).
  let acaoJaExecutada = false;

  for (const passo of auto.passos) {
    const tipo = passo && passo.tipo;

    if (tipo === 'condicao') {
      const cond = await evaluateCondicoes([passo.condicao], contexto);
      if (!cond.pass) {
        await finishRun(run.id, 'ignorado', {
          motivo: 'condição do passo não satisfeita',
          campo: cond.campo, valor_atual: cond.atual, valor_esperado: cond.esperado,
          passos: resultados,
        });
        return { outcome: 'ignorado', whatsappSent };
      }
      resultados.push({ tipo: 'condicao', status: 'ok' });

    } else if (tipo === 'ia_condicao') {
      // Fail-clear sem key (mesmo padrão do ia_prompt): erro claro e para.
      if (!GEMINI_API_KEY) {
        resultados.push({ tipo: 'ia_condicao', status: 'erro', detalhe: 'IA não configurada (GEMINI_API_KEY)' });
        houveErro = true;
        break;
      }
      try {
        // Agent plugável (F5): o prompt do agent substitui o critério inline;
        // fallback GARANTIDO para passo.prompt. Gate fail-closed inalterado.
        const gatePrompt = (await resolveAgentPrompt(passo.agent_id, tickState.agentCache)) || passo.prompt;
        const veredito = await avaliarIaCondicao(gatePrompt, contexto, tickState);
        if (!veredito.passou) {
          await finishRun(run.id, 'ignorado', {
            motivo: `IA decidiu NÃO prosseguir${passo.rotulo ? ` (${passo.rotulo})` : ''}`,
            ia_resposta: veredito.resposta, passos: resultados,
          });
          return { outcome: 'ignorado', whatsappSent };
        }
        resultados.push({ tipo: 'ia_condicao', status: 'ok', detalhe: `IA (${veredito.modelUsed}) → SIM` });
      } catch (e) {
        // GATE fail-closed. Se NENHUMA ação rodou ainda, o erro é transitório
        // (Gemini indisponível) e re-tentar é seguro (o gate não tem side-
        // effect) → retryOrExhaust, para não DROPAR o lead em silêncio (um
        // blip de IA parecia um "NÃO" legítimo). Se já houve ação, manter
        // 'ignorado' (reprocessar re-executaria a ação anterior).
        log('WARN', 'ia_condicao_gate_error', { runId: run.id, acaoJaExecutada, error: e.message });
        if (!acaoJaExecutada) {
          await retryOrExhaust(run, engineConfig, {
            motivo: 'IA indisponível no gate (retry seguro — sem ação anterior)',
            erro_ia: e.message, passos: resultados,
          });
          return { outcome: 'erro', whatsappSent };
        }
        await finishRun(run.id, 'ignorado', {
          motivo: 'IA indisponível — gate fail-closed (ação anterior já executada)',
          erro_ia: e.message, passos: resultados,
        });
        return { outcome: 'ignorado', whatsappSent };
      }

    } else if (tipo === 'acao') {
      acaoJaExecutada = true;
      try {
        const r = await executeAcao(passo.acao, contexto, run.id, tickState);
        resultados.push(r);
        if ((r.tipo === 'enviar_whatsapp' || r.tipo === 'enviar_whatsapp_custom') && r.status === 'ok') {
          whatsappSent = true;
        }
        if (r.status === 'erro') houveErro = true;
      } catch (e) {
        houveErro = true;
        const t = passo.acao && passo.acao.tipo;
        resultados.push({ tipo: t, status: 'erro', detalhe: e.message });
        log('ERROR', 'passo_acao_failed', { runId: run.id, automacao: auto.nome, tipo: t, error: e.message });
      }

    } else {
      resultados.push({ tipo: 'desconhecido', status: 'erro', detalhe: `passo inválido: ${tipo}` });
      houveErro = true;
    }
  }

  if (houveErro) {
    await retryOrExhaust(run, engineConfig, { passos: resultados });
    return { outcome: 'erro', whatsappSent };
  }
  await finishRun(run.id, 'sucesso', { passos: resultados });
  return { outcome: 'sucesso', whatsappSent };
};

const processRun = async (run, automacoesById, engineConfig, tickState) => {
  const auto = automacoesById[run.automacao_id];

  if (!auto || !auto.ativo || auto.deleted_at) {
    await finishRun(run.id, 'ignorado', { motivo: 'automação inativa/removida' });
    return { outcome: 'ignorado', whatsappSent: false };
  }

  const contexto = { ...(run.contexto || {}), __tabela: run.gatilho_origem_tabela };

  try {
    // Filtro por etapa do gatilho deal_etapa_mudou (gatilho_config.etapa_para):
    // o trigger do banco materializa TODA transição — com etapa configurada,
    // a automação só roda quando o deal ENTROU naquela etapa. Avaliado ANTES
    // das condições (e do loop guard: é gratuito, sem round-trip ao banco).
    const etapaEsperada =
      auto.gatilho === 'deal_etapa_mudou' ? (auto.gatilho_config || {}).etapa_para : null;
    if (etapaEsperada && String(contexto.etapa_para) !== String(etapaEsperada)) {
      await finishRun(run.id, 'ignorado', {
        motivo: `etapa ${contexto.etapa_para || 'desconhecida'}, automação espera ${etapaEsperada}`,
      });
      return { outcome: 'ignorado', whatsappSent: false };
    }

    if (await hitsLoopGuard(run)) {
      await finishRun(run.id, 'ignorado', { motivo: 'loop_guard: 3+ disparos da mesma origem em 24h' });
      log('WARN', 'loop_guard_hit', { runId: run.id, automacao: auto.nome });
      return { outcome: 'ignorado', whatsappSent: false };
    }

    // Fluxo por PASSOS (novo): intercala condições, condições-IA e ações na
    // ordem do array. Só ativa quando há passos — SEM passos, cai no fluxo
    // LEGADO abaixo (condições → ações) idêntico ao histórico (backward-compat).
    if (Array.isArray(auto.passos) && auto.passos.length > 0) {
      return await processarPassos(run, auto, contexto, engineConfig, tickState);
    }

    const cond = await evaluateCondicoes(auto.condicoes, contexto);
    if (!cond.pass) {
      await finishRun(run.id, 'ignorado', {
        motivo: 'condição não satisfeita',
        campo: cond.campo, valor_atual: cond.atual, valor_esperado: cond.esperado,
      });
      return { outcome: 'ignorado', whatsappSent: false };
    }

    const resultados = [];
    let houveErro = false;
    for (const acao of auto.acoes || []) {
      try {
        resultados.push(await executeAcao(acao, contexto, run.id, tickState));
      } catch (e) {
        houveErro = true;
        resultados.push({ tipo: acao.tipo, status: 'erro', detalhe: e.message });
        log('ERROR', 'acao_failed', { runId: run.id, automacao: auto.nome, tipo: acao.tipo, error: e.message });
      }
    }

    // Custom conta para o delay anti-ban do loop igual aos templates.
    const whatsappSent = resultados.some(
      (r) => (r.tipo === 'enviar_whatsapp' || r.tipo === 'enviar_whatsapp_custom') && r.status === 'ok'
    );

    if (houveErro) {
      await retryOrExhaust(run, engineConfig, { acoes: resultados });
      return { outcome: 'erro', whatsappSent };
    }

    await finishRun(run.id, 'sucesso', { acoes: resultados });
    return { outcome: 'sucesso', whatsappSent };
  } catch (e) {
    // Falha transitória (ex.: 5xx na avaliação de condição) também ganha
    // retry com backoff — sem isso o run morreria na primeira exceção.
    log('ERROR', 'run_failed', { runId: run.id, error: e.message });
    await retryOrExhaust(run, engineConfig, { motivo: e.message });
    return { outcome: 'erro', whatsappSent: false };
  }
};

// ─── Entry point ────────────────────────────────────────────────
functions.http('automationEngine', async (req, res) => {
  // Auth entre serviços — FAIL-CLOSED: sem WEBHOOK_SECRET configurado, rejeita.
  if (!WEBHOOK_SECRET || req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
    log('WARN', 'auth_failed');
    return res.status(401).send({ success: false, error: 'unauthorized' });
  }

  const startedAt = Date.now();
  try {
    const engineConfig = await fetchEngineConfig();

    // Automações ativas (uma vez por tick)
    const automacoes = await sbGet(
      'automacoes?select=id,nome,gatilho,gatilho_config,condicoes,acoes,passos,ativo,deleted_at'
      + '&ativo=is.true&deleted_at=is.null'
    );
    const automacoesById = {};
    for (const a of automacoes) automacoesById[a.id] = a;

    // 1. Materializa gatilhos de tempo
    const materialized = await materializeTimeTriggers(automacoes);

    // 2. Fila: pendentes + erros com retry vencido + órfãos (claimados por um
    //    tick que morreu — crash/timeout — sem update há ORPHAN_MINUTES)
    const nowIso = encodeURIComponent(new Date().toISOString());
    const orphanIso = encodeURIComponent(new Date(Date.now() - ORPHAN_MINUTES * 60000).toISOString());
    const pendentes = await sbGet(
      `automacao_runs?status=eq.pendente&select=*&order=created_at.asc&limit=${RUN_LIMIT}`
    );
    const retries = await sbGet(
      `automacao_runs?status=eq.erro&proxima_tentativa_at=lte.${nowIso}`
      + `&tentativas=lt.${engineConfig.max_tentativas}`
      + `&select=*&order=proxima_tentativa_at.asc&limit=${RUN_LIMIT}`
    );
    const orfaos = await sbGet(
      `automacao_runs?status=eq.executando&updated_at=lt.${orphanIso}`
      + `&tentativas=lt.${engineConfig.max_tentativas}`
      + `&select=*&order=updated_at.asc&limit=${RUN_LIMIT}`
    );
    if (orfaos.length > 0) log('WARN', 'orphan_runs_recovered', { count: orfaos.length });

    // Sweeper de zumbis: run que crashou no ÚLTIMO attempt fica 'executando'
    // com tentativas esgotadas — invisível às filas. Fechar como erro final.
    const zumbis = await sbGet(
      `automacao_runs?status=eq.executando&updated_at=lt.${orphanIso}`
      + `&tentativas=gte.${engineConfig.max_tentativas}`
      + `&select=id&limit=${RUN_LIMIT}`
    );
    for (const z of zumbis) {
      await finishRun(z.id, 'erro', { motivo: 'esgotado após crash (zumbi recuperado pelo sweeper)' });
    }
    if (zumbis.length > 0) log('WARN', 'zombie_runs_closed', { count: zumbis.length });

    const counters = { sucesso: 0, erro: 0, ignorado: 0, skipped_cas: 0, deferred_budget: 0, deferred_ia: 0 };
    // agentCache: prompts de agents resolvidos por agent_id — 1 lookup por
    // agent por tick (inclui o null de "indisponível" p/ não re-consultar).
    const tickState = { iaCalls: 0, agentCache: {} };
    const fila = [...pendentes, ...retries, ...orfaos].slice(0, RUN_LIMIT);
    for (let i = 0; i < fila.length; i++) {
      const run = fila[i];
      // Budget de wall-clock: envios de WhatsApp custam 35-60s cada — parar
      // com folga antes do timeout de 540s; o resto processa no próximo tick.
      if (Date.now() - startedAt > TICK_BUDGET_MS) {
        counters.deferred_budget = fila.length - (counters.sucesso + counters.erro + counters.ignorado + counters.skipped_cas + counters.deferred_ia);
        log('WARN', 'tick_budget_reached', { deferred: counters.deferred_budget });
        break;
      }
      // Teto de IA por tick: run com ação ia_prompt além do orçamento é
      // ADIADO SEM CLAIM (segue pendente/erro-retry) — roda no próximo tick,
      // sem queimar tentativa. Loga o excedente para monitoramento.
      const autoDoRun = automacoesById[run.automacao_id];
      // Conta ia_prompt (ação) E ia_condicao (passo) — ambos chamam a Gemini.
      const iaCount = contarChamadasIA(autoDoRun);
      // Um run cujo iaCount SOZINHO excede o teto do tick nunca caberia →
      // adiá-lo o prende para sempre (nunca claimado). Nesse caso, processa
      // mesmo (aceita overrun pontual — o deadline por run protege o tick).
      // O Zod já limita a 4 IA/automação; isto só ocorre via escrita direta.
      const excedeSozinho = iaCount > IA_MAX_PER_TICK;
      if (iaCount > 0 && !excedeSozinho && tickState.iaCalls + iaCount > IA_MAX_PER_TICK) {
        counters.deferred_ia++;
        log('WARN', 'ia_budget_deferred', {
          runId: run.id, iaCalls: tickState.iaCalls, iaMax: IA_MAX_PER_TICK,
        });
        continue;
      }
      if (!(await claimRun(run))) {
        counters.skipped_cas++;
        continue;
      }
      const { outcome, whatsappSent } = await processRun(run, automacoesById, engineConfig, tickState);
      counters[outcome] = (counters[outcome] || 0) + 1;
      // Anti-ban: espaçar envios de leads distintos (padrão dos schedulers).
      // Sem delay após o último run — não queimar budget dormindo à toa.
      if (whatsappSent && i < fila.length - 1) await delay(WHATSAPP_DELAY_MS());
    }

    const summary = {
      automacoes_ativas: automacoes.length,
      runs_materializados: materialized,
      ...counters,
      durationMs: Date.now() - startedAt,
    };
    log('INFO', 'tick_done', summary);
    return res.status(200).send({ success: true, ...summary });
  } catch (e) {
    log('ERROR', 'unhandled', { error: e.message });
    return res.status(500).send({ success: false, error: e.message });
  }
});
