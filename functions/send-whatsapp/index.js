const functions = require('@google-cloud/functions-framework');
const https = require('https');
const crypto = require('crypto');

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
    const timeoutMs = options.timeoutMs || 15000;
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request timeout (${timeoutMs / 1000}s)`));
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

  // Mínimo de 12 dígitos só vale para o caminho BR (55 + DDD + número).
  // E.164 confia no DDI do lead: EUA/Canadá (+1) e Austrália (+61) têm 11
  // dígitos no total — o piso 12 rejeitava todo lead internacional com
  // invalid_phone e o scheduler marcava como enviado (2026-08-15: Felipe +1
  // e Benjamin +61 nunca receberam nada). Teto 15 = máximo do E.164.
  const minimo = isE164 ? 8 : 12;
  if (cleaned.length < minimo || cleaned.length > 15) {
    return null;
  }

  return cleaned;
};

// ─── Cura de DDI ausente (incidente Gustavo Telles, 2026-08-23) ─────────
// O formulário deixava passar E.164 quebrado: "+28999711222" é o DDD 28
// com o "+" colado e SEM o 55 — o formatPhone confiava no "+" ("E.164 =
// DDI correto") e o envio ia para um DDI inexistente, ou pior, para um
// DDI REAL de outro país (+49 Alemanha, +27 África do Sul, +51 Peru…).
// Resultado: o responsável nunca recebia o link de agendamento enquanto o
// atleta (número válido) recebia todos os follow-ups.
//
// A cura só se aplica ao padrão INEQUÍVOCO de número BR e SOMENTE quando o
// lead declarou país BR no formulário — um celular peruano real (+51 9…)
// tem a mesma forma de "DDD 51 + 9…", e o país declarado é o desempate.
// Um +55 VÁLIDO tem 12–13 dígitos, então os comprimentos 10/11 nunca
// colidem com número BR correto. Guard: tests/telefone-heal-invariants.test.js
const DDD_VALIDOS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  '21', '22', '24', '27', '28',
  '31', '32', '33', '34', '35', '37', '38',
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  '51', '53', '54', '55',
  '61', '62', '63', '64', '65', '66', '67', '68', '69',
  '71', '73', '74', '75', '77', '79',
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  '91', '92', '93', '94', '95', '96', '97', '98', '99',
]);

const healBrDdiAusente = (phone, addressCountry) => {
  if (!phone || typeof phone !== 'string') return phone;
  const original = phone.trim();
  // Sem "+" é o caminho legado — o formatPhone já adiciona o 55 com segurança.
  if (!original.startsWith('+')) return phone;
  // Lead internacional: o DDI declarado é dele — nunca reescrever.
  if (((addressCountry || 'BR').toUpperCase()) !== 'BR') return phone;

  const digits = original.replace(/\D/g, '');
  const dddValido = DDD_VALIDOS.has(digits.slice(0, 2));
  const celular11 = digits.length === 11 && digits[2] === '9'; // DDD + 9XXXXXXXX
  const fixoOuAntigo10 = digits.length === 10;                 // DDD + XXXXXXXX
  if (dddValido && (celular11 || fixoOuAntigo10)) {
    log('WARN', 'phone_healed_ddi_ausente', {
      tail: digits.slice(-4),
      digitos: digits.length,
    });
    return `+55${digits}`;
  }
  return phone;
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

// ─── Enviar imagem com legenda via Z-API (/send-image) ───────
// image = URL pública. A imagem chega como mídia nativa do WhatsApp (não
// como card de link), com o texto como legenda. Usado quando o CEO anexa uma
// imagem SEM link no compositor de mensagem direta.
const sendImage = async (phone, imageUrl, caption) => {
  const formattedPhone = formatPhone(phone);

  if (!formattedPhone) {
    log('WARN', 'invalid_phone', { phone });
    return { success: false, error: 'Número inválido' };
  }

  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-image`;

  const postData = JSON.stringify({
    phone: formattedPhone,
    image: imageUrl,
    caption: caption || '',
  });

  log('INFO', 'zapi_sending', {
    phone: formattedPhone,
    type: 'image',
    captionLength: (caption || '').length,
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
    type: 'image',
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
// V2 (2026-07): SHORT LINK POR LEAD — slug determinístico do id do lead na
// tabela links_curtos (mesma infra do Gerador UTM: rota pública /l/[slug]
// do site conta o clique e redireciona p/ /agendar). Ganhos: rastrear
// clique-por-lead no convite e link mais curto no WhatsApp.
// FAIL-OPEN: qualquer falha usa o link fixo — o envio NUNCA depende disto.
// Schema: SEMPRE public — quem resolve o slug é o SITE em produção (o /l/
// lê public), mesmo padrão do "Engine lê public" (zapi-inbox/index.js:33).
const SCHEDULE_URL = 'https://bolsaatletausa.com/agendar';
const buildScheduleUrl = (data) => (data && data.schedule_url) || SCHEDULE_URL;

const resolveScheduleUrl = async (data) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !data || !data.id) return SCHEDULE_URL;
    // Slug determinístico e idempotente: 'a' + 7 hex do sha256 do id do lead
    const slug = 'a' + crypto.createHash('sha256').update(String(data.id)).digest('hex').slice(0, 7);

    const postData = JSON.stringify({
      slug,
      destino: SCHEDULE_URL,
      titulo: `Agenda — ${data.athlete_name || 'lead'}`,
      utm_source: 'whatsapp',
      utm_medium: 'crm',
      utm_content: String(data.id),
    });
    const result = await httpRequest(`${SUPABASE_URL}/rest/v1/links_curtos`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Profile': 'public',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Prefer': 'return=minimal',
      },
    }, postData);

    // 201 criado | 409 já existe (idempotente) → usa o short link
    if (result.statusCode === 201 || result.statusCode === 409) {
      return `https://bolsaatletausa.com/l/${slug}`;
    }
    log('WARN', 'short_link_fallback', { statusCode: result.statusCode });
    return SCHEDULE_URL;
  } catch (error) {
    log('WARN', 'short_link_fallback', { error: error.message });
    return SCHEDULE_URL;
  }
};

// ─── Metadados do link de agendamento ─────────────────────────
const CALENDAR_LINK_URL = SCHEDULE_URL;
const CALENDAR_LINK_TITLE = 'Reunião Estratégica Individual - Leandro Ribeiro';
const CALENDAR_LINK_IMAGE = 'https://lh3.googleusercontent.com/a-/ALV-UjXKwLrleoe7peDm_g3u_88uIfrh08RcWDpvv2VkH7XIkjMFKWko=s256';
const CALENDAR_LINK_DESCRIPTION = 'Agende sua Reunião Estratégica com Leandro Ribeiro - Bolsa Atleta USA';

// ─── Delay entre mensagens (anti-ban) ──────────────────────────
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Montar mensagens personalizadas ───────────────────────────
// ─── Templates de REATIVAÇÃO (2026-08-24) ──────────────────────
// Lead antigo que JÁ recebeu o outreach e não agendou, re-aprovado pelo CEO:
// a primeira mensagem do novo ciclo NÃO pode repetir o 'initial' — anuncia a
// REABERTURA de uma possibilidade (tom de exclusividade/escassez do funil).
// Depois dela, o lead cai no MESMO follow-up de sempre (FU1 48h / FU2 7d).
const buildReactivationAthleteMessage = (data) => {
  const name = sanitize(data.athlete_name) || 'Atleta';

  return `*${name}*, temos uma novidade importante.

Aqui é da *Bolsa Atleta USA*.

No fechamento do ciclo atual de seleção, o nosso comitê reavaliou perfis que ficaram pelo caminho — e o seu voltou à mesa.

✅ *Decidimos reabrir uma possibilidade para o seu projeto.*

Isso acontece com um número muito restrito de atletas, e o seu perfil foi um dos selecionados para essa retomada.

Já enviamos os detalhes e o link para o seu responsável. Fala com ele(a) ainda hoje: *as vagas desta reabertura são poucas e expiram com o fechamento do ciclo*.`;
};

const buildReactivationGuardianMessage = (data) => {
  const guardianName = sanitize(data.guardian_name) || 'Responsável';
  const athleteName = sanitize(data.athlete_name) || 'seu(sua) filho(a)';

  return `Olá, *${guardianName}*.

Aqui é da *Bolsa Atleta USA*.

No fechamento do ciclo atual de seleção, nosso comitê reavaliou alguns perfis — e uma decisão interna nos trouxe de volta ao de *${athleteName}*.

✅ *Decidimos reabrir uma possibilidade de posicionamento para ${athleteName}* nas instituições parceiras de excelência nos Estados Unidos, dentro do modelo da *Educação Esportiva Inteligente®*.

Essas reaberturas são raras: acontecem para um número muito restrito de famílias, quando identificamos que o potencial mapeado na primeira análise permanece — e que ainda existe janela para estruturar o projeto com segurança.

O próximo passo é retomar exatamente de onde paramos: a *Reunião Estratégica Individual* com *Leandro Ribeiro*, fundador da Bolsa Atleta USA.

Essa reabertura é limitada: *são poucas vagas, e elas expiram com o fechamento do ciclo*.

O horário de vocês com o Leandro ainda está disponível — recomendo garantir com brevidade, antes que a agenda desta rodada se encerre.`;
};

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
      // 5s (nao os 15s default): o caller followup-scheduler tem timeout de
      // 30s - Supabase degradado nao pode consumir metade do budget dele.
      timeoutMs: 5000,
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
    // Cura DDI ausente ANTES de qualquer uso dos números (samePhone,
    // templates e envio) — ver comentário do healBrDdiAusente.
    if (data) {
      data.athlete_whatsapp = healBrDdiAusente(data.athlete_whatsapp, data.address_country);
      data.guardian_whatsapp = healBrDdiAusente(data.guardian_whatsapp, data.address_country);
    }
    // Short link por lead (fail-open; os builders leem via buildScheduleUrl)
    data.schedule_url = await resolveScheduleUrl(data);

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

    // Mensagem custom (meeting_confirmed): envia direto sem template.
    // Extensão I2 (aditiva): linkUrl opcional no payload → envia via
    // /send-link (card clicável com linkTitle/linkDescription/linkImage —
    // mesmo contrato do sendLink dos templates). SEM linkUrl, o caminho é
    // o histórico byte-a-byte: /send-text (fallback intacto — callers
    // existentes como o convite de reunião do Engine não mudam em nada).
    if (messageType === 'meeting_confirmed' && payload.customMessage && payload.phone) {
      const phone = formatPhone(payload.phone);
      if (!phone) {
        return res.status(400).send({ success: false, error: 'Telefone inválido' });
      }
      const isHttpUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v.trim());
      const customLinkUrl = isHttpUrl(payload.linkUrl) ? payload.linkUrl.trim() : null;
      // Imagem SEM link → mídia nativa (/send-image) com o texto como legenda.
      // Com link, a imagem segue como preview do card (linkImage) — não duplica.
      const customImageUrl =
        !customLinkUrl && isHttpUrl(payload.imageUrl) ? payload.imageUrl.trim() : null;
      let result;
      if (customLinkUrl) {
        // Z-API /send-link: o link precisa estar contido na mensagem para o
        // card ser clicável — se o texto não o contém, anexa ao final
        // (WYSIWYG com o preview do builder de automações).
        const message = payload.customMessage.includes(customLinkUrl)
          ? payload.customMessage
          : `${payload.customMessage}\n\n${customLinkUrl}`;
        result = await sendLink(
          payload.phone,
          message,
          customLinkUrl,
          sanitize(payload.linkTitle) || customLinkUrl,
          sanitize(payload.linkDescription) || '',
          isHttpUrl(payload.linkImage) ? payload.linkImage.trim() : ''
        );
      } else if (customImageUrl) {
        result = await sendImage(payload.phone, customImageUrl, payload.customMessage);
      } else {
        result = await sendMessage(payload.phone, payload.customMessage);
      }
      const durationMs = Date.now() - startTime;
      log('INFO', 'custom_message_sent', {
        phone,
        durationMs,
        withLink: !!customLinkUrl,
        withImage: !!customImageUrl,
      });
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
      messageType === 'reactivation' ? buildReactivationAthleteMessage(data) :
      buildAthleteMessage(data));

    const guardianMsg = guardianCustom || (
      messageType === 'followup_2' ? buildGuardianFollowup2Message(data) :
      messageType === 'followup_1' ? buildGuardianFollowup1Message(data) :
      messageType === 'early_potential' ? buildEarlyPotentialGuardianMessage(data) :
      messageType === 'late_timing' ? buildLateTimingGuardianMessage(data) :
      messageType === 'scheduled_return' ? buildScheduledReturnGuardianMessage(data) :
      messageType === 'reactivation' ? buildReactivationGuardianMessage(data) :
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
