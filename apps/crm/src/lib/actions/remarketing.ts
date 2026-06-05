"use server";

import { getUserPapel } from "@/lib/auth";
import {
  fetchRemarketingSegments,
  REMARKETING_SEGMENTS,
} from "@/lib/remarketing-queries";

// ════════════════════════════════════════════════════════════════════════
// Export de segmento de re-marketing → CSV formato Meta Custom Audience
// A Meta hasheia email/phone no upload. Telefone em E.164 (com DDI).
// Apenas CEO. Uso sujeito a base legal (LGPD) — aviso na UI.
// ════════════════════════════════════════════════════════════════════════

type ExportResult =
  | { success: true; csv: string; filename: string; rows: number }
  | { success: false; error: string };

function toE164(whatsapp: string): string {
  const digits = (whatsapp || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 12) return digits; // já tem DDI
  if (digits.length === 10 || digits.length === 11) return `55${digits}`; // BR sem DDI
  return digits;
}

function csvCell(value: string): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportarSegmentoCSV(
  segmentKey: string,
): Promise<ExportResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode exportar audiências." };
  }

  const def = REMARKETING_SEGMENTS.find((s) => s.key === segmentKey);
  if (!def) {
    return { success: false, error: "Segmento inválido." };
  }

  const segments = await fetchRemarketingSegments();
  const segment = segments.find((s) => s.key === segmentKey);
  if (!segment || segment.leads.length === 0) {
    return { success: false, error: "Nenhum lead neste segmento." };
  }

  // Cabeçalho no schema Meta Custom Audience (email, phone, fn=first name).
  const header = "email,phone,fn";
  const lines = segment.leads
    .map((l) => {
      const fn = (l.nome || "").trim().split(/\s+/)[0] || "";
      const phone = toE164(l.whatsapp);
      // Pula linhas sem nenhum identificador (email nem phone) — inúteis na Meta.
      if (!l.email && !phone) return null;
      return [csvCell(l.email), csvCell(phone), csvCell(fn)].join(",");
    })
    .filter((x): x is string => x !== null);

  if (lines.length === 0) {
    return { success: false, error: "Nenhum lead com email ou telefone válido." };
  }

  const csv = [header, ...lines].join("\n");
  const filename = `remarketing_${segmentKey}_${segment.leads.length}leads.csv`;
  return { success: true, csv, filename, rows: lines.length };
}
