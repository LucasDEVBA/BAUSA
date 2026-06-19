"use server";

import { revalidatePath } from "next/cache";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { isCeoLevel } from "@/lib/papel";

export type ReuniaoStatus =
  | "agendada"
  | "realizada"
  | "cancelada"
  | "reagendada";

export interface ReuniaoFamilia {
  id: string;
  experiencia_id: string;
  etapa_estado_id: string | null;
  titulo: string;
  assuntos: string[];
  data_hora: string;
  duracao_minutos: number;
  link_reuniao: string | null;
  status: ReuniaoStatus;
  participantes: string[];
  notas_realizacao: string | null;
  assuntos_discutidos: string[];
  realizada_at: string | null;
  cancelada_motivo: string | null;
  cancelada_at: string | null;
  created_at: string;
}

async function requireHeadOrCeo() {
  const papel = await getUserPapel();
  if (!papel || (!isCeoLevel(papel) && papel !== "head_sucesso")) return null;
  return papel;
}

async function notifyCeos(
  supabase: Awaited<ReturnType<typeof createAuditedSupabaseClient>>,
  payload: {
    titulo: string;
    mensagem: string;
    tipo: string;
    severidade: "baixa" | "media" | "alta" | "critica";
  },
) {
  const { data: ceos } = await supabase
    .from("user_profiles")
    .select("id")
    .in("papel", ["ceo", "cto"])
    .eq("ativo", true);
  if (!ceos || ceos.length === 0) return;
  await supabase.from("notificacoes").insert(
    ceos.map((c) => ({
      destinatario_id: c.id,
      ...payload,
      link: "/war-room/familias-onboarding",
    })),
  );
}

// ─── Listar reuniões de uma família ─────────────────────────
export async function listarReunioesFamilia(
  experienciaId: string,
): Promise<ReuniaoFamilia[]> {
  const papel = await requireHeadOrCeo();
  if (!papel) return [];

  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase
    .from("reunioes_familia")
    .select("*")
    .eq("experiencia_id", experienciaId)
    .is("deleted_at", null)
    .order("data_hora", { ascending: false });
  return (data ?? []) as ReuniaoFamilia[];
}

// ─── Criar reunião + notificar CEO ──────────────────────────
export async function criarReuniao(
  experienciaId: string,
  dados: {
    titulo: string;
    assuntos: string[];
    data_hora: string; // ISO
    duracao_minutos?: number;
    link_reuniao?: string;
    etapa_estado_id?: string;
    participantes?: string[];
  },
) {
  const papel = await requireHeadOrCeo();
  if (!papel) return { success: false, error: "Sem permissão." };
  if (!dados.titulo.trim()) return { success: false, error: "Título é obrigatório." };
  if (!dados.data_hora) return { success: false, error: "Data/hora é obrigatória." };

  const supabase = await createAuditedSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("reunioes_familia")
    .insert({
      experiencia_id: experienciaId,
      etapa_estado_id: dados.etapa_estado_id ?? null,
      titulo: dados.titulo.trim(),
      assuntos: dados.assuntos.filter((a) => a.trim()).map((a) => a.trim()),
      data_hora: dados.data_hora,
      duracao_minutos: dados.duracao_minutos ?? 30,
      link_reuniao: dados.link_reuniao?.trim() || null,
      participantes: dados.participantes ?? [],
      status: "agendada",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  // Buscar nome do atleta para a notificação
  try {
    const { data: exp } = await supabase
      .from("crm_experiencia")
      .select("atleta:atletas(nome_completo)")
      .eq("id", experienciaId)
      .maybeSingle();
    const rawA = exp?.atleta as unknown;
    const ao = (Array.isArray(rawA) ? rawA[0] : rawA) as { nome_completo?: string } | null;
    const nome = ao?.nome_completo ?? "atleta";

    await notifyCeos(supabase, {
      titulo: `Reuniao agendada com ${nome}`,
      mensagem: `${dados.titulo} em ${new Date(dados.data_hora).toLocaleString("pt-BR")}.` +
        (dados.link_reuniao ? ` Link: ${dados.link_reuniao}` : "") +
        (dados.assuntos.length > 0 ? ` Assuntos: ${dados.assuntos.join(", ")}` : ""),
      tipo: "reuniao_agendada",
      severidade: "media",
    });
  } catch (e) {
    console.warn("[criarReuniao] notif failed", e);
  }

  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  revalidatePath("/minha-area");
  revalidatePath("/war-room");
  return { success: true, reuniaoId: data.id };
}

// ─── Confirmar reunião como realizada ───────────────────────
export async function confirmarReuniaoRealizada(
  reuniaoId: string,
  dados: {
    notas_realizacao: string;
    assuntos_discutidos?: string[];
  },
) {
  const papel = await requireHeadOrCeo();
  if (!papel) return { success: false, error: "Sem permissão." };
  if (!dados.notas_realizacao.trim()) {
    return { success: false, error: "Notas da reunião são obrigatórias." };
  }

  const supabase = await createAuditedSupabaseClient();

  const { data: reuniao } = await supabase
    .from("reunioes_familia")
    .select("titulo, experiencia_id")
    .eq("id", reuniaoId)
    .maybeSingle();

  const { error } = await supabase
    .from("reunioes_familia")
    .update({
      status: "realizada",
      realizada_at: new Date().toISOString(),
      notas_realizacao: dados.notas_realizacao.trim(),
      assuntos_discutidos: (dados.assuntos_discutidos ?? [])
        .filter((a) => a.trim())
        .map((a) => a.trim()),
    })
    .eq("id", reuniaoId);

  if (error) return { success: false, error: error.message };

  // Notificar CEO
  try {
    if (reuniao?.experiencia_id) {
      const { data: exp } = await supabase
        .from("crm_experiencia")
        .select("atleta:atletas(nome_completo)")
        .eq("id", reuniao.experiencia_id)
        .maybeSingle();
      const rawA = exp?.atleta as unknown;
      const ao = (Array.isArray(rawA) ? rawA[0] : rawA) as { nome_completo?: string } | null;
      const nome = ao?.nome_completo ?? "atleta";

      await notifyCeos(supabase, {
        titulo: `Reuniao realizada: ${nome}`,
        mensagem: `${reuniao.titulo} concluida. Notas: ${dados.notas_realizacao.slice(0, 180)}${dados.notas_realizacao.length > 180 ? "..." : ""}`,
        tipo: "reuniao_realizada",
        severidade: "baixa",
      });
    }
  } catch (e) {
    console.warn("[confirmarReuniaoRealizada] notif failed", e);
  }

  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  revalidatePath("/minha-area");
  revalidatePath("/war-room");
  return { success: true };
}

// ─── Cancelar reunião ───────────────────────────────────────
export async function cancelarReuniao(
  reuniaoId: string,
  motivo: string,
) {
  const papel = await requireHeadOrCeo();
  if (!papel) return { success: false, error: "Sem permissão." };
  if (!motivo.trim()) return { success: false, error: "Motivo é obrigatório." };

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("reunioes_familia")
    .update({
      status: "cancelada",
      cancelada_at: new Date().toISOString(),
      cancelada_motivo: motivo.trim(),
    })
    .eq("id", reuniaoId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  revalidatePath("/minha-area");
  revalidatePath("/war-room");
  return { success: true };
}

// ─── Próximas reuniões agendadas (vista global ou por familia) ─
export interface ProximaReuniaoResumo {
  id: string;
  experiencia_id: string;
  titulo: string;
  data_hora: string;
  link_reuniao: string | null;
  assuntos: string[];
  experiencia: { atleta: { nome_completo: string } | null } | null;
}

export async function listarProximasReunioes(
  limit: number = 20,
): Promise<ProximaReuniaoResumo[]> {
  const papel = await requireHeadOrCeo();
  if (!papel) return [];

  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase
    .from("reunioes_familia")
    .select(
      "id, experiencia_id, titulo, data_hora, link_reuniao, assuntos, status, " +
      "experiencia:crm_experiencia(atleta:atletas(nome_completo))",
    )
    .eq("status", "agendada")
    .gte("data_hora", new Date().toISOString())
    .is("deleted_at", null)
    .order("data_hora", { ascending: true })
    .limit(limit);

  // Normalizar: Supabase devolve `experiencia` como array OU objeto
  type RawRow = {
    id: string;
    experiencia_id: string;
    titulo: string;
    data_hora: string;
    link_reuniao: string | null;
    assuntos: string[];
    experiencia?:
      | { atleta?: { nome_completo?: string } | null | { nome_completo?: string }[] }
      | { atleta?: { nome_completo?: string } | null }[]
      | null;
  };
  const rows = (data ?? []) as unknown as RawRow[];
  return rows.map((r) => {
    const expRaw = r.experiencia;
    const expObj = Array.isArray(expRaw) ? expRaw[0] : expRaw;
    const atletaRaw = expObj?.atleta;
    const atletaObj = Array.isArray(atletaRaw) ? atletaRaw[0] : atletaRaw;
    return {
      id: r.id,
      experiencia_id: r.experiencia_id,
      titulo: r.titulo,
      data_hora: r.data_hora,
      link_reuniao: r.link_reuniao,
      assuntos: r.assuntos ?? [],
      experiencia: expObj
        ? {
            atleta: atletaObj?.nome_completo
              ? { nome_completo: atletaObj.nome_completo }
              : null,
          }
        : null,
    };
  });
}
