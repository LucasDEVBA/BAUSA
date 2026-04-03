"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import type { NotaInterna } from "@/types/crm";

interface CriarNotaParams {
  conteudo: string;
  deal_id?: string;
  atleta_id?: string;
  experiencia_id?: string;
}

export async function criarNota(params: CriarNotaParams) {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) {
    return { success: false, error: "Sem permissao." };
  }

  if (!params.conteudo.trim()) {
    return { success: false, error: "Conteudo da nota e obrigatorio." };
  }

  const supabase = await createAuditedSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Usuario nao autenticado." };
  }

  const { error } = await supabase.from("notas_internas").insert({
    conteudo: params.conteudo.trim(),
    deal_id: params.deal_id ?? null,
    atleta_id: params.atleta_id ?? null,
    experiencia_id: params.experiencia_id ?? null,
    autor_id: user.id,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

interface ListarNotasParams {
  deal_id?: string;
  atleta_id?: string;
  experiencia_id?: string;
}

export async function listarNotas(
  params: ListarNotasParams
): Promise<NotaInterna[]> {
  const supabase = await createAuditedSupabaseClient();

  let query = supabase
    .from("notas_internas")
    .select("*, autor:user_profiles!autor_id(nome)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (params.deal_id) {
    query = query.eq("deal_id", params.deal_id);
  }

  if (params.atleta_id) {
    query = query.eq("atleta_id", params.atleta_id);
  }

  if (params.experiencia_id) {
    query = query.eq("experiencia_id", params.experiencia_id);
  }

  const { data } = await query;

  return (data ?? []) as NotaInterna[];
}
