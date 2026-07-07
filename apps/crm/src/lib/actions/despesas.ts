"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserPapel } from "@/lib/auth";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import type { Despesa } from "@/types/financeiro";

const CATEGORIAS = [
  "folha",
  "marketing",
  "ferramentas",
  "servicos",
  "impostos",
  "comissoes",
  "ocupacao",
  "outros",
] as const;
const TIPOS = ["fixa", "variavel"] as const;
const STATUS = ["previsto", "pago", "atrasado", "cancelado"] as const;
const METODOS = [
  "pix",
  "boleto",
  "cartao",
  "transferencia",
  "debito_automatico",
  "dinheiro",
  "outro",
] as const;

const NAO_AUTORIZADO = "Apenas o CEO pode gerenciar despesas." as const;

// Campos SEM default — o update parcial não pode reintroduzir defaults, senão
// atualizar um campo qualquer sobrescreveria status/tipo/recorrente no banco
// (ex.: mexer no valor de uma despesa PAGA a resetaria para 'previsto').
const despesaShape = {
  descricao: z.string().trim().min(2, "Informe a descrição da despesa.").max(160),
  categoria: z.enum(CATEGORIAS),
  tipo: z.enum(TIPOS),
  valor_brl: z.number().nonnegative("O valor não pode ser negativo."),
  competencia: z.string().date("Competência inválida."),
  vencimento: z.string().date().optional().nullable(),
  status: z.enum(STATUS),
  metodo: z.enum(METODOS).optional().nullable(),
  fornecedor: z.string().trim().max(160).optional().nullable(),
  recorrente: z.boolean(),
  recorrencia_dia: z.number().int().min(1).max(28).optional().nullable(),
  colaborador_id: z.string().uuid().optional().nullable(),
  observacao: z.string().trim().max(500).optional().nullable(),
};

// Recorrente exige o dia do mês (a projeção mensal depende dele).
function recorrenteExigeDia(
  v: { recorrente?: boolean; recorrencia_dia?: number | null },
  ctx: z.RefinementCtx,
): void {
  if (v.recorrente && (v.recorrencia_dia === undefined || v.recorrencia_dia === null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recorrencia_dia"],
      message: "Despesa recorrente exige o dia do vencimento (1–28).",
    });
  }
}

// Create: defaults só aqui (tipo/status/recorrente são opcionais na entrada).
const despesaSchema = z
  .object({
    ...despesaShape,
    tipo: z.enum(TIPOS).default("fixa"),
    status: z.enum(STATUS).default("previsto"),
    recorrente: z.boolean().default(false),
  })
  .superRefine(recorrenteExigeDia);

// Update: parcial, sem defaults — campos ausentes não tocam o banco.
const despesaUpdateSchema = z.object(despesaShape).partial().superRefine(recorrenteExigeDia);

export type DespesaInput = z.input<typeof despesaSchema>;
type ActionResult = { success: true; id?: string } | { success: false; error: string };

async function assertCeo(): Promise<{ ok: true } | { ok: false; error: string }> {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { ok: false, error: NAO_AUTORIZADO };
  return { ok: true };
}

/** Normaliza a competência para o 1º dia do mês (regime de competência). */
function primeiroDiaDoMes(dateIso: string): string {
  return `${dateIso.slice(0, 7)}-01`;
}

export async function listarDespesas(): Promise<Despesa[]> {
  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase
    .from("despesas")
    .select("*")
    .is("deleted_at", null)
    .order("competencia", { ascending: false })
    .order("created_at", { ascending: false });
  return (data as Despesa[] | null) ?? [];
}

export async function criarDespesa(input: DespesaInput): Promise<ActionResult> {
  const auth = await assertCeo();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = despesaSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("despesas")
    .insert({ ...parsed.data, competencia: primeiroDiaDoMes(parsed.data.competencia) })
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: `Erro ao criar despesa: ${error?.message ?? "desconhecido"}` };
  }

  revalidatePath("/financeiro");
  return { success: true, id: data.id };
}

export async function atualizarDespesa(
  id: string,
  input: Partial<DespesaInput>,
): Promise<ActionResult> {
  const auth = await assertCeo();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = despesaUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const patch = { ...parsed.data };
  if (patch.competencia) patch.competencia = primeiroDiaDoMes(patch.competencia);

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase.from("despesas").update(patch).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/financeiro");
  return { success: true };
}

export async function removerDespesa(id: string): Promise<ActionResult> {
  const auth = await assertCeo();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("despesas")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/financeiro");
  return { success: true };
}

export async function marcarDespesaPaga(
  id: string,
  dados?: { comprovante_url?: string; metodo?: (typeof METODOS)[number] },
): Promise<ActionResult> {
  const auth = await assertCeo();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("despesas")
    .update({
      status: "pago",
      pago_at: new Date().toISOString(),
      ...(dados?.comprovante_url ? { comprovante_url: dados.comprovante_url } : {}),
      ...(dados?.metodo ? { metodo: dados.metodo } : {}),
    })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/financeiro");
  return { success: true };
}

/**
 * Efetiva um TEMPLATE recorrente para uma competência: cria a despesa
 * realizada do mês (status pago) apontando para o template. Idempotente —
 * se a instância daquele mês já existe, apenas retorna sucesso.
 */
export async function efetivarDespesaRecorrente(
  templateId: string,
  competenciaMes: string, // qualquer dia do mês-alvo (YYYY-MM ou YYYY-MM-DD)
): Promise<ActionResult> {
  const auth = await assertCeo();
  if (!auth.ok) return { success: false, error: auth.error };

  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(competenciaMes)) {
    return { success: false, error: "Competência inválida (use AAAA-MM)." };
  }

  const competencia = primeiroDiaDoMes(competenciaMes);
  const supabase = await createAuditedSupabaseClient();

  const { data: template, error: tplErr } = await supabase
    .from("despesas")
    .select("*")
    .eq("id", templateId)
    .eq("recorrente", true)
    .is("deleted_at", null)
    .single();

  if (tplErr || !template) {
    return { success: false, error: "Template recorrente não encontrado." };
  }

  const { data: existente } = await supabase
    .from("despesas")
    .select("id")
    .eq("despesa_origem_id", templateId)
    .eq("competencia", competencia)
    .is("deleted_at", null)
    .maybeSingle();

  if (existente) return { success: true, id: existente.id };

  const tpl = template as Despesa;
  const vencimento = tpl.recorrencia_dia
    ? `${competencia.slice(0, 7)}-${String(tpl.recorrencia_dia).padStart(2, "0")}`
    : null;

  const { data, error } = await supabase
    .from("despesas")
    .insert({
      descricao: tpl.descricao,
      categoria: tpl.categoria,
      tipo: tpl.tipo,
      valor_brl: tpl.valor_brl,
      competencia,
      vencimento,
      status: "pago",
      pago_at: new Date().toISOString(),
      recorrente: false,
      despesa_origem_id: templateId,
      colaborador_id: tpl.colaborador_id,
    })
    .select("id")
    .single();

  // Violação do índice único (origem, competência): outra efetivação venceu a
  // corrida — a instância do mês já existe, então tratamos como sucesso idempotente.
  if (error?.code === "23505") {
    return { success: true };
  }

  if (error || !data) {
    return { success: false, error: `Erro ao efetivar recorrente: ${error?.message ?? "desconhecido"}` };
  }

  revalidatePath("/financeiro");
  return { success: true, id: data.id };
}
