"use server";

import { z } from "zod";

import { getUserPapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { gerarConteudoGemini, GeminiNotConfiguredError } from "@/lib/gemini";
import { GATILHO_FLUXO_CATALOG, type FluxoCanal, type FluxoGatilho } from "@/types/fluxo";

// ════════════════════════════════════════════════════════════════════════
// Sugestões de IA para fluxos.
//
// Duas superfícies, ambas SOB DEMANDA e CEO-only:
//  1. `sugerirFluxo` — dado um objetivo, a IA propõe o fluxo inteiro (blocos
//     encadeados). O CEO revisa e aplica; nada é criado sem clique.
//  2. `diagnosticarFluxo` — dado um fluxo COM histórico, a IA lê as métricas
//     reais por bloco e aponta onde está vazando.
//
// Regra herdada do A4-Planner: a IA NUNCA se autoavalia. Quando não há massa
// de dados, quem diz isso é código determinístico (`evidencia`), não o modelo.
// ════════════════════════════════════════════════════════════════════════

const MIN_EXECUCOES_DIAGNOSTICO = 20;
const GEMINI_TIMEOUT_MS = 45_000;
const GEMINI_DEADLINE_MS = 90_000;
const GEMINI_MAX_TOKENS = 8192; // gemini-2.5-flash gasta orçamento "pensando"

export interface BlocoSugerido {
  tipo: string;
  texto?: string;
  variavel?: string;
  campo?: string;
  opcoes?: string[];
  rotulos?: string[];
  prompt?: string;
  minutos?: number;
  porque: string;
}

export interface FluxoSugerido {
  nome: string;
  descricao: string;
  blocos: BlocoSugerido[];
  avisos: string[];
}

interface SugestaoResult {
  success: boolean;
  error?: string;
  fluxo?: FluxoSugerido;
}

const respostaSchema = z.object({
  nome: z.string().min(3).max(160),
  descricao: z.string().max(600),
  blocos: z
    .array(
      z.object({
        tipo: z.string(),
        texto: z.string().max(1200).optional(),
        variavel: z.string().max(40).optional(),
        campo: z.string().max(20).optional(),
        // Limites FROUXOS aqui de propósito: rejeitar a geração inteira porque
        // um rótulo veio com 26 caracteres é frágil (mesmo gotcha do A4-Planner).
        // O sanitizador abaixo encurta de forma determinística para o limite real.
        opcoes: z.array(z.string().max(120)).max(3).optional(),
        rotulos: z.array(z.string().max(120)).max(6).optional(),
        prompt: z.string().max(4000).optional(),
        minutos: z.number().int().min(1).max(10080).optional(),
        porque: z.string().max(300),
      }),
    )
    .min(3)
    .max(14),
  avisos: z.array(z.string().max(300)).max(5).default([]),
});

// Limite real de rótulo de resposta rápida. O Instagram corta em ~20 e o
// WhatsApp em 24 — usamos 24 e encurtamos na palavra mais próxima para não
// entregar texto cortado no meio ("Sim, quero saber ma…").
const ROTULO_MAX = 24;

function encurtarRotulo(bruto: string): string {
  const t = bruto.trim();
  if (t.length <= ROTULO_MAX) return t;
  const corte = t.slice(0, ROTULO_MAX);
  const espaco = corte.lastIndexOf(" ");
  return (espaco > ROTULO_MAX / 2 ? corte.slice(0, espaco) : corte).trim();
}

/** Tipos que a IA pode propor — evita alucinação de bloco inexistente. */
const TIPOS_PERMITIDOS = new Set([
  "mensagem",
  "pergunta",
  "botoes",
  "condicao",
  "ia_resposta",
  "ia_condicao",
  "delay",
  "tag",
  "captura",
  "handoff",
  "acao_crm",
  "fim",
]);

function contexto(): string {
  return [
    "NEGÓCIO: Bolsa Atleta USA (BAUSA) — assessoria que coloca atletas brasileiros em escolas/universidades",
    "dos EUA com bolsa esportiva. Ticket alto (R$ 15k–70k/ano em investimento da família).",
    "PÚBLICO: pais/responsáveis de atletas de 13 a 18 anos, e os próprios atletas.",
    "OBJETIVO COMERCIAL: levar a família a AGENDAR UMA REUNIÃO de diagnóstico.",
    "O funil real: lead preenche formulário → IA qualifica (QUENTE/MORNO/FRIO) → aprovação humana →",
    "WhatsApp → reunião. Um contato só vale se virar LEAD com telefone ou e-mail capturado.",
  ].join(" ");
}

const REGRAS = [
  "REGRAS OBRIGATÓRIAS DO FLUXO:",
  "1. Todo fluxo TEM que ter pelo menos um bloco `captura` (campo email ou telefone). Conversa que não",
  "   captura contato é entretenimento, não aquisição — esse é o erro do ManyChat atual do cliente",
  "   (213 disparos, 0 contatos capturados).",
  "2. Qualifique ANTES de capturar: pergunte esporte/série/momento com blocos `botoes` (2-3 opções),",
  "   para que o contato chegue no pedido de e-mail já engajado.",
  "3. Use `delay` de 1-2 minutos entre mensagens longas — cadência humana, não rajada.",
  "4. Bloco de IA sempre traz `prompt` escrito por extenso (é o fallback obrigatório).",
  "5. Termine com `handoff` (passar ao time) quando o contato demonstrar alta intenção.",
  "6. Textos curtos, tom brasileiro, direto, sem emoji em excesso (no máximo 1 por mensagem).",
  `   Rótulos de opção (opcoes/rotulos) com NO MÁXIMO ${ROTULO_MAX} caracteres — é o limite do canal.`,
  "7. NUNCA prometa bolsa garantida nem valores de bolsa — é promessa que o negócio não pode cumprir.",
].join("\n");

export async function sugerirFluxo(input: {
  objetivo: string;
  canal: FluxoCanal;
  gatilho: FluxoGatilho;
}): Promise<SugestaoResult> {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO pode gerar sugestões de fluxo." };

  const objetivo = String(input.objetivo ?? "").trim().slice(0, 500);
  if (objetivo.length < 10) return { success: false, error: "Descreva o objetivo com um pouco mais de detalhe." };

  const g = GATILHO_FLUXO_CATALOG[input.gatilho];
  if (!g) return { success: false, error: "Gatilho inválido." };

  const prompt = [
    contexto(),
    "",
    `CANAL: ${input.canal}. GATILHO: ${g.label} — ${g.descricao}`,
    `OBJETIVO DO CEO: ${objetivo}`,
    "",
    REGRAS,
    "",
    "BLOCOS DISPONÍVEIS: mensagem (texto), pergunta (resposta livre → variavel),",
    "botoes (2-3 opcoes, ramifica), condicao, ia_resposta (prompt), ia_condicao (prompt + rotulos),",
    "delay (minutos), tag, captura (campo: email|telefone|nome, variavel), handoff, acao_crm, fim.",
    "",
    "Responda SOMENTE com JSON válido:",
    '{"nome":"…","descricao":"…","blocos":[{"tipo":"mensagem","texto":"…","porque":"…"}],"avisos":["…"]}',
    "Cada bloco traz `porque` — uma frase explicando a intenção daquele passo.",
    "`avisos` traz riscos ou premissas que o CEO deve conferir antes de ligar o fluxo.",
  ].join("\n");

  try {
    const bruto = await gerarConteudoGemini(prompt, {
      temperature: 0.4,
      maxOutputTokens: GEMINI_MAX_TOKENS,
      timeoutMs: GEMINI_TIMEOUT_MS,
      deadlineMs: GEMINI_DEADLINE_MS,
    });
    const parsed = respostaSchema.safeParse(JSON.parse(bruto));
    if (!parsed.success) {
      console.error({ level: "error", action: "sugerir_fluxo_zod", erro: parsed.error.issues[0]?.message });
      return { success: false, error: "A IA respondeu num formato inesperado. Tente de novo." };
    }

    // Sanitização determinística: descarta bloco de tipo inventado, encurta
    // rótulos para o limite do canal e garante prompt inline nos blocos de IA
    // (invariante do motor — agent ausente nunca pode travar o fluxo).
    const blocos = parsed.data.blocos
      .filter((b) => TIPOS_PERMITIDOS.has(b.tipo))
      .map((b) => ({
        ...b,
        ...(b.opcoes ? { opcoes: b.opcoes.map(encurtarRotulo) } : {}),
        ...(b.rotulos ? { rotulos: b.rotulos.map((r) => r.trim().slice(0, ROTULO_MAX)) } : {}),
        ...((b.tipo === "ia_resposta" || b.tipo === "ia_condicao") && !b.prompt
          ? { prompt: "Responda de forma breve e cordial, retomando o que o contato disse." }
          : {}),
      }));

    const avisos = [...parsed.data.avisos];
    if (!blocos.some((b) => b.tipo === "captura")) {
      avisos.unshift(
        "A sugestão veio SEM bloco de captura — adicione um antes de ativar, senão o fluxo conversa mas não gera lead.",
      );
    }

    return { success: true, fluxo: { ...parsed.data, blocos, avisos } };
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError) {
      return { success: false, error: "IA não configurada neste ambiente (falta GEMINI_API_KEY)." };
    }
    console.error({ level: "error", action: "sugerir_fluxo", error: String(err) });
    return { success: false, error: "Não foi possível gerar a sugestão agora." };
  }
}

// ─── Diagnóstico de um fluxo com histórico ───────────────────────────────

export interface DiagnosticoFluxo {
  /** Determinístico — a IA NÃO decide isso. */
  confiavel: boolean;
  amostra: number;
  resumo: string;
  gargalos: Array<{ bloco: string; problema: string; sugestao: string }>;
}

interface DiagnosticoResult {
  success: boolean;
  error?: string;
  diagnostico?: DiagnosticoFluxo;
}

const diagnosticoSchema = z.object({
  resumo: z.string().max(800),
  gargalos: z
    .array(
      z.object({
        bloco: z.string().max(120),
        problema: z.string().max(300),
        sugestao: z.string().max(400),
      }),
    )
    .max(6),
});

export async function diagnosticarFluxo(fluxoId: string): Promise<DiagnosticoResult> {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO pode diagnosticar fluxos." };

  try {
    const supabase = await createServerSupabaseClient();
    const { fetchFluxo, fetchFluxoMetricas } = await import("@/lib/fluxos-queries");
    const fluxo = await fetchFluxo(supabase, fluxoId);
    if (!fluxo) return { success: false, error: "Fluxo não encontrado." };
    const m = await fetchFluxoMetricas(supabase, fluxoId, 90);

    // Confiança é DETERMINÍSTICA (mesma regra do A4-Planner: a IA nunca se autoavalia).
    const confiavel = m.entradas >= MIN_EXECUCOES_DIAGNOSTICO;

    const tabela = m.blocos
      .map(
        (b) =>
          `- ${b.rotulo} (${b.tipo}): chegaram ${b.chegaram}, seguiram ${b.seguiram}` +
          (b.taxaAvanco !== null ? ` (${Math.round(b.taxaAvanco * 100)}% de avanço)` : ""),
      )
      .join("\n");

    const prompt = [
      contexto(),
      "",
      `FLUXO: "${fluxo.nome}" — canal ${fluxo.canal}, gatilho ${fluxo.gatilho}.`,
      `NÚMEROS (90 dias): ${m.entradas} entradas, ${m.concluidas} concluídas, ${m.respostas} respostas,`,
      `${m.capturas} capturas, ${m.leadsCriados} leads criados, ${m.abandonadas} abandonos.`,
      "",
      "FUNIL POR BLOCO (onde as pessoas param):",
      tabela || "(sem blocos registrados)",
      "",
      confiavel
        ? "A amostra é suficiente para conclusões."
        : `ATENÇÃO: amostra pequena (${m.entradas} entradas). Trate como hipótese, não como conclusão, e diga isso.`,
      "",
      "Aponte no MÁXIMO 4 gargalos reais, do mais caro ao menos caro. Para cada um: em qual bloco,",
      "qual o problema provável e o que mudar concretamente (texto novo, ordem, remover passo).",
      "Se a maior perda for ausência de captura de contato, diga isso em primeiro lugar.",
      "",
      'Responda SOMENTE com JSON: {"resumo":"…","gargalos":[{"bloco":"…","problema":"…","sugestao":"…"}]}',
    ].join("\n");

    const bruto = await gerarConteudoGemini(prompt, {
      temperature: 0.3,
      maxOutputTokens: GEMINI_MAX_TOKENS,
      timeoutMs: GEMINI_TIMEOUT_MS,
      deadlineMs: GEMINI_DEADLINE_MS,
    });
    const parsed = diagnosticoSchema.safeParse(JSON.parse(bruto));
    if (!parsed.success) return { success: false, error: "A IA respondeu num formato inesperado." };

    return {
      success: true,
      diagnostico: { confiavel, amostra: m.entradas, resumo: parsed.data.resumo, gargalos: parsed.data.gargalos },
    };
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError) {
      return { success: false, error: "IA não configurada neste ambiente (falta GEMINI_API_KEY)." };
    }
    console.error({ level: "error", action: "diagnosticar_fluxo", error: String(err) });
    return { success: false, error: "Não foi possível diagnosticar agora." };
  }
}

/** Aplica uma sugestão da IA criando os blocos encadeados de verdade. */
export async function aplicarSugestao(
  fluxoId: string,
  blocos: BlocoSugerido[],
): Promise<{ success: boolean; error?: string; criados?: number }> {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO pode aplicar sugestões." };
  if (!Array.isArray(blocos) || blocos.length === 0) return { success: false, error: "Nada a aplicar." };

  try {
    const { createAuditedSupabaseClient } = await import("@/lib/supabase-audit");
    const supabase = await createAuditedSupabaseClient();

    // Cria em ordem e depois liga cada um ao seguinte (encadeamento linear;
    // ramos de botoes/ia_condicao o CEO ajusta no builder).
    const ids: string[] = [];
    for (const [i, b] of blocos.entries()) {
      if (!TIPOS_PERMITIDOS.has(b.tipo)) continue;
      const conteudo: Record<string, unknown> = {};
      if (b.texto) conteudo.texto = b.texto;
      if (b.variavel) conteudo.variavel = b.variavel;
      if (b.campo) conteudo.campo = b.campo;
      if (b.opcoes?.length) conteudo.opcoes = b.opcoes;
      if (b.rotulos?.length) conteudo.rotulos = b.rotulos;
      if (b.prompt) conteudo.prompt = b.prompt;
      if (b.minutos) conteudo.minutos = b.minutos;

      const { data, error } = await supabase
        .from("fluxo_blocos")
        .insert({ fluxo_id: fluxoId, tipo: b.tipo, conteudo, ordem: i, ramos: [] })
        .select("id")
        .single();
      if (error) return { success: false, error: error.message };
      ids.push(data.id);
    }

    for (let i = 0; i < ids.length - 1; i++) {
      await supabase.from("fluxo_blocos").update({ proximo_id: ids[i + 1] }).eq("id", ids[i]);
    }
    if (ids.length > 0) {
      await supabase.from("fluxos").update({ bloco_inicial_id: ids[0] }).eq("id", fluxoId);
    }

    const { revalidatePath } = await import("next/cache");
    revalidatePath(`/fluxos/${fluxoId}`, "page");
    return { success: true, criados: ids.length };
  } catch (err) {
    console.error({ level: "error", action: "aplicar_sugestao_fluxo", error: String(err) });
    return { success: false, error: "Erro inesperado ao aplicar a sugestão." };
  }
}
