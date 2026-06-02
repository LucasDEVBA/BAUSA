"use server";

import { revalidatePath } from "next/cache";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

export type TemplateCanal = "whatsapp" | "email" | "ambos";
export type TemplateCategoria =
  | "onboarding"
  | "checkin"
  | "pre_embarque"
  | "pos_embarque"
  | "documento"
  | "crise"
  | "celebracao"
  | "follow_up"
  | "outro";

export interface MensagemTemplate {
  id: string;
  nome: string;
  categoria: TemplateCategoria;
  canal: TemplateCanal;
  assunto: string | null;
  corpo: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

async function requireWritePapel() {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) return null;
  return papel;
}

export async function listarTemplates(filtros?: {
  canal?: TemplateCanal;
  categoria?: TemplateCategoria;
}): Promise<MensagemTemplate[]> {
  const supabase = await createAuditedSupabaseClient();
  let q = supabase
    .from("mensagem_templates")
    .select("*")
    .is("deleted_at", null)
    .eq("ativo", true)
    .order("categoria", { ascending: true })
    .order("nome", { ascending: true });

  if (filtros?.canal) {
    if (filtros.canal === "whatsapp") {
      q = q.in("canal", ["whatsapp", "ambos"]);
    } else if (filtros.canal === "email") {
      q = q.in("canal", ["email", "ambos"]);
    }
  }
  if (filtros?.categoria) q = q.eq("categoria", filtros.categoria);

  const { data } = await q;
  return (data ?? []) as MensagemTemplate[];
}

export async function criarTemplate(dados: {
  nome: string;
  categoria: TemplateCategoria;
  canal: TemplateCanal;
  assunto?: string | null;
  corpo: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const papel = await requireWritePapel();
  if (!papel) return { success: false, error: "Sem permissão." };
  if (!dados.nome.trim() || !dados.corpo.trim()) {
    return { success: false, error: "Nome e corpo são obrigatórios." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("mensagem_templates")
    .insert({
      nome: dados.nome.trim(),
      categoria: dados.categoria,
      canal: dados.canal,
      assunto: dados.assunto ?? null,
      corpo: dados.corpo,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  return { success: true, id: data.id };
}

export async function atualizarTemplate(
  id: string,
  dados: Partial<{
    nome: string;
    categoria: TemplateCategoria;
    canal: TemplateCanal;
    assunto: string | null;
    corpo: string;
    ativo: boolean;
  }>,
) {
  const papel = await requireWritePapel();
  if (!papel) return { success: false, error: "Sem permissão." };

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("mensagem_templates")
    .update(dados)
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/familias-crm");
  return { success: true };
}

export async function arquivarTemplate(id: string) {
  const papel = await requireWritePapel();
  if (!papel) return { success: false, error: "Sem permissão." };

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("mensagem_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/familias-crm");
  return { success: true };
}

// renderTemplate (função pura) movido para /lib/template-render.ts
// — arquivos com "use server" só podem exportar async functions.
