'use strict';

// ════════════════════════════════════════════════════════════════════════
// Núcleo PURO da API de Conversões (sem rede, sem env) — testável com
// `node --test` sem dependências (tests/meta-capi-invariants.test.js).
//
// Regras do Meta para user_data (doc "Customer Information Parameters"):
//   - em/ph/fn/ln/ct/st/zp/country/external_id → SHA-256 do valor normalizado
//   - fbp/fbc/client_ip_address/client_user_agent → SEM hash
//   - evento de site exige client_user_agent
//   - event_time em segundos, no máximo 7 dias atrás
//
// LGPD/menores: o atleta é MENOR DE IDADE — só dados dos RESPONSÁVEIS saem
// daqui. Nenhum campo do atleta (nome, nascimento, WhatsApp, Instagram) entra
// no evento; telefone igual ao do atleta é descartado (o formulário usa o
// WhatsApp do atleta como fallback do responsável).
// ════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const net = require('net');

const EVENT_NAME = 'LeadQualificado';
const CLASSES_QUALIFICADAS = ['QUENTE', 'MORNO'];
// Valor por classe (BRL): permite otimizar por VALOR no futuro.
const VALOR_POR_CLASSE = { QUENTE: 300, MORNO: 100 };
const MOEDA = 'BRL';
// Meta aceita evento de site com até 7 dias; 12h de margem para o envio.
const JANELA_MAX_MS = (7 * 24 - 12) * 3600 * 1000;
const EVENT_SOURCE_URL_PADRAO = 'https://www.bolsaatletausa.com/forms';
const HOST_PROPRIO_RE = /(^|\.)bolsaatletausa\.com$/i;

// Formato oficial + sufixo opcional ("appendix" do Parameter Builder do Meta):
// o Meta pede para repassar o cookie como está, então só barramos lixo.
const FBP_RE = /^fb\.\d\.\d{10,13}\.\d{1,20}(\.[A-Za-z0-9_-]{1,64})?$/;
const FBC_RE = /^fb\.\d\.\d{10,13}\.[A-Za-z0-9_-]{1,500}(\.[A-Za-z0-9_-]{1,64})?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UA_MAX = 1000;

// Prefixo dos descartes PERMANENTES (dado que nunca vai passar). O monitor
// separa estes da fila "queimada" por falha do Meta.
const PREFIXO_DESCARTE = 'descartado:';
// Motivos que se resolvem sozinhos: o lead fica para o próximo tick.
const MOTIVOS_ADIAR = new Set(['qualified_at_no_futuro']);

const ipValido = (ip) => typeof ip === 'string' && ip.length <= 64 && net.isIP(ip) !== 0;

const sha256 = (valor) => crypto.createHash('sha256').update(valor, 'utf8').digest('hex');

const semAcento = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');

const normalizarEmail = (email) => {
  if (!email) return null;
  const e = String(email).trim().toLowerCase();
  return EMAIL_RE.test(e) ? e : null;
};

/** Só dígitos com DDI. Sem `+` e com até 11 dígitos = número BR sem DDI → 55. */
const normalizarTelefone = (telefone) => {
  if (!telefone) return null;
  const original = String(telefone).trim();
  let digitos = original.replace(/\D/g, '');
  if (digitos.startsWith('0')) digitos = digitos.slice(1);
  if (!original.startsWith('+') && digitos.length >= 10 && digitos.length <= 11) digitos = `55${digitos}`;
  return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
};

/** Minúsculas, sem acento, só letras a-z (sem espaço/pontuação). */
const normalizarTexto = (texto) => {
  if (!texto) return null;
  const t = semAcento(texto).toLowerCase().replace(/[^a-z]/g, '');
  return t.length > 0 ? t : null;
};

const partirNome = (nomeCompleto) => {
  if (!nomeCompleto) return { primeiro: null, ultimo: null };
  const partes = String(nomeCompleto).trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { primeiro: null, ultimo: null };
  return {
    primeiro: normalizarTexto(partes[0]),
    ultimo: partes.length > 1 ? normalizarTexto(partes[partes.length - 1]) : null,
  };
};

const normalizarPais = (pais) => {
  const p = String(pais || 'BR').trim().toLowerCase();
  return /^[a-z]{2}$/.test(p) ? p : null;
};

const normalizarCep = (cep) => {
  if (!cep) return null;
  const c = String(cep).toLowerCase().replace(/[^a-z0-9]/g, '');
  return c.length > 0 ? c : null;
};

const normalizarEstado = (estado) => {
  if (!estado) return null;
  const e = semAcento(estado).toLowerCase().replace(/[^a-z]/g, '');
  return e.length === 2 ? e : null;
};

/** URL do evento SEM query/fragmento (não vaza mcp_token, fbclid etc.). */
const urlDoEvento = (landingUrl) => {
  try {
    const u = new URL(String(landingUrl || ''));
    if (u.protocol !== 'https:' || !HOST_PROPRIO_RE.test(u.hostname)) return EVENT_SOURCE_URL_PADRAO;
    return `${u.origin}${u.pathname}`;
  } catch {
    return EVENT_SOURCE_URL_PADRAO;
  }
};

const unicos = (lista) => [...new Set(lista.filter(Boolean))];

/**
 * Monta o evento LeadQualificado de UM cadastro.
 * Retorna { evento } ou { erro } — erro aqui é PERMANENTE (dado que nunca vai
 * passar): a CF para de tentar esse lead.
 */
const montarEvento = (lead, agoraMs) => {
  const classe = lead && lead.qualification_classification;
  if (!CLASSES_QUALIFICADAS.includes(classe)) return { erro: 'classe_nao_qualificada' };

  const qualificadoMs = Date.parse(lead.qualified_at || '');
  if (!Number.isFinite(qualificadoMs)) return { erro: 'sem_qualified_at' };
  if (qualificadoMs > agoraMs + 60_000) return { erro: 'qualified_at_no_futuro' };
  if (agoraMs - qualificadoMs > JANELA_MAX_MS) return { erro: 'fora_da_janela_7d' };
  // Requalificação em massa renova qualified_at de cadastro ANTIGO: o sinal
  // para o Meta é "este clique virou lead bom" — só vale para cadastro recente.
  const enviadoMs = Date.parse(lead.submitted_at || '');
  if (!Number.isFinite(enviadoMs) || agoraMs - enviadoMs > JANELA_MAX_MS) return { erro: 'cadastro_antigo' };

  const ua = typeof lead.user_agent === 'string' ? lead.user_agent.trim() : '';
  if (!ua) return { erro: 'sem_user_agent' };

  const foneAtleta = normalizarTelefone(lead.athlete_whatsapp);
  const emails = unicos([normalizarEmail(lead.guardian_email || lead.email), normalizarEmail(lead.guardian_email_2)]);
  const fones = unicos([normalizarTelefone(lead.guardian_whatsapp), normalizarTelefone(lead.guardian_whatsapp_2)])
    .filter((f) => f !== foneAtleta);
  if (emails.length === 0 && fones.length === 0) return { erro: 'sem_email_e_telefone_do_responsavel' };

  const nome = partirNome(lead.guardian_name);
  const cidade = normalizarTexto(lead.address_city);
  const estado = normalizarEstado(lead.address_state);
  const cep = normalizarCep(lead.address_cep);
  const pais = normalizarPais(lead.address_country);

  const userData = {
    em: emails.map(sha256),
    ph: fones.map(sha256),
    external_id: [sha256(String(lead.id))],
    client_user_agent: ua.slice(0, UA_MAX),
  };
  if (nome.primeiro) userData.fn = [sha256(nome.primeiro)];
  if (nome.ultimo) userData.ln = [sha256(nome.ultimo)];
  if (cidade) userData.ct = [sha256(cidade)];
  if (estado) userData.st = [sha256(estado)];
  if (cep) userData.zp = [sha256(cep)];
  if (pais) userData.country = [sha256(pais)];
  if (lead.meta_fbp && FBP_RE.test(lead.meta_fbp)) userData.fbp = lead.meta_fbp;
  if (lead.meta_fbc && FBC_RE.test(lead.meta_fbc)) userData.fbc = lead.meta_fbc;
  if (ipValido(lead.ip_address)) userData.client_ip_address = lead.ip_address;
  if (userData.em.length === 0) delete userData.em;
  if (userData.ph.length === 0) delete userData.ph;

  return {
    evento: {
      event_name: EVENT_NAME,
      event_time: Math.floor(qualificadoMs / 1000),
      // Dedup no Meta: mesmo event_id + event_name = um evento só.
      event_id: `lq_${lead.id}`,
      action_source: 'website',
      event_source_url: urlDoEvento(lead.landing_url),
      user_data: userData,
      custom_data: {
        lead_quality: classe.toLowerCase(),
        value: VALOR_POR_CLASSE[classe],
        currency: MOEDA,
      },
    },
  };
};

// Códigos do Graph: credencial/permissão/objeto (Pixel) inválido → config;
// limites e indisponibilidade → transitório. Resto (ex.: 100 com parâmetro
// do evento) = problema do DADO daquele lead.
const CODIGOS_CONFIG = new Set([10, 102, 190, 200, 803]);
const CODIGOS_TRANSITORIOS = new Set([1, 2, 4, 17, 32, 341, 368, 613, 80004]);
const SUBCODIGO_OBJETO_INEXISTENTE = 33;

/**
 * Classifica uma falha do Graph:
 *   'config'      — token/Pixel/permissão: TODO lead falharia → para o tick, não gasta tentativa;
 *   'transitorio' — Meta fora/limite: para o tick, não gasta tentativa;
 *   'dado'        — o evento deste lead foi recusado → gasta tentativa e segue.
 */
const classificarErroMeta = (statusCode, corpo) => {
  if (statusCode === 429 || statusCode >= 500) return 'transitorio';
  let e = {};
  try {
    e = JSON.parse(corpo || '{}').error || {};
  } catch {
    return statusCode === 401 || statusCode === 403 ? 'config' : 'transitorio';
  }
  if (e.is_transient === true || CODIGOS_TRANSITORIOS.has(e.code)) return 'transitorio';
  if (statusCode === 401 || statusCode === 403 || CODIGOS_CONFIG.has(e.code)) return 'config';
  if (e.code === 100 && e.error_subcode === SUBCODIGO_OBJETO_INEXISTENTE) return 'config';
  return 'dado';
};

/** Mensagem de erro do Graph sem token nem dado de lead (vai para log e banco). */
const resumirErroMeta = (statusCode, corpo) => {
  try {
    const e = JSON.parse(corpo || '{}').error || {};
    const partes = [`HTTP ${statusCode}`];
    if (e.code) partes.push(`code ${e.code}`);
    if (e.error_subcode) partes.push(`sub ${e.error_subcode}`);
    if (e.message) partes.push(String(e.message).slice(0, 200));
    return partes.join(' · ');
  } catch {
    return `HTTP ${statusCode}`;
  }
};

module.exports = {
  PREFIXO_DESCARTE,
  MOTIVOS_ADIAR,
  classificarErroMeta,
  ipValido,
  EVENT_NAME,
  CLASSES_QUALIFICADAS,
  VALOR_POR_CLASSE,
  JANELA_MAX_MS,
  EVENT_SOURCE_URL_PADRAO,
  sha256,
  normalizarEmail,
  normalizarTelefone,
  normalizarTexto,
  partirNome,
  normalizarPais,
  normalizarCep,
  normalizarEstado,
  urlDoEvento,
  montarEvento,
  resumirErroMeta,
};
