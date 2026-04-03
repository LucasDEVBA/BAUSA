const functions = require("@google-cloud/functions-framework");
const https = require("https");

// ─── Configuração via variáveis de ambiente (NUNCA hardcode) ────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "Bolsa Atleta USA <contato@bolsaatletausa.com>";
const INTERNAL_EMAIL = process.env.INTERNAL_EMAIL || "contato@bolsaatletausa.com";
const LOGO_URL = process.env.LOGO_URL || "https://nikrlikwghqcxcjzthmc.supabase.co/storage/v1/object/public/public-assets/logo-bsa.jpg";

// ─── Helpers ────────────────────────────────────────────────────
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseFromEmail = (fromString) => {
  const match = fromString.match(/^(.+)\s*<(.+)>$/);
  return {
    name: match ? match[1].trim() : "Bolsa Atleta USA",
    email: match ? match[2].trim() : "contato@bolsaatletausa.com",
  };
};

const httpRequest = (options, postData) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on("error", (e) => reject(e));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timeout (10s)"));
    });
    req.write(postData);
    req.end();
  });
};

// ─── Provider 1: Resend (primário) ──────────────────────────────
const sendViaResend = async (to, subject, html) => {
  const postData = JSON.stringify({
    from: FROM_EMAIL,
    to: [to],
    subject,
    html,
  });

  const options = {
    hostname: "api.resend.com",
    path: "/emails",
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  };

  const result = await httpRequest(options, postData);
  if (result.statusCode >= 400) {
    throw new Error(`Resend HTTP ${result.statusCode}: ${result.body}`);
  }
  return { provider: "resend", statusCode: result.statusCode, body: result.body };
};

// ─── Provider 2: Brevo (fallback) ───────────────────────────────
const sendViaBrevo = async (to, subject, html) => {
  const from = parseFromEmail(FROM_EMAIL);
  const postData = JSON.stringify({
    sender: { name: from.name, email: from.email },
    to: [{ email: to }],
    subject,
    htmlContent: html,
  });

  const options = {
    hostname: "api.brevo.com",
    path: "/v3/smtp/email",
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    },
  };

  const result = await httpRequest(options, postData);
  if (result.statusCode >= 400) {
    throw new Error(`Brevo HTTP ${result.statusCode}: ${result.body}`);
  }
  return { provider: "brevo", statusCode: result.statusCode, body: result.body };
};

// ─── Envio com fallback automático ──────────────────────────────
const sendEmailWithFallback = async (to, subject, html, label) => {
  if (!to || !to.includes("@")) {
    console.log(JSON.stringify({
      level: "WARN", action: "email_skip", label,
      reason: "Email inválido ou ausente", to: to || "null",
    }));
    return { success: false, reason: "invalid_email" };
  }

  const providers = [
    { name: "resend", fn: sendViaResend, available: !!RESEND_API_KEY },
    { name: "brevo", fn: sendViaBrevo, available: !!BREVO_API_KEY },
  ];

  for (const provider of providers) {
    if (!provider.available) {
      console.log(JSON.stringify({
        level: "WARN", action: "provider_skip", provider: provider.name,
        label, reason: "API key não configurada",
      }));
      continue;
    }

    try {
      const result = await provider.fn(to, subject, html);
      console.log(JSON.stringify({
        level: "INFO", action: "email_sent", provider: result.provider,
        label, to, statusCode: result.statusCode,
      }));
      return { success: true, provider: result.provider };
    } catch (error) {
      console.log(JSON.stringify({
        level: "ERROR", action: "email_failed", provider: provider.name,
        label, to, error: error.message,
      }));
      await delay(500);
    }
  }

  console.log(JSON.stringify({
    level: "CRITICAL", action: "all_providers_failed", label, to,
    message: "NENHUM provider conseguiu enviar o email",
  }));
  return { success: false, reason: "all_providers_failed" };
};

// ─── Validação do payload ───────────────────────────────────────
const validatePayload = (data) => {
  const errors = [];
  if (!data) return { valid: false, errors: ["Payload vazio"] };
  if (!data.email || !data.email.includes("@")) errors.push("Campo 'email' ausente ou inválido");
  if (!data.athlete_name || data.athlete_name.trim().length === 0) errors.push("Campo 'athlete_name' ausente ou vazio");
  return { valid: errors.length === 0, errors };
};

// ─── Sanitização (previne XSS) ─────────────────────────────────
const sanitize = (str) => {
  if (!str || typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
};

// ─── Template de E-mail para Atleta/Responsável ─────────────────
const getHtmlTemplate = (name, type) => {
  const safeName = sanitize(name);
  const colors = {
    primary: "#1A365D",
    secondary: "#9B2C2C",
    accent: "#C53030",
  };

  const title = type === "athlete"
    ? `Candidatura Recebida, ${safeName}`
    : `Candidatura Recebida: ${safeName}`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bolsa Atleta USA</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f4f4f4;" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" style="max-width:600px;width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);" cellpadding="0" cellspacing="0">

          <!-- Header com Logo -->
          <tr>
            <td style="padding:40px 40px 30px 40px;text-align:center;background:linear-gradient(135deg, ${colors.primary} 0%, #2C5282 100%);border-radius:12px 12px 0 0;">
              <img src="${LOGO_URL}" alt="Bolsa Atleta USA" style="max-width:220px;height:auto;display:block;margin:0 auto;">
            </td>
          </tr>

          <!-- Badge -->
          <tr>
            <td style="padding:30px 40px 0 40px;text-align:center;">
              <div style="display:inline-block;background:linear-gradient(90deg, ${colors.secondary} 0%, ${colors.accent} 100%);color:#ffffff;padding:8px 24px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;box-shadow:0 2px 4px rgba(155,44,44,0.2);">
                Candidatura Confirmada
              </div>
            </td>
          </tr>

          <!-- Título -->
          <tr>
            <td style="padding:30px 40px 0 40px;">
              <h1 style="margin:0;color:${colors.primary};font-size:26px;font-weight:700;line-height:1.3;text-align:center;">
                ${title}
              </h1>
            </td>
          </tr>

          <!-- Conteúdo -->
          <tr>
            <td style="padding:25px 40px 40px 40px;">
              <div style="color:#2D3748;font-size:16px;line-height:1.7;">
                <p style="margin:0 0 18px 0;">
                  Confirmamos o recebimento das suas informações.
                </p>
                <p style="margin:0 0 18px 0;">
                  A avaliação considera o momento estratégico do jovem atleta, a visão da família, a viabilidade real de inserção qualificada no sistema educacional esportivo americano e a disponibilidade limitada de vagas nos projetos conduzidos pela Bolsa Atleta USA.
                </p>
                <p style="margin:0 0 18px 0;">
                  Trabalhamos com número restrito de famílias por ciclo, garantindo acompanhamento estruturado e padrão elevado de execução.
                </p>
                <p style="margin:0;font-weight:600;color:${colors.primary};">
                  Nossa equipe retornará em até 48 horas úteis com o posicionamento institucional acerca da continuidade do processo.
                </p>
              </div>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 40px 40px;text-align:center;">
              <a href="https://bolsaatletausa.com" style="display:inline-block;background:linear-gradient(90deg, ${colors.primary} 0%, #2C5282 100%);color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 2px 4px rgba(26,54,93,0.2);">
                Acessar Nosso Site
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:30px 40px;background-color:#F7FAFC;border-radius:0 0 12px 12px;border-top:1px solid #E2E8F0;">
              <p style="margin:0;font-size:13px;color:#718096;text-align:center;line-height:1.6;">
                &copy; ${new Date().getFullYear()} Bolsa Atleta USA. Todos os direitos reservados.<br>
                <span style="font-size:11px;">Este é um e-mail automático, por favor não responda.</span>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// ─── Template interno (notificação para a equipe) ───────────────
const getInternalTemplate = (data) => {
  const colors = {
    primary: "#1A365D",
    secondary: "#9B2C2C",
    success: "#38A169",
    border: "#E2E8F0",
  };

  const formatValue = (value) => {
    if (!value || value === "" || value === null || value === undefined) {
      return '<span style="color:#A0AEC0;font-style:italic;">Não informado</span>';
    }
    return sanitize(String(value));
  };

  const timestamp = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "short",
  });

  const buildSection = (title, rows) => {
    const rowsHtml = rows.map((r, i) => {
      const border = i < rows.length - 1 ? `border-bottom:1px solid ${colors.border};` : '';
      return `<tr>
        <td style="padding:10px;font-weight:600;color:#4A5568;width:200px;${border}">${r.label}</td>
        <td style="padding:10px;color:#2D3748;${border}${r.style || ''}">${formatValue(r.value)}</td>
      </tr>`;
    }).join('');

    return `<tr><td style="padding:0 30px 30px 30px;">
      <h2 style="margin:0 0 20px 0;color:${colors.primary};font-size:18px;font-weight:600;border-bottom:2px solid ${colors.secondary};padding-bottom:8px;">${title}</h2>
      <table style="width:100%;border-collapse:collapse;" cellpadding="0" cellspacing="0">${rowsHtml}</table>
    </td></tr>`;
  };

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f4f4f4;" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:30px 20px;">
        <table role="presentation" style="max-width:700px;width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" cellpadding="0" cellspacing="0">

          <tr>
            <td style="padding:30px;background:linear-gradient(135deg, ${colors.primary} 0%, #2C5282 100%);border-radius:8px 8px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">🎯 Novo Lead Recebido</h1>
              <p style="margin:8px 0 0 0;color:#E2E8F0;font-size:14px;">${timestamp}</p>
            </td>
          </tr>

          ${buildSection('Informações do Atleta', [
            { label: 'Nome Completo', value: data.athlete_name },
            { label: 'Data de Nascimento', value: data.birth_date },
            { label: 'Idade', value: data.age ? data.age + ' anos' : null },
            { label: 'WhatsApp do Atleta', value: data.athlete_whatsapp },
            { label: 'E-mail', value: data.email },
            { label: 'Série/Ano', value: data.school_year },
            { label: 'Instagram', value: data.instagram },
            { label: 'Vídeo Highlights', value: data.video_highlights },
          ])}

          ${buildSection('Base Educacional', [
            { label: 'Escola Atual', value: data.current_school },
            { label: 'Cidade/Estado', value: data.school_city_state },
            { label: 'Modelo Educacional', value: data.education_model },
            { label: 'Desempenho Acadêmico', value: data.academic_performance },
            { label: 'Nível de Inglês', value: data.english_level },
          ])}

          ${buildSection('Trajetória Esportiva', [
            { label: 'Posição', value: data.position },
            { label: 'Histórico de Clubes', value: data.club_history, style: 'white-space:pre-wrap;' },
            { label: 'Conquistas', value: data.achievements, style: 'white-space:pre-wrap;' },
          ])}

          ${buildSection('Perfil e Decisão Familiar', [
            { label: 'Momento de Início', value: data.start_timing },
            { label: 'Direção do Projeto', value: data.project_direction },
            { label: 'Perfil Comportamental', value: data.behavioral_profile },
            { label: 'Comprometimento', value: data.youth_commitment },
            { label: 'Decisão Familiar', value: data.family_decision_structure },
            { label: 'Faixa de Investimento', value: data.investment_range, style: `font-weight:600;color:${colors.secondary};` },
          ])}

          ${buildSection('Responsável Legal', [
            { label: 'Nome', value: data.guardian_name },
            { label: 'Profissão', value: data.guardian_profession },
            { label: 'WhatsApp', value: data.guardian_whatsapp },
            { label: 'E-mail', value: data.guardian_email },
          ])}

          ${buildSection('Endereço Residencial', [
            { label: 'CEP', value: data.address_cep },
            { label: 'Rua', value: data.address_street },
            { label: 'Número', value: data.address_number },
            { label: 'Complemento', value: data.address_complement },
            { label: 'Bairro', value: data.address_neighborhood },
            { label: 'Cidade', value: data.address_city },
            { label: 'Estado', value: data.address_state },
          ])}

          ${buildSection('Informações Técnicas', [
            { label: 'Submission ID', value: data.submission_id, style: 'font-family:monospace;font-size:12px;' },
            { label: 'User Agent', value: data.user_agent, style: 'font-family:monospace;font-size:11px;color:#718096;' },
          ])}

          <tr>
            <td style="padding:20px 30px;background-color:#F7FAFC;border-radius:0 0 8px 8px;border-top:1px solid ${colors.border};">
              <p style="margin:0;font-size:12px;color:#718096;text-align:center;">
                E-mail automático gerado pelo sistema | Bolsa Atleta USA
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// ─── Cloud Function principal ───────────────────────────────────
functions.http("sendMessages", async (req, res) => {
  const startTime = Date.now();

  // ─── Autenticação via secret compartilhado ──────────────────
  if (WEBHOOK_SECRET) {
    const incoming = req.headers["x-webhook-secret"];
    if (incoming !== WEBHOOK_SECRET) {
      console.log(JSON.stringify({ level: "WARN", action: "auth_failed", ip: req.ip }));
      return res.status(401).send({ success: false, error: "Unauthorized" });
    }
  }

  try {
    const data = req.body.record || req.body;

    const validation = validatePayload(data);
    if (!validation.valid) {
      console.log(JSON.stringify({
        level: "WARN", action: "validation_failed",
        errors: validation.errors, receivedFields: data ? Object.keys(data) : [],
      }));
      return res.status(400).send({
        success: false, message: "Dados inválidos", errors: validation.errors,
      });
    }

    console.log(JSON.stringify({
      level: "INFO", action: "processing_start",
      athlete: data.athlete_name, email: data.email,
    }));

    const results = [];

    // Verifica se email do atleta e responsável são o mesmo
    const sameEmail = data.guardian_email &&
      data.guardian_email.trim().toLowerCase() === data.email.trim().toLowerCase();

    if (sameEmail) {
      // Mesmo email: envia apenas a copy do responsável (mais completa)
      console.log(JSON.stringify({ level: "INFO", action: "same_email_detected", email: data.email }));

      const guardianResult = await sendEmailWithFallback(
        data.email,
        `Candidatura Recebida - Bolsa Atleta USA`,
        getHtmlTemplate(data.athlete_name, "guardian"),
        "RESPONSAVEL_ONLY"
      );
      results.push({ label: "RESPONSAVEL_ONLY (same email)", ...guardianResult });
      await delay(600);

    } else {
      // Emails diferentes: envia para ambos

      // 1. E-mail para o Atleta
      const athleteResult = await sendEmailWithFallback(
        data.email,
        `Candidatura Recebida - Bolsa Atleta USA`,
        getHtmlTemplate(data.athlete_name, "athlete"),
        "ATLETA"
      );
      results.push({ label: "ATLETA", ...athleteResult });
      await delay(600);

      // 2. E-mail para o Responsável
      if (data.guardian_email) {
        const guardianResult = await sendEmailWithFallback(
          data.guardian_email,
          `Candidatura Recebida - Bolsa Atleta USA`,
          getHtmlTemplate(data.athlete_name, "guardian"),
          "RESPONSAVEL"
        );
        results.push({ label: "RESPONSAVEL", ...guardianResult });
        await delay(600);
      } else {
        console.log(JSON.stringify({
          level: "INFO", action: "guardian_skip",
          reason: "Email do responsável não informado",
        }));
      }
    }

    // 3. E-mail interno (sempre)
    const internalResult = await sendEmailWithFallback(
      INTERNAL_EMAIL,
      `🎯 Novo Lead: ${sanitize(data.athlete_name)}`,
      getInternalTemplate(data),
      "INTERNO"
    );
    results.push({ label: "INTERNO", ...internalResult });

    const totalSent = results.filter((r) => r.success).length;
    const totalFailed = results.filter((r) => !r.success).length;
    const durationMs = Date.now() - startTime;

    console.log(JSON.stringify({
      level: totalFailed > 0 ? "WARN" : "INFO",
      action: "processing_complete",
      athlete: data.athlete_name,
      totalSent, totalFailed, durationMs, results,
    }));

    res.status(200).send({
      success: true,
      message: `Processado: ${totalSent} enviados, ${totalFailed} falharam`,
      results, durationMs,
    });

  } catch (error) {
    const durationMs = Date.now() - startTime;
    console.log(JSON.stringify({
      level: "CRITICAL", action: "unhandled_error",
      error: error.message, stack: error.stack, durationMs,
    }));
    res.status(500).send({
      success: false, error: "Erro interno no processamento de emails",
    });
  }
});
