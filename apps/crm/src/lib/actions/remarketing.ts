"use server";

import { getUserPapel } from "@/lib/auth";
import {
  fetchSegmentoLeadsFull,
  REMARKETING_SEGMENTS,
  type RemarketingFiltros,
} from "@/lib/remarketing-queries";

// ════════════════════════════════════════════════════════════════════════
// Export de segmento de re-marketing → CSV formato Meta Custom Audience.
// Reaplica os mesmos filtros do client server-side (PII nunca vai ao client).
// A Meta hasheia email/phone no upload. Telefone em E.164. Apenas CEO.
// ════════════════════════════════════════════════════════════════════════

type ExportResult =
  | { success: true; csv: string; filename: string; rows: number }
  | { success: false; error: string };

function toE164(whatsapp: string): string {
  const digits = (whatsapp || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function csvCell(value: string): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportarSegmentoCSV(
  segmentKey: string,
  filtros?: RemarketingFiltros,
): Promise<ExportResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode exportar audiências." };
  }

  const def = REMARKETING_SEGMENTS.find((s) => s.key === segmentKey);
  if (!def) return { success: false, error: "Segmento inválido." };

  const leads = await fetchSegmentoLeadsFull(segmentKey, filtros);
  if (leads.length === 0) {
    return { success: false, error: "Nenhum lead neste segmento com os filtros aplicados." };
  }

  const header = "email,phone,fn";
  const lines = leads
    .map((l) => {
      const fn = (l.nome || "").trim().split(/\s+/)[0] || "";
      const phone = toE164(l.whatsapp);
      if (!l.email && !phone) return null;
      return [csvCell(l.email), csvCell(phone), csvCell(fn)].join(",");
    })
    .filter((x): x is string => x !== null);

  if (lines.length === 0) {
    return { success: false, error: "Nenhum lead com email ou telefone válido." };
  }

  const csv = [header, ...lines].join("\n");
  const filename = `remarketing_${segmentKey}_${lines.length}leads.csv`;
  return { success: true, csv, filename, rows: lines.length };
}
