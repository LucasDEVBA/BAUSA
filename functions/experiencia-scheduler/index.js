const functions = require('@google-cloud/functions-framework');
const https = require('https');

// ════════════════════════════════════════════════════════════════════════
// experiencia-scheduler — Pós-venda: NPS aos 6 meses + alerta de inatividade
//
// Cloud Scheduler diário (10:00 BRT). Dois checks independentes:
//
//   1. NPS automático (outreach à família): famílias embarcadas há 180+ dias
//      (fase embarcado_inicial/acompanhamento) sem pesquisa enviada recebem
//      UM WhatsApp perguntando a nota 0–10. CAS por nps_enviado_at (marca
//      ANTES de enviar — falha de envio não reprocessa/spamma). A resposta
//      chega pelo WhatsApp normal; a Head registra a nota manualmente no
//      Engine (action registrarNps → crm_experiencia.nps_6meses).
//
//   2. Alerta de inatividade ATIVO (in-app): a RPC familias_em_alerta_
//      inatividade lista famílias sem contato acima do threshold da fase.
//      Para cada uma (cooldown de 7 dias via ultimo_alerta_inatividade_at,
//      CAS): notificação p/ Head + CEO/CTO e tarefa p/ Head ("Contatar
//      família <atleta>", prazo 24h, prioridade alta).
//
// NÃO é outreach de lead: os alvos são FAMÍLIAS CLIENTES (crm_experiencia).
// Não usa classificação Gemini nem timing_status — invariantes próprios no
// guard tests/experiencia-scheduler-invariants.test.js.
//
// Os dados do Engine vivem SEMPRE em public (padrão monitor-health): os
// headers Accept-Profile/Content-Profile são hardcoded 'public'. A instância
// UAT/DEV (SUPABASE_SCHEMA != public) roda em modo dry — loga o que faria sem
// enviar/gravar. `?dry=1` força dry-run em qualquer ambiente.
// ════════════════════════════════════════════════════════════════════════

const WEBHOOK_SECRET       = process.env.WEBHOOK_SECRET;
const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_SCHEMA      = process.env.SUPABASE_SCHEMA || 'public';
const SEND_WHATSAPP_URL    = process.env.SEND_WHATSAPP_URL;
const CEO_WHATSAPP         = process.env.CEO_WHATSAPP || ''; // opcional (não usado nos envios; reservado)

// Os DADOS do Engine são os de produção — sempre public (padrão monitor-health).
const DATA_SCHEMA = 'public';

const NPS_MIN_DIAS = 180;          // pesquisa NPS aos 6 meses de jornada
const ALERTA_COOLDOWN_DIAS = 7;    // 1 alerta de inatividade por família/semana
const MAX_NPS_POR_TICK = 20;       // teto por execução (20×8s ≈ 160s, folga sob deadline 300s)
const DELAY_MS = 8000;             // intervalo entre envios (anti-ban)
const DIA_MS = 86400000;
const TAREFA_PRAZO_HORAS = 24;

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
  [write ? 'Content-Profile' : 'Accept-Profile']: DATA_SCHEMA,
});

// ─── Texto da pesquisa NPS (editável em configuracoes_sistema.nps_mensagem,
//     campo `texto`; ausente/vazio → este default) ────────────────────────
const NPS_MENSAGEM_DEFAULT =
  'Olá {{responsavel}}! Aqui é a equipe da Bolsa Atleta USA. 💙\n\n' +
  'Já são 6 meses de jornada do(a) {{atleta}} com a gente, e a sua opinião vale muito: ' +
  'de 0 a 10, o quanto você recomendaria a BAUSA para outra família?\n\n' +
  'É só responder esta mensagem com a nota. Obrigado! 🙏';

const renderNpsMensagem = (tpl, vars) =>
  String(tpl || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{{${k}}}`));

// ─── Config (fail-open → {}) — padrão monitor-health ─────────────────────
const lerConfig = async (chave) => {
  try {
    const result = await httpRequest(
      `${SUPABASE_URL}/rest/v1/configuracoes_sistema?chave=eq.${chave}&select=valor`,
      { method: 'GET', headers: supaHeaders(false) },
    );
    if (result.statusCode >= 400) throw new Error(`config HTTP ${result.statusCode}`);
    const rows = JSON.parse(result.body);
    return (Array.isArray(rows) && rows[0]?.valor) || {};
  } catch (error) {
    // Padrão do guard sistema-automacoes-ativas: log + degrada p/ default
    log('WARN', 'sistema_config_fallback', { chave, error: error.message });
    return {};
  }
};

// ─── Check 1: famílias elegíveis à pesquisa NPS ──────────────────────────
const fetchNpsElegiveis = async () => {
  const corte = new Date(Date.now() - NPS_MIN_DIAS * DIA_MS).toISOString();
  const select =
    'id,created_at,atleta:atletas(nome_completo,whatsapp,responsavel:responsaveis(nome,whatsapp))';
  const url =
    `${SUPABASE_URL}/rest/v1/crm_experiencia?select=${encodeURIComponent(select)}` +
    `&fase=in.(embarcado_inicial,acompanhamento)` +
    `&nps_enviado_at=is.null&deleted_at=is.null` +
    `&created_at=lt.${encodeURIComponent(corte)}` +
    `&order=created_at.asc&limit=${MAX_NPS_POR_TICK}`;
  const r = await httpRequest(url, { headers: supaHeaders(false) });
  if (r.statusCode >= 400) throw new Error(`fetch nps elegiveis: ${r.statusCode} ${r.body}`);
  return JSON.parse(r.body);
};

// Telefone: responsável (responsaveis.whatsapp) com fallback atletas.whatsapp
const extractContatoNps = (exp) => {
  const atleta = exp.atleta;
  if (!atleta) return null;
  const resp = atleta.responsavel;
  const phone = resp?.whatsapp || atleta.whatsapp || null;
  if (!phone) return null;
  return {
    phone,
    responsavelNome: resp?.nome || 'família',
    atletaNome: atleta.nome_completo || 'atleta',
  };
};

// ─── CAS atômico: marca nps_enviado_at ANTES de enviar ───────────────────
// Filtro `nps_enviado_at=is.null` + Prefer return=representation: resposta
// vazia = outra instância venceu a corrida → pular (nunca duplica).
const casMarcarNpsEnviado = async (experienciaId) => {
  const url =
    `${SUPABASE_URL}/rest/v1/crm_experiencia?id=eq.${experienciaId}` +
    `&nps_enviado_at=is.null&deleted_at=is.null`;
  const r = await httpRequest(
    url,
    { method: 'PATCH', headers: { ...supaHeaders(true), Prefer: 'return=representation' } },
    JSON.stringify({ nps_enviado_at: new Date().toISOString() }),
  );
  if (r.statusCode >= 400) throw new Error(`CAS nps_enviado_at: ${r.statusCode} ${r.body}`);
  const rows = JSON.parse(r.body);
  return Array.isArray(rows) && rows.length > 0;
};

// Envio: o CAS já marcou ANTES daqui — falha 4xx/5xx NÃO reenvia (sem spam),
// mas logamos para o marco não se perder em silêncio.
const sendWhatsApp = async (phone, message, experienciaId) => {
  if (!SEND_WHATSAPP_URL || !phone) return { skipped: true };
  // Contrato do caminho custom da CF send-whatsapp (mesmo da billing-reminders):
  // messageType meeting_confirmed + customMessage + phone → envia direto.
  const payload = JSON.stringify({ messageType: 'meeting_confirmed', customMessage: message, phone });
  const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) };
  if (WEBHOOK_SECRET) headers['x-webhook-secret'] = WEBHOOK_SECRET;
  const r = await httpRequest(SEND_WHATSAPP_URL, { method: 'POST', headers }, payload);
  if (r.statusCode >= 400) log('WARN', 'nps_whatsapp_failed', { experienciaId, statusCode: r.statusCode });
  return { statusCode: r.statusCode };
};

// ─── Check 2: alerta de inatividade (RPC + CAS com cooldown) ─────────────
const fetchAlertasInatividade = async () => {
  const r = await httpRequest(
    `${SUPABASE_URL}/rest/v1/rpc/familias_em_alerta_inatividade`,
    { method: 'POST', headers: supaHeaders(true) },
    '{}',
  );
  if (r.statusCode >= 400) throw new Error(`rpc inatividade: ${r.statusCode} ${r.body}`);
  const rows = JSON.parse(r.body);
  return Array.isArray(rows) ? rows : [];
};

// CAS com cooldown embutido: só marca (e alerta) se nunca alertou OU o último
// alerta tem mais de ALERTA_COOLDOWN_DIAS. Resposta vazia = cooldown/corrida.
const casMarcarAlertaInatividade = async (experienciaId) => {
  const corte = new Date(Date.now() - ALERTA_COOLDOWN_DIAS * DIA_MS).toISOString();
  const url =
    `${SUPABASE_URL}/rest/v1/crm_experiencia?id=eq.${experienciaId}&deleted_at=is.null` +
    `&or=(ultimo_alerta_inatividade_at.is.null,ultimo_alerta_inatividade_at.lt.${encodeURIComponent(corte)})`;
  const r = await httpRequest(
    url,
    { method: 'PATCH', headers: { ...supaHeaders(true), Prefer: 'return=representation' } },
    JSON.stringify({ ultimo_alerta_inatividade_at: new Date().toISOString() }),
  );
  if (r.statusCode >= 400) throw new Error(`CAS ultimo_alerta_inatividade_at: ${r.statusCode} ${r.body}`);
  const rows = JSON.parse(r.body);
  return Array.isArray(rows) && rows.length > 0;
};

// Destinatários internos: Head de Sucesso (tarefa + notificação) e CEO/CTO
// (notificação espelhada — regra "toda notificação espelhada ao CEO").
const loadDestinatarios = async () => {
  try {
    const r = await httpRequest(
      `${SUPABASE_URL}/rest/v1/user_profiles?papel=in.(ceo,cto,head_sucesso)&ativo=eq.true&select=id,papel`,
      { headers: supaHeaders(false) },
    );
    if (r.statusCode >= 400) return { heads: [], ceos: [] };
    const rows = JSON.parse(r.body);
    return {
      heads: rows.filter((u) => u.papel === 'head_sucesso').map((u) => u.id),
      ceos: rows.filter((u) => u.papel === 'ceo' || u.papel === 'cto').map((u) => u.id),
    };
  } catch (e) {
    log('WARN', 'load_destinatarios_failed', { error: e.message });
    return { heads: [], ceos: [] };
  }
};

const insertNotificacoes = async (destinatarioIds, titulo, mensagem, experienciaId) => {
  if (!destinatarioIds.length) return;
  const rows = destinatarioIds.map((id) => ({
    destinatario_id: id,
    titulo,
    mensagem,
    tipo: 'experiencia_alerta',
    severidade: 'media',
    link: `/familias-crm?familia=${experienciaId}`,
  }));
  try {
    await httpRequest(
      `${SUPABASE_URL}/rest/v1/notificacoes`,
      { method: 'POST', headers: { ...supaHeaders(true), Prefer: 'return=minimal' } },
      JSON.stringify(rows),
    );
  } catch (e) {
    log('WARN', 'notificacao_failed', { experienciaId, error: e.message });
  }
};

const insertTarefaHead = async (responsavelId, alerta) => {
  const prazo = new Date(Date.now() + TAREFA_PRAZO_HORAS * 3600000).toISOString();
  const row = {
    titulo: `Contatar família ${alerta.atleta_nome}`,
    descricao:
      `Família há ${alerta.dias} dias sem contato (fase ${alerta.fase}, ` +
      `threshold ${alerta.threshold} dias). Registrar contato no Engine.`,
    responsavel_id: responsavelId,
    prazo,
    prioridade: 'alta',
    experiencia_id: alerta.experiencia_id,
    modulo_origem: 'experiencia',
    criada_automaticamente: true,
  };
  try {
    const r = await httpRequest(
      `${SUPABASE_URL}/rest/v1/tarefas`,
      { method: 'POST', headers: { ...supaHeaders(true), Prefer: 'return=minimal' } },
      JSON.stringify(row),
    );
    if (r.statusCode >= 400) {
      log('WARN', 'tarefa_failed', { experienciaId: alerta.experiencia_id, statusCode: r.statusCode, body: r.body });
    }
  } catch (e) {
    log('WARN', 'tarefa_failed', { experienciaId: alerta.experiencia_id, error: e.message });
  }
};

// ─── Cloud Function principal ─────────────────────────────────────────────
functions.http('experienciaScheduler', async (req, res) => {
  const startTime = Date.now();

  // Permite chamadas do Cloud Scheduler (sem secret) e chamadas autenticadas
  // (padrão process-pending-whatsapp/monitor-health — o job do scheduler.sh
  // não envia header; secret errado continua sendo rejeitado).
  if (WEBHOOK_SECRET && req.headers['x-webhook-secret']) {
    if (req.headers['x-webhook-secret'] !== WEBHOOK_SECRET) {
      log('WARN', 'auth_failed');
      return res.status(401).send({ success: false, error: 'unauthorized' });
    }
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    log('CRITICAL', 'missing_env', {});
    return res.status(500).send({ success: false, error: 'missing env' });
  }

  try {
    // Dry-run: instância não-PRD (dados vivem em public — só a PRD age) ou ?dry=1
    const dryRun = SUPABASE_SCHEMA !== 'public' || req.query?.dry === '1';

    // Toggles editáveis em /automacoes (fail-open: ausente = ativo)
    const ativas = await lerConfig('sistema_automacoes_ativas');
    const npsDesligado = ativas.nps_automatico === false;
    const alertaDesligado = ativas.alerta_inatividade === false;

    const stats = {
      npsVerificadas: 0, npsEnviados: 0, npsPulados: 0,
      alertasDetectados: 0, alertasEmitidos: 0, alertasPulados: 0,
      erros: 0,
    };

    // ── Check 1: pesquisa NPS aos 6 meses ─────────────────────────────────
    if (npsDesligado) {
      log('INFO', 'nps_desligado', {});
    } else {
      const npsCfg = await lerConfig('nps_mensagem');
      const template =
        typeof npsCfg.texto === 'string' && npsCfg.texto.trim() ? npsCfg.texto : NPS_MENSAGEM_DEFAULT;

      const familias = await fetchNpsElegiveis();
      stats.npsVerificadas = familias.length;

      for (const exp of familias) {
        try {
          const contato = extractContatoNps(exp);
          if (!contato) {
            // Sem telefone não é erro: loga e pula (sem marcar — se o contato
            // for cadastrado depois, a família entra no próximo tick).
            stats.npsPulados++;
            log('INFO', 'nps_skipped_no_phone', { experienciaId: exp.id });
            continue;
          }

          const mensagem = renderNpsMensagem(template, {
            responsavel: contato.responsavelNome,
            atleta: contato.atletaNome,
          });

          if (dryRun) {
            stats.npsPulados++;
            log('INFO', 'dry_nps_would_send', { experienciaId: exp.id });
            continue;
          }

          // CAS ANTES do envio — se não fomos os primeiros, outra instância cuidou
          const won = await casMarcarNpsEnviado(exp.id);
          if (!won) {
            stats.npsPulados++;
            continue;
          }

          await sendWhatsApp(contato.phone, mensagem, exp.id);
          stats.npsEnviados++;
          log('INFO', 'nps_sent', { experienciaId: exp.id });
          await delay(DELAY_MS);
        } catch (e) {
          stats.erros++;
          log('WARN', 'nps_error', { experienciaId: exp.id, error: e.message });
        }
      }
    }

    // ── Check 2: alerta de inatividade ativo ──────────────────────────────
    if (alertaDesligado) {
      log('INFO', 'alerta_inatividade_desligado', {});
    } else {
      const alertas = await fetchAlertasInatividade();
      stats.alertasDetectados = alertas.length;

      const { heads, ceos } = alertas.length > 0 ? await loadDestinatarios() : { heads: [], ceos: [] };

      for (const alerta of alertas) {
        try {
          if (dryRun) {
            stats.alertasPulados++;
            log('INFO', 'dry_alerta_would_notify', {
              experienciaId: alerta.experiencia_id,
              dias: alerta.dias,
              fase: alerta.fase,
            });
            continue;
          }

          // CAS com cooldown de 7 dias — resposta vazia = já alertado/corrida
          const won = await casMarcarAlertaInatividade(alerta.experiencia_id);
          if (!won) {
            stats.alertasPulados++;
            continue;
          }

          const titulo = `Família sem contato: ${alerta.atleta_nome}`;
          const mensagem =
            `${alerta.atleta_nome}: ${alerta.dias} dias sem contato ` +
            `(fase ${alerta.fase}, limite ${alerta.threshold} dias).`;
          await insertNotificacoes([...heads, ...ceos], titulo, mensagem, alerta.experiencia_id);

          const responsavelTarefa = heads[0] || ceos[0] || null;
          if (responsavelTarefa) {
            await insertTarefaHead(responsavelTarefa, alerta);
          } else {
            log('WARN', 'tarefa_sem_responsavel', { experienciaId: alerta.experiencia_id });
          }

          stats.alertasEmitidos++;
          log('INFO', 'alerta_inatividade_emitido', {
            experienciaId: alerta.experiencia_id,
            dias: alerta.dias,
            fase: alerta.fase,
          });
        } catch (e) {
          stats.erros++;
          log('WARN', 'alerta_error', { experienciaId: alerta.experiencia_id, error: e.message });
        }
      }
    }

    const durationMs = Date.now() - startTime;
    log('INFO', 'tick_done', { dryRun, npsDesligado, alertaDesligado, ...stats, durationMs });
    return res.status(200).send({ success: true, dryRun, ...stats, durationMs });
  } catch (error) {
    log('ERROR', 'experiencia_scheduler_error', { error: error.message });
    return res.status(500).send({ success: false, error: error.message });
  }
});
