"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Grupos de WhatsApp (Fase A dos agents) — CEO-only.
// A CF zapi-inbox registra a EXISTÊNCIA de cada grupo (whatsapp_grupos); o
// CONTEÚDO só é capturado para grupos com capturar=true (opt-in). Estas actions
// listam os grupos, ligam/desligam a captura e vinculam cada grupo a uma família
// (atleta). Sem retroativo — a Z-API não fornece histórico (documentado na UI).
// ════════════════════════════════════════════════════════════════════════

const MENSAGENS_LIMIT = 300;

export interface GrupoItem {
  id: string;
  grupoId: string;
  nome: string | null;
  capturar: boolean;
  atletaId: string | null;
  atletaNome: string | null;
  experienciaId: string | null;
  lastMessageAt: string | null;
  totalMensagens: number;
  firstSeenAt: string;
}

export interface AtletaOpcao {
  id: string;
  nome: string;
}

export interface GrupoMensagem {
  id: string;
  fromMe: boolean;
  texto: string | null;
  tipo: string;
  mediaUrl: string | null;
  fileName: string | null;
  participanteNome: string | null;
  timestamp: number | null;
}

type ListarGruposResult =
  | { success: true; grupos: GrupoItem[] }
  | { success: false; error: string };

type MutationResult = { success: true } | { success: false; error: string };

type MensagensResult =
  | { success: true; mensagens: GrupoMensagem[] }
  | { success: false; error: string };

interface GrupoRow {
  id: string;
  grupo_id: string;
  nome: string | null;
  capturar: boolean;
  atleta_id: string | null;
  experiencia_id: string | null;
  last_message_at: string | null;
  total_mensagens: number;
  first_seen_at: string;
  atletas: { nome_completo: string | null } | null;
}

const NEGADO = "Apenas o CEO." as const;
const ERRO_GENERICO = "Não foi possível concluir a operação." as const;

async function garantirCeo(): Promise<boolean> {
  const papel = await getUserPapel();
  return papel === "ceo";
}

/** Lista os grupos detectados (não deletados), com vínculo e contadores. */
export async function listarGrupos(): Promise<ListarGruposResult> {
  if (!(await garantirCeo())) return { success: false, error: NEGADO };

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("whatsapp_grupos")
      .select(
        "id, grupo_id, nome, capturar, atleta_id, experiencia_id, last_message_at, total_mensagens, first_seen_at, atletas ( nome_completo )",
      )
      .is("deleted_at", null)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("first_seen_at", { ascending: false });

    if (error) return { success: false, error: "Não foi possível carregar os grupos." };

    const grupos: GrupoItem[] = ((data as unknown as GrupoRow[] | null) ?? []).map((row) => ({
      id: row.id,
      grupoId: row.grupo_id,
      nome: row.nome,
      capturar: row.capturar,
      atletaId: row.atleta_id,
      atletaNome: row.atletas?.nome_completo ?? null,
      experienciaId: row.experiencia_id,
      lastMessageAt: row.last_message_at,
      totalMensagens: row.total_mensagens,
      firstSeenAt: row.first_seen_at,
    }));

    return { success: true, grupos };
  } catch {
    return { success: false, error: ERRO_GENERICO };
  }
}

/** Atletas para o seletor de vínculo (id + nome). */
export async function listarAtletasParaVinculo(): Promise<AtletaOpcao[]> {
  if (!(await garantirCeo())) return [];

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome_completo")
      .is("deleted_at", null)
      .order("nome_completo", { ascending: true })
      .limit(2000);

    if (error) return [];

    return ((data as { id: string; nome_completo: string | null }[] | null) ?? [])
      .filter((a) => (a.nome_completo ?? "").trim().length > 0)
      .map((a) => ({ id: a.id, nome: (a.nome_completo as string).trim() }));
  } catch {
    return [];
  }
}

const capturaSchema = z.object({
  grupoId: z.string().min(1, "Grupo inválido."),
  capturar: z.boolean(),
});

/** Liga/desliga a captura de conteúdo de UM grupo (opt-in consciente do CEO). */
export async function definirCapturaGrupo(
  grupoId: string,
  capturar: boolean,
): Promise<MutationResult> {
  if (!(await garantirCeo())) return { success: false, error: NEGADO };

  const parsed = capturaSchema.safeParse({ grupoId, capturar });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { error } = await supabase
      .from("whatsapp_grupos")
      .update({ capturar: parsed.data.capturar })
      .eq("grupo_id", parsed.data.grupoId)
      .is("deleted_at", null);

    if (error) return { success: false, error: "Não foi possível atualizar a captura." };

    revalidatePath("/whatsapp");
    return { success: true };
  } catch {
    return { success: false, error: ERRO_GENERICO };
  }
}

const vinculoSchema = z.object({
  grupoId: z.string().min(1, "Grupo inválido."),
  // null desvincula; UUID vincula a um atleta (família).
  atletaId: z.string().uuid("Atleta inválido.").nullable(),
});

/**
 * Vincula (ou desvincula) um grupo a uma família (atleta). Quando há atleta,
 * resolve também a experiência pós-venda dele (best-effort) para o vínculo
 * ficar completo; ao desvincular, limpa ambos.
 */
export async function vincularGrupoFamilia(
  grupoId: string,
  atletaId: string | null,
): Promise<MutationResult> {
  if (!(await garantirCeo())) return { success: false, error: NEGADO };

  const parsed = vinculoSchema.safeParse({ grupoId, atletaId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();

    let experienciaId: string | null = null;
    if (parsed.data.atletaId) {
      // Best-effort: nem todo atleta tem experiência (só pós-venda) — sem ela o
      // vínculo fica só no atleta, o que já é suficiente para a Fase A.
      const { data: exp } = await supabase
        .from("crm_experiencia")
        .select("id")
        .eq("atleta_id", parsed.data.atletaId)
        .is("deleted_at", null)
        .maybeSingle();
      experienciaId = (exp as { id: string } | null)?.id ?? null;
    }

    const { error } = await supabase
      .from("whatsapp_grupos")
      .update({ atleta_id: parsed.data.atletaId, experiencia_id: experienciaId })
      .eq("grupo_id", parsed.data.grupoId)
      .is("deleted_at", null);

    if (error) return { success: false, error: "Não foi possível vincular o grupo." };

    revalidatePath("/whatsapp");
    return { success: true };
  } catch {
    return { success: false, error: ERRO_GENERICO };
  }
}

/** Mensagens capturadas de UM grupo (ordem cronológica). CEO-only. */
export async function listarMensagensGrupo(grupoId: string): Promise<MensagensResult> {
  if (!(await garantirCeo())) return { success: false, error: NEGADO };
  if (!grupoId || grupoId.trim().length === 0) {
    return { success: false, error: "Grupo inválido." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    // DESC + limit p/ manter as RECENTES; reordena p/ cronológico em JS.
    const { data, error } = await supabase
      .from("whatsapp_mensagens")
      .select("message_id, from_me, texto, tipo, media_url, media_filename, participante_nome, momment")
      .eq("grupo_id", grupoId)
      .eq("is_grupo", true)
      .order("momment", { ascending: false, nullsFirst: false })
      .limit(MENSAGENS_LIMIT);

    if (error) return { success: false, error: "Não foi possível carregar as mensagens." };

    const mensagens: GrupoMensagem[] = (
      (data as
        | {
            message_id: string;
            from_me: boolean;
            texto: string | null;
            tipo: string | null;
            media_url: string | null;
            media_filename: string | null;
            participante_nome: string | null;
            momment: string | null;
          }[]
        | null) ?? []
    )
      .map((row) => ({
        id: row.message_id,
        fromMe: row.from_me,
        texto: row.texto,
        tipo: row.tipo ?? "text",
        mediaUrl: row.media_url,
        fileName: row.media_filename,
        participanteNome: row.participante_nome,
        timestamp: row.momment ? Date.parse(row.momment) : null,
      }))
      .reverse();

    return { success: true, mensagens };
  } catch {
    return { success: false, error: ERRO_GENERICO };
  }
}
