"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";
import { cleanPhone, isValidPhone } from "@/lib/whatsapp-espelho";

/**
 * Threads de conversa de um lead para o painel do modal (CEO):
 * privado do RESPONSÁVEL, privado do ATLETA e GRUPO(s) da família.
 * Fontes: atletas + responsaveis + form_submissions + whatsapp_grupos.
 * Queries separadas (sem embed) — o embed atletas→responsaveis exige hint de
 * FK e já quebrou 6 arquivos em produção (PGRST201 silencioso).
 */

export interface ConversaThread {
  tipo: "privado" | "grupo";
  /** Rótulo curto do seletor (ex.: "Responsável", "Atleta", nome do grupo). */
  label: string;
  /** Nome completo para o cabeçalho, quando conhecido. */
  detalhe?: string;
  /** Telefone só-dígitos (threads privadas). */
  phone?: string;
  /** grupo_id no formato do banco, sem @g.us (threads de grupo). */
  grupoId?: string;
  /** Grupo com captura desligada: existe, mas o espelho não guarda conteúdo. */
  capturaDesligada?: boolean;
}

interface ListarThreadsInput {
  atletaId?: string | null;
  formSubmissionId?: string | null;
}

export async function listarThreadsLead(
  input: ListarThreadsInput,
): Promise<{ success: true; threads: ConversaThread[] } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode ver conversas." };
  }

  const supabase = await createServerSupabaseClient();
  const threads: ConversaThread[] = [];
  const phonesVistos = new Set<string>();

  let atletaId = input.atletaId ?? null;
  let responsavelId: string | null = null;
  let atletaWhatsapp: string | null = null;
  let atletaNome: string | null = null;
  let formSubmissionId = input.formSubmissionId ?? null;

  // ── Atleta (quando promovido) ──
  if (atletaId) {
    const { data: atleta } = await supabase
      .from("atletas")
      .select("id, nome_completo, whatsapp, form_submission_id, responsavel_id")
      .eq("id", atletaId)
      .is("deleted_at", null)
      .maybeSingle();
    if (atleta) {
      atletaWhatsapp = (atleta.whatsapp as string) ?? null;
      atletaNome = (atleta.nome_completo as string) ?? null;
      responsavelId = (atleta.responsavel_id as string) ?? null;
      formSubmissionId = formSubmissionId ?? ((atleta.form_submission_id as string) ?? null);
    } else {
      atletaId = null;
    }
  } else if (formSubmissionId) {
    // Lead ainda não promovido pode mesmo assim ter atleta (corrida) — best effort
    const { data: atleta } = await supabase
      .from("atletas")
      .select("id, nome_completo, whatsapp, responsavel_id")
      .eq("form_submission_id", formSubmissionId)
      .is("deleted_at", null)
      .maybeSingle();
    if (atleta) {
      atletaId = (atleta.id as string) ?? null;
      atletaWhatsapp = (atleta.whatsapp as string) ?? null;
      atletaNome = (atleta.nome_completo as string) ?? null;
      responsavelId = (atleta.responsavel_id as string) ?? null;
    }
  }

  // ── form_submissions: telefones distintos de atleta e responsável ──
  let fsAthleteWhatsapp: string | null = null;
  let fsGuardianWhatsapp: string | null = null;
  let fsGuardianName: string | null = null;
  let fsAthleteName: string | null = null;
  if (formSubmissionId) {
    const { data: fs } = await supabase
      .from("form_submissions")
      .select("athlete_name, athlete_whatsapp, guardian_name, guardian_whatsapp")
      .eq("id", formSubmissionId)
      .maybeSingle();
    if (fs) {
      fsAthleteWhatsapp = (fs.athlete_whatsapp as string) ?? null;
      fsGuardianWhatsapp = (fs.guardian_whatsapp as string) ?? null;
      fsGuardianName = (fs.guardian_name as string) ?? null;
      fsAthleteName = (fs.athlete_name as string) ?? null;
    }
  }

  // ── Responsável (nome oficial do CRM, se houver) ──
  let respNome: string | null = null;
  let respWhatsapp: string | null = null;
  if (responsavelId) {
    const { data: resp } = await supabase
      .from("responsaveis")
      .select("nome, whatsapp")
      .eq("id", responsavelId)
      .is("deleted_at", null)
      .maybeSingle();
    if (resp) {
      respNome = (resp.nome as string) ?? null;
      respWhatsapp = (resp.whatsapp as string) ?? null;
    }
  }

  const addPrivado = (raw: string | null, label: string, detalhe?: string | null) => {
    const digits = raw ? cleanPhone(raw) : "";
    if (!isValidPhone(digits) || phonesVistos.has(digits)) return;
    phonesVistos.add(digits);
    threads.push({ tipo: "privado", label, detalhe: detalhe ?? undefined, phone: digits });
  };

  // Ordem do seletor: responsável (thread principal do outreach) → atleta
  addPrivado(respWhatsapp ?? fsGuardianWhatsapp, "Responsável", respNome ?? fsGuardianName);
  addPrivado(fsAthleteWhatsapp ?? atletaWhatsapp, "Atleta", atletaNome ?? fsAthleteName);

  // ── Grupos vinculados à família ──
  if (atletaId) {
    const { data: grupos } = await supabase
      .from("whatsapp_grupos")
      .select("grupo_id, nome, capturar")
      .eq("atleta_id", atletaId)
      .is("deleted_at", null);
    for (const g of grupos ?? []) {
      threads.push({
        tipo: "grupo",
        label: (g.nome as string) || "Grupo da família",
        grupoId: g.grupo_id as string,
        capturaDesligada: g.capturar === false,
      });
    }
  }

  return { success: true, threads };
}
