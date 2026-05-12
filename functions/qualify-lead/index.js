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
const httpRequest = (url, options, postData) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
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
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout (15s)'));
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

// ─── Chamada ao Gemini 2.5 Flash ───────────────────────────────
const qualifyWithGemini = async (leadData) => {
  const isBrazil = !leadData.address_country || leadData.address_country === 'BR';

  // Bloco de endereço adaptado ao país do lead
  const addressBlock = isBrazil
    ? `- Endereço: ${[leadData.address_street, leadData.address_number, leadData.address_complement].filter(Boolean).join(', ') || 'Não informado'}
- Bairro: ${leadData.address_neighborhood || 'Não informado'}
- Cidade/Estado: ${[leadData.address_city, leadData.address_state].filter(Boolean).join('/') || 'Não informado'}
- CEP: ${leadData.address_cep || 'Não informado'}`
    : `- País de residência: ${leadData.address_country}
- Cidade: ${leadData.address_city || 'Não informado'}
- Endereço detalhado: não fornecido (lead internacional — campos de bairro, CEP e estado não se aplicam)`;

  // Critério MORNO de endereço adaptado ao contexto do lead
  const mornoAddressCriteria = isBrazil
    ? '- MAS o endereço/cidade informado confirma região de alto padrão / alto poder aquisitivo no Brasil'
    : '- MAS a cidade ou país informado sugere contexto econômico favorável (ex: cidade de grande porte em país desenvolvido)';

  const prompt = `Você é um Analista Estratégico de Qualificação da Bolsa Atleta USA.
Sua função é classificar leads com base exclusivamente em:
1. Faixa de investimento anual escolhida
2. Profissão do responsável financeiro
3. Endereço informado (caso necessário)
4. Escola informada (caso necessário)
5. Validação de consistência dos dados

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

1️⃣ QUENTE
Classifique como QUENTE quando:
- A profissão sustenta claramente a faixa escolhida OU a profissão indica capacidade financeira superior à faixa escolhida
- E os dados do formulário NÃO apresentam sinais de preenchimento aleatório (ex: sequências de letras sem sentido, números repetitivos, padrões como "aaaa", "123456", "xxxx", campos incoerentes)
- Se houver qualquer indício de preenchimento aleatório, NÃO pode ser QUENTE

2️⃣ MORNO
Classifique como MORNO quando:
- A profissão não sustenta claramente a faixa escolhida
- ${mornoAddressCriteria}
- OU a escola informada é reconhecida como instituição de alto padrão

3️⃣ FRIO
Classifique como FRIO quando:
- A profissão não sustenta a faixa escolhida E o endereço não confirma alto padrão E a escola não confirma alto padrão
- OU houver sinais de preenchimento aleatório/inconsistente no formulário

PROFISSÕES COM RENDA VARIÁVEL:
Profissões que contenham termos como "analista", "financeiro", "gestor", "marketing", "comercial", "consultor", "corretor", "trader", "assessor" ou equivalentes frequentemente possuem renda total significativamente superior ao salário base, devido a comissões, bônus e variáveis. Analise com atenção o contexto completo antes de classificar como FRIO — um Analista Financeiro ou Gestor Comercial, por exemplo, pode ter renda real muito acima da média do cargo. Em caso de dúvida entre FRIO e MORNO para essas profissões, prefira MORNO.

REGRAS IMPORTANTES:
- Não presumir renda
- Não inventar patrimônio
- Avaliar apenas plausibilidade estrutural
- Não considerar desempenho esportivo ou acadêmico para decisão financeira
- A análise deve ser objetiva e criteriosa
- Para leads internacionais (fora do Brasil): não penalize a ausência de bairro, CEP ou estado — esses campos não foram solicitados; baseie a análise em profissão, faixa de investimento e contexto do país/cidade

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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const result = await httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  }, postData);

  if (result.statusCode >= 400) {
    throw new Error(`Gemini HTTP ${result.statusCode}: ${result.body}`);
  }

  const response = JSON.parse(result.body);
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini retornou resposta vazia');
  }

  // Limpa possíveis backticks ou markdown residuais
  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  log('INFO', 'gemini_raw_response', { rawText: cleanText.substring(0, 600) });

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
    };
  } catch (parseError) {
    log('WARN', 'gemini_parse_fallback', { error: parseError.message, rawText: cleanText.substring(0, 300) });

    if (cleanText.includes('QUENTE')) return { classification: 'QUENTE', reason: cleanText.substring(0, 200), confidence: 'BAIXA' };
    if (cleanText.includes('MORNO'))  return { classification: 'MORNO',  reason: cleanText.substring(0, 200), confidence: 'BAIXA' };
    if (cleanText.includes('FRIO'))   return { classification: 'FRIO',   reason: cleanText.substring(0, 200), confidence: 'BAIXA' };
    return { classification: 'FRIO', reason: 'Não foi possível classificar automaticamente. Revisão manual necessária.', confidence: 'BAIXA' };
  }
};

// ─── Atualizar Supabase ────────────────────────────────────────
const updateSupabase = async (email, athleteName, qualification) => {
  // Normaliza para match com o banco (Edge Function salva em lowercase)
  const normalizedEmail = email.trim().toLowerCase();

  const url = `${SUPABASE_URL}/rest/v1/form_submissions?email=eq.${encodeURIComponent(normalizedEmail)}&athlete_name=eq.${encodeURIComponent(athleteName.trim())}`;

  const postData = JSON.stringify({
    qualified: qualification.classification !== 'FRIO',
    qualification_classification: qualification.classification,
    qualification_reason: qualification.reason,
    qualification_confidence: qualification.confidence,
    qualified_at: new Date().toISOString(),
  });

  log('INFO', 'supabase_patch_attempt', {
    url: url.replace(SUPABASE_SERVICE_KEY, '***'),
    email: normalizedEmail,
    athlete: athleteName.trim(),
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

  // Verifica se alguma linha foi atualizada
  const responseData = JSON.parse(result.body);
  if (Array.isArray(responseData) && responseData.length === 0) {
    log('WARN', 'supabase_no_rows_matched', { email: normalizedEmail, athlete: athleteName.trim() });
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
  if (lower.includes('pg') || lower.includes('post')) return 'pg_year';
  if (lower.includes('12') || lower.includes('3')) return '12th';
  if (lower.includes('11') || lower.includes('2')) return '11th';
  if (lower.includes('10') || lower.includes('1')) return '10th';
  return '9th';
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
const autoPromoteToCRM = async (data, classification, reason, confidence) => {
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

  const newDeal = await supabaseRequest('POST', 'deals', {
    atleta_id: atletaId,
    etapa: 'lead',
    valor_estimado: mapInvestmentToValor(data.investment_range),
    probabilidade_fechamento: 10,
    status_decisao_familia: 'em_discussao',
    safra: 'fall_2026',
    responsavel_id: defaultResponsavelId,
  }, { 'Prefer': 'return=representation' });

  if (!Array.isArray(newDeal) || newDeal.length === 0) {
    throw new Error('Falha ao criar deal: resposta vazia');
  }

  const dealId = newDeal[0].id;

  return { submissionId, atletaId, dealId };
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

    log('INFO', 'qualification_start', {
      email: data.email,
      athlete: data.athlete_name,
      investment: data.investment_range,
      profession: data.guardian_profession,
    });

    // 1. Qualificar com Gemini
    const qualification = await qualifyWithGemini(data);

    log('INFO', 'qualification_result', {
      email: data.email,
      athlete: data.athlete_name,
      classification: qualification.classification,
      reason: qualification.reason,
      confidence: qualification.confidence,
    });

    // 2. Atualizar Supabase
    try {
      await updateSupabase(data.email, data.athlete_name, qualification);
      log('INFO', 'supabase_updated', { email: data.email });
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

    // 4. Auto-promoção CRM para leads QUENTE/MORNO
    let crmResult = null;
    if (
      SUPABASE_URL && SUPABASE_SERVICE_KEY &&
      (qualification.classification === 'QUENTE' || qualification.classification === 'MORNO')
    ) {
      try {
        crmResult = await autoPromoteToCRM(data, qualification.classification, qualification.reason, qualification.confidence);
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
    }

    const durationMs = Date.now() - startTime;

    log('INFO', 'qualification_complete', {
      email: data.email,
      classification: qualification.classification,
      durationMs,
    });

    return res.status(200).send({
      success: true,
      qualification,
      whatsappScheduled: qualification.classification !== 'FRIO',
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
