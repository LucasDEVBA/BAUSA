const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ─── Configuração via variáveis de ambiente ─────────────────────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const ZAPI_INSTANCE_ID = process.env.ZAPI_INSTANCE_ID;
const ZAPI_TOKEN = process.env.ZAPI_TOKEN;
const ZAPI_CLIENT_TOKEN = process.env.ZAPI_CLIENT_TOKEN;

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

// ─── Metadados do link do Google Calendar ─────────────────────
const CALENDAR_LINK_URL = 'https://bolsaatletausa.com/agendar';
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
https://bolsaatletausa.com/agendar

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
https://bolsaatletausa.com/agendar

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
https://bolsaatletausa.com/agendar

_Após o encerramento do ciclo, novos processos têm datas e critérios próprios._`;
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
    if (classification === 'FRIO') {
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

    // Seleciona templates com base no tipo de mensagem
    const athleteMsg =
      messageType === 'followup_2' ? buildAthleteFollowup2Message(data) :
      messageType === 'followup_1' ? buildAthleteFollowup1Message(data) :
      buildAthleteMessage(data);

    const guardianMsg =
      messageType === 'followup_2' ? buildGuardianFollowup2Message(data) :
      messageType === 'followup_1' ? buildGuardianFollowup1Message(data) :
      buildGuardianMessage(data);

    const results = [];

    // Verifica se o número do atleta e do responsável são o mesmo
    const athletePhone = formatPhone(data.athlete_whatsapp);
    const guardianPhone = formatPhone(data.guardian_whatsapp);
    const samePhone = athletePhone && guardianPhone && athletePhone === guardianPhone;

    if (samePhone) {
      // Mesmo número: envia apenas a copy do responsável (mais completa, com link de agendamento)
      log('INFO', 'same_phone_detected', { phone: guardianPhone });
      const guardianResult = await sendLink(
        data.guardian_whatsapp,
        guardianMsg,
        CALENDAR_LINK_URL,
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

      // 2. Mensagem para o responsável (com link preview)
      if (data.guardian_whatsapp) {
        const guardianResult = await sendLink(
          data.guardian_whatsapp,
          guardianMsg,
          CALENDAR_LINK_URL,
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
