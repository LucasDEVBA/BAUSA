"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Métricas de UMA conversa do espelho WhatsApp (painel direito, sob demanda).
// Reaproveita a lógica de agregação do dashboard, escopada a um telefone/LID.
// Só CEO (whatsapp_mensagens é CEO-only). Fonte: schema public (SEMPRE).
// ════════════════════════════════════════════════════════════════════════

const MAX_MENSAGENS = 2000;
const RESPOSTA_MAX_HORAS = 72;
const phoneRe = /^\d{10,15}$/;

export interface MetricasConversa {
  total: number;
  enviadas: number;
  recebidas: number;
  /** Nosso tempo de resposta na conversa (min, mediana) — null se sem dados. */
  nossaRespostaMedianaMin: number | null;
  leadRespostaMedianaMin: number | null;
  /** epoch ms da 1ª e da última mensagem. */
  primeiraMs: number | null;
  ultimaMs: number | null;
  /** Última mensagem foi do lead? (devemos resposta). */
  aguardando: boolean;
  /** Mídias trocadas (não-texto), enviadas + recebidas. */
  midiaEnviadas: number;
  midiaRecebidas: number;
}

export type MetricasConversaResult =
  | { success: true; metricas: MetricasConversa }
  | { success: false; error: string };

interface Row {
  from_me: boolean;
  momment: string | null;
  created_at: string;
  tipo: string | null;
}

function mediana(v: number[]): number | null {
  if (v.length === 0) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export async function fetchMetricasConversa(input: {
  phone: string;
  lid?: string | null;
}): Promise<MetricasConversaResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode ver as métricas." };
  }
  const phone = (input.phone ?? "").replace(/\D/g, "");
  if (!phoneRe.test(phone)) return { success: false, error: "Telefone inválido." };
  const lid = (input.lid ?? "").replace(/\D/g, "");
  const chaves = lid && lid !== phone ? [phone, lid] : [phone];

  try {
    const supabase = await createServerSupabaseClient();
    // DESC + limit: se a conversa passar de MAX_MENSAGENS, mantém as RECENTES
    // (última msg / "aguardando" corretos) — reordena p/ cronológico em JS.
    const { data, error } = await supabase
      .from("whatsapp_mensagens")
      .select("from_me, momment, created_at, tipo")
      .in("phone", chaves)
      .order("created_at", { ascending: false })
      .limit(MAX_MENSAGENS);

    if (error) return { success: false, error: "Não foi possível carregar as métricas." };
    const rows = (data as Row[] | null) ?? [];
    if (rows.length === 0) {
      return {
        success: true,
        metricas: {
          total: 0,
          enviadas: 0,
          recebidas: 0,
          nossaRespostaMedianaMin: null,
          leadRespostaMedianaMin: null,
          primeiraMs: null,
          ultimaMs: null,
          aguardando: false,
          midiaEnviadas: 0,
          midiaRecebidas: 0,
        },
      };
    }

    const tempoMs = (r: Row) => Date.parse(r.momment ?? r.created_at);
    const ordenada = [...rows].sort((a, b) => tempoMs(a) - tempoMs(b));

    let enviadas = 0;
    let recebidas = 0;
    let midiaEnviadas = 0;
    let midiaRecebidas = 0;
    const nossosGaps: number[] = [];
    const leadGaps: number[] = [];
    let anterior: Row | null = null;

    for (const r of ordenada) {
      if (r.from_me) enviadas++;
      else recebidas++;
      const tp = r.tipo ?? "text";
      if (tp !== "text") {
        if (r.from_me) midiaEnviadas++;
        else midiaRecebidas++;
      }
      if (anterior && anterior.from_me !== r.from_me) {
        const gap = (tempoMs(r) - tempoMs(anterior)) / 60000;
        if (gap >= 0 && gap <= RESPOSTA_MAX_HORAS * 60) {
          if (r.from_me) nossosGaps.push(gap);
          else leadGaps.push(gap);
        }
      }
      anterior = r;
    }

    const ultima = ordenada[ordenada.length - 1];
    return {
      success: true,
      metricas: {
        total: ordenada.length,
        enviadas,
        recebidas,
        nossaRespostaMedianaMin: mediana(nossosGaps),
        leadRespostaMedianaMin: mediana(leadGaps),
        primeiraMs: tempoMs(ordenada[0]),
        ultimaMs: tempoMs(ultima),
        aguardando: !ultima.from_me,
        midiaEnviadas,
        midiaRecebidas,
      },
    };
  } catch (err) {
    console.error({
      level: "error",
      action: "fetch_metricas_conversa",
      error: err instanceof Error ? err.name : "unknown",
    });
    return { success: false, error: "Erro ao carregar as métricas." };
  }
}
