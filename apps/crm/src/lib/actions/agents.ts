"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";
import {
  AGENT_CAPACIDADES,
  type AgentCapacidade,
  type AgentResumo,
} from "@/types/agent";

// ════════════════════════════════════════════════════════════════════════
// CRUD dos agents CUSTOM (tabela `agents`, hub /agents → "Seus agents").
//
// Invariantes:
//   • Escrita (criar/atualizar/excluir) é CEO-only; exclusão é SOFT
//     ({deleted_at, ativo:false}) — nunca DELETE físico (não há policy).
//   • O prompt NUNCA vai ao client nas listas (AgentResumo = id/nome/descricao)
//     e NUNCA é logado (conteúdo autoral do CEO).
//   • Este arquivo NUNCA dispara envio de mensagem — agents só configuram as
//     superfícies de IA; quem envia continua sendo o fluxo humano/CFs.
//     Guard: tests/agents-invariants.test.js.
// ════════════════════════════════════════════════════════════════════════

const NOME_MIN = 3;
const NOME_MAX = 120;
const DESCRICAO_MAX = 500;
const PROMPT_MIN = 10;
const PROMPT_MAX = 4000;

/** Achata caracteres de controle — mesma regex de chatbot-sugestao.ts. */
function sanitizar(texto: string): string {
  return texto.replace(/[\u0000-\u001F\u007F]+/g, " ").trim();
}

/** Sanitiza o prompt LINHA a linha — remove controle preservando quebras. */
function sanitizarPrompt(texto: string): string {
  return texto
    .split("\n")
    .map((linha) => sanitizar(linha))
    .join("\n")
    .trim();
}

const capacidadesSchema = z
  .array(z.enum(AGENT_CAPACIDADES))
  .min(1, "Escolha pelo menos uma capacidade.")
  .transform((arr) => Array.from(new Set(arr)));

const agentFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(NOME_MIN, `Nome muito curto (mín ${NOME_MIN} caracteres).`)
    .max(NOME_MAX, `Nome muito longo (máx ${NOME_MAX} caracteres).`),
  descricao: z
    .string()
    .trim()
    .max(DESCRICAO_MAX, `Descrição muito longa (máx ${DESCRICAO_MAX} caracteres).`)
    .optional(),
  prompt: z.string(),
  capacidades: capacidadesSchema,
});

export type AgentFormInput = {
  nome: string;
  descricao?: string;
  prompt: string;
  capacidades: AgentCapacidade[];
};

export type AgentMutationResult = { success: boolean; error?: string };

/** Valida + sanitiza o prompt fora do Zod (a sanitização pode mudar o tamanho). */
function validarPrompt(bruto: string): { ok: true; prompt: string } | { ok: false; error: string } {
  const prompt = sanitizarPrompt(bruto);
  if (prompt.length < PROMPT_MIN) {
    return { ok: false, error: `Prompt muito curto (mín ${PROMPT_MIN} caracteres).` };
  }
  if (prompt.length > PROMPT_MAX) {
    return { ok: false, error: `Prompt muito longo (máx ${PROMPT_MAX} caracteres).` };
  }
  return { ok: true, prompt };
}

export async function criarAgent(input: AgentFormInput): Promise<AgentMutationResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode gerenciar agents." };
  }
  const parsed = agentFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const prompt = validarPrompt(parsed.data.prompt);
  if (!prompt.ok) return { success: false, error: prompt.error };

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("agents")
      .insert({
        nome: parsed.data.nome,
        descricao: parsed.data.descricao || null,
        prompt: prompt.prompt,
        capacidades: parsed.data.capacidades,
        ativo: true,
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    // Log estruturado SEM o prompt (conteúdo autoral do CEO — não logar).
    console.log({
      level: "info",
      action: "criar_agent",
      agentId: (data as { id: string } | null)?.id,
      capacidades: parsed.data.capacidades,
    });
    revalidatePath("/agents");
    return { success: true };
  } catch (err) {
    console.error({
      level: "error",
      action: "criar_agent",
      error: err instanceof Error ? err.name : "unknown",
    });
    return { success: false, error: "Erro inesperado ao criar o agent." };
  }
}

const atualizarSchema = agentFormSchema.extend({
  id: z.string().uuid("Agent inválido."),
  ativo: z.boolean(),
});

export async function atualizarAgent(
  input: AgentFormInput & { id: string; ativo: boolean },
): Promise<AgentMutationResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode gerenciar agents." };
  }
  const parsed = atualizarSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const prompt = validarPrompt(parsed.data.prompt);
  if (!prompt.ok) return { success: false, error: prompt.error };

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("agents")
      .update({
        nome: parsed.data.nome,
        descricao: parsed.data.descricao || null,
        prompt: prompt.prompt,
        capacidades: parsed.data.capacidades,
        ativo: parsed.data.ativo,
      })
      .eq("id", parsed.data.id)
      .is("deleted_at", null)
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Agent não encontrado." };
    }
    console.log({
      level: "info",
      action: "atualizar_agent",
      agentId: parsed.data.id,
      ativo: parsed.data.ativo,
      capacidades: parsed.data.capacidades,
    });
    revalidatePath("/agents");
    return { success: true };
  } catch (err) {
    console.error({
      level: "error",
      action: "atualizar_agent",
      error: err instanceof Error ? err.name : "unknown",
    });
    return { success: false, error: "Erro inesperado ao atualizar o agent." };
  }
}

export async function excluirAgent(id: string): Promise<AgentMutationResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode gerenciar agents." };
  }
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "Agent inválido." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    // Exclusão SOFT: marca deleted_at e desativa — não há policy de DELETE.
    const { data, error } = await supabase
      .from("agents")
      .update({ deleted_at: new Date().toISOString(), ativo: false })
      .eq("id", id)
      .is("deleted_at", null)
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Agent não encontrado." };
    }
    console.log({ level: "info", action: "excluir_agent", agentId: id });
    revalidatePath("/agents");
    return { success: true };
  } catch (err) {
    console.error({
      level: "error",
      action: "excluir_agent",
      error: err instanceof Error ? err.name : "unknown",
    });
    return { success: false, error: "Erro inesperado ao excluir o agent." };
  }
}

/**
 * Lista os agents ATIVOS de uma capacidade — projeção segura (SEM o prompt).
 * Autorização: `conversa` → CEO ou Head (o Head usa o copiloto de grupo);
 * demais capacidades → CEO apenas. Não autorizado/erro → lista vazia
 * (degradação graciosa: a UI simplesmente não mostra o seletor).
 */
export async function listarAgentsAtivos(capacidade: AgentCapacidade): Promise<AgentResumo[]> {
  const parsedCap = z.enum(AGENT_CAPACIDADES).safeParse(capacidade);
  if (!parsedCap.success) return [];

  const papel = await getUserPapel();
  const autorizado =
    parsedCap.data === "conversa"
      ? papel === "ceo" || papel === "head_sucesso"
      : papel === "ceo";
  if (!autorizado) return [];

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("agents")
      .select("id, nome, descricao")
      .contains("capacidades", [parsedCap.data])
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome");

    if (error) {
      console.error({
        level: "error",
        action: "listar_agents_ativos",
        capacidade: parsedCap.data,
        error: error.code,
      });
      return [];
    }
    return (data as AgentResumo[] | null) ?? [];
  } catch (err) {
    console.error({
      level: "error",
      action: "listar_agents_ativos",
      capacidade: parsedCap.data,
      error: err instanceof Error ? err.name : "unknown",
    });
    return [];
  }
}
