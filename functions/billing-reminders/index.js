const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ════════════════════════════════════════════════════════════════════════
// billing-reminders — Régua de cobrança automática (D-3 a D+15)
//
// A régua NÃO é outreach de lead: os alvos são FAMÍLIAS COM CONTRATO ASSINADO
// devendo uma parcela. Por isso NÃO usa classificação Gemini (QUENTE/MORNO).
// Elegibilidade = parcela status previsto/atrasado + contrato ativo + marco
// ainda não enviado (trava CAS por coluna regua_<marco>_at).
//
// A cada tick (diário), dispara NO MÁXIMO 1 marco por parcela — o primeiro
// não-enviado cujo limiar de dias foi atingido. Isso dá a cadência D-3→D+15
// num scheduler diário e faz catch-up gentil (1 marco/dia) em backlog, sem spam.
//
// Cobrança é transacional (dívida do próprio cliente): envia se houver contato,
// independentemente dos flags de marketing. Texto vem de config regua_mensagens
// (editável em Configurações) com fallback hardcoded.
// ════════════════════════════════════════════════════════════════════════

const WEBHOOK_SECRET       = process.env.WEBHOOK_SECRET;
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA      = process.env.SUPABASE_SCHEMA || 'public';
const SEND_WHATSAPP_URL    = process.env.SEND_WHATSAPP_URL;
const SEND_MESSAGES_URL    = process.env.SEND_MESSAGES_URL;

const MAX_PARCELAS_POR_TICK = 45;   // teto por execução (45×8s ≈ 360s, folga sob deadline 600s)
const DELAY_MS = 8000;              // intervalo entre envios (anti-ban)
const DIA_MS = 86400000;

const log = (level, action, details = {}) => console.log(JSON.stringify({ level, action, ...details }));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const httpRequest = (url, options, postData) =>
  new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: options.method || 'GET', headers: options.headers || {} },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body }));
      },
    );
    req.on('error', reject);
    req.setTimeout(90000, () => {
      req.destroy();
      reject(new Error('Request timeout (90s)'));
    });
    if (postData) req.write(postData);
    req.end();
  });

const supaHeaders = (write) => ({
  'Content-Type': 'application/json',
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  [write ? 'Content-Profile' : 'Accept-Profile']: SUPABASE_SCHEMA,
});

// ─── Marcos da régua (ordem = prioridade de disparo por tick) ───────────
// dtd = dias até o vencimento (venc − hoje). Negativo = vencido.
const CHECKPOINTS = [
  { id: 'dneg3', col: 'regua_dneg3_at', match: (dtd, st) => st === 'previsto' && dtd >= 1 && dtd <= 3, whatsapp: true, email: false },
  { id: 'd0', col: 'regua_d0_at', match: (dtd, st) => st === 'previsto' && dtd === 0, whatsapp: true, email: true },
  { id: 'd1', col: 'regua_d1_at', match: (dtd) => dtd <= -1, whatsapp: true, email: false, marcaAtrasado: true },
  { id: 'd3', col: 'regua_d3_at', match: (dtd) => dtd <= -3, whatsapp: false, email: true },
  { id: 'd7', col: 'regua_d7_at', match: (dtd) => dtd <= -7, whatsapp: true, email: true, notifica: 'war_room' },
  { id: 'd15', col: 'regua_d15_at', match: (dtd) => dtd <= -15, whatsapp: false, email: true, notifica: 'ceo' },
];

// ─── Fallback de mensagens (usado se config regua_mensagens ausente) ────
const MENSAGENS_FALLBACK = {
  dneg3: { whatsapp: 'Olá {responsavel_nome}! Passando para lembrar que a parcela {numero_parcela} de {valor} do projeto do(a) {atleta_nome} vence em {vencimento}. Qualquer dúvida, é só chamar!' },
  d0: { whatsapp: 'Olá {responsavel_nome}! Hoje ({vencimento}) vence a parcela {numero_parcela} de {valor} do projeto do(a) {atleta_nome}. Se já pagou, desconsidere.', email_assunto: 'Vencimento hoje — {atleta_nome}', email: 'Olá {responsavel_nome}, hoje vence a parcela {numero_parcela} ({valor}) do projeto do(a) {atleta_nome}. Se já pagou, desconsidere.' },
  d1: { whatsapp: 'Olá {responsavel_nome}, a parcela {numero_parcela} de {valor} (venc. {vencimento}) do projeto do(a) {atleta_nome} consta em aberto. Deve ser esquecimento — qualquer coisa, fale com a gente.' },
  d3: { email_assunto: 'Pagamento pendente — {atleta_nome}', email: 'Prezado(a) {responsavel_nome}, não identificamos o pagamento da parcela {numero_parcela} ({valor}, venc. {vencimento}) do projeto do(a) {atleta_nome}. Pedimos a gentileza de regularizar.' },
  d7: { whatsapp: 'Olá {responsavel_nome}, a parcela {numero_parcela} de {valor} do projeto do(a) {atleta_nome} está com 7 dias de atraso. Queremos ajudar — fale com a gente.', email_assunto: 'Parcela em atraso — {atleta_nome}', email: 'Prezado(a) {responsavel_nome}, a parcela {numero_parcela} ({valor}) do projeto do(a) {atleta_nome} está com 7 dias de atraso. Entre em contato para combinarmos uma solução.' },
  d15: { email_assunto: 'Importante: 15 dias de atraso — {atleta_nome}', email: 'Prezado(a) {responsavel_nome}, a parcela {numero_parcela} ({valor}) do projeto do(a) {atleta_nome} está com 15 dias de atraso. Precisamos conversar com urgência.' },
};

const formatBRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
const formatData = (iso) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const renderTemplate = (tpl, vars) =>
  String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));

// ─── Config de mensagens (uma leitura por tick) ─────────────────────────
const loadMensagens = async () => {
  try {
    const url = `${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=eq.regua_mensagens&select=valor`;
    const r = await httpRequest(url, { headers: supaHeaders(false) });
    if (r.statusCode >= 400) return MENSAGENS_FALLBACK;
    const rows = JSON.parse(r.body);
    return rows[0]?.valor || MENSAGENS_FALLBACK;
  } catch (e) {
    log('WARN', 'load_mensagens_failed', { error: e.message });
    return MENSAGENS_FALLBACK;
  }
};

// ─── CEOs/CTOs (destinatários das notificações internas) ────────────────
const loadCeoIds = async () => {
  try {
    const url = `${SUPABASE_URL}/rest/v1/user_profiles?papel=in.(ceo,cto)&ativo=eq.true&select=id`;
    const r = await httpRequest(url, { headers: supaHeaders(false) });
    if (r.statusCode >= 400) return [];
    return JSON.parse(r.body).map((u) => u.id);
  } catch {
    return [];
  }
};

// ─── Parcelas elegíveis (janela + contato via embed) ────────────────────
// Janela: [hoje-20d, hoje+5d]. O corte de -20d é INTENCIONAL — dívida com
// mais de 20 dias de atraso sai da régua automática (o CEO já foi notificado
// no D+15 e trata manualmente). Dá 5 dias de catch-up para o pior marco (d15,
// dtd=-15). `hoje` é injetado (mesmo instante do dtd — evita divergência de
// borda se o tick cruzar a meia-noite UTC).
const fetchEligibleParcelas = async (hoje) => {
  const de = new Date(hoje.getTime() - 20 * DIA_MS).toISOString().slice(0, 10);
  const ate = new Date(hoje.getTime() + 5 * DIA_MS).toISOString().slice(0, 10);
  const select =
    'id,numero_parcela,valor,vencimento,status,regua_dneg3_at,regua_d0_at,regua_d1_at,regua_d3_at,regua_d7_at,regua_d15_at,' +
    'contrato:contratos_financeiros(id,deleted_at,deal:deals(id,atleta:atletas(nome_completo,responsavel:responsaveis(nome,email,whatsapp,aceite_whatsapp,aceite_email))))';
  const url =
    `${SUPABASE_URL}/rest/v1/parcelas?select=${encodeURIComponent(select)}` +
    `&status=in.(previsto,atrasado)&deleted_at=is.null` +
    `&vencimento=gte.${de}&vencimento=lte.${ate}&order=vencimento.asc&limit=${MAX_PARCELAS_POR_TICK}`;
  const r = await httpRequest(url, { headers: supaHeaders(false) });
  if (r.statusCode >= 400) throw new Error(`fetch parcelas: ${r.statusCode} ${r.body}`);
  return JSON.parse(r.body);
};

// ─── CAS atômico: marca o marco ANTES de enviar ─────────────────────────
const casMark = async (parcelaId, column, marcaAtrasado) => {
  const url = `${SUPABASE_URL}/rest/v1/parcelas?id=eq.${parcelaId}&${column}=is.null&deleted_at=is.null`;
  const patch = { [column]: new Date().toISOString() };
  if (marcaAtrasado) patch.status = 'atrasado';
  const r = await httpRequest(
    url,
    { method: 'PATCH', headers: { ...supaHeaders(true), Prefer: 'return=representation' } },
    JSON.stringify(patch),
  );
  if (r.statusCode >= 400) throw new Error(`CAS ${column}: ${r.statusCode} ${r.body}`);
  const rows = JSON.parse(r.body);
  return Array.isArray(rows) && rows.length > 0;
};

// Envio: o CAS já marcou o marco ANTES daqui, então uma falha 4xx/5xx NÃO
// reenvia (evita loop/spam) — mas logamos para não perder o marco em silêncio.
const sendWhatsApp = async (phone, message, parcelaId, checkpoint) => {
  if (!SEND_WHATSAPP_URL || !phone) return { skipped: true };
  const payload = JSON.stringify({ messageType: 'meeting_confirmed', customMessage: message, phone });
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;
  const r = await httpRequest(SEND_WHATSAPP_URL, { method: 'POST', headers }, payload);
  if (r.statusCode >= 400) log('WARN', 'reminder_whatsapp_failed', { parcelaId, checkpoint, statusCode: r.statusCode });
  return { statusCode: r.statusCode };
};

const sendEmail = async (to, subject, text, parcelaId, checkpoint) => {
  if (!SEND_MESSAGES_URL || !to) return { skipped: true };
  const payload = JSON.stringify({ customEmail: { to, subject, text } });
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;
  const r = await httpRequest(SEND_MESSAGES_URL, { method: 'POST', headers }, payload);
  if (r.statusCode >= 400) log('WARN', 'reminder_email_failed', { parcelaId, checkpoint, statusCode: r.statusCode });
  return { statusCode: r.statusCode };
};

const insertNotificacao = async (ceoIds, titulo, mensagem, severidade) => {
  if (!ceoIds.length) return;
  const rows = ceoIds.map((id) => ({
    destinatario_id: id,
    titulo,
    mensagem,
    tipo: 'cobranca',
    severidade,
    link: '/financeiro',
  }));
  try {
    await httpRequest(
      `${SUPABASE_URL}/rest/v1/notificacoes`,
      { method: 'POST', headers: { ...supaHeaders(true), Prefer: 'return=minimal' } },
      JSON.stringify(rows),
    );
  } catch (e) {
    log('WARN', 'notificacao_failed', { error: e.message });
  }
};

// ─── Resolve contato do responsável a partir do embed ───────────────────
const extractContato = (parcela) => {
  const contrato = parcela.contrato;
  if (!contrato || contrato.deleted_at) return null; // contrato cancelado → não cobra
  const atleta = contrato.deal?.atleta;
  const resp = atleta?.responsavel;
  if (!resp) return null;
  return {
    atletaNome: atleta?.nome_completo || 'atleta',
    responsavelNome: resp.nome || 'responsável',
    whatsapp: resp.whatsapp || null,
    email: resp.email || null,
    // Consentimento por canal (contrato da migration 20260707033339). Sem
    // opt-in do canal a família não recebe — mas o CEO ainda é notificado no
    // D+7/D+15 e trata manualmente.
    aceiteWhatsapp: resp.aceite_whatsapp === true,
    aceiteEmail: resp.aceite_email === true,
  };
};

functions.http('billingReminders', async (req, res) => {
  const startTime = Date.now();
  if (WEBHOOK_SECRET && req.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return res.status(401).send({ success: false, error: 'unauthorized' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log('CRITICAL', 'missing_env', {});
    return res.status(500).send({ success: false, error: 'missing env' });
  }

  const hoje = new Date();
  const hojeMid = Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate());

  let mensagens, ceoIds, parcelas;
  try {
    [mensagens, ceoIds] = await Promise.all([loadMensagens(), loadCeoIds()]);
    parcelas = await fetchEligibleParcelas(hoje);
  } catch (e) {
    log('CRITICAL', 'fetch_failed', { error: e.message });
    return res.status(500).send({ success: false, error: e.message });
  }

  const stats = { verificadas: parcelas.length, enviadas: 0, puladas: 0, erros: 0 };

  for (const p of parcelas) {
    try {
      const vencMid = Date.parse(`${String(p.vencimento).slice(0, 10)}T00:00:00Z`);
      const dtd = Math.round((vencMid - hojeMid) / DIA_MS);

      // Primeiro marco não-enviado cujo limiar foi atingido (1 por tick)
      const cp = CHECKPOINTS.find((c) => c.match(dtd, p.status) && !p[c.col]);
      if (!cp) {
        stats.puladas++;
        continue;
      }

      const contato = extractContato(p);
      if (!contato) {
        // Contrato cancelado ou sem responsável: marca p/ não reprocessar em loop
        await casMark(p.id, cp.col, cp.marcaAtrasado);
        stats.puladas++;
        log('INFO', 'skipped_no_contact', { parcelaId: p.id, checkpoint: cp.id });
        continue;
      }

      // CAS ANTES do envio — se não fomos os primeiros, outra instância cuidou
      const won = await casMark(p.id, cp.col, cp.marcaAtrasado);
      if (!won) {
        stats.puladas++;
        continue;
      }

      const vars = {
        responsavel_nome: contato.responsavelNome,
        atleta_nome: contato.atletaNome,
        valor: formatBRL(p.valor),
        vencimento: formatData(p.vencimento),
        numero_parcela: p.numero_parcela,
      };
      const msg = mensagens[cp.id] || MENSAGENS_FALLBACK[cp.id] || {};

      // Envia só com opt-in do canal (consentimento). Sem contato-consentido,
      // o marco fica marcado (não reprocessa) e o CEO cobre via notificação.
      if (cp.whatsapp && msg.whatsapp && contato.whatsapp && contato.aceiteWhatsapp) {
        await sendWhatsApp(contato.whatsapp, renderTemplate(msg.whatsapp, vars), p.id, cp.id);
      }
      if (cp.email && msg.email && contato.email && contato.aceiteEmail) {
        await sendEmail(contato.email, renderTemplate(msg.email_assunto || 'Bolsa Atleta USA', vars), renderTemplate(msg.email, vars), p.id, cp.id);
      }

      if (cp.notifica === 'war_room') {
        await insertNotificacao(ceoIds, 'Parcela em atraso (7 dias)', `${contato.atletaNome}: parcela ${p.numero_parcela} de ${vars.valor} com 7 dias de atraso.`, 'alta');
      } else if (cp.notifica === 'ceo') {
        await insertNotificacao(ceoIds, 'Cobrança crítica (15 dias)', `${contato.atletaNome}: parcela ${p.numero_parcela} de ${vars.valor} com 15 dias de atraso. Considerar suspensão.`, 'critica');
      }

      stats.enviadas++;
      log('INFO', 'reminder_sent', { parcelaId: p.id, checkpoint: cp.id, dtd });
      await delay(DELAY_MS);
    } catch (e) {
      stats.erros++;
      log('WARN', 'reminder_error', { parcelaId: p.id, error: e.message });
    }
  }

  log('INFO', 'tick_done', { ...stats, durationMs: Date.now() - startTime });
  return res.status(200).send({ success: true, ...stats });
});
