"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import type { Escola } from "@/types/crm";

const criarEscolaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da escola."),
  estado_us: z.string().trim().min(2, "Informe o estado (US)."),
  cidade: z.string().trim().min(2, "Informe a cidade."),
  tipo: z.enum(["boarding", "day", "mista"]),
});

export async function criarEscola(dados: Partial<Escola>) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO pode criar escolas." };

  const parsed = criarEscolaSchema.safeParse(dados);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("escolas")
    .insert({
      nome: dados.nome,
      estado_us: dados.estado_us,
      cidade: dados.cidade,
      tipo: dados.tipo || "boarding",
      status: dados.status || "ativa",
      website: dados.website,
      link_inscricao: dados.link_inscricao,
      link_plano_saude: dados.link_plano_saude,
      notas_internas: dados.notas_internas,
      budget_minimo_usd: dados.budget_minimo_usd,
      budget_forte_usd: dados.budget_forte_usd,
      agressividade_bolsa: dados.agressividade_bolsa as any,
      regra_pratica: dados.regra_pratica,
      ingles_minimo: dados.ingles_minimo as any || "intermediario",
      gpa_minimo: dados.gpa_minimo ?? null,
      testes_exigidos: dados.testes_exigidos || [],
      esportes_oferecidos: dados.esportes_oferecidos || [],
      influencia_esporte: dados.influencia_esporte as any || "moderada",
      aceita_excecao_elite: dados.aceita_excecao_elite || false,
      series_preferenciais: dados.series_preferenciais || [],
      serie_maxima: dados.serie_maxima || "12th",
      deadline_fall: dados.deadline_fall,
      deadline_spring: dados.deadline_spring,
      rolling_admission: dados.rolling_admission || false,
      admissions_officer_nome: dados.admissions_officer_nome,
      admissions_officer_email: dados.admissions_officer_email,
      admissions_officer_telefone: dados.admissions_officer_telefone,
      temperatura_relacionamento: dados.temperatura_relacionamento || "neutro",
      notas_relacionamento: dados.notas_internas,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/escolas");
  return { success: true, escolaId: data.id };
}

export async function atualizarEscola(escolaId: string, dados: Partial<Escola>) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO pode editar escolas." };

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase.from("escolas").update(dados as any).eq("id", escolaId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function sugerirEscolas(atletaId: string) {
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase.rpc("sugerir_escolas", {
    p_atleta_id: atletaId,
    p_limite: 10,
  });
  if (error) return { success: false, error: error.message, data: [] };
  return { success: true, data: data || [] };
}

export async function calcularMatch(atletaId: string, escolaId: string) {
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase.rpc("calcular_match_score", {
    p_atleta_id: atletaId,
    p_escola_id: escolaId,
  });
  if (error) return { score: 0, error: error.message };
  const score = data as number;
  const classificacao = score >= 85 ? "excelente" : score >= 70 ? "forte" : score >= 50 ? "possivel" : "fraco";
  return { score, classificacao };
}

export async function adicionarEstrategia(atletaId: string, escolaId: string, prioridade: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO." };

  const supabase = await createAuditedSupabaseClient();
  const match = await calcularMatch(atletaId, escolaId);

  const { error } = await supabase.from("estrategia_escolas").insert({
    atleta_id: atletaId,
    escola_id: escolaId,
    match_score: match.score,
    prioridade,
    status: "planejamento",
    resultado: "nao_aplicado",
  });

  if (error) return { success: false, error: error.message };
  return { success: true, matchScore: match.score };
}

export async function registrarContatoEscola(
  escolaId: string,
  dados: { data: string; tipo: string; resumo: string }
) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO pode registrar contatos." };

  const supabase = await createAuditedSupabaseClient();

  const { error } = await supabase.from("historico_contatos_escola").insert({
    escola_id: escolaId,
    data_contato: dados.data,
    tipo_contato: dados.tipo,
    resumo: dados.resumo,
  });

  if (error) return { success: false, error: error.message };

  // Atualizar ultimo_contato_at na escola
  await supabase
    .from("escolas")
    .update({ ultimo_contato_at: dados.data })
    .eq("id", escolaId);

  return { success: true };
}

export async function listarContatosEscola(escolaId: string) {
  const supabase = await createAuditedSupabaseClient();

  const { data, error } = await supabase
    .from("historico_contatos_escola")
    .select("*")
    .eq("escola_id", escolaId)
    .order("data_contato", { ascending: false });

  if (error) return { success: false, error: error.message, data: [] };
  return { success: true, data: data || [] };
}

export async function atualizarResultadoEscola(estrategiaId: string, dados: {
  resultado?: string;
  bolsa_obtida_pct?: number;
  bolsa_obtida_valor?: number;
  data_resposta?: string;
  observacao?: string;
}) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO." };

  const supabase = await createAuditedSupabaseClient();

  const { data: estrategia } = await supabase
    .from("estrategia_escolas")
    .select("escola_id")
    .eq("id", estrategiaId)
    .single();

  const { error } = await supabase.from("estrategia_escolas").update(dados as any).eq("id", estrategiaId);
  if (error) return { success: false, error: error.message };

  // Atualizar contadores da escola se resultado mudou para aceito
  if (dados.resultado === "aceito" && estrategia?.escola_id) {
    try {
      await supabase
        .from("escolas")
        .update({ total_aceitos: (await supabase.from("escolas").select("total_aceitos").eq("id", estrategia.escola_id).single()).data?.total_aceitos + 1 })
        .eq("id", estrategia.escola_id);
    } catch {
      // Ignorar silenciosamente se falhar
    }
  }

  return { success: true };
}
