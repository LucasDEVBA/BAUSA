"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

// ─── Schemas (espelham src/types/automacao.ts) ──────────────────────────────

const condicaoSchema = z.object({
  campo: z.string().min(1, "Campo da condição é obrigatório"),
  operador: z.enum(["eq", "neq", "in", "gt", "gte", "lt", "lte"]),
  valor: z.union([z.string().min(1), z.number(), z.array(z.string().min(1)).min(1)]),
});

const acaoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("criar_tarefa"),
    parametros: z.object({
      titulo: z.string().min(3, "Título da tarefa muito curto"),
      descricao: z.string().optional(),
      prioridade: z.enum(["critica", "alta", "media", "baixa"]),
      prazo_dias: z.number().int().min(0).max(365),
      responsavel_id: z.string().uuid("Responsável inválido"),
    }),
  }),
  z.object({
    tipo: z.literal("criar_notificacao"),
    parametros: z.object({
      titulo: z.string().min(3, "Título da notificação muito curto"),
      mensagem: z.string().min(3, "Mensagem muito curta"),
      severidade: z.enum(["critica", "alta", "media", "baixa"]),
      destinatario: z.enum(["ceo", "head_sucesso", "responsavel"]),
    }),
  }),
  z.object({
    tipo: z.literal("enviar_whatsapp"),
    parametros: z.object({
      template: z.enum([
        "initial",
        "followup_1",
        "followup_2",
        "early_potential",
        "late_timing",
        "scheduled_return",
      ]),
    }),
  }),
  z.object({
    tipo: z.literal("mover_deal"),
    parametros: z.object({
      etapa_destino: z.string().min(1, "Etapa de destino é obrigatória"),
      // Regra inviolável nº 2: mover deal exige próxima ação definida
      next_action: z.string().min(3, "Próxima ação é obrigatória ao mover deal"),
      proxima_acao_dias: z.number().int().min(0).max(90),
    }),
  }),
]);

const automacaoSchema = z.object({
  nome: z.string().min(3, "Nome muito curto").max(120),
  descricao: z.string().max(500).optional(),
  gatilho: z.enum([
    "lead_qualificado",
    "deal_etapa_mudou",
    "reuniao_marcada",
    "temperatura_vermelha",
    "deal_parado_etapa",
    "parcela_vencendo",
    "parcela_atrasada",
    "familia_sem_contato",
    "tarefa_vencida",
  ]),
  gatilho_config: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  condicoes: z.array(condicaoSchema).max(10).default([]),
  acoes: z.array(acaoSchema).min(1, "Adicione pelo menos uma ação").max(5),
});

export type AutomacaoInput = z.input<typeof automacaoSchema>;

interface ActionResult {
  success: boolean;
  error?: string;
  id?: string;
}

async function requireCeo(): Promise<string | null> {
  const papel = await getUserPapel();
  return papel === "ceo" ? null : "Apenas o CEO pode gerenciar automações.";
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function criarAutomacao(input: AutomacaoInput): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  const parsed = automacaoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("automacoes")
      .insert({
        nome: parsed.data.nome,
        descricao: parsed.data.descricao ?? null,
        gatilho: parsed.data.gatilho,
        gatilho_config: parsed.data.gatilho_config,
        condicoes: parsed.data.condicoes,
        acoes: parsed.data.acoes,
        ativo: false, // nasce pausada — ativar é gesto explícito
      })
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    revalidatePath("/automacoes");
    return { success: true, id: data.id };
  } catch (err) {
    console.error({ level: "error", action: "criar_automacao", error: String(err) });
    return { success: false, error: "Erro inesperado ao criar automação." };
  }
}

export async function atualizarAutomacao(
  id: string,
  input: AutomacaoInput,
): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }

  const parsed = automacaoSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { error } = await supabase
      .from("automacoes")
      .update({
        nome: parsed.data.nome,
        descricao: parsed.data.descricao ?? null,
        gatilho: parsed.data.gatilho,
        gatilho_config: parsed.data.gatilho_config,
        condicoes: parsed.data.condicoes,
        acoes: parsed.data.acoes,
      })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    revalidatePath("/automacoes");
    return { success: true, id };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_automacao", id, error: String(err) });
    return { success: false, error: "Erro inesperado ao atualizar automação." };
  }
}

export async function alternarAtivoAutomacao(id: string, ativo: boolean): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { error } = await supabase
      .from("automacoes")
      .update({ ativo })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    revalidatePath("/automacoes");
    return { success: true, id };
  } catch (err) {
    console.error({ level: "error", action: "alternar_automacao", id, error: String(err) });
    return { success: false, error: "Erro inesperado ao alterar status." };
  }
}

// Intervalos das automações NATIVAS (schedulers de WhatsApp). As CFs leem esta
// chave com clamp 1h-720h próprio (guard de CI) — o Zod espelha o mesmo range.
const intervalosSchema = z
  .object({
    whatsapp_inicial_horas: z.number().int().min(1).max(720),
    whatsapp_timing_alt_horas: z.number().int().min(1).max(720),
    followup_1_horas: z.number().int().min(1).max(720),
    followup_2_horas: z.number().int().min(1).max(720),
  })
  // Ambos os cutoffs medem de whatsapp_sent_at — FU2 <= FU1 colapsaria o
  // espaçamento (lead receberia FU1 e FU2 em ticks consecutivos).
  .refine((v) => v.followup_2_horas > v.followup_1_horas, {
    message: "Follow-up 2 deve ter intervalo maior que o Follow-up 1",
  });

export type SchedulerIntervalos = z.infer<typeof intervalosSchema>;

/** Atualiza os intervalos das automações do sistema (configuracoes_sistema.
 *  scheduler_intervalos). Efeito no próximo tick dos schedulers (1x/hora). */
export async function atualizarIntervalosScheduler(
  input: SchedulerIntervalos,
): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };

  const parsed = intervalosSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Intervalos inválidos (1-720h)" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: parsed.data })
      .eq("chave", "scheduler_intervalos")
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Config scheduler_intervalos não encontrada (migration pendente?)" };
    }
    revalidatePath("/automacoes");
    return { success: true };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_intervalos_scheduler", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar intervalos." };
  }
}

/** Reenfileira um run que terminou em erro (replay manual do CEO).
 *  Zera tentativas e volta a 'pendente' — a engine reprocessa no próximo tick.
 *  Idempotência de envio é garantida pela engine (CAS nas colunas *_sent_at). */
export async function reprocessarRun(runId: string): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  if (!z.string().uuid().safeParse(runId).success) {
    return { success: false, error: "ID inválido" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("automacao_runs")
      .update({ status: "pendente", tentativas: 0, proxima_tentativa_at: null })
      .eq("id", runId)
      .eq("status", "erro")
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Run não está em erro (talvez já reprocessado)." };
    }
    revalidatePath("/automacoes");
    return { success: true, id: runId };
  } catch (err) {
    console.error({ level: "error", action: "reprocessar_run", runId, error: String(err) });
    return { success: false, error: "Erro inesperado ao reprocessar." };
  }
}

export async function excluirAutomacao(id: string): Promise<ActionResult> {
  const denied = await requireCeo();
  if (denied) return { success: false, error: denied };
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "ID inválido" };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    // Soft delete + pausa (engine ignora automações deletadas/pausadas)
    const { error } = await supabase
      .from("automacoes")
      .update({ deleted_at: new Date().toISOString(), ativo: false })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    revalidatePath("/automacoes");
    return { success: true, id };
  } catch (err) {
    console.error({ level: "error", action: "excluir_automacao", id, error: String(err) });
    return { success: false, error: "Erro inesperado ao excluir automação." };
  }
}
