"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

export async function registrarLinkCalendario(
  dealId: string,
  eventLink: string,
  dataReuniao?: string,
) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO." };

  const supabase = await createAuditedSupabaseClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("etapa")
    .eq("id", dealId)
    .single();

  if (!deal) return { success: false, error: "Deal nao encontrado." };

  const updateData: Record<string, unknown> = {
    google_calendar_event_id: eventLink,
  };

  if (deal.etapa === "lead") {
    updateData.etapa = "reuniao_marcada";
  }

  if (dataReuniao) {
    updateData.reuniao_realizada_at = dataReuniao;
  }

  const { error } = await supabase
    .from("deals")
    .update(updateData)
    .eq("id", dealId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function verificarReunioesPendentes() {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO.", data: [] };

  const supabase = await createAuditedSupabaseClient();

  const { data } = await supabase
    .from("deals")
    .select("id, google_calendar_event_id, etapa, atleta:atletas(nome_completo)")
    .not("google_calendar_event_id", "is", null)
    .in("etapa", ["lead", "reuniao_marcada"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return { success: true, data: data || [] };
}
