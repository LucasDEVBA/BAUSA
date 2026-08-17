"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserPapel } from "@/lib/auth";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";

/**
 * Exclusão de lead = SOFT DELETE (form_submissions.deleted_at).
 *
 * A linha nunca é apagada — auditável e reversível (basta limpar a coluna).
 * A exclusão cascateia por soft delete para o atleta e os deals vinculados,
 * então o lead some das listas, do pipeline e de TODOS os schedulers de
 * mensagem (que filtram deleted_at IS NULL — guard
 * tests/scheduler-eligibility.test.js).
 */
export async function excluirLead(formSubmissionId: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem excluir leads." };
  }
  if (!z.string().uuid().safeParse(formSubmissionId).success) {
    return { success: false, error: "Id inválido." };
  }

  const supabase = await createAuditedSupabaseClient();
  const agora = new Date().toISOString();

  // CAS: só um vencedor marca a exclusão (duas abas clicando juntas).
  const { data: casRows, error: casError } = await supabase
    .from("form_submissions")
    .update({ deleted_at: agora })
    .eq("id", formSubmissionId)
    .is("deleted_at", null)
    .select("id, athlete_name");

  if (casError) {
    return { success: false, error: `Erro ao excluir: ${casError.message}` };
  }
  if (!casRows || casRows.length === 0) {
    return { success: false, error: "Lead já estava excluído (outra aba?)." };
  }

  // Cascata: atleta + deals do lead também saem de circulação (soft delete).
  // Falha aqui não desfaz a exclusão do lead — reporta para revisão manual.
  const { data: atletas, error: atletasError } = await supabase
    .from("atletas")
    .select("id")
    .eq("form_submission_id", formSubmissionId)
    .is("deleted_at", null);

  let atletasExcluidos = 0;
  let dealsExcluidos = 0;
  if (!atletasError && atletas && atletas.length > 0) {
    const atletaIds = atletas.map((a) => a.id);
    const { data: dealsUpd } = await supabase
      .from("deals")
      .update({ deleted_at: agora })
      .in("atleta_id", atletaIds)
      .is("deleted_at", null)
      .select("id");
    dealsExcluidos = dealsUpd?.length ?? 0;

    const { data: atletasUpd, error: updError } = await supabase
      .from("atletas")
      .update({ deleted_at: agora })
      .in("id", atletaIds)
      .is("deleted_at", null)
      .select("id");
    if (updError) {
      return {
        success: true,
        atletasExcluidos: 0,
        dealsExcluidos,
        aviso: `Lead excluído, mas o atleta vinculado falhou: ${updError.message}`,
      };
    }
    atletasExcluidos = atletasUpd?.length ?? 0;
  }

  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/war-room");
  return { success: true, atletasExcluidos, dealsExcluidos };
}
