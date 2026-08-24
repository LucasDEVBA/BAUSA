import { createServerSupabaseClient } from "@/lib/supabase-server";

// ════════════════════════════════════════════════════════════════════════
// Prioridade interna P1/P2 por ENGAJAMENTO (v1 — régua explicável e ajustável).
//
// Camada NOVA de exibição/priorização sobre leads já qualificados (Gemini
// QUENTE/MORNO) e APROVADOS pelo gate humano. NÃO substitui nem remove a
// classificação Gemini — ela continua sendo o gate de entrada/elegibilidade.
//
// Sinais e pesos (fonte: whatsapp_mensagens 1:1, correlação por tail-10
// tolerante ao 9º dígito — atleta OU responsável):
//   +40  respondeu ≥1 vez no WhatsApp
//   +20  última resposta nas últimas 72h
//   +10  ≥3 mensagens recebidas do lead (conversa com volume)
//   +10  primeira resposta ≤6h depois da NOSSA primeira mensagem
//   +20  deal avançou além do início (etapa ≠ lead/aguardando_timing)
//
// P1 = pontos ≥ 50 (atenção máxima); senão P2. Todo alvo recebe entrada no
// Map (lead aprovado sem sinal = P2 com 0 pontos); lead fora dos alvos
// (não aprovado, FRIO) fica FORA do Map e a UI não mostra badge.
//
// Fail-open: erro na query → Map vazio (a UI degrada sem badge; nunca lança).
// Teto FETCH_LIMIT com order DESC: se a tabela crescer além do teto, o corte
// perde histórico ANTIGO (pode subestimar "primeira resposta"), nunca o recente.
// ════════════════════════════════════════════════════════════════════════

export type PrioridadeNivel = "P1" | "P2";

export interface PrioridadeLead {
  nivel: PrioridadeNivel;
  pontos: number;
  motivos: string[];
}

export interface AlvoPrioridade {
  /** form_submission_id — chave do Map de retorno. */
  id: string;
  athleteWhatsapp: string | null;
  guardianWhatsapp: string | null;
  /** Etapa atual do deal, se houver. */
  etapaDeal?: string | null;
}

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabaseClient>>;

interface MsgRow {
  from_me: boolean;
  phone: string;
  momment: string | null;
  created_at: string;
}

interface SinaisConversa {
  inbound: number;
  ultimaInboundMs: number | null;
  primeiraInboundMs: number | null;
  primeiraOutboundMs: number | null;
}

const PONTOS_RESPONDEU = 40;
const PONTOS_ATIVO_72H = 20;
const PONTOS_VOLUME = 10;
const PONTOS_RESPOSTA_RAPIDA = 10;
const PONTOS_AVANCO_PIPELINE = 20;
const LIMIAR_P1 = 50;

const JANELA_ATIVO_MS = 72 * 60 * 60 * 1000;
const JANELA_RESPOSTA_RAPIDA_MS = 6 * 60 * 60 * 1000;
const MIN_MENSAGENS_VOLUME = 3;

/** Teto defensivo (padrão de conversas-queries) — order DESC garante que o
 *  corte perca o ANTIGO, não o recente. */
const FETCH_LIMIT = 20_000;

/** Etapas que NÃO contam como avanço no pipeline. */
const ETAPAS_INICIO = new Set(["lead", "aguardando_timing"]);

/** Últimos 10 dígitos do número do CEO (env opcional) — as auto-notificações
 *  do sistema ao CEO usam a mesma instância Z-API e poluiriam os sinais.
 *  Sem a env, nenhuma exclusão (degradação graciosa). */
const CEO_TAIL = (process.env.CEO_WHATSAPP ?? "").replace(/\D/g, "").slice(-10);

/**
 * Tails de 10 dígitos do telefone, nas DUAS grafias do nono dígito (mesmo
 * padrão de observabilidade-checks). A Z-API espelha número BR ora com, ora
 * sem o 9 — comparar um único tail-10 geraria falso negativo de correlação.
 */
function tailsDe(phone: unknown): string[] {
  if (typeof phone !== "string") return [];
  const digitos = phone.replace(/\D/g, "");
  if (digitos.length < 8) return [];
  const variantes = [digitos];
  if (/^55\d{2}9\d{8}$/.test(digitos)) variantes.push(digitos.slice(0, 4) + digitos.slice(5));
  else if (/^55\d{10}$/.test(digitos)) variantes.push(digitos.slice(0, 4) + "9" + digitos.slice(4));
  return variantes.map((v) => v.slice(-10));
}

function coletarSinais(mensagens: MsgRow[], tailParaAlvos: Map<string, string[]>): Map<string, SinaisConversa> {
  const sinaisPorAlvo = new Map<string, SinaisConversa>();

  for (const msg of mensagens) {
    const tails = tailsDe(msg.phone);
    if (tails.length === 0) continue;
    if (CEO_TAIL && tails.includes(CEO_TAIL)) continue;

    const ts = Date.parse(msg.momment ?? msg.created_at);
    if (Number.isNaN(ts)) continue;

    // As duas grafias do mesmo número não podem contar a mensagem 2x.
    const alvosDaMsg = new Set<string>();
    for (const tail of tails) {
      for (const alvoId of tailParaAlvos.get(tail) ?? []) alvosDaMsg.add(alvoId);
    }

    for (const alvoId of alvosDaMsg) {
      const s = sinaisPorAlvo.get(alvoId) ?? {
        inbound: 0,
        ultimaInboundMs: null,
        primeiraInboundMs: null,
        primeiraOutboundMs: null,
      };
      if (msg.from_me) {
        s.primeiraOutboundMs = s.primeiraOutboundMs === null ? ts : Math.min(s.primeiraOutboundMs, ts);
      } else {
        s.inbound += 1;
        s.ultimaInboundMs = s.ultimaInboundMs === null ? ts : Math.max(s.ultimaInboundMs, ts);
        s.primeiraInboundMs = s.primeiraInboundMs === null ? ts : Math.min(s.primeiraInboundMs, ts);
      }
      sinaisPorAlvo.set(alvoId, s);
    }
  }

  return sinaisPorAlvo;
}

function pontuarAlvo(alvo: AlvoPrioridade, sinais: SinaisConversa | undefined, agoraMs: number): PrioridadeLead {
  let pontos = 0;
  const motivos: string[] = [];

  if (sinais) {
    if (sinais.inbound >= 1) {
      pontos += PONTOS_RESPONDEU;
      motivos.push("Respondeu no WhatsApp");
    }
    if (sinais.ultimaInboundMs !== null && agoraMs - sinais.ultimaInboundMs <= JANELA_ATIVO_MS) {
      pontos += PONTOS_ATIVO_72H;
      motivos.push("Ativo nas últimas 72h");
    }
    if (sinais.inbound >= MIN_MENSAGENS_VOLUME) {
      pontos += PONTOS_VOLUME;
      motivos.push("Conversa com volume");
    }
    const respostaRapida =
      sinais.primeiraOutboundMs !== null &&
      sinais.primeiraInboundMs !== null &&
      sinais.primeiraInboundMs >= sinais.primeiraOutboundMs &&
      sinais.primeiraInboundMs - sinais.primeiraOutboundMs <= JANELA_RESPOSTA_RAPIDA_MS;
    if (respostaRapida) {
      pontos += PONTOS_RESPOSTA_RAPIDA;
      motivos.push("Respondeu rápido");
    }
  }

  if (alvo.etapaDeal && !ETAPAS_INICIO.has(alvo.etapaDeal)) {
    pontos += PONTOS_AVANCO_PIPELINE;
    motivos.push("Avançou no pipeline");
  }

  return { nivel: pontos >= LIMIAR_P1 ? "P1" : "P2", pontos, motivos };
}

/**
 * Computa a prioridade P1/P2 de cada alvo numa ÚNICA query em
 * `whatsapp_mensagens` (1:1, sem grupos). Retorna Map keyed por
 * form_submission_id — TODO alvo entra no Map; erro de leitura → Map vazio.
 */
export async function computarPrioridades(
  supabase: SupabaseServer,
  alvos: AlvoPrioridade[],
): Promise<Map<string, PrioridadeLead>> {
  const resultado = new Map<string, PrioridadeLead>();
  if (alvos.length === 0) return resultado;

  // tail-10 → ids de alvo (atleta OU responsável; um telefone compartilhado
  // entre irmãos credita o sinal a todos — comportamento aceito na v1).
  const tailParaAlvos = new Map<string, string[]>();
  for (const alvo of alvos) {
    for (const tail of [...tailsDe(alvo.athleteWhatsapp), ...tailsDe(alvo.guardianWhatsapp)]) {
      const ids = tailParaAlvos.get(tail) ?? [];
      if (!ids.includes(alvo.id)) ids.push(alvo.id);
      tailParaAlvos.set(tail, ids);
    }
  }

  const { data, error } = await supabase
    .from("whatsapp_mensagens")
    .select("from_me, phone, momment, created_at")
    .eq("is_grupo", false)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);

  if (error) {
    // Fail-open: prioridade é camada de exibição — sem dados, sem badge.
    console.error({ level: "error", action: "computar_prioridades", message: error.message });
    return resultado;
  }

  const sinaisPorAlvo = coletarSinais((data ?? []) as MsgRow[], tailParaAlvos);

  const agoraMs = Date.now();
  for (const alvo of alvos) {
    resultado.set(alvo.id, pontuarAlvo(alvo, sinaisPorAlvo.get(alvo.id), agoraMs));
  }
  return resultado;
}
