"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { isCeoLevel } from "@/lib/papel";

// ════════════════════════════════════════════════════════════
// Administração de templates de onboarding — exclusivo do CEO.
// A Head executa (onboarding.ts); aqui o CEO define O QUE é
// executado: etapas, ordem, prazos, checklist e exigências.
// Alterações valem para NOVOS onboardings (snapshot por design).
// ════════════════════════════════════════════════════════════

export interface TemplateEtapaAdmin {
  id: string;
  template_id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  prazo_dias: number;
  requer_reuniao: boolean;
  requer_assuntos: boolean;
  requer_documentos: boolean;
  checklist: string[];
}

export interface TemplateAdmin {
  id: string;
  nome: string;
  descricao: string | null;
  is_default: boolean;
  ativo: boolean;
  created_at: string;
  instancias_count: number;
  etapas: TemplateEtapaAdmin[];
}

const etapaSchema = z.object({
  titulo: z.string().trim().min(1, "Título é obrigatório.").max(200),
  descricao: z.string().trim().max(2000).optional(),
  prazo_dias: z
    .number()
    .int("Prazo deve ser um número inteiro de dias.")
    .min(1, "Prazo mínimo: 1 dia.")
    .max(365, "Prazo máximo: 365 dias."),
  requer_reuniao: z.boolean(),
  requer_assuntos: z.boolean(),
  requer_documentos: z.boolean(),
  checklist: z
    .array(z.string().trim().min(1).max(300))
    .max(20, "Máximo de 20 itens no checklist."),
});

export type EtapaInput = z.infer<typeof etapaSchema>;

async function requireCeo() {
  const papel = await getUserPapel();
  return papel && isCeoLevel(papel) ? papel : null;
}

function parseChecklistTemplate(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );
}

// ─── Listar templates (inclui inativos) + uso ────────────────
export async function listarTemplatesAdmin(): Promise<TemplateAdmin[]> {
  const papel = await requireCeo();
  if (!papel) return [];

  const supabase = await createAuditedSupabaseClient();
  const [{ data: templates }, { data: instancias }] = await Promise.all([
    supabase
      .from("onboarding_templates")
      .select(
        "id, nome, descricao, is_default, ativo, created_at, " +
          "etapas:onboarding_template_etapas(id, template_id, ordem, titulo, descricao, prazo_dias, requer_reuniao, requer_assuntos, requer_documentos, checklist)",
      )
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("nome"),
    supabase
      .from("onboarding_instancias")
      .select("template_id")
      .is("deleted_at", null),
  ]);

  const usoPorTemplate = new Map<string, number>();
  for (const i of (instancias ?? []) as Array<{ template_id: string }>) {
    usoPorTemplate.set(i.template_id, (usoPorTemplate.get(i.template_id) ?? 0) + 1);
  }

  type RawTemplate = {
    id: string;
    nome: string;
    descricao: string | null;
    is_default: boolean;
    ativo: boolean;
    created_at: string;
    etapas?: Array<Record<string, unknown>> | null;
  };

  return ((templates ?? []) as unknown as RawTemplate[]).map((t) => ({
    id: t.id,
    nome: t.nome,
    descricao: t.descricao,
    is_default: t.is_default,
    ativo: t.ativo,
    created_at: t.created_at,
    instancias_count: usoPorTemplate.get(t.id) ?? 0,
    etapas: (t.etapas ?? [])
      .map((e) => ({
        ...(e as unknown as TemplateEtapaAdmin),
        checklist: parseChecklistTemplate(e.checklist),
      }))
      .sort((a, b) => a.ordem - b.ordem),
  }));
}

// ─── Criar template ──────────────────────────────────────────
export async function criarTemplateOnboarding(dados: {
  nome: string;
  descricao?: string;
}) {
  const papel = await requireCeo();
  if (!papel) return { success: false, error: "Apenas o CEO pode gerenciar modelos." };

  const nome = dados.nome.trim();
  if (!nome) return { success: false, error: "Nome é obrigatório." };
  if (nome.length > 120) return { success: false, error: "Nome muito longo (máx. 120)." };

  const supabase = await createAuditedSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("onboarding_templates")
    .insert({
      nome,
      descricao: dados.descricao?.trim() || null,
      is_default: false,
      ativo: true,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/war-room/familias-onboarding");
  return { success: true, templateId: data.id };
}

// ─── Atualizar template (nome/descrição/ativo) ───────────────
export async function atualizarTemplateOnboarding(
  templateId: string,
  dados: { nome?: string; descricao?: string; ativo?: boolean },
) {
  const papel = await requireCeo();
  if (!papel) return { success: false, error: "Apenas o CEO pode gerenciar modelos." };

  const supabase = await createAuditedSupabaseClient();

  const patch: Record<string, unknown> = {};
  if (dados.nome !== undefined) {
    const nome = dados.nome.trim();
    if (!nome) return { success: false, error: "Nome é obrigatório." };
    if (nome.length > 120) return { success: false, error: "Nome muito longo (máx. 120)." };
    patch.nome = nome;
  }
  if (dados.descricao !== undefined) patch.descricao = dados.descricao.trim() || null;
  if (dados.ativo !== undefined) {
    if (dados.ativo === false) {
      const { data: t } = await supabase
        .from("onboarding_templates")
        .select("is_default")
        .eq("id", templateId)
        .maybeSingle();
      if (t?.is_default) {
        return {
          success: false,
          error: "O modelo padrão não pode ser desativado. Defina outro como padrão antes.",
        };
      }
    }
    patch.ativo = dados.ativo;
  }
  if (Object.keys(patch).length === 0) return { success: true };

  const { error } = await supabase
    .from("onboarding_templates")
    .update(patch)
    .eq("id", templateId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/war-room/familias-onboarding");
  return { success: true };
}

// ─── Definir template padrão (RPC atômica) ───────────────────
export async function definirTemplateDefault(templateId: string) {
  const papel = await requireCeo();
  if (!papel) return { success: false, error: "Apenas o CEO pode gerenciar modelos." };

  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase.rpc("definir_template_default", {
    p_template_id: templateId,
  });
  if (error) return { success: false, error: error.message };

  const result = (data ?? {}) as { success?: boolean; error?: string };
  if (!result.success) {
    return { success: false, error: result.error ?? "Falha ao definir o padrão." };
  }
  revalidatePath("/war-room/familias-onboarding");
  return { success: true };
}

// ─── Excluir template (soft delete) ──────────────────────────
export async function excluirTemplateOnboarding(templateId: string) {
  const papel = await requireCeo();
  if (!papel) return { success: false, error: "Apenas o CEO pode gerenciar modelos." };

  const supabase = await createAuditedSupabaseClient();
  const { data: t } = await supabase
    .from("onboarding_templates")
    .select("is_default")
    .eq("id", templateId)
    .maybeSingle();

  if (!t) return { success: false, error: "Modelo não encontrado." };
  if (t.is_default) {
    return {
      success: false,
      error: "O modelo padrão não pode ser excluído. Defina outro como padrão antes.",
    };
  }

  const { error } = await supabase
    .from("onboarding_templates")
    .update({ deleted_at: new Date().toISOString(), ativo: false })
    .eq("id", templateId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/war-room/familias-onboarding");
  return { success: true };
}

// ─── Criar etapa ─────────────────────────────────────────────
export async function criarEtapaTemplate(
  templateId: string,
  dados: EtapaInput,
) {
  const papel = await requireCeo();
  if (!papel) return { success: false, error: "Apenas o CEO pode gerenciar modelos." };

  const parsed = etapaSchema.safeParse(dados);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createAuditedSupabaseClient();

  // Próxima ordem = max + 1 (gaps são aceitáveis; UNIQUE protege colisões)
  const { data: ultima } = await supabase
    .from("onboarding_template_etapas")
    .select("ordem")
    .eq("template_id", templateId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("onboarding_template_etapas").insert({
    template_id: templateId,
    ordem: (ultima?.ordem ?? 0) + 1,
    titulo: parsed.data.titulo,
    descricao: parsed.data.descricao || null,
    prazo_dias: parsed.data.prazo_dias,
    requer_reuniao: parsed.data.requer_reuniao,
    requer_assuntos: parsed.data.requer_assuntos,
    requer_documentos: parsed.data.requer_documentos,
    checklist: parsed.data.checklist,
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/war-room/familias-onboarding");
  return { success: true };
}

// ─── Atualizar etapa ─────────────────────────────────────────
export async function atualizarEtapaTemplate(
  etapaId: string,
  dados: EtapaInput,
) {
  const papel = await requireCeo();
  if (!papel) return { success: false, error: "Apenas o CEO pode gerenciar modelos." };

  const parsed = etapaSchema.safeParse(dados);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("onboarding_template_etapas")
    .update({
      titulo: parsed.data.titulo,
      descricao: parsed.data.descricao || null,
      prazo_dias: parsed.data.prazo_dias,
      requer_reuniao: parsed.data.requer_reuniao,
      requer_assuntos: parsed.data.requer_assuntos,
      requer_documentos: parsed.data.requer_documentos,
      checklist: parsed.data.checklist,
    })
    .eq("id", etapaId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/war-room/familias-onboarding");
  return { success: true };
}

// ─── Remover etapa (só se nunca instanciada) ─────────────────
export async function removerEtapaTemplate(etapaId: string) {
  const papel = await requireCeo();
  if (!papel) return { success: false, error: "Apenas o CEO pode gerenciar modelos." };

  const supabase = await createAuditedSupabaseClient();

  const { count } = await supabase
    .from("onboarding_etapa_estado")
    .select("id", { count: "exact", head: true })
    .eq("template_etapa_id", etapaId);

  if (count && count > 0) {
    return {
      success: false,
      error:
        "Esta etapa já foi usada em onboardings de famílias e não pode ser excluída. Edite o título/descrição ou crie um novo modelo.",
    };
  }

  const { error } = await supabase
    .from("onboarding_template_etapas")
    .delete()
    .eq("id", etapaId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/war-room/familias-onboarding");
  return { success: true };
}

// ─── Reordenar etapas (RPC atômica) ──────────────────────────
export async function reordenarEtapasTemplate(
  templateId: string,
  etapaIds: string[],
) {
  const papel = await requireCeo();
  if (!papel) return { success: false, error: "Apenas o CEO pode gerenciar modelos." };
  if (etapaIds.length === 0) return { success: false, error: "Nada para reordenar." };

  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase.rpc("reordenar_etapas_template", {
    p_template_id: templateId,
    p_etapa_ids: etapaIds,
  });
  if (error) return { success: false, error: error.message };

  const result = (data ?? {}) as { success?: boolean; error?: string };
  if (!result.success) {
    return { success: false, error: result.error ?? "Falha ao reordenar." };
  }
  revalidatePath("/war-room/familias-onboarding");
  return { success: true };
}
