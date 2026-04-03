"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import type { AuditLog } from "@/types/crm";

export async function getAuditLogs(
  tabela: string,
  registroId: string,
): Promise<AuditLog[]> {
  const supabase = await createAuditedSupabaseClient();

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("tabela", tabela)
    .eq("registro_id", registroId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.log({
      level: "error",
      action: "get_audit_logs",
      tabela,
      registroId,
      error: error.message,
    });
    return [];
  }

  return (data ?? []) as AuditLog[];
}

export async function getAuditLogsForDeal(
  dealId: string,
  atletaId?: string,
): Promise<AuditLog[]> {
  const supabase = await createAuditedSupabaseClient();
  const results: AuditLog[] = [];

  const { data: dealLogs } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("tabela", "deals")
    .eq("registro_id", dealId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (dealLogs) {
    results.push(...(dealLogs as AuditLog[]));
  }

  if (atletaId) {
    const { data: atletaLogs } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("tabela", "atletas")
      .eq("registro_id", atletaId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (atletaLogs) {
      results.push(...(atletaLogs as AuditLog[]));
    }
  }

  results.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return results;
}
