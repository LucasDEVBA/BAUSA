const functions = require('@google-cloud/functions-framework');
const https = require('https');
const { google } = require('googleapis');

// ─── Configuração via variáveis de ambiente ─────────────────────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
// Schema do Supabase: 'public' em PRD, 'uat' em UAT, 'dev' em DEV
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';
// Runs de observabilidade vão p/ public SEMPRE — o Engine (apps/crm) lê public em todos os ambientes, igual ao whatsapp_mensagens da zapi-inbox. NÃO usar SUPABASE_SCHEMA aqui.
const RUNS_SCHEMA = 'public';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.SERVICE_ACCOUNT_EMAIL;
const RAW_KEY = process.env.SERVICE_ACCOUNT_PRIVATE_KEY || '';
const SERVICE_ACCOUNT_PRIVATE_KEY = RAW_KEY
  .replace(/^["']|["']$/g, '')
  .replace(/\\n/g, '\n')
  .replace(/\\\\n/g, '\n');

// ─── Log estruturado ───────────────────────────────────────────
const log = (level, action, details = {}) => {
  console.log(JSON.stringify({ level, action, ...details }));
};

// ─── Requisição HTTPS genérica com timeout ─────────────────────
// options.timeoutMs: timeout por requisição (default 15s — comportamento
// histórico preservado p/ Supabase/Sheets; a chamada Gemini passa o seu).
const httpRequest = (url, options, postData) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const timeoutMs = options.timeoutMs || 15000;
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'POST',
      headers: options.headers || {},
    };

    const req = https.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('error', (e) => reject(e));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timeout (${Math.round(timeoutMs / 1000)}s)`));
    });

    if (postData) req.write(postData);
    req.end();
  });
};

// ─── Tradução dos códigos de faixa de investimento ────────────
const formatInvestmentRange = (code) => {
  const ranges = {
    '15k-20k':  'US$ 15.000 a US$ 20.000/ano ≈ R$ 7.500 a R$ 10.000/mês',
    '20k-30k':  'US$ 20.000 a US$ 30.000/ano ≈ R$ 10.000 a R$ 15.000/mês',
    '30k-40k':  'US$ 30.000 a US$ 40.000/ano ≈ R$ 15.000 a R$ 20.000/mês',
    '40k-50k':  'US$ 40.000 a US$ 50.000/ano ≈ R$ 20.000 a R$ 25.000/mês',
    '50k-70k':  'US$ 50.000 a US$ 70.000/ano ≈ R$ 25.000 a R$ 35.000/mês',
    'over-70k': 'Acima de US$ 70.000/ano ≈ acima de R$ 35.000/mês',
  };
  return ranges[code] || code || 'Não informado';
};

// ─── Helper: sleep ─────────────────────────────────────────────
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Resiliência da chamada Gemini ─────────────────────────────
// Port do padrão validado do Engine (apps/crm/src/lib/gemini.ts):
//  - retry com backoff exponencial + jitter em erros transitórios
//    (429/5xx/rede/timeout);
//  - fallback para um modelo GA de capacidade separada quando o primário
//    está indisponível (retries esgotados OU 404 model-not-found);
//  - deadline global para caber no timeout da CF (120s no deploy) deixando
//    margem para Supabase/Sheets/auto-promoção CRM depois da chamada.
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest'];
const GEMINI_ENDPOINT = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_TIMEOUT_MS = 20000; // por tentativa
const GEMINI_DEADLINE_MS = 90000; // orçamento total do loop de resiliência
const MAX_TENTATIVAS_POR_MODELO = 2;
const BACKOFF_BASE_MS = 1500;
/** HTTP transitórios que valem re-tentar no MESMO modelo (capacidade/rate). */
const STATUS_TRANSIENTE = new Set([429, 500, 502, 503, 504]);

// Como o laço reage a uma falha:
//   'retry' → capacidade/rede/timeout: re-tenta o mesmo modelo (com backoff)
//   'pular' → modelo indisponível (404 model-not-found): próximo modelo já
//   'fatal' → request/credencial inválidos (400/401/403): aborta imediatamente
class GeminiCallError extends Error {
  constructor(message, categoria = 'fatal') {
    super(message);
    this.name = 'GeminiCallError';
    this.categoria = categoria;
  }
}

// Backoff exponencial com jitter (base ~1.5s: 1.5–3s, depois 3–4.5s…)
const backoffMs = (tentativa) => {
  const base = BACKOFF_BASE_MS * 2 ** (tentativa - 1);
  return base + Math.floor(Math.random() * BACKOFF_BASE_MS);
};

// ─── Uma chamada a um modelo específico (timeout limitado pelo orçamento) ──
// Lança GeminiCallError com a categoria correta (mesma taxonomia do Engine).
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
      // Corpo vazio = rate-limit de edge do free-tier sob rajada (transitório
      // → retry). Corpo com erro = model-not-found → pula p/ o próximo modelo.
      categoria = body ? 'pular' : 'retry';
    } else {
      // 400/401/403… → request/credencial inválidos: definitivo.
      categoria = 'fatal';
    }
    throw new GeminiCallError(
      `Gemini HTTP ${result.statusCode}: ${body.substring(0, 200)}`,
      categoria
    );
  }

  return result;
};

// ─── Loop de resiliência: retry + fallback de modelo + deadline global ─────
// Retorna { result, modelUsed } do primeiro modelo que responder 2xx.
// Se tudo falhar, lança o último erro — o handler marca o lead como
// qualification_pending e o cron/manual reprocessa.
const callGeminiWithResilience = async (postData) => {
  const inicio = Date.now();
  const restante = () => GEMINI_DEADLINE_MS - (Date.now() - inicio);
  let ultimoErro = null;

  for (const model of GEMINI_MODELS) {
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_POR_MODELO; tentativa++) {
      if (restante() <= 0) {
        log('ERROR', 'gemini_deadline_exceeded', { model, deadlineMs: GEMINI_DEADLINE_MS });
        throw ultimoErro || new GeminiCallError('Gemini excedeu o orçamento total de tempo', 'retry');
      }
      try {
        const result = await chamarModeloGemini(
          model,
          postData,
          Math.min(GEMINI_TIMEOUT_MS, restante())
        );
        return { result, modelUsed: model };
      } catch (err) {
        const gerr = err instanceof GeminiCallError ? err : new GeminiCallError(err.message, 'retry');
        ultimoErro = gerr;
        if (gerr.categoria === 'fatal') {
          log('ERROR', 'gemini_fatal_error', { model, tentativa, error: gerr.message });
          throw gerr;
        }
        if (gerr.categoria === 'pular') {
          log('WARN', 'gemini_model_skip', { model, tentativa, error: gerr.message });
          break; // modelo indisponível → próximo modelo já
        }
        // 'retry': backoff antes da próxima tentativa do mesmo modelo (se
        // houver tentativa restante E orçamento p/ esperar + chamar de novo).
        log('WARN', 'gemini_will_retry', { model, tentativa, error: gerr.message });
        if (tentativa < MAX_TENTATIVAS_POR_MODELO && restante() > BACKOFF_BASE_MS) {
          await sleep(Math.min(backoffMs(tentativa), Math.max(0, restante() - 1000)));
        }
      }
    }
    // Esgotou/pulou este modelo → tenta o próximo (capacidade separada).
  }

  log('ERROR', 'gemini_exhausted_retries', {
    models: GEMINI_MODELS,
    lastErr: ultimoErro ? ultimoErro.message : null,
  });
  throw ultimoErro || new GeminiCallError('Falha ao chamar a Gemini após retries', 'retry');
};

// ─── Seções EDITÁVEIS do prompt (defaults byte-idênticos ao histórico) ─────
// Editáveis pelo CEO em /automacoes (configuracoes_sistema.qualificacao_prompt).
// Campo ausente/vazio na config → o default abaixo assume. O bloco DADOS DO
// LEAD, o addressBlock e o FORMATO OBRIGATÓRIO (contrato JSON parseado pelo
// código) permanecem FIXOS no código e não são editáveis.
const PROMPT_DEFAULTS = {
  persona: `Você é um Analista Estratégico de Qualificação da Bolsa Atleta USA.
Sua função é classificar leads com base exclusivamente em:
1. Faixa de investimento anual escolhida
2. Profissão do responsável financeiro
3. Endereço informado (caso necessário)
4. Escola informada (caso necessário)
5. Validação de consistência dos dados`,
  criterio_quente: `1️⃣ QUENTE
Classifique como QUENTE quando:
- A profissão sustenta claramente a faixa escolhida OU a profissão indica capacidade financeira superior à faixa escolhida
- E os dados do formulário NÃO apresentam sinais de preenchimento aleatório (ex: sequências de letras sem sentido, números repetitivos, padrões como "aaaa", "123456", "xxxx", campos incoerentes)
- Se houver qualquer indício de preenchimento aleatório, NÃO pode ser QUENTE`,
  // {criterio_endereco} é substituído pela variante BR/internacional abaixo.
  criterio_morno: `2️⃣ MORNO
Classifique como MORNO quando:
- A profissão não sustenta claramente a faixa escolhida
- {criterio_endereco}
- OU a escola informada é reconhecida como instituição de alto padrão`,
  morno_endereco_br: '- MAS o endereço/cidade informado confirma região de alto padrão / alto poder aquisitivo no Brasil',
  morno_endereco_internacional: '- MAS a cidade ou país informado sugere contexto econômico favorável (ex: cidade de grande porte em país desenvolvido)',
  criterio_frio: `3️⃣ FRIO
Classifique como FRIO quando:
- A profissão não sustenta a faixa escolhida E o endereço não confirma alto padrão E a escola não confirma alto padrão
- OU houver sinais de preenchimento aleatório/inconsistente no formulário`,
  regra_renda_variavel: `PROFISSÕES COM RENDA VARIÁVEL:
Profissões que contenham termos como "analista", "financeiro", "gestor", "marketing", "comercial", "consultor", "corretor", "trader", "assessor" ou equivalentes frequentemente possuem renda total significativamente superior ao salário base, devido a comissões, bônus e variáveis. Analise com atenção o contexto completo antes de classificar como FRIO — um Analista Financeiro ou Gestor Comercial, por exemplo, pode ter renda real muito acima da média do cargo. Em caso de dúvida entre FRIO e MORNO para essas profissões, prefira MORNO.`,
  regras_importantes: `REGRAS IMPORTANTES:
- Não presumir renda
- Não inventar patrimônio
- Avaliar apenas plausibilidade estrutural
- Não considerar desempenho esportivo ou acadêmico para decisão financeira
- A análise deve ser objetiva e criteriosa
- Para leads internacionais (fora do Brasil): não penalize a ausência de bairro, CEP ou estado — esses campos não foram solicitados; baseie a análise em profissão, faixa de investimento e contexto do país/cidade`,
};

// Seção da config quando é string não-vazia; senão o default (fail-open).
const promptSection = (promptCfg, key) => {
  const v = promptCfg ? promptCfg[key] : null;
  return typeof v === 'string' && v.trim() ? v : PROMPT_DEFAULTS[key];
};

// ─── Chamada ao Gemini 2.5 Flash (retry + fallback de modelo) ──
// Resiliência via callGeminiWithResilience: até 2 tentativas por modelo
// (backoff exponencial + jitter), fallback gemini-flash-lite-latest e
// deadline global de 90s. Se tudo falhar, lança erro para que o handler
// marque o lead como `qualification_pending=true` e o cron/manual reprocesse.
// promptCfg: seções editáveis (configuracoes_sistema.qualificacao_prompt);
// {} → prompt byte-idêntico ao histórico.
const qualifyWithGemini = async (leadData, promptCfg = {}) => {
  const isBrazil = !leadData.address_country || leadData.address_country === 'BR';

  // Bloco de endereço adaptado ao país do lead (FIXO — interpolação de dados)
  const addressBlock = isBrazil
    ? `- Endereço: ${[leadData.address_street, leadData.address_number, leadData.address_complement].filter(Boolean).join(', ') || 'Não informado'}
- Bairro: ${leadData.address_neighborhood || 'Não informado'}
- Cidade/Estado: ${[leadData.address_city, leadData.address_state].filter(Boolean).join('/') || 'Não informado'}
- CEP: ${leadData.address_cep || 'Não informado'}`
    : `- País de residência: ${leadData.address_country}
- Cidade: ${leadData.address_city || 'Não informado'}
- Endereço detalhado: não fornecido (lead internacional — campos de bairro, CEP e estado não se aplicam)`;

  // Critério MORNO de endereço adaptado ao contexto do lead (textos editáveis)
  const mornoAddressCriteria = isBrazil
    ? promptSection(promptCfg, 'morno_endereco_br')
    : promptSection(promptCfg, 'morno_endereco_internacional');

  const criterioMorno = promptSection(promptCfg, 'criterio_morno')
    .split('{criterio_endereco}')
    .join(mornoAddressCriteria);

  const prompt = `${promptSection(promptCfg, 'persona')}

DADOS DO LEAD:
- Atleta: ${leadData.athlete_name || 'Não informado'}
- Idade: ${leadData.age || 'Não informado'}
- Email: ${leadData.email || 'Não informado'}
- Posição/Esporte: ${leadData.position || 'Não informado'}
- Faixa de investimento escolhida: ${formatInvestmentRange(leadData.investment_range)}
- Responsável: ${leadData.guardian_name || 'Não informado'}
- Profissão do responsável: ${leadData.guardian_profession || 'Não informado'}
- Escola atual: ${leadData.current_school || 'Não informado'}
- Cidade/Estado da escola: ${leadData.school_city_state || 'Não informado'}
${addressBlock}

CRITÉRIO PRINCIPAL:

${promptSection(promptCfg, 'criterio_quente')}

${criterioMorno}

${promptSection(promptCfg, 'criterio_frio')}

${promptSection(promptCfg, 'regra_renda_variavel')}

${promptSection(promptCfg, 'regras_importantes')}

FORMATO OBRIGATÓRIO DE RESPOSTA — retorne APENAS o JSON abaixo, sem markdown, sem backticks, sem texto adicional:
{"classification":"QUENTE","reason":"Análise objetiva em 2-4 frases","confidence":"ALTA"}

Onde:
- classification: QUENTE, MORNO ou FRIO
- reason: Análise objetiva e criteriosa em 2-4 frases, citando os dados avaliados
- confidence: ALTA, MEDIA ou BAIXA`;

  const postData = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  });

  // Retry + fallback de modelo + deadline global (mesma taxonomia do Engine)
  const { result, modelUsed } = await callGeminiWithResilience(postData);

  const response = JSON.parse(result.body);
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini retornou resposta vazia');
  }

  // Limpa possíveis backticks ou markdown residuais
  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  log('INFO', 'gemini_raw_response', { modelUsed, rawText: cleanText.substring(0, 600) });

  try {
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Nenhum JSON encontrado na resposta');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!['QUENTE', 'MORNO', 'FRIO'].includes(parsed.classification)) {
      throw new Error(`Classificação inválida: ${parsed.classification}`);
    }

    return {
      classification: parsed.classification,
      reason: parsed.reason || 'Sem justificativa',
      confidence: ['ALTA', 'MEDIA', 'BAIXA'].includes(parsed.confidence) ? parsed.confidence : 'MEDIA',
      modelUsed,
    };
  } catch (parseError) {
    log('WARN', 'gemini_parse_fallback', { error: parseError.message, rawText: cleanText.substring(0, 300) });

    if (cleanText.includes('QUENTE')) return { classification: 'QUENTE', reason: cleanText.substring(0, 200), confidence: 'BAIXA', modelUsed };
    if (cleanText.includes('MORNO'))  return { classification: 'MORNO',  reason: cleanText.substring(0, 200), confidence: 'BAIXA', modelUsed };
    if (cleanText.includes('FRIO'))   return { classification: 'FRIO',   reason: cleanText.substring(0, 200), confidence: 'BAIXA', modelUsed };
    return { classification: 'FRIO', reason: 'Não foi possível classificar automaticamente. Revisão manual necessária.', confidence: 'BAIXA', modelUsed };
  }
};

// ─── Atualizar Supabase ────────────────────────────────────────
// Usa id=eq.${submissionId} para evitar problemas de case-sensitivity em email.
// Fallback para email+athlete_name (case-insensitive via ilike) se id ausente.
const updateSupabase = async (submissionId, email, athleteName, qualification, timingStatus = 'ideal', scheduledFollowupAt = null, aprovacaoStatus = null) => {
  // Em caso de sucesso, limpa flags de pendência (caso lead estivesse pendente)
  const patchBody = {
    qualified: qualification.classification !== 'FRIO',
    qualification_classification: qualification.classification,
    qualification_reason: qualification.reason,
    qualification_confidence: qualification.confidence,
    qualified_at: new Date().toISOString(),
    qualification_pending: false,
    last_qualification_error: null,
    timing_status: timingStatus,
  };
  // Gate humano: undefined = NÃO tocar no campo (preserva decisão do CEO em
  // requalificações — achado ALTO da revisão adversarial 2026-08-10); null =
  // limpar (lead requalificado como FRIO sai da fila); string = setar.
  if (aprovacaoStatus !== undefined) {
    patchBody.aprovacao_status = aprovacaoStatus;
  }
  // Só seta scheduled_followup_at quando aplicável (muito_cedo).
  // Para outros timings, mantém o valor existente (não sobrescreve com null
  // caso já tenha sido setado em algum reprocessamento anterior).
  if (scheduledFollowupAt) {
    patchBody.scheduled_followup_at = scheduledFollowupAt;
  }

  let url;
  if (submissionId) {
    url = `${SUPABASE_URL}/rest/v1/form_submissions?id=eq.${encodeURIComponent(submissionId)}`;
  } else {
    // Fallback case-insensitive caso o payload não traga id
    url = `${SUPABASE_URL}/rest/v1/form_submissions`
      + `?email=ilike.${encodeURIComponent((email || '').trim())}`
      + `&athlete_name=ilike.${encodeURIComponent((athleteName || '').trim())}`;
  }

  const postData = JSON.stringify(patchBody);

  log('INFO', 'supabase_patch_attempt', {
    url: url.replace(SUPABASE_SERVICE_KEY, '***'),
    submissionId: submissionId || null,
    email: email,
    body: postData,
  });

  const result = await httpRequest(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Profile': SUPABASE_SCHEMA,
      'Prefer': 'return=representation',
    },
  }, postData);

  log('INFO', 'supabase_patch_response', {
    statusCode: result.statusCode,
    body: result.body.substring(0, 500),
  });

  if (result.statusCode >= 400) {
    throw new Error(`Supabase PATCH ${result.statusCode}: ${result.body}`);
  }

  const responseData = JSON.parse(result.body);
  if (Array.isArray(responseData) && responseData.length === 0) {
    log('WARN', 'supabase_no_rows_matched', { submissionId, email, athlete: athleteName });
    return false;
  }

  return true;
};

// ─── Atualizar Google Sheets ───────────────────────────────────
const updateSheets = async (email, athleteName, qualification) => {
  if (!SPREADSHEET_ID || !SERVICE_ACCOUNT_EMAIL || !SERVICE_ACCOUNT_PRIVATE_KEY) {
    log('WARN', 'sheets_skip', { reason: 'Env vars do Sheets não configuradas' });
    return false;
  }

  const auth = new google.auth.JWT(
    SERVICE_ACCOUNT_EMAIL,
    null,
    SERVICE_ACCOUNT_PRIVATE_KEY,
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });

  // Busca a linha do lead
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Página1!A:AO',
  });

  const rows = response.data.values || [];
  let targetRow = null;

  for (let i = 0; i < rows.length; i++) {
    const rowEmail = (rows[i][8] || '').trim().toLowerCase();  // col I
    const rowName  = (rows[i][4] || '').trim().toLowerCase();  // col E

    if (rowEmail === email.trim().toLowerCase() && rowName === athleteName.trim().toLowerCase()) {
      targetRow = i + 1;
      break;
    }
  }

  if (!targetRow) {
    log('WARN', 'sheets_row_not_found', { email, athleteName });
    return false;
  }

  // Atualiza colunas A (SIM/NÃO) e B (motivo)
  const qualifiedLabel = qualification.classification !== 'FRIO' ? '✅ SIM' : '❌ NÃO';

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Página1!A${targetRow}:B${targetRow}`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[
        qualifiedLabel,
        qualification.reason,
      ]],
    },
  });

  return true;
};

// ─── Mapeamentos para auto-promoção CRM ──────────────────────
const mapInvestmentToEnum = (range) => {
  if (!range) return 'ate_20k';
  const lower = range.toLowerCase();
  if (lower.includes('40') || lower.includes('50') || lower.includes('70') || lower.includes('over')) return '40k_mais';
  if (lower.includes('30')) return '30k_40k';
  if (lower.includes('20')) return '20k_30k';
  return 'ate_20k';
};

const mapInvestmentToValor = (range) => {
  const mapped = mapInvestmentToEnum(range);
  const valores = { '40k_mais': 32000, '30k_40k': 28000, '20k_30k': 22000, 'ate_20k': 16000 };
  return valores[mapped] || 16000;
};

const mapClassificacao = (cls) => {
  if (cls === 'QUENTE') return 'hot';
  if (cls === 'MORNO') return 'warm';
  return 'cold';
};

const mapNivelIngles = (level) => {
  if (!level) return 'basico';
  const lower = level.toLowerCase();
  if (lower.includes('fluent') || lower.includes('fluente')) return 'fluente';
  if (lower.includes('avanc') || lower.includes('advanced')) return 'avancado';
  if (lower.includes('interm')) return 'intermediario';
  if (lower.includes('basic') || lower.includes('basico') || lower.includes('básico')) return 'basico';
  return 'nenhum';
};

const mapDesempenho = (perf) => {
  if (!perf) return 'regular';
  const lower = perf.toLowerCase();
  if (lower.includes('excelent')) return 'excelente';
  if (lower.includes('bom') || lower.includes('good')) return 'bom';
  if (lower.includes('fraco') || lower.includes('weak') || lower.includes('poor')) return 'fraco';
  return 'regular';
};

const mapSchoolYear = (year) => {
  if (!year) return null;
  const lower = year.toLowerCase();
  if (lower.includes('pg') || lower.includes('post') || lower.includes('graduated')) return 'pg_year';
  if (lower.includes('12') || lower.includes('hs_3') || lower.includes('3rd')) return '12th';
  if (lower.includes('11') || lower.includes('hs_2') || lower.includes('2nd')) return '11th';
  if (lower.includes('10') || lower.includes('hs_1') || lower.includes('1st')) return '10th';
  return '9th';
};

// ─── Classifica o timing do atleta baseado em school_year ──────
// Determina se o lead está dentro da janela ideal (high school), cedo
// demais (antes do 7º ano) ou tarde demais (graduado há 2+ anos).
const classifyTiming = (schoolYear) => {
  if (schoolYear === 'before_7th') return 'muito_cedo';
  if (schoolYear === 'graduated_2plus') return 'tarde_demais';
  return 'ideal';
};

// ─── Calcula a data agendada para retomar contato ──────────────
// Para muito_cedo: novembro do ano civil seguinte (1º novembro às 10h BRT).
// Retorna ISO 8601 string ou null se não aplicável.
const computeScheduledFollowupAt = (timingStatus) => {
  if (timingStatus !== 'muito_cedo') return null;
  // 1º de novembro às 13:00 UTC = 10:00 BRT
  const nextYear = new Date().getUTCFullYear() + 1;
  return new Date(Date.UTC(nextYear, 10, 1, 13, 0, 0)).toISOString();
};

// ─── Helper: requisição REST ao Supabase ──────────────────────
const supabaseRequest = async (method, path, body = null, extraHeaders = {}) => {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    ...extraHeaders,
  };

  if (method === 'GET') {
    headers['Accept-Profile'] = SUPABASE_SCHEMA;
  } else {
    headers['Content-Profile'] = SUPABASE_SCHEMA;
    headers['Content-Type'] = 'application/json';
  }

  const postData = body ? JSON.stringify(body) : null;
  if (postData) {
    headers['Content-Length'] = Buffer.byteLength(postData);
  }

  const result = await httpRequest(url, { method, headers }, postData);

  if (result.statusCode >= 400) {
    throw new Error(`Supabase ${method} ${path} -> ${result.statusCode}: ${result.body.substring(0, 300)}`);
  }

  return result.body ? JSON.parse(result.body) : null;
};

// ─── Auto-promoção: cria registros CRM para leads qualificados ─
const autoPromoteToCRM = async (data, classification, reason, confidence, timingStatus = 'ideal') => {
  const submissionId = data.id;
  if (!submissionId) {
    log('WARN', 'crm_skip_no_id', { email: data.email, reason: 'data.id ausente no payload' });
    return null;
  }

  // Verificar se já foi promovido
  const existing = await supabaseRequest(
    'GET',
    `atletas?form_submission_id=eq.${encodeURIComponent(submissionId)}&select=id&limit=1`
  );

  if (Array.isArray(existing) && existing.length > 0) {
    log('INFO', 'crm_already_promoted', { submissionId, atletaId: existing[0].id });
    return null;
  }

  // Step A: Criar endereço (se dados disponíveis) — primeiro para vincular ao responsável
  let enderecoId = null;
  if (data.address_city || data.city_state || data.family_address) {
    try {
      const newEnd = await supabaseRequest('POST', 'enderecos', {
        cidade: data.address_city || data.city_state || 'N/A',
        estado: data.address_state || null,
        cep: data.address_cep || null,
        logradouro: data.address_street || null,
        numero: data.address_number || null,
        complemento: data.address_complement || null,
        bairro: data.address_neighborhood || null,
        pais: data.address_country || 'BR',
      }, { 'Prefer': 'return=representation' });

      if (Array.isArray(newEnd) && newEnd.length > 0) {
        enderecoId = newEnd[0].id;
      }
    } catch (endError) {
      log('WARN', 'crm_endereco_failed', { submissionId, error: endError.message });
    }
  }

  // Step B: Criar ou encontrar responsável (com endereco_id já vinculado)
  const whatsapp = data.guardian_whatsapp || data.email;
  if (!whatsapp) {
    log('WARN', 'crm_skip_no_whatsapp', { submissionId, reason: 'Sem WhatsApp ou email do responsável' });
    return null;
  }

  let responsavelId;
  const existingResp = await supabaseRequest(
    'GET',
    `responsaveis?whatsapp=eq.${encodeURIComponent(whatsapp)}&deleted_at=is.null&select=id,endereco_id&limit=1`
  );

  if (Array.isArray(existingResp) && existingResp.length > 0) {
    responsavelId = existingResp[0].id;
    log('INFO', 'crm_responsavel_found', { submissionId, responsavelId });

    // Se o responsável existente não tinha endereço e agora temos um, vincula
    if (enderecoId && !existingResp[0].endereco_id) {
      try {
        await supabaseRequest(
          'PATCH',
          `responsaveis?id=eq.${responsavelId}`,
          { endereco_id: enderecoId }
        );
        log('INFO', 'crm_responsavel_endereco_linked', { responsavelId, enderecoId });
      } catch (linkError) {
        log('WARN', 'crm_responsavel_endereco_link_failed', { responsavelId, error: linkError.message });
      }
    }
  } else {
    const respPayload = {
      nome: data.guardian_name || 'Responsável',
      email: data.guardian_email || data.email,
      whatsapp: whatsapp,
      profissao: data.guardian_profession,
      parentesco: 'outro',
      consentimento_lgpd: true,
      aceite_whatsapp: true,
      aceite_email: true,
      form_submission_ids: [submissionId],
    };
    if (enderecoId) {
      respPayload.endereco_id = enderecoId;
    }

    const newResp = await supabaseRequest('POST', 'responsaveis', respPayload, {
      'Prefer': 'return=representation',
    });

    if (!Array.isArray(newResp) || newResp.length === 0) {
      throw new Error('Falha ao criar responsável: resposta vazia');
    }
    responsavelId = newResp[0].id;
    log('INFO', 'crm_responsavel_created', { submissionId, responsavelId, enderecoId: enderecoId || null });
  }

  // Step C: Criar atleta (sem endereco_id — endereço pertence ao responsável)
  const atletaPayload = {
    nome_completo: data.athlete_name,
    data_nascimento: data.birth_date || '2008-01-01',
    whatsapp: data.guardian_whatsapp || data.email,
    email: data.email,
    instagram: data.instagram || null,
    esporte: data.position ? 'Futebol' : 'Outro',
    posicao: data.position || null,
    nivel_competitivo: 'base_medio',
    nivel_ingles: mapNivelIngles(data.english_level),
    desempenho_academico: mapDesempenho(data.academic_performance),
    serie_escolar: mapSchoolYear(data.school_year),
    escola_atual: data.current_school || null,
    cidade_estado: data.city_state || data.school_city_state || 'N/A',
    video_highlights_url: data.video_link || null,
    historico_clubes: data.club_history || null,
    conquistas: data.achievements || null,
    momento_inicio: 'proximo_semestre',
    comprometimento: 'medio',
    decisao_familiar: 'em_discussao',
    faixa_investimento: mapInvestmentToEnum(data.investment_range),
    lead_classificacao: mapClassificacao(classification),
    qualificado_gemini: true,
    classificacao_gemini: classification,
    motivo_gemini: reason,
    confianca_gemini: confidence,
    qualificado_gemini_at: new Date().toISOString(),
    lead_score: 0,
    safra: 'fall_2026',
    responsavel_id: responsavelId,
    form_submission_id: submissionId,
    origem: 'formulario_web',
    consentimento_lgpd: true,
  };

  const newAtleta = await supabaseRequest('POST', 'atletas', atletaPayload, {
    'Prefer': 'return=representation',
  });

  if (!Array.isArray(newAtleta) || newAtleta.length === 0) {
    throw new Error('Falha ao criar atleta: resposta vazia');
  }

  const atletaId = newAtleta[0].id;

  // Step D: Criar deal — busca o user com papel 'head_sucesso' (ou primeiro ativo) como responsável default
  let defaultResponsavelId = null;
  try {
    const headUser = await supabaseRequest(
      'GET',
      'user_profiles?papel=eq.head_sucesso&ativo=is.true&select=id&limit=1'
    );
    if (Array.isArray(headUser) && headUser.length > 0) {
      defaultResponsavelId = headUser[0].id;
    } else {
      // Fallback: qualquer user ativo (preferencialmente comercial)
      const anyUser = await supabaseRequest(
        'GET',
        'user_profiles?ativo=is.true&papel=in.(comercial,head_sucesso,ceo)&order=papel.asc&select=id&limit=1'
      );
      if (Array.isArray(anyUser) && anyUser.length > 0) {
        defaultResponsavelId = anyUser[0].id;
      }
    }
  } catch (respError) {
    log('WARN', 'crm_default_responsavel_lookup_failed', { error: respError.message });
  }

  if (!defaultResponsavelId) {
    log('WARN', 'crm_skip_no_responsavel', { submissionId, reason: 'Nenhum user ativo encontrado para atribuir como responsavel do deal' });
    throw new Error('Não há user_profile ativo (head_sucesso/comercial/ceo) para atribuir como responsável do deal');
  }

  // Define etapa/perda/next_action conforme timing_status:
  //   - muito_cedo  → aguardando_timing (visível no Kanban, retorno em nov+1)
  //   - tarde_demais→ perdido + motivo timing (cluster "lead alternativo", fora do Kanban)
  //   - ideal       → lead (fluxo atual)
  const dealPayload = {
    atleta_id: atletaId,
    valor_estimado: mapInvestmentToValor(data.investment_range),
    status_decisao_familia: 'em_discussao',
    safra: 'fall_2026',
    responsavel_id: defaultResponsavelId,
  };

  if (timingStatus === 'muito_cedo') {
    const nextYear = new Date().getUTCFullYear() + 1;
    dealPayload.etapa = 'aguardando_timing';
    dealPayload.probabilidade_fechamento = 5;
    dealPayload.next_action = `Aguardar contato programado em novembro/${nextYear}`;
    dealPayload.data_proxima_acao = `${nextYear}-11-01`;
  } else if (timingStatus === 'tarde_demais') {
    dealPayload.etapa = 'perdido';
    dealPayload.probabilidade_fechamento = 0;
    dealPayload.motivo_perda = 'timing';
    dealPayload.detalhe_perda = 'Concluiu EM há 2+ anos — fora da janela competitiva NCAA/NAIA. Lead alternativo (não exibido no Kanban).';
    dealPayload.pode_reativar = true;
  } else {
    dealPayload.etapa = 'lead';
    dealPayload.probabilidade_fechamento = 10;
  }

  const newDeal = await supabaseRequest('POST', 'deals', dealPayload, { 'Prefer': 'return=representation' });

  if (!Array.isArray(newDeal) || newDeal.length === 0) {
    throw new Error('Falha ao criar deal: resposta vazia');
  }

  const dealId = newDeal[0].id;

  return { submissionId, atletaId, dealId };
};

// ─── Marcar lead como pendente de qualificação ─────────────────
// Chamado após esgotar retries do Gemini. Incrementa attempts,
// atualiza last_qualification_attempt_at, salva último erro.
// O cron diário e o botão manual no War Room reprocessam após 6h.
//
// incrementAttempts=false (skip por TOGGLE desligado em /automacoes): marca
// pendente SEM consumir o orçamento de retries (retry-qualification só
// reprocessa attempts < 10) e SEM tocar last_qualification_attempt_at — na
// reativação o cron pega o lead no primeiro tick, sem cooldown.
const markQualificationPending = async (submissionId, errorMessage, { incrementAttempts = true } = {}) => {
  if (!submissionId) return false;

  let patchFields = {
    qualification_pending: true,
    last_qualification_error: (errorMessage || '').substring(0, 1000),
  };

  if (incrementAttempts) {
    // Lê attempts atual para incrementar
    const existing = await supabaseRequest(
      'GET',
      `form_submissions?id=eq.${encodeURIComponent(submissionId)}&select=qualification_attempts&limit=1`
    );
    const currentAttempts = Array.isArray(existing) && existing.length > 0
      ? (existing[0].qualification_attempts || 0)
      : 0;
    patchFields = {
      ...patchFields,
      qualification_attempts: currentAttempts + 1,
      last_qualification_attempt_at: new Date().toISOString(),
    };
  }

  const patchBody = JSON.stringify(patchFields);

  const result = await httpRequest(
    `${SUPABASE_URL}/rest/v1/form_submissions?id=eq.${encodeURIComponent(submissionId)}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Profile': SUPABASE_SCHEMA,
        'Prefer': 'return=minimal',
      },
    },
    patchBody
  );

  return result.statusCode < 400;
};

// ─── Notificar CEO + Head sobre pendência de qualificação ──────
// Cria registros em `notificacoes` (tabela CRM) para que apareçam
// no sininho do BAUSA Engine para os papéis ceo e head_sucesso.
const notifyQualificationPending = async (leadData, errorMessage) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;

  // Busca users ativos com papel ceo/head_sucesso para notificar
  const users = await supabaseRequest(
    'GET',
    `user_profiles?papel=in.(ceo,head_sucesso)&ativo=is.true&select=id,nome,papel`
  );

  if (!Array.isArray(users) || users.length === 0) {
    log('WARN', 'no_users_to_notify_qualification_pending');
    return;
  }

  const titulo = `Lead aguardando qualificação: ${leadData.athlete_name}`;
  const descricao = `O Gemini retornou erro repetido (tentativas esgotadas nos 2 modelos) ao qualificar este lead. `
    + `Erro: ${(errorMessage || '').substring(0, 300)}. `
    + `O sistema tentará novamente automaticamente em até 6 horas. Você também pode forçar `
    + `o retry manualmente no War Room → "Leads pendentes de qualificação".`;

  for (const user of users) {
    try {
      await supabaseRequest(
        'POST',
        'notificacoes',
        {
          user_id: user.id,
          titulo,
          descricao,
          severidade: 'aviso',
          modulo_origem: 'comercial',
          lida: false,
          link: `/leads?filter=qualification_pending`,
        },
        { 'Prefer': 'return=minimal' }
      );
      log('INFO', 'qualification_pending_notification_sent', { userId: user.id, papel: user.papel });
    } catch (notifErr) {
      log('WARN', 'notification_create_failed', { userId: user.id, error: notifErr.message });
    }
  }
};

// ─── Notificar CEO/CTO sobre lead aguardando aprovação ─────────
// Fila de aprovação manual: lead QUENTE/MORNO pré-qualificado pela IA
// espera decisão humana antes de entrar no pipeline e receber outreach.
const notifyAprovacaoPendente = async (leadData, qualification) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;

  const users = await supabaseRequest(
    'GET',
    `user_profiles?papel=in.(ceo,cto)&ativo=is.true&select=id,nome,papel`
  );

  if (!Array.isArray(users) || users.length === 0) {
    log('WARN', 'no_users_to_notify_aprovacao_pendente');
    return;
  }

  const titulo = `Lead aguardando aprovação: ${leadData.athlete_name}`;
  const descricao = `Pré-qualificação da IA: ${qualification.classification} (confiança ${qualification.confidence}). `
    + `${(qualification.reason || '').substring(0, 200)} `
    + `Aprove ou reprove na fila de aprovações (War Room ou Leads) para liberar o pipeline e o WhatsApp.`;

  for (const user of users) {
    try {
      await supabaseRequest(
        'POST',
        'notificacoes',
        {
          user_id: user.id,
          titulo,
          descricao,
          severidade: 'aviso',
          modulo_origem: 'comercial',
          lida: false,
          link: `/leads?aprovacao=pendente`,
        },
        { 'Prefer': 'return=minimal' }
      );
      log('INFO', 'aprovacao_pendente_notification_sent', { userId: user.id, papel: user.papel });
    } catch (notifErr) {
      log('WARN', 'aprovacao_notification_failed', { userId: user.id, error: notifErr.message });
    }
  }
};

// ─── Config dinâmica das automações de sistema (/automacoes) ───
// sistema_automacoes_ativas: toggles on/off (campo ausente = ATIVA).
// qualificacao_prompt: seções editáveis do prompt (ausente = defaults).
// Config indisponível JAMAIS bloqueia a qualificação — fallback {} (fail-open).
const fetchSistemaConfig = async () => {
  const out = { ativas: {}, promptCfg: {} };
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return out;
  try {
    const rows = await supabaseRequest(
      'GET',
      'configuracoes_sistema?chave=in.(sistema_automacoes_ativas,qualificacao_prompt)&select=chave,valor'
    );
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row.chave === 'sistema_automacoes_ativas' && row.valor && typeof row.valor === 'object') {
          out.ativas = row.valor;
        }
        if (row.chave === 'qualificacao_prompt' && row.valor && typeof row.valor === 'object') {
          out.promptCfg = row.valor;
        }
      }
    }
  } catch (e) {
    log('WARN', 'sistema_config_fallback', { error: e.message });
  }
  return out;
};

// ─── Âncora da automação de SISTEMA (aba Execuções de /automacoes) ─────────
// ID fixo semeado pela migration 20260709220205_automacoes_sistema_runs
// (guard de CI: tests/automacao-runs-sistema.test.js compara CF ↔ migration).
const RUN_QUALIFICACAO_ID = 'a0000000-0000-4000-8000-000000000006';

// ─── Registrar execução em automacao_runs (observabilidade) ────────────────
// SEGURANÇA: runs de sistema nascem SEMPRE em estado TERMINAL (sucesso/erro,
// tentativas=1, proxima_tentativa_at=null) — a automation-engine NUNCA os
// executa (a fila dela só seleciona pendente/erro-com-retry/executando).
// Falha no registro JAMAIS afeta o fluxo principal (WARN e segue).
// PII: contexto/resultado sem telefone/e-mail — só o nome do atleta.
const registrarRunSistema = async ({ automacaoId, ok, lead = null, acoes = [] }) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
    // POST direto (não supabaseRequest): o helper força Content-Profile =
    // SUPABASE_SCHEMA DEPOIS do spread e não dá p/ sobrepor; o run PRECISA ir
    // p/ RUNS_SCHEMA ('public') para o Engine enxergar em todos os ambientes.
    const postData = JSON.stringify({
      automacao_id: automacaoId,
      status: ok ? 'sucesso' : 'erro',
      tentativas: 1,
      proxima_tentativa_at: null,
      executado_at: new Date().toISOString(),
      gatilho_origem_tabela: lead && lead.id ? 'form_submissions' : null,
      gatilho_origem_id: (lead && lead.id) || null,
      contexto: lead ? { athlete_name: lead.athlete_name || null } : {},
      resultado: { acoes },
    });
    const result = await httpRequest(`${SUPABASE_URL}/rest/v1/automacao_runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Profile': RUNS_SCHEMA,
        'Prefer': 'return=minimal',
      },
    }, postData);
    if (result.statusCode >= 400) {
      throw new Error(`POST automacao_runs ${result.statusCode}: ${(result.body || '').substring(0, 200)}`);
    }
  } catch (e) {
    log('WARN', 'run_sistema_fallback', { error: e.message });
  }
};

// ─── Cloud Function principal ──────────────────────────────────
functions.http('qualifyLead', async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // ─── Autenticação via secret compartilhado ──────────────────
  if (WEBHOOK_SECRET) {
    const incoming = req.headers['x-webhook-secret'];
    if (incoming !== WEBHOOK_SECRET) {
      log('WARN', 'auth_failed', { ip: req.ip });
      return res.status(401).send({ success: false, error: 'Unauthorized' });
    }
  }

  const startTime = Date.now();

  try {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY não configurada');
    }

    const payload = req.body;
    const data = payload.record || payload;

    if (!data || !data.email || !data.athlete_name) {
      log('WARN', 'validation_failed', { hasEmail: !!data?.email, hasName: !!data?.athlete_name });
      return res.status(400).send({ success: false, error: 'email e athlete_name obrigatórios' });
    }

    // Config dinâmica: toggle on/off + seções editáveis do prompt (/automacoes)
    const { ativas, promptCfg } = await fetchSistemaConfig();
    if (ativas.qualificacao === false) {
      // Desativada pelo CEO: NÃO qualifica — marca pendente SEM incrementar
      // attempts (não consome o orçamento de 10 retries do cron) para
      // reprocesso quando reativar (o retry-qualification chama esta CF,
      // então o gate cobre o cron também).
      log('WARN', 'qualificacao_desativada_skip', { email: data.email, athlete: data.athlete_name });
      if (data.id && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        try {
          const marked = await markQualificationPending(
            data.id,
            'Automação de qualificação desativada em /automacoes',
            { incrementAttempts: false }
          );
          if (!marked) throw new Error('PATCH pending retornou erro');
        } catch (markErr) {
          // Sem o pending o lead ficaria órfão — 500 faz o webhook re-tentar.
          log('ERROR', 'mark_pending_failed_on_disabled', { error: markErr.message });
          return res.status(500).send({ success: false, error: 'Falha ao marcar pendente (toggle off)' });
        }
      }
      return res.status(200).send({
        success: true,
        action: 'skipped_disabled',
        reason: 'Qualificação desativada em /automacoes — lead marcado como pendente.',
      });
    }

    // Classifica timing antes de chamar Gemini (decisão categórica baseada em school_year)
    const timingStatus = classifyTiming(data.school_year);
    const scheduledFollowupAt = computeScheduledFollowupAt(timingStatus);

    log('INFO', 'qualification_start', {
      email: data.email,
      athlete: data.athlete_name,
      investment: data.investment_range,
      profession: data.guardian_profession,
      school_year: data.school_year,
      timing_status: timingStatus,
      scheduled_followup_at: scheduledFollowupAt,
    });

    // 1. Qualificar com Gemini (retry + fallback de modelo + deadline; prompt editável)
    let qualification;
    try {
      qualification = await qualifyWithGemini(data, promptCfg);
    } catch (geminiErr) {
      // Após esgotar retries + fallback de modelo: marca lead como pendente.
      // Cron diário + botão manual no War Room tentarão novamente.
      log('ERROR', 'gemini_all_retries_failed_marking_pending', {
        email: data.email,
        athlete: data.athlete_name,
        error: geminiErr.message,
      });

      if (data.id && SUPABASE_URL && SUPABASE_SERVICE_KEY) {
        try {
          await markQualificationPending(data.id, geminiErr.message);
          log('INFO', 'qualification_marked_pending', { submissionId: data.id });

          // Notificar CEO + Head para que vejam imediatamente
          await notifyQualificationPending(data, geminiErr.message);
        } catch (markErr) {
          log('WARN', 'mark_pending_failed', { error: markErr.message });
        }
      }

      // Registro em automacao_runs (aba Execuções) — estado TERMINAL (erro).
      // Skip por toggle desligado (skipped_disabled acima) NÃO registra.
      await registrarRunSistema({
        automacaoId: RUN_QUALIFICACAO_ID,
        ok: false,
        lead: data,
        acoes: [{
          tipo: 'qualificacao',
          status: 'falha',
          detalhe: `Gemini indisponível — lead pendente p/ retry: ${(geminiErr.message || '').substring(0, 200)}`,
        }],
      });

      return res.status(202).send({
        success: false,
        action: 'pending_retry',
        reason: 'Gemini indisponível — lead marcado como pendente. Cron diário reprocessará.',
        error: geminiErr.message,
      });
    }

    log('INFO', 'qualification_result', {
      email: data.email,
      athlete: data.athlete_name,
      classification: qualification.classification,
      reason: qualification.reason,
      confidence: qualification.confidence,
      modelUsed: qualification.modelUsed,
    });

    // Gate humano (fila de aprovação): por padrão ATIVO. Com o gate ativo,
    // QUENTE/MORNO nascem aprovacao_status='pendente' — sem promoção ao CRM
    // e sem elegibilidade nos schedulers até o CEO/CTO aprovar no Engine.
    // Toggle aprovacao_manual desligado em /automacoes = fluxo antigo
    // (auto-promoção + 'aprovado' imediato). FRIO nunca entra na fila.
    //
    // REQUALIFICAÇÃO (retry-qualification / recuperação de órfão): uma decisão
    // humana já tomada ('aprovado'/'reprovado') NUNCA é sobrescrita — senão um
    // retry silenciosamente tiraria lead aprovado da elegibilidade ou
    // ressuscitaria lead reprovado na fila (achado ALTO da revisão 2026-08-10).
    const aprovacaoManualDesativada = ativas.aprovacao_manual === false;
    const isQuenteOuMorno = qualification.classification === 'QUENTE' || qualification.classification === 'MORNO';
    const statusAprovacaoAtual = data.aprovacao_status ?? null;
    const decisaoHumanaTomada = statusAprovacaoAtual === 'aprovado' || statusAprovacaoAtual === 'reprovado';
    let aprovacaoStatus; // undefined = não tocar; null = limpar; string = setar
    if (isQuenteOuMorno) {
      aprovacaoStatus = decisaoHumanaTomada
        ? undefined
        : (aprovacaoManualDesativada ? 'aprovado' : 'pendente');
    } else {
      // Requalificado como FRIO: se estava na fila, sai dela (NULL).
      aprovacaoStatus = statusAprovacaoAtual === 'pendente' ? null : undefined;
    }

    // 2. Atualizar Supabase (com timing_status + scheduled_followup_at se aplicável)
    try {
      await updateSupabase(data.id, data.email, data.athlete_name, qualification, timingStatus, scheduledFollowupAt, aprovacaoStatus);
      log('INFO', 'supabase_updated', { email: data.email, timing_status: timingStatus, aprovacao_status: aprovacaoStatus });

      // Registro em automacao_runs (aba Execuções) — estado TERMINAL, após a
      // classificação persistida no Supabase.
      await registrarRunSistema({
        automacaoId: RUN_QUALIFICACAO_ID,
        ok: true,
        lead: data,
        acoes: [{
          tipo: 'qualificacao',
          status: 'ok',
          detalhe: `${qualification.classification} (confiança ${qualification.confidence})`,
        }],
      });
    } catch (error) {
      log('ERROR', 'supabase_update_failed', { error: error.message });
    }

    // 3. Atualizar Google Sheets (com retry para caso de timing com syncLeads)
    try {
      let sheetsUpdated = await updateSheets(data.email, data.athlete_name, qualification);

      // Se não encontrou, aguarda 3s e tenta novamente (syncLeads pode não ter terminado)
      if (!sheetsUpdated) {
        log('INFO', 'sheets_retry', { reason: 'Linha não encontrada, aguardando syncLeads...' });
        await new Promise(resolve => setTimeout(resolve, 3000));
        sheetsUpdated = await updateSheets(data.email, data.athlete_name, qualification);
      }

      log('INFO', 'sheets_updated', { email: data.email, updated: sheetsUpdated });
    } catch (error) {
      log('ERROR', 'sheets_update_failed', { error: error.message });
    }

    // 4. Leads QUENTE/MORNO: fila de aprovação (padrão) OU auto-promoção
    //    (somente com o toggle aprovacao_manual desligado — fluxo antigo).
    //    A promoção ao CRM do fluxo novo acontece na server action
    //    aprovarLead (Engine), no momento da decisão humana.
    //    Requalificação: reprovado NUNCA promove; aprovado re-promove
    //    idempotente (recupera aprovado cuja promoção falhou).
    let crmResult = null;
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY && isQuenteOuMorno) {
      const podePromover = aprovacaoManualDesativada
        ? statusAprovacaoAtual !== 'reprovado'
        : statusAprovacaoAtual === 'aprovado';
      const notificarFila = !aprovacaoManualDesativada
        && aprovacaoStatus === 'pendente'
        && statusAprovacaoAtual !== 'pendente';

      if (podePromover) {
        try {
          crmResult = await autoPromoteToCRM(data, qualification.classification, qualification.reason, qualification.confidence, timingStatus);
          if (crmResult) {
            log('INFO', 'crm_auto_created', {
              submissionId: crmResult.submissionId,
              atletaId: crmResult.atletaId,
              dealId: crmResult.dealId,
            });
          }
        } catch (crmError) {
          log('ERROR', 'crm_auto_promote_failed', {
            error: crmError.message,
            email: data.email,
            athlete: data.athlete_name,
          });
        }
      } else if (notificarFila) {
        try {
          await notifyAprovacaoPendente(data, qualification);
          log('INFO', 'aprovacao_pendente_criada', { email: data.email, athlete: data.athlete_name });
        } catch (notifErr) {
          // Notificação é best-effort — a fila é a fonte de verdade
          // (badge/modal no Engine consultam aprovacao_status direto).
          log('WARN', 'aprovacao_notify_failed', { error: notifErr.message });
        }
      }
    }

    const durationMs = Date.now() - startTime;

    log('INFO', 'qualification_complete', {
      email: data.email,
      classification: qualification.classification,
      durationMs,
    });

    // Status EFETIVO pós-request (undefined no patch = manteve o anterior)
    const aprovacaoStatusEfetivo = aprovacaoStatus !== undefined ? aprovacaoStatus : statusAprovacaoAtual;

    return res.status(200).send({
      success: true,
      qualification,
      aprovacaoStatus: aprovacaoStatusEfetivo,
      whatsappScheduled: qualification.classification !== 'FRIO' && aprovacaoStatusEfetivo === 'aprovado',
      crmCreated: !!crmResult,
      crmAtletaId: crmResult?.atletaId || null,
      crmDealId: crmResult?.dealId || null,
      durationMs,
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;

    log('CRITICAL', 'qualification_failed', {
      error: error.message,
      durationMs,
    });

    return res.status(500).send({
      success: false,
      error: 'Erro interno na qualificação do lead',
    });
  }
});
