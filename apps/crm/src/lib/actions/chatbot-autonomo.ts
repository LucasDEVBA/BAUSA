"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Chatbot AUTÔNOMO de WhatsApp — server actions da UI (CEO-only, audited).
//
// A UI só LÊ/ESCREVE config + override por conversa. Quem RESPONDE leads é a
// Cloud Function `chatbot-autonomo` (Cloud Scheduler ~2min, NASCE off). Nenhuma
// action aqui envia mensagem.
//
//   • chatbot_autonomo            → { modo: off|sombra|ativo } (global)
//   • chatbot_autonomo_criterio   → { criterio?: string } (gate de intenção;
//       vazio/ausente = default do código na CF — fail-open). ⚠️ O campo é
//       `criterio` (é o que a CF lê), NÃO `instrucoes`.
//   • chatbot_autonomo_conversa   → override por conversa (UNIQUE phone)
//   • chatbot_autonomo_log        → trilha append-only (o CEO revisa na sombra)
//
// Leitura/escrita sempre em `public` (o Engine e a CF operam em public).
// ════════════════════════════════════════════════════════════════════════

const CRITERIO_MAX = 4000;
const LOG_LIMIT_DEFAULT = 50;
const LOG_LIMIT_MAX = 200;

/** Dígitos do telefone da conversa (mesma validação do whatsapp-insights). */
const PHONE_RE = /^\d{10,15}$/;

const modoGlobalSchema = z.enum(["off", "sombra", "ativo"]);
const conversaModoSchema = z.enum(["padrao", "ativo", "desligado"]);

export type ChatbotAutonomoModo = z.infer<typeof modoGlobalSchema>;
export type ConversaAutonomoModo = z.infer<typeof conversaModoSchema>;
export type ChatbotAutonomoDecisao = "respondeu" | "sombra" | "escalou" | "ignorou" | "erro";

export interface ChatbotAutonomoLogItem {
  id: string;
  phone: string | null;
  atleta_id: string | null;
  mensagem_lead: string | null;
  decisao: ChatbotAutonomoDecisao;
  categoria: string | null;
  resposta_gerada: string | null;
  enviado: boolean;
  motivo: string | null;
  modo_efetivo: string | null;
  created_at: string;
}

export type ChatbotAutonomoActionResult = { success: boolean; error?: string };

function normalizarTelefone(input: string): string | null {
  const digits = (input ?? "").replace(/\D/g, "");
  return PHONE_RE.test(digits) ? digits : null;
}

// ─── Config global + critério ────────────────────────────────────────────


/** Grava o modo global (off|sombra|ativo). CEO-only, audited. */
export async function atualizarChatbotAutonomoModo(
  modo: ChatbotAutonomoModo,
): Promise<ChatbotAutonomoActionResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode alterar o modo do chatbot." };
  }
  const parsed = modoGlobalSchema.safeParse(modo);
  if (!parsed.success) {
    return { success: false, error: "Modo inválido." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: { modo: parsed.data } })
      .eq("chave", "chatbot_autonomo")
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return {
        success: false,
        error: "Config chatbot_autonomo não encontrada (migration pendente?)",
      };
    }
    revalidatePath("/agents");
    return { success: true };
  } catch (err) {
    console.error({
      level: "error",
      action: "atualizar_chatbot_autonomo_modo",
      error: String(err),
    });
    return { success: false, error: "Erro inesperado ao salvar o modo." };
  }
}

/** Grava o critério do gate (vazio = remove override → default do código). CEO-only, audited. */
export async function atualizarChatbotAutonomoCriterio(
  criterio: string,
): Promise<ChatbotAutonomoActionResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode editar o critério." };
  }
  const texto = (criterio ?? "").trim();
  if (texto.length > CRITERIO_MAX) {
    return { success: false, error: `Critério muito longo (máx ${CRITERIO_MAX} caracteres).` };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: texto ? { criterio: texto } : {} })
      .eq("chave", "chatbot_autonomo_criterio")
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return {
        success: false,
        error: "Config chatbot_autonomo_criterio não encontrada (migration pendente?)",
      };
    }
    revalidatePath("/agents");
    return { success: true };
  } catch (err) {
    console.error({
      level: "error",
      action: "atualizar_chatbot_autonomo_criterio",
      error: String(err),
    });
    return { success: false, error: "Erro inesperado ao salvar o critério." };
  }
}

// ─── Monitor (log append-only) ───────────────────────────────────────────

export type ListarChatbotAutonomoLogResult =
  | { success: true; items: ChatbotAutonomoLogItem[] }
  | { success: false; error: string };

/** Lista as últimas decisões do bot (o que o CEO revisa na sombra). CEO-only. */
export async function listarChatbotAutonomoLog(
  input?: { limit?: number },
): Promise<ListarChatbotAutonomoLogResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode ver o monitor." };
  }

  const requested = Number.isFinite(input?.limit) ? Math.floor(input?.limit as number) : LOG_LIMIT_DEFAULT;
  const limit = Math.min(Math.max(1, requested), LOG_LIMIT_MAX);

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("chatbot_autonomo_log")
      .select(
        "id, phone, atleta_id, mensagem_lead, decisao, categoria, resposta_gerada, enviado, motivo, modo_efetivo, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { success: false, error: error.message };
    return { success: true, items: (data ?? []) as ChatbotAutonomoLogItem[] };
  } catch (err) {
    console.error({
      level: "error",
      action: "listar_chatbot_autonomo_log",
      error: String(err),
    });
    return { success: false, error: "Erro inesperado ao carregar o monitor." };
  }
}

// ─── Override por conversa ────────────────────────────────────────────────

export type GetConversaAutonomoModoResult =
  | { success: true; modo: ConversaAutonomoModo }
  | { success: false; error: string };

/** Lê o modo do override de UMA conversa (ou 'padrao' se não há override). CEO-only. */
export async function getConversaAutonomoModo(
  phone: string,
): Promise<GetConversaAutonomoModoResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode ver o modo da conversa." };
  }
  const digits = normalizarTelefone(phone);
  if (!digits) {
    return { success: false, error: "Telefone inválido." };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("chatbot_autonomo_conversa")
      .select("modo")
      .eq("phone", digits)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    const parsed = conversaModoSchema.safeParse(data?.modo);
    return { success: true, modo: parsed.success ? parsed.data : "padrao" };
  } catch (err) {
    console.error({
      level: "error",
      action: "get_conversa_autonomo_modo",
      error: String(err),
    });
    return { success: false, error: "Erro inesperado ao carregar o modo da conversa." };
  }
}

/** UPSERT do override por conversa (por phone). CEO-only, audited. Não envia nada. */
export async function setConversaAutonomoModo(
  phone: string,
  modo: ConversaAutonomoModo,
  atletaId?: string,
): Promise<ChatbotAutonomoActionResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode alterar o modo da conversa." };
  }
  const digits = normalizarTelefone(phone);
  if (!digits) {
    return { success: false, error: "Telefone inválido." };
  }
  const parsedModo = conversaModoSchema.safeParse(modo);
  if (!parsedModo.success) {
    return { success: false, error: "Modo inválido." };
  }

  let atleta: string | undefined;
  if (atletaId !== undefined && atletaId !== "") {
    const parsedAtleta = z.string().uuid().safeParse(atletaId);
    if (!parsedAtleta.success) {
      return { success: false, error: "Atleta inválido." };
    }
    atleta = parsedAtleta.data;
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload: {
      phone: string;
      modo: ConversaAutonomoModo;
      updated_by?: string;
      atleta_id?: string;
    } = { phone: digits, modo: parsedModo.data };
    if (user?.id) payload.updated_by = user.id;
    if (atleta !== undefined) payload.atleta_id = atleta;

    const { error } = await supabase
      .from("chatbot_autonomo_conversa")
      .upsert(payload, { onConflict: "phone" });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    console.error({
      level: "error",
      action: "set_conversa_autonomo_modo",
      error: String(err),
    });
    return { success: false, error: "Erro inesperado ao salvar o modo da conversa." };
  }
}
