const functions = require("@google-cloud/functions-framework");
const https = require("https");

// ─── Configuração via variáveis de ambiente (NUNCA hardcode) ────
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "Bolsa Atleta USA <contato@bolsaatletausa.com>";
const INTERNAL_EMAIL = process.env.INTERNAL_EMAIL || "contato@bolsaatletausa.com";
const LOGO_URL = process.env.LOGO_URL || "https://nikrlikwghqcxcjzthmc.supabase.co/storage/v1/object/public/public-assets/logo-bsa.jpg";
// Config dinâmica (/automacoes) — OPCIONAIS: sem eles a CF se comporta
// exatamente como hoje (toggles ativos + destino INTERNAL_EMAIL da env).
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA = process.env.SUPABASE_SCHEMA || "public";
// Runs de observabilidade vão p/ public SEMPRE — o Engine (apps/crm) lê public em todos os ambientes, igual ao whatsapp_mensagens da zapi-inbox. NÃO usar SUPABASE_SCHEMA aqui.
const RUNS_SCHEMA = "public";

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
    // Guard p/ GETs sem body (fetchEmailConfig) — write(undefined) lançaria
    // ERR_INVALID_ARG_TYPE. Paridade com as demais CFs do repo.
    if (postData) req.write(postData);
    req.end();
  });
};

// ─── Provider 1: Resend (primário) ──────────────────────────────
const sendViaResend = async (to, subject, html, opts = {}) => {
  const postData = JSON.stringify({
    // from selecionável (multi-conta do Engine) — o domínio já foi validado
    // no handler; o Resend aceita qualquer endereço do domínio verificado.
    from: opts.from ? `Bolsa Atleta USA <${opts.from}>` : FROM_EMAIL,
    to: [to],
    subject,
    html,
    // reply_to: respostas caem na caixa da contato@ (espelhada pelo
    // email-inbox-sync) — essencial para o compositor do Engine.
    ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    ...(opts.cc ? { cc: opts.cc } : {}),
    ...(opts.attachments ? { attachments: opts.attachments } : {}),
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
  // id do Resend correlaciona com os webhooks de métrica (CF email-events).
  let providerId = null;
  try { providerId = JSON.parse(result.body)?.id ?? null; } catch { /* body não-JSON */ }
  return { provider: "resend", statusCode: result.statusCode, body: result.body, providerId };
};

// ─── Provider 2: Brevo (fallback) ───────────────────────────────
const sendViaBrevo = async (to, subject, html, opts = {}) => {
  const from = parseFromEmail(FROM_EMAIL);
  const postData = JSON.stringify({
    sender: { name: from.name, email: opts.from || from.email },
    to: [{ email: to }],
    subject,
    htmlContent: html,
    ...(opts.replyTo ? { replyTo: { email: opts.replyTo } } : {}),
    ...(opts.cc ? { cc: opts.cc.map((e) => ({ email: e })) } : {}),
    ...(opts.attachments
      ? { attachment: opts.attachments.map((a) => ({ name: a.filename, content: a.content })) }
      : {}),
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
const sendEmailWithFallback = async (to, subject, html, label, opts = {}) => {
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
      const result = await provider.fn(to, subject, html, opts);
      console.log(JSON.stringify({
        level: "INFO", action: "email_sent", provider: result.provider,
        label, to, statusCode: result.statusCode,
      }));
      return { success: true, provider: result.provider, providerId: result.providerId ?? null };
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

// ─── Sanitização de HTML de assinatura (denylist endurecida) ───────────
// Assinatura rica é autorada pelo CEO no Engine, mas passa por aqui como
// defesa em profundidade: remove todo vetor ativo, preservando formatação
// (b/i/u/font/color/img/a/table…). ITERATIVA até estabilizar — remoção de
// passagem única reconstrói tag aninhada (<scr<script>ipt>). Handlers on*
// aceitam `/` como separador de atributo (<img/onerror=…>), por isso a
// classe [\s/"'] no prefixo. Espelho: sanitizarHtmlAssinatura no Engine.
const sanitizeSignatureHtml = (html) => {
  if (!html || typeof html !== "string") return "";
  let out = html;
  let prev;
  do {
    prev = out;
    out = out
      .replace(/<\s*\/?\s*(script|style|iframe|object|embed|form|link|meta|svg|math|base|template)[^>]*>/gi, "")
      .replace(/[\s/"']on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/(href|src|formaction|action|xlink:href|srcdoc|data)\s*=\s*("|')?\s*(javascript|vbscript):[^"'\s>]*("|')?/gi, "")
      .replace(/(href|src|formaction|action)\s*=\s*("|')?\s*data\s*:\s*text\/html[^"'\s>]*("|')?/gi, "")
      .replace(/expression\s*\(/gi, "")
      .replace(/url\s*\(\s*("|')?\s*(javascript|vbscript):/gi, "url(");
  } while (out !== prev);
  return out;
};

// ─── Wrapper HTML compartilhado (header + footer Bolsa Atleta USA) ───
// Recebe: badge label (string), title (string), bodyHtml (string com <p> tags),
// ctaHref (string), ctaLabel (string). Retorna HTML completo.
const renderEmailShell = ({ badge, title, bodyHtml, ctaHref = 'https://bolsaatletausa.com', ctaLabel = 'Acessar Nosso Site' }) => {
  const colors = {
    primary: '#1A365D',
    secondary: '#9B2C2C',
    accent: '#C53030',
  };
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Bolsa Atleta USA</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f4f4f4;" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
    <table role="presentation" style="max-width:600px;width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);" cellpadding="0" cellspacing="0">
      <tr><td style="padding:40px 40px 30px 40px;text-align:center;background:linear-gradient(135deg, ${colors.primary} 0%, #2C5282 100%);border-radius:12px 12px 0 0;">
        <img src="${LOGO_URL}" alt="Bolsa Atleta USA" style="max-width:220px;height:auto;display:block;margin:0 auto;">
      </td></tr>
      <tr><td style="padding:30px 40px 0 40px;text-align:center;">
        <div style="display:inline-block;background:linear-gradient(90deg, ${colors.secondary} 0%, ${colors.accent} 100%);color:#ffffff;padding:8px 24px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;box-shadow:0 2px 4px rgba(155,44,44,0.2);">
          ${badge}
        </div>
      </td></tr>
      <tr><td style="padding:30px 40px 0 40px;">
        <h1 style="margin:0;color:${colors.primary};font-size:26px;font-weight:700;line-height:1.3;text-align:center;">${title}</h1>
      </td></tr>
      <tr><td style="padding:25px 40px 40px 40px;">
        <div style="color:#2D3748;font-size:16px;line-height:1.7;">${bodyHtml}</div>
      </td></tr>
      <tr><td style="padding:0 40px 40px 40px;text-align:center;">
        <a href="${ctaHref}" style="display:inline-block;background:linear-gradient(90deg, ${colors.primary} 0%, #2C5282 100%);color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 2px 4px rgba(26,54,93,0.2);">${ctaLabel}</a>
      </td></tr>
      <tr><td style="padding:30px 40px;background-color:#F7FAFC;border-radius:0 0 12px 12px;border-top:1px solid #E2E8F0;">
        <p style="margin:0;font-size:13px;color:#718096;text-align:center;line-height:1.6;">&copy; ${new Date().getFullYear()} Bolsa Atleta USA. Todos os direitos reservados.<br><span style="font-size:11px;">Este é um e-mail automático, por favor não responda.</span></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
};

// ─── Wrapper HTML do e-mail CUSTOM (automation-engine) ─────────
// Intencionalmente leve: logo + parágrafos do texto + footer — sem o
// template pesado dos e-mails de confirmação. O texto chega PLAIN
// (placeholders já renderizados pela engine); é sanitizado aqui e as
// quebras de linha viram parágrafos.
// Mídia opcional (I2): media.imageUrl embutida no topo do corpo;
// media.linkUrl vira botão/CTA (rótulo media.linkTitle, default "Saiba
// mais"). URLs já validadas http(s) no handler; aqui são HTML-escapadas
// (sanitize) para o contexto de atributo — sem mídia, o HTML é idêntico
// ao histórico.
const getCustomEmailHtml = (text, media = {}) => {
  const paragraphs = String(text)
    .split(/\r?\n+/)
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0)
    .map((linha) => `<p style="margin:0 0 16px 0;">${sanitize(linha)}</p>`)
    .join("");
  // Guarda de scheme DENTRO do render (defesa em profundidade além da
  // validação do handler): URL fora de http(s) — ex.: javascript: — jamais
  // vira src/href, mesmo se um caller futuro pular a validação de entrada.
  const safeUrl = (u) =>
    typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? sanitize(u.trim()) : null;
  const safeImageUrl = safeUrl(media.imageUrl);
  const safeLinkUrl = safeUrl(media.linkUrl);
  const imageHtml = safeImageUrl
    ? `<tr><td style="padding:28px 40px 0 40px;">
        <img src="${safeImageUrl}" alt="" style="width:100%;height:auto;display:block;border-radius:8px;">
      </td></tr>`
    : "";
  const buttonHtml = safeLinkUrl
    ? `<tr><td style="padding:0 40px 32px 40px;text-align:center;">
        <a href="${safeLinkUrl}" style="display:inline-block;background:linear-gradient(90deg, #1A365D 0%, #2C5282 100%);color:#ffffff;padding:13px 30px;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(26,54,93,0.2);">${sanitize(media.linkTitle) || "Saiba mais"}</a>
      </td></tr>`
    : "";
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Bolsa Atleta USA</title></head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f4f4f4;" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px;">
    <table role="presentation" style="max-width:600px;width:100%;border-collapse:collapse;background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);" cellpadding="0" cellspacing="0">
      <tr><td style="padding:32px 40px 24px 40px;text-align:center;border-bottom:1px solid #E2E8F0;">
        <img src="${LOGO_URL}" alt="Bolsa Atleta USA" style="max-width:180px;height:auto;display:block;margin:0 auto;">
      </td></tr>
      ${imageHtml}
      <tr><td style="padding:32px 40px;">
        <div style="color:#2D3748;font-size:16px;line-height:1.7;">${paragraphs}</div>
      </td></tr>
      ${media.signatureHtml
        ? `<tr><td style="padding:0 40px 24px 40px;">
        <div style="border-top:1px solid #E2E8F0;padding-top:16px;color:#2D3748;font-size:14px;line-height:1.6;">${sanitizeSignatureHtml(media.signatureHtml)}</div>
      </td></tr>`
        : ""}
      ${buttonHtml}
      <tr><td style="padding:24px 40px;background-color:#F7FAFC;border-radius:0 0 12px 12px;border-top:1px solid #E2E8F0;">
        <p style="margin:0;font-size:13px;color:#718096;text-align:center;line-height:1.6;">&copy; ${new Date().getFullYear()} Bolsa Atleta USA. Todos os direitos reservados.<br><span style="font-size:11px;">Este é um e-mail automático, por favor não responda.</span></p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
};

// ─── Template HTML "Cedo demais" (early_potential, 48h) ────────
const getEarlyPotentialHtml = (athleteName, guardianName) => {
  const safeAthlete = sanitize(athleteName);
  const safeGuardian = sanitize(guardianName) || 'Família';
  const nextYear = new Date().getUTCFullYear() + 1;
  const bodyHtml = `
    <p style="margin:0 0 18px 0;">Olá, <strong>${safeGuardian}</strong>.</p>
    <p style="margin:0 0 18px 0;">Concluímos a análise inicial do perfil de <strong>${safeAthlete}</strong> e identificamos <strong>potencial real</strong>. Por isso queremos cuidar desse projeto com a atenção que merece — e isso passa por respeitar o timing certo.</p>
    <p style="margin:0 0 18px 0;">Atuamos com famílias intencionalmente selecionadas, dentro da metodologia <em>Educação Esportiva Inteligente®</em>. O trabalho estratégico que conduzimos faz mais sentido a partir do 8º ano: é quando começa a construção concreta da trajetória esportiva, acadêmica e linguística que será avaliada pelas universidades americanas.</p>
    <p style="margin:0 0 18px 0;font-weight:600;color:#1A365D;">📅 Vamos retomar este contato em novembro de ${nextYear} para uma análise estratégica completa.</p>
    <p style="margin:0 0 18px 0;">Nessa ocasião, vamos avaliar a trajetória esportiva construída até lá, a performance acadêmica, a evolução no inglês e a direção do projeto familiar.</p>
    <p style="margin:0;">Reservamos esse compromisso. Enquanto isso, <em>o trabalho de base começa agora — mantenham o sonho vivo</em>.</p>
  `;
  return renderEmailShell({
    badge: 'Candidatura Recebida',
    title: `Identificamos potencial em ${safeAthlete}`,
    bodyHtml,
  });
};

// ─── Template HTML "Tarde demais" (late_timing, 48h) ───────────
const getLateTimingHtml = (athleteName, guardianName) => {
  const safeAthlete = sanitize(athleteName);
  const safeGuardian = sanitize(guardianName) || 'Família';
  const bodyHtml = `
    <p style="margin:0 0 18px 0;">Olá, <strong>${safeGuardian}</strong>.</p>
    <p style="margin:0 0 18px 0;">Recebemos a candidatura de <strong>${safeAthlete}</strong> e queremos compartilhar uma análise sincera sobre o timing.</p>
    <p style="margin:0 0 18px 0;">A janela ideal de aplicação para o sistema <strong>NCAA/NAIA</strong> ocorre durante o high school ou imediatamente após a conclusão (em geral, até 12 meses). Pelas informações que recebemos, esse momento já passou — o que muda significativamente o cenário competitivo.</p>
    <p style="margin:0 0 18px 0;font-weight:600;color:#1A365D;">Isso não encerra o sonho americano — apenas redireciona o caminho.</p>
    <p style="margin:0 0 10px 0;">Para casos assim, normalmente avaliamos:</p>
    <ul style="margin:0 0 18px 0;padding-left:20px;color:#2D3748;">
      <li style="margin-bottom:8px;"><strong>Junior College (NJCAA)</strong> — caminho de 2 anos como porta de entrada para NCAA via transferência</li>
      <li style="margin-bottom:8px;"><strong>Aplicação direta</strong> em universidades fora do sistema esportivo competitivo</li>
      <li><strong>Transfer student</strong> — reaplicação após histórico universitário inicial</li>
    </ul>
    <p style="margin:0 0 18px 0;">Nosso método é focado em atletas dentro da janela competitiva ideal, onde temos a maior eficácia comprovada. Mas valorizamos a transparência: <em>se desejarem conversar sobre esses caminhos alternativos, estaremos à disposição</em>.</p>
    <p style="margin:0;">Agradecemos a confiança em compartilhar esse momento conosco.</p>
  `;
  return renderEmailShell({
    badge: 'Análise de Timing',
    title: `Sobre a candidatura de ${safeAthlete}`,
    bodyHtml,
  });
};

// ─── Template HTML retorno agendado (scheduled_return) ─────────
const getScheduledReturnHtml = (athleteName, guardianName, scheduleUrl) => {
  const safeAthlete = sanitize(athleteName);
  const safeGuardian = sanitize(guardianName) || 'Família';
  const safeUrl = scheduleUrl || 'https://bolsaatletausa.com';
  const bodyHtml = `
    <p style="margin:0 0 18px 0;">Olá, <strong>${safeGuardian}</strong>.</p>
    <p style="margin:0 0 18px 0;">Como combinamos no ano passado, voltamos para retomar a conversa sobre o futuro internacional de <strong>${safeAthlete}</strong>.</p>
    <p style="margin:0 0 18px 0;">Identificamos potencial naquele primeiro contato e, neste momento estratégico, queremos entender a evolução nos últimos 12 meses:</p>
    <ul style="margin:0 0 18px 0;padding-left:20px;color:#2D3748;">
      <li style="margin-bottom:6px;">Como está a trajetória esportiva?</li>
      <li style="margin-bottom:6px;">E o desempenho acadêmico?</li>
      <li style="margin-bottom:6px;">Como foi a evolução no inglês?</li>
      <li>Vocês mantêm o sonho americano?</li>
    </ul>
    <p style="margin:0 0 18px 0;font-weight:600;color:#1A365D;">📅 Reservamos esse retorno para vocês.</p>
    <p style="margin:0;">Se ainda fizer sentido, gostaríamos de agendar uma <strong>Reunião Estratégica Individual</strong> com <strong>Leandro Ribeiro</strong> para analisar as possibilidades específicas de <strong>${safeAthlete}</strong>.</p>
  `;
  return renderEmailShell({
    badge: 'Retorno Programado',
    title: `Como combinamos: vamos retomar o projeto de ${safeAthlete}`,
    bodyHtml,
    ctaHref: safeUrl,
    ctaLabel: 'Agendar Reunião Estratégica',
  });
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
// ─── Config dinâmica das automações de sistema (/automacoes) ────
// sistema_automacoes_ativas: toggles on/off (campo ausente = ATIVA).
// email_config: destino_interno (ausente = env INTERNAL_EMAIL).
// Config indisponível JAMAIS bloqueia o envio — fallback {} (fail-open).
const fetchEmailConfig = async () => {
  const out = { ativas: {}, emailCfg: {} };
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return out;
  try {
    const u = new URL(
      `${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=in.(sistema_automacoes_ativas,email_config)&select=chave,valor`
    );
    const result = await httpRequest({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "GET",
      headers: {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Accept-Profile": SUPABASE_SCHEMA,
      },
    });
    if (result.statusCode >= 400) throw new Error(`GET config: ${result.statusCode}`);
    for (const row of JSON.parse(result.body) || []) {
      if (row.chave === "sistema_automacoes_ativas" && row.valor && typeof row.valor === "object") {
        out.ativas = row.valor;
      }
      if (row.chave === "email_config" && row.valor && typeof row.valor === "object") {
        out.emailCfg = row.valor;
      }
    }
  } catch (e) {
    console.log(JSON.stringify({ level: "WARN", action: "email_config_fallback", error: e.message }));
  }
  return out;
};

// ─── Âncora da automação de SISTEMA (aba Execuções de /automacoes) ─────────
// ID fixo semeado pela migration 20260709220205_automacoes_sistema_runs
// (guard de CI: tests/automacao-runs-sistema.test.js compara CF ↔ migration).
const RUN_EMAIL_CONFIRMACAO_ID = "a0000000-0000-4000-8000-000000000008";

// ─── Registrar execução em automacao_runs (observabilidade) ────────────────
// SEGURANÇA: runs de sistema nascem SEMPRE em estado TERMINAL (sucesso/erro,
// tentativas=1, proxima_tentativa_at=null) — a automation-engine NUNCA os
// executa (a fila dela só seleciona pendente/erro-com-retry/executando).
// Falha no registro JAMAIS afeta o fluxo principal (WARN e segue).
// PII: contexto/resultado sem telefone/e-mail — só o nome do atleta.
const registrarRunSistema = async ({ automacaoId, ok, lead = null, acoes = [] }) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
    const u = new URL(`${SUPABASE_URL}/rest/v1/automacao_runs`);
    const postData = JSON.stringify({
      automacao_id: automacaoId,
      status: ok ? "sucesso" : "erro",
      tentativas: 1,
      proxima_tentativa_at: null,
      executado_at: new Date().toISOString(),
      gatilho_origem_tabela: lead && lead.id ? "form_submissions" : null,
      gatilho_origem_id: (lead && lead.id) || null,
      contexto: lead ? { athlete_name: lead.athlete_name || null } : {},
      resultado: { acoes },
    });
    const result = await httpRequest({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Profile": RUNS_SCHEMA,
        "Prefer": "return=minimal",
      },
    }, postData);
    if (result.statusCode >= 400) {
      throw new Error(`POST automacao_runs ${result.statusCode}: ${(result.body || "").substring(0, 200)}`);
    }
  } catch (e) {
    console.log(JSON.stringify({ level: "WARN", action: "run_sistema_fallback", error: e.message }));
  }
};

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
    // ─── Caminho CUSTOM (automation-engine → ação enviar_email_custom) ───
    // Payload: { customEmail: { to, subject, text } }. Early-return ANTES do
    // fluxo de confirmação por INSERT — com customEmail ausente, o caminho
    // existente segue byte-intacto (zero impacto no webhook do formulário).
    const customEmail = req.body?.customEmail;
    if (customEmail) {
      const errors = [];
      if (!customEmail.to || typeof customEmail.to !== "string" || !customEmail.to.includes("@")) {
        errors.push("Campo 'to' ausente ou inválido");
      }
      if (!customEmail.subject || typeof customEmail.subject !== "string" || customEmail.subject.trim().length === 0) {
        errors.push("Campo 'subject' ausente ou vazio");
      }
      if (!customEmail.text || typeof customEmail.text !== "string" || customEmail.text.trim().length === 0) {
        errors.push("Campo 'text' ausente ou vazio");
      }
      // Mídia opcional (I2): quando presente, URLs precisam ser http(s)
      // (defesa em profundidade — o Zod do builder já valida na entrada;
      // aqui protege contra scheme injection em href/src, ex.: javascript:).
      const isHttpUrl = (v) => typeof v === "string" && /^https?:\/\//i.test(v.trim());
      if (customEmail.imageUrl !== undefined && !isHttpUrl(customEmail.imageUrl)) {
        errors.push("Campo 'imageUrl' inválido (URL http/https)");
      }
      if (customEmail.linkUrl !== undefined && !isHttpUrl(customEmail.linkUrl)) {
        errors.push("Campo 'linkUrl' inválido (URL http/https)");
      }
      if (customEmail.linkTitle !== undefined && typeof customEmail.linkTitle !== "string") {
        errors.push("Campo 'linkTitle' inválido");
      }
      if (customEmail.replyTo !== undefined &&
          (typeof customEmail.replyTo !== "string" || !customEmail.replyTo.includes("@"))) {
        errors.push("Campo 'replyTo' inválido");
      }
      // from restrito ao domínio próprio — remetente arbitrário aqui seria
      // spoofing autenticado pela nossa chave do Resend.
      if (customEmail.from !== undefined &&
          (typeof customEmail.from !== "string" ||
           !customEmail.from.toLowerCase().endsWith("@bolsaatletausa.com"))) {
        errors.push("Campo 'from' inválido (precisa ser @bolsaatletausa.com)");
      }
      // cc: usado pelo Engine p/ colocar o CEO em cópia nos envios da Head
      // (forçado na server action — aqui só valida e entrega). Restrito ao
      // domínio próprio: o único uso real é interno, e cc arbitrário seria
      // capacidade genérica de spam autenticada pela nossa chave.
      if (customEmail.cc !== undefined) {
        if (!Array.isArray(customEmail.cc) || customEmail.cc.length > 3 ||
            customEmail.cc.some((e) => typeof e !== "string" ||
              !e.trim().toLowerCase().endsWith("@bolsaatletausa.com"))) {
          errors.push("Campo 'cc' inválido (até 3 e-mails @bolsaatletausa.com)");
        }
      }
      // signatureHtml: assinatura RICA (imagem/negrito/cor) montada no Engine.
      // Sanitização dura no servidor: e-mail não executa script, mas markup
      // ativo aqui seria vetor se o HTML vazasse p/ outra superfície.
      if (customEmail.signatureHtml !== undefined &&
          (typeof customEmail.signatureHtml !== "string" || customEmail.signatureHtml.length > 20000)) {
        errors.push("Campo 'signatureHtml' inválido (máx 20000 chars)");
      }
      // Anexos: até 5 arquivos, 8MB somados (base64 conta ~+33% — teto do
      // Resend é 40MB, mas o gargalo real é o bodySizeLimit do chamador).
      if (customEmail.attachments !== undefined) {
        if (!Array.isArray(customEmail.attachments) || customEmail.attachments.length > 5) {
          errors.push("Campo 'attachments' inválido (máximo 5 arquivos)");
        } else {
          let totalB64 = 0;
          for (const a of customEmail.attachments) {
            if (!a || typeof a.filename !== "string" || a.filename.trim().length === 0 ||
                a.filename.length > 120 || typeof a.content !== "string") {
              errors.push("Anexo inválido (filename + content base64 obrigatórios)");
              break;
            }
            totalB64 += a.content.length;
          }
          if (totalB64 > 11 * 1024 * 1024) {
            errors.push("Anexos excedem o limite total de 8MB");
          }
        }
      }
      if (errors.length > 0) {
        console.log(JSON.stringify({
          level: "WARN", action: "custom_email_validation_failed", errors,
        }));
        return res.status(400).send({ success: false, message: "customEmail inválido", errors });
      }

      console.log(JSON.stringify({
        level: "INFO", action: "custom_email_start", to: customEmail.to,
        withImage: !!customEmail.imageUrl, withLink: !!customEmail.linkUrl,
      }));
      const result = await sendEmailWithFallback(
        customEmail.to,
        customEmail.subject.trim(),
        getCustomEmailHtml(customEmail.text, {
          imageUrl: customEmail.imageUrl ? customEmail.imageUrl.trim() : undefined,
          linkUrl: customEmail.linkUrl ? customEmail.linkUrl.trim() : undefined,
          linkTitle: typeof customEmail.linkTitle === "string" ? customEmail.linkTitle.trim() : undefined,
          signatureHtml: typeof customEmail.signatureHtml === "string" ? customEmail.signatureHtml : undefined,
        }),
        "CUSTOM",
        {
          replyTo: customEmail.replyTo ? customEmail.replyTo.trim() : undefined,
          from: customEmail.from ? customEmail.from.trim().toLowerCase() : undefined,
          cc: Array.isArray(customEmail.cc) && customEmail.cc.length > 0
            ? customEmail.cc.map((e) => e.trim().toLowerCase())
            : undefined,
          attachments: Array.isArray(customEmail.attachments) && customEmail.attachments.length > 0
            ? customEmail.attachments.map((a) => ({ filename: a.filename.trim(), content: a.content }))
            : undefined,
        }
      );
      const durationMs = Date.now() - startTime;
      console.log(JSON.stringify({
        level: result.success ? "INFO" : "ERROR",
        action: "custom_email_complete",
        to: customEmail.to, success: result.success, durationMs,
      }));
      // Falha de envio responde 502 — o chamador (automation-engine) trata
      // >=400 como erro e faz retry com backoff.
      return res.status(result.success ? 200 : 502).send({
        success: result.success,
        ...(result.success
          ? { provider: result.provider, providerId: result.providerId ?? null }
          : { error: result.reason }),
        durationMs,
      });
    }

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

    // messageType: 'initial' (default, candidatura recebida),
    //               'early_potential' (cedo demais),
    //               'late_timing' (tarde demais),
    //               'scheduled_return' (retorno agendado em novembro)
    //
    // BUG HISTÓRICO (commit 7514c9a, 2026-05-15): esta linha referenciava
    // `payload?.messageType`, mas a variável `payload` nunca existiu nesse
    // escopo — só `req.body`. Resultado: ReferenceError em 100% das chamadas
    // entre 2026-05-17 (deploy) e 2026-05-29 (este fix), capturado pelo catch
    // genérico na linha 642 e retornado como HTTP 500 "Erro interno". Nenhum
    // e-mail saiu nesse período. Fix: usar `req.body?.messageType` em vez de
    // `payload?.messageType` para que o messageType opcionalmente passado no
    // root do payload (irmão de `record`) também seja respeitado.
    const messageType = req.body?.messageType || data.messageType || 'initial';

    console.log(JSON.stringify({
      level: "INFO", action: "processing_start",
      athlete: data.athlete_name, email: data.email, messageType,
    }));

    // Determina subject + HTML conforme messageType
    const buildHtmlAndSubject = (recipientType /* 'athlete' | 'guardian' */) => {
      const recipientName = recipientType === 'guardian'
        ? (data.guardian_name || data.athlete_name)
        : data.athlete_name;
      if (messageType === 'early_potential') {
        return {
          subject: 'Bolsa Atleta USA — Identificamos potencial no perfil',
          html: getEarlyPotentialHtml(data.athlete_name, recipientName),
        };
      }
      if (messageType === 'late_timing') {
        return {
          subject: 'Bolsa Atleta USA — Análise de timing da candidatura',
          html: getLateTimingHtml(data.athlete_name, recipientName),
        };
      }
      if (messageType === 'scheduled_return') {
        return {
          subject: 'Bolsa Atleta USA — Retomando o projeto, como combinado',
          html: getScheduledReturnHtml(data.athlete_name, recipientName, data.schedule_url),
        };
      }
      // default 'initial'
      return {
        subject: 'Candidatura Recebida - Bolsa Atleta USA',
        html: getHtmlTemplate(data.athlete_name, recipientType),
      };
    };

    const results = [];

    // Config dinâmica (/automacoes): toggles + destino do e-mail interno.
    // Fail-open: config indisponível = comportamento atual (tudo ativo).
    const { ativas, emailCfg } = await fetchEmailConfig();
    const confirmacaoAtiva = ativas.email_confirmacao !== false;
    const internoAtivo = ativas.email_interno !== false;
    const internalTo =
      typeof emailCfg.destino_interno === "string" && emailCfg.destino_interno.trim()
        ? emailCfg.destino_interno.trim()
        : INTERNAL_EMAIL;

    // Verifica se email do atleta e responsável são o mesmo
    const sameEmail = data.guardian_email &&
      data.guardian_email.trim().toLowerCase() === data.email.trim().toLowerCase();

    if (!confirmacaoAtiva) {
      // Toggle email_confirmacao cobre TODOS os e-mails automáticos ao lead
      // deste fluxo (initial + early_potential/late_timing/scheduled_return) —
      // semântica documentada na UI. O interno (toggle próprio) sai abaixo;
      // o caminho customEmail (envios manuais/billing) NÃO passa por aqui.
      console.log(JSON.stringify({
        level: "WARN", action: "email_confirmacao_desativado_skip",
        athlete: data.athlete_name, messageType,
      }));
      results.push({ label: "CONFIRMACAO", success: true, skipped: true });
    } else if (sameEmail) {
      // Mesmo email: envia apenas a copy do responsável (mais completa)
      console.log(JSON.stringify({ level: "INFO", action: "same_email_detected", email: data.email }));

      const { subject, html } = buildHtmlAndSubject('guardian');
      const guardianResult = await sendEmailWithFallback(
        data.email,
        subject,
        html,
        "RESPONSAVEL_ONLY"
      );
      results.push({ label: "RESPONSAVEL_ONLY (same email)", ...guardianResult });
      await delay(600);

    } else {
      // Emails diferentes: envia para ambos

      // 1. E-mail para o Atleta
      const athleteCopy = buildHtmlAndSubject('athlete');
      const athleteResult = await sendEmailWithFallback(
        data.email,
        athleteCopy.subject,
        athleteCopy.html,
        "ATLETA"
      );
      results.push({ label: "ATLETA", ...athleteResult });
      await delay(600);

      // 2. E-mail para o Responsável
      if (data.guardian_email) {
        const guardianCopy = buildHtmlAndSubject('guardian');
        const guardianResult = await sendEmailWithFallback(
          data.guardian_email,
          guardianCopy.subject,
          guardianCopy.html,
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

    // 3. E-mail interno: apenas para fluxo 'initial' (avisa equipe sobre novo lead).
    // Mensagens de timing não geram aviso interno (são automações pós-qualificação).
    // Destino editável em /automacoes (email_config.destino_interno) + toggle próprio.
    if (messageType === 'initial' && internoAtivo) {
      const internalResult = await sendEmailWithFallback(
        internalTo,
        `🎯 Novo Lead: ${sanitize(data.athlete_name)}`,
        getInternalTemplate(data),
        "INTERNO"
      );
      results.push({ label: "INTERNO", ...internalResult });
    } else if (messageType === 'initial') {
      console.log(JSON.stringify({
        level: "WARN", action: "email_interno_desativado_skip", athlete: data.athlete_name,
      }));
      results.push({ label: "INTERNO", success: true, skipped: true });
    }

    // Skips por toggle (/automacoes) não contam como enviados nem falhas.
    const totalSkipped = results.filter((r) => r.skipped).length;
    const totalSent = results.filter((r) => r.success && !r.skipped).length;
    const totalFailed = results.filter((r) => !r.success).length;
    const durationMs = Date.now() - startTime;

    console.log(JSON.stringify({
      level: totalFailed > 0 ? "WARN" : "INFO",
      action: "processing_complete",
      athlete: data.athlete_name,
      totalSent, totalSkipped, totalFailed, durationMs, results,
    }));

    // Registro em automacao_runs (aba Execuções) — UM run por request do
    // fluxo `record` (o caminho customEmail NÃO chega aqui: early-return).
    // PII: detalhe usa só os labels (ATLETA/RESPONSAVEL/INTERNO), sem e-mail.
    await registrarRunSistema({
      automacaoId: RUN_EMAIL_CONFIRMACAO_ID,
      ok: totalFailed === 0,
      lead: data,
      acoes: results.map((r) => ({
        tipo: "email_confirmacao",
        status: r.success ? "ok" : "falha",
        detalhe: r.skipped
          ? `${r.label}: pulado (toggle)`
          : `${r.label}: ${r.success ? "enviado" : "falhou"}${r.provider ? ` via ${r.provider}` : ""}`,
      })),
    });

    res.status(200).send({
      success: true,
      message: `Processado: ${totalSent} enviados, ${totalSkipped} pulados, ${totalFailed} falharam`,
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
