const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ─── Configuração via variáveis de ambiente ─────────────────────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

// Supabase (OPCIONAL — só para textos custom de mensagem). Sem estas env
// vars a função usa exclusivamente os builders hardcoded (comportamento
// histórico) — zero mudança de comportamento até serem configuradas.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || 'public';

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

// ─── Sanitização simples ───────────────────────────────────────
const sanitize = (str) => {
  if (!str) return '';
  return String(str).replace(/[<>]/g, '').trim();
};

// ─── Formatar número para formato Z-API ────────────────────────
// Z-API aceita: "5511999999999" (apenas números, com DDI)
// Suporta E.164 internacional (+14155551234) e formato BR legado (11999999999)
const formatPhone = (phone) => {
  if (!phone) return null;

  const original = String(phone).trim();

  // Números E.164 (vindos do react-phone-number-input) já têm DDI correto —
  // apenas remove o + e caracteres não numéricos
  const isE164 = original.startsWith('+');

  let cleaned = original.replace(/\D/g, '');

  // Remove zero à esquerda (formato legado BR)
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // Só adiciona DDI 55 (Brasil) se NÃO for E.164 e parecer número BR sem DDI
  if (!isE164 && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }

  // Validação mínima: precisa ter pelo menos 12 dígitos
  if (cleaned.length < 12) {
    return null;
  }

  return cleaned;
};

// ─── Enviar mensagem de texto via Z-API (/send-text) ──────────
const sendMessage = async (phone, message) => {
  const formattedPhone = formatPhone(phone);

  if (!formattedPhone) {
    log('WARN', 'invalid_phone', { phone });
    return { success: false, error: 'Número inválido' };
  }

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`;

  const postData = JSON.stringify({
    phone: formattedPhone,
    message: message,
  });

  log('INFO', 'zapi_sending', {
    phone: formattedPhone,
    type: 'text',
    messageLength: message.length,
  });

  const result = await httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CLIENT_TOKEN,
    },
  }, postData);

  log('INFO', 'zapi_response', {
    phone: formattedPhone,
    type: 'text',
    statusCode: result.statusCode,
    body: result.body.substring(0, 300),
  });

  if (result.statusCode >= 400) {
    return { success: false, error: `Z-API HTTP ${result.statusCode}: ${result.body}` };
  }

  return { success: true, response: JSON.parse(result.body) };
};

// ─── Enviar mensagem com link preview via Z-API (/send-link) ──
const sendLink = async (phone, message, linkUrl, title, linkDescription, image) => {
  const formattedPhone = formatPhone(phone);

  if (!formattedPhone) {
    log('WARN', 'invalid_phone', { phone });
    return { success: false, error: 'Número inválido' };
  }

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-link`;

  const postData = JSON.stringify({
    phone: formattedPhone,
    message: message,
    linkUrl: linkUrl,
    title: title,
    linkDescription: linkDescription,
    image: image,
  });

  log('INFO', 'zapi_sending', {
    phone: formattedPhone,
    type: 'link',
    linkUrl: linkUrl,
    messageLength: message.length,
  });

  const result = await httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CLIENT_TOKEN,
    },
  }, postData);

  log('INFO', 'zapi_response', {
    phone: formattedPhone,
    type: 'link',
    statusCode: result.statusCode,
    body: result.body.substring(0, 300),
  });

  if (result.statusCode >= 400) {
    return { success: false, error: `Z-API HTTP ${result.statusCode}: ${result.body}` };
  }

  return { success: true, response: JSON.parse(result.body) };
};

// ─── Link de agendamento ─────────────────────────────────────
// V1: link fixo para Google Calendar via /agendar (redirect)
// V2: buildScheduleUrl com token Base64 (quando página custom ativar)
const SCHEDULE_URL = 'https://bolsaatletausa.com/agendar';
const buildScheduleUrl = () => SCHEDULE_URL;

// ─── Metadados do link de agendamento ─────────────────────────
const CALENDAR_LINK_URL = SCHEDULE_URL;
const CALENDAR_LINK_TITLE = 'Reunião Estratégica Individual - Leandro Ribeiro';
const CALENDAR_LINK_IMAGE = 'https://lh3.googleusercontent.com/a-/ALV-UjXKwLrleoe7peDm_g3u_88uIfrh08RcWDpvv2VkH7XIkjMFKWko=s256';
const CALENDAR_LINK_DESCRIPTION = 'Agende sua Reunião Estratégica com Leandro Ribeiro - Bolsa Atleta USA';

// ─── Delay entre mensagens (anti-ban) ──────────────────────────
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Montar mensagens personalizadas ───────────────────────────
const buildAthleteMessage = (data) => {
  const name = sanitize(data.athlete_name) || 'Atleta';

  return `*${name}*,

Concluímos a análise do seu perfil.

Identificamos *potencial real* em você para ingresso em instituições de excelência nos Estados Unidos.

Já mapeamos algumas instituições parceiras que combinam com seu perfil e potencial de crescimento.

✅ *Você foi selecionado para avançar à próxima etapa.*
Parabéns por essa conquista.

O próximo passo é uma *Reunião Estratégica Individual* com o fundador da Bolsa Atleta USA.

Nessa etapa, iniciaremos a estruturação do seu projeto e a transformação desse potencial em um plano concreto rumo aos Estados Unidos.

O link para agendamento já foi enviado ao seu responsável indicado no formulário.

⏳ _A confirmação deve ocorrer dentro do ciclo vigente._`;
};

const buildGuardianMessage = (data) => {
  const guardianName = sanitize(data.guardian_name) || 'Responsável';
  const athleteName = sanitize(data.athlete_name) || 'seu(sua) filho(a)';

  return `Olá, *${guardianName}*.

Aqui é da *Bolsa Atleta USA*.

Concluímos a análise estratégica do perfil de *${athleteName}*.

Identificamos potencial de viabilidade para posicionamento em instituições parceiras de excelência nos Estados Unidos, dentro do modelo estruturado pela *Educação Esportiva Inteligente®*.

Já mapeamos instituições parceiras que apresentam alinhamento consistente com o perfil apresentado e o momento do atleta.

Atuamos com número intencionalmente limitado de famílias por ciclo, com acompanhamento ativo do fundador, com suporte de equipe multidisciplinar especializada, assegurando segurança e direção estratégica ao longo de toda a jornada do atleta.

✅ *O perfil foi selecionado para avançar à próxima etapa.*

O próximo passo é uma *Reunião Estratégica Individual* com *Leandro Ribeiro*.
Essa etapa marca o início formal da estruturação do projeto.

📅 *Agende a Reunião Estratégica:*
${buildScheduleUrl(data)}

⏳ _A reserva desta etapa é mantida por período limitado, conforme o ciclo em andamento._`;
};

// ─── Mensagens de follow-up 1 (48h sem agendamento) ───────────
const buildAthleteFollowup1Message = (data) => {
  const name = sanitize(data.athlete_name) || 'Atleta';

  return `*${name}*,

Você ainda tem uma oportunidade em aberto no processo de seleção da Bolsa Atleta USA.

O link para agendamento da Reunião Estratégica Individual já foi enviado ao seu responsável.

⚠️ As vagas do ciclo atual estão sendo preenchidas. Oriente o seu responsável a confirmar o horário.

_Não perca essa janela de oportunidade._`;
};

const buildGuardianFollowup1Message = (data) => {
  const guardianName = sanitize(data.guardian_name) || 'Responsável';
  const athleteName = sanitize(data.athlete_name) || 'seu(sua) filho(a)';

  return `Olá, *${guardianName}*.

O agendamento da Reunião Estratégica Individual de *${athleteName}* ainda não foi confirmado.

As vagas do ciclo atual estão sendo preenchidas. O perfil continua selecionado, mas a reserva é por tempo limitado.

📅 *Garanta o agendamento agora:*
${buildScheduleUrl(data)}

⏳ _Essa etapa é fundamental para iniciar a estruturação do projeto._`;
};

// ─── Mensagens de follow-up 2 (7 dias sem agendamento) ────────
const buildAthleteFollowup2Message = (data) => {
  const name = sanitize(data.athlete_name) || 'Atleta';

  return `*${name}*,

Última etapa antes do encerramento do ciclo de seleção.

A Reunião Estratégica ainda não foi confirmada pelo seu responsável.

_Oriente seu responsável a realizar o agendamento o quanto antes._`;
};

const buildGuardianFollowup2Message = (data) => {
  const guardianName = sanitize(data.guardian_name) || 'Responsável';
  const athleteName = sanitize(data.athlete_name) || 'seu(sua) filho(a)';

  return `Olá, *${guardianName}*.

Esse é nosso último contato sobre o ciclo atual de seleção.

O perfil de *${athleteName}* foi selecionado, mas a Reunião Estratégica Individual ainda está pendente.

Não conseguindo encaixar o horário, é só nos informar — estamos aqui para facilitar.

📅 *Agende agora:*
${buildScheduleUrl(data)}

_Após o encerramento do ciclo, novos processos têm datas e critérios próprios._`;
};

// ─── Mensagens "Cedo demais" (timing_status = muito_cedo) ──────
// Para atletas em before_7th: identificamos potencial mas o trabalho
// estratégico só faz sentido a partir do 8º ano. Sistema agenda
// retomada em novembro do ano civil seguinte.
const buildEarlyPotentialAthleteMessage = (data) => {
  const name = sanitize(data.athlete_name) || 'Atleta';
  const nextYear = new Date().getUTCFullYear() + 1;

  return `*${name}*,

Recebemos sua candidatura à Bolsa Atleta USA e identificamos *potencial real* no seu perfil.

Antes de seguirmos, queremos ser transparentes sobre o momento ideal: o trabalho estratégico que conduzimos junto aos atletas começa a fazer sentido a partir do 8º ano — quando inicia a construção do histórico esportivo e acadêmico que será avaliado pelas instituições americanas.

📅 *Vamos retomar este contato em novembro de ${nextYear}* para uma análise estratégica completa do seu perfil.

Enquanto isso, _mantenha o sonho vivo, treine com consistência e prepare-se com seriedade._

A jornada começou hoje.

— Equipe *Bolsa Atleta USA*`;
};

const buildEarlyPotentialGuardianMessage = (data) => {
  const guardianName = sanitize(data.guardian_name) || 'Responsável';
  const athleteName = sanitize(data.athlete_name) || 'seu(sua) filho(a)';
  const nextYear = new Date().getUTCFullYear() + 1;

  return `Olá, *${guardianName}*.

Aqui é da *Bolsa Atleta USA*.

Concluímos a análise inicial do perfil de *${athleteName}* e identificamos *potencial real*. Por isso queremos cuidar desse projeto com a atenção que merece — e isso passa por respeitar o timing certo.

Atuamos com famílias intencionalmente selecionadas, dentro da metodologia *Educação Esportiva Inteligente®*, e o trabalho estratégico que conduzimos faz mais sentido a partir do 8º ano: é quando começa a construção concreta da trajetória esportiva, acadêmica e linguística que será avaliada pelas universidades americanas.

📅 *Vamos retomar este contato em novembro de ${nextYear}* para uma análise estratégica completa de:
• Trajetória esportiva construída até lá
• Performance acadêmica
• Evolução no inglês
• Direção do projeto familiar

Reservamos esse compromisso. Em novembro, voltamos a falar — _com mais informações, mais maturidade do(a) atleta, e o quadro ideal para iniciar formalmente a estruturação._

Enquanto isso, _o trabalho de base começa agora. Mantenham o sonho vivo._

— Equipe *Bolsa Atleta USA*`;
};

// ─── Mensagens "Tarde demais" (timing_status = tarde_demais) ───
// Para atletas em graduated_2plus: fora da janela competitiva NCAA/NAIA.
// Transparência total + sugestões de caminhos alternativos.
const buildLateTimingAthleteMessage = (data) => {
  const name = sanitize(data.athlete_name) || 'Atleta';

  return `*${name}*,

Recebemos sua candidatura à Bolsa Atleta USA e queremos ser totalmente transparentes com você.

A janela competitiva de aplicação para o sistema *NCAA/NAIA* ocorre durante o high school ou imediatamente após a conclusão (em geral, até 12 meses). Pelas informações enviadas, esse momento já passou.

Isso *não significa que o sonho acabou* — significa que o caminho precisa ser diferente. Para casos como o seu, geralmente o melhor caminho é:

• *Junior College (NJCAA)* — porta de entrada por 2 anos antes de transferir para uma universidade NCAA
• *Aplicação direta* em universidades fora do circuito esportivo competitivo
• *Transfer student* — reaplicação a partir de um histórico universitário inicial

Nosso método é especializado em atletas dentro da janela competitiva, onde temos maior eficácia. Mas se quiser conversar sobre esses caminhos alternativos, _estaremos à disposição._

— Equipe *Bolsa Atleta USA*`;
};

const buildLateTimingGuardianMessage = (data) => {
  const guardianName = sanitize(data.guardian_name) || 'Responsável';
  const athleteName = sanitize(data.athlete_name) || 'o(a) atleta';

  return `Olá, *${guardianName}*.

Aqui é da *Bolsa Atleta USA*.

Recebemos a candidatura de *${athleteName}* e queremos compartilhar uma análise sincera sobre o timing.

A janela ideal de aplicação para o sistema *NCAA/NAIA* ocorre durante o high school ou imediatamente após a conclusão (geralmente até 12 meses). Pelas informações que recebemos, esse momento já passou — o que muda significativamente o cenário competitivo.

Isso *não encerra o sonho americano* — apenas redireciona o caminho. Para casos assim, normalmente avaliamos:

• *Junior College (NJCAA)* — caminho de 2 anos como porta de entrada para NCAA via transferência
• *Aplicação direta* em universidades fora do sistema esportivo competitivo
• *Transfer student* — reaplicação após histórico universitário inicial

Nosso método é focado em atletas dentro da janela competitiva ideal, onde temos a maior eficácia comprovada. Mas valorizamos a transparência: _se desejarem conversar sobre esses caminhos alternativos, estaremos à disposição para uma orientação._

Agradecemos a confiança em compartilhar esse momento conosco.

— Equipe *Bolsa Atleta USA*`;
};

// ─── Mensagem agendada de retomada (timing_status = muito_cedo) ─
// Enviada em novembro do ano civil seguinte ao cadastro. Marca o
// retorno do contato prometido na mensagem early_potential.
const buildScheduledReturnAthleteMessage = (data) => {
  const name = sanitize(data.athlete_name) || 'Atleta';

  return `*${name}*,

Como combinamos no ano passado, voltamos para retomar a sua jornada rumo aos Estados Unidos.

Identificamos potencial naquele primeiro contato — e *agora é o momento estratégico* para entendermos a evolução:

• Como está sua trajetória esportiva?
• Como está o desempenho acadêmico?
• E o inglês — evoluiu?

📅 _Seu responsável receberá em seguida o link para uma Reunião Estratégica Individual com o fundador da Bolsa Atleta USA._

— Equipe *Bolsa Atleta USA*`;
};

const buildScheduledReturnGuardianMessage = (data) => {
  const guardianName = sanitize(data.guardian_name) || 'Responsável';
  const athleteName = sanitize(data.athlete_name) || 'seu(sua) filho(a)';

  return `Olá, *${guardianName}*.

Aqui é da *Bolsa Atleta USA*.

Como combinamos no ano passado, voltamos para retomar a conversa sobre o futuro internacional de *${athleteName}*.

Identificamos potencial naquele primeiro contato e, neste momento estratégico, queremos entender a evolução nos últimos 12 meses:

• Como está a trajetória esportiva?
• E o desempenho acadêmico?
• Como foi a evolução no inglês?
• Vocês mantêm o sonho americano?

Reservamos esse retorno para vocês. Se ainda fizer sentido, gostaríamos de agendar uma *Reunião Estratégica Individual* com *Leandro Ribeiro* — para analisar as possibilidades específicas de *${athleteName}*.

📅 *Agendar a Reunião Estratégica:*
${buildScheduleUrl(data)}

— Equipe *Bolsa Atleta USA* — assessoria exclusiva para bolsas esportivas em instituições americanas.`;
};

// ─── Textos custom (configuracoes_sistema.scheduler_mensagens) ─
// O CEO edita os textos no Engine (/automacoes). Esta função lê a config
// UMA vez por request e usa o texto custom quando existir; os builders
// hardcoded acima NUNCA são removidos — são o fallback permanente
// (guard de CI: tests/send-whatsapp-mensagens.test.js).
const fetchMensagensCustom = async () => {
  // Sem credenciais Supabase → fallback total nos builders (sem WARN:
  // é o estado esperado até as env vars serem configuradas).
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

  try {
    const url = `${SUPABASE_URL}/rest/v1/configuracoes_sistema` +
      '?chave=eq.scheduler_mensagens&select=valor&limit=1';
    const result = await httpRequest(url, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Accept-Profile': SUPABASE_SCHEMA,
      },
    });

    if (result.statusCode >= 400) {
      throw new Error(`Supabase HTTP ${result.statusCode}`);
    }

    const rows = JSON.parse(result.body);
    const valor = Array.isArray(rows) ? rows[0]?.valor : null;
    // Seed ausente ou formato inesperado → builders assumem (sem erro)
    if (!valor || typeof valor !== 'object') return null;
    return valor;
  } catch (error) {
    log('WARN', 'mensagens_fallback', { error: error.message });
    return null;
  }
};

// Variáveis suportadas nos textos custom — espelham EXATAMENTE as
// interpolações dos builders hardcoded, inclusive os fallbacks de nome
// por destinatário/template.
const buildTemplateVars = (data, messageType, destinatario) => {
  const athleteFallback =
    destinatario === 'atleta' ? 'Atleta' :
    messageType === 'late_timing' ? 'o(a) atleta' :
    'seu(sua) filho(a)';

  return {
    '{atleta_nome}': sanitize(data.athlete_name) || athleteFallback,
    '{responsavel_nome}': sanitize(data.guardian_name) || 'Responsável',
    '{agenda_url}': buildScheduleUrl(data),
    '{proximo_ano}': String(new Date().getUTCFullYear() + 1),
  };
};

// Renderiza um texto custom substituindo todos os placeholders.
// Retorna null (→ builder hardcoded assume) se o texto não existir,
// não for string ou renderizar vazio/whitespace.
const renderTemplate = (texto, vars) => {
  if (!texto || typeof texto !== 'string') return null;

  let rendered = texto;
  for (const [placeholder, valor] of Object.entries(vars)) {
    rendered = rendered.split(placeholder).join(valor);
  }

  if (!rendered.trim()) return null;
  return rendered;
};

// ─── Cloud Function principal ──────────────────────────────────
functions.http('sendWhatsApp', async (req, res) => {
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
    // Validação das env vars
    if (!ZAPI_INSTANCE_ID || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) {
      throw new Error('Variáveis Z-API não configuradas');
    }

    const payload = req.body;
    const data = payload.record || payload;
    const messageType = payload.messageType || 'initial';

    if (!data || !data.athlete_name) {
      log('WARN', 'validation_failed', { hasData: !!data });
      return res.status(400).send({ success: false, error: 'Dados inválidos' });
    }

    // Verifica se deve enviar (só Quente e Morno)
    const classification = data.qualification_classification;
    // Mensagens de timing (early_potential, late_timing, scheduled_return)
    // são enviadas independente da classificação Gemini — bypass do filtro FRIO.
    const isTimingMessage = ['early_potential', 'late_timing', 'scheduled_return'].includes(messageType);
    if (classification === 'FRIO' && !isTimingMessage) {
      log('INFO', 'skipped_cold_lead', {
        email: data.email,
        athlete: data.athlete_name,
      });
      return res.status(200).send({
        success: true,
        action: 'skipped',
        reason: 'Lead classificado como FRIO',
      });
    }

    log('INFO', 'whatsapp_start', {
      email: data.email,
      athlete: data.athlete_name,
      classification: classification || 'NOT_QUALIFIED_YET',
      messageType,
    });

    // Mensagem custom (meeting_confirmed): envia direto sem template
    if (messageType === 'meeting_confirmed' && payload.customMessage && payload.phone) {
      const phone = formatPhone(payload.phone);
      if (!phone) {
        return res.status(400).send({ success: false, error: 'Telefone inválido' });
      }
      const result = await sendMessage(payload.phone, payload.customMessage);
      const durationMs = Date.now() - startTime;
      log('INFO', 'custom_message_sent', { phone, durationMs });
      return res.status(200).send({ success: true, results: [{ to: 'custom', ...result }], durationMs });
    }

    // Textos custom editáveis (config scheduler_mensagens) — buscados UMA
    // vez por request. Qualquer falha/ausência → athleteCustom/guardianCustom
    // ficam null e os builders hardcoded abaixo assumem (fallback permanente).
    const mensagensCustom = await fetchMensagensCustom();
    const athleteCustom = renderTemplate(
      mensagensCustom?.[messageType]?.atleta,
      buildTemplateVars(data, messageType, 'atleta')
    );
    const guardianCustom = renderTemplate(
      mensagensCustom?.[messageType]?.responsavel,
      buildTemplateVars(data, messageType, 'responsavel')
    );

    // Seleciona templates com base no tipo de mensagem
    const athleteMsg = athleteCustom || (
      messageType === 'followup_2' ? buildAthleteFollowup2Message(data) :
      messageType === 'followup_1' ? buildAthleteFollowup1Message(data) :
      messageType === 'early_potential' ? buildEarlyPotentialAthleteMessage(data) :
      messageType === 'late_timing' ? buildLateTimingAthleteMessage(data) :
      messageType === 'scheduled_return' ? buildScheduledReturnAthleteMessage(data) :
      buildAthleteMessage(data));

    const guardianMsg = guardianCustom || (
      messageType === 'followup_2' ? buildGuardianFollowup2Message(data) :
      messageType === 'followup_1' ? buildGuardianFollowup1Message(data) :
      messageType === 'early_potential' ? buildEarlyPotentialGuardianMessage(data) :
      messageType === 'late_timing' ? buildLateTimingGuardianMessage(data) :
      messageType === 'scheduled_return' ? buildScheduledReturnGuardianMessage(data) :
      buildGuardianMessage(data));

    const results = [];

    // Verifica se o número do atleta e do responsável são o mesmo
    const athletePhone = formatPhone(data.athlete_whatsapp);
    const guardianPhone = formatPhone(data.guardian_whatsapp);
    const samePhone = athletePhone && guardianPhone && athletePhone === guardianPhone;

    const scheduleUrl = buildScheduleUrl(data);

    if (samePhone) {
      // Mesmo número: envia apenas a copy do responsável (mais completa, com link de agendamento)
      log('INFO', 'same_phone_detected', { phone: guardianPhone });
      const guardianResult = await sendLink(
        data.guardian_whatsapp,
        guardianMsg,
        scheduleUrl,
        CALENDAR_LINK_TITLE,
        CALENDAR_LINK_DESCRIPTION,
        CALENDAR_LINK_IMAGE
      );
      results.push({ to: 'guardian_only (same phone)', ...guardianResult });

    } else {
      // Números diferentes: envia para ambos

      // 1. Mensagem para o atleta
      if (data.athlete_whatsapp) {
        const athleteResult = await sendMessage(data.athlete_whatsapp, athleteMsg);
        results.push({ to: 'athlete', ...athleteResult });

        // Delay anti-ban: 20-30 segundos aleatório
        if (data.guardian_whatsapp) {
          const randomDelay = 20000 + Math.floor(Math.random() * 10000);
          await delay(randomDelay);
        }
      }

      // 2. Mensagem para o responsável (com link preview personalizado)
      if (data.guardian_whatsapp) {
        const guardianResult = await sendLink(
          data.guardian_whatsapp,
          guardianMsg,
          scheduleUrl,
          CALENDAR_LINK_TITLE,
          CALENDAR_LINK_DESCRIPTION,
          CALENDAR_LINK_IMAGE
        );
        results.push({ to: 'guardian', ...guardianResult });
      }
    }

    const durationMs = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    log('INFO', 'whatsapp_complete', {
      email: data.email,
      athlete: data.athlete_name,
      sent: successCount,
      failed: failCount,
      durationMs,
    });

    return res.status(200).send({
      success: true,
      results,
      durationMs,
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;

    log('CRITICAL', 'whatsapp_failed', {
      error: error.message,
      durationMs,
    });

    return res.status(500).send({
      success: false,
      error: 'Erro interno no envio de WhatsApp',
    });
  }
});
