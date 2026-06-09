"use server";

import { revalidatePath } from "next/cache";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel, getSession } from "@/lib/auth";
import {
  fetchSegmentoLeadsFull,
  REMARKETING_SEGMENTS,
  type RemarketingFiltros,
} from "@/lib/remarketing-queries";
import type { MensagemConfig } from "@/lib/remarketing-types";

// ════════════════════════════════════════════════════════════════════════
// Campanhas de re-marketing — preparar / disparar / cancelar.
// O disparo real (com salvaguardas anti-ban) é feito pela Cloud Function
// send-remarketing; aqui apenas criamos a campanha + envios e a acionamos.
// ════════════════════════════════════════════════════════════════════════

const SEND_REMARKETING_URL = process.env.SEND_REMARKETING_URL;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;
const MENSAGEM_MAX = 1024;

function isHttpUrl(u?: string): boolean {
  if (!u) return false;
  try {
    const x = new URL(u.trim());
    return x.protocol === "https:" || x.protocol === "http:";
  } catch {
    return false;
  }
}

function toE164(whatsapp: string): string {
  const digits = (whatsapp || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

type PrepararResult =
  | { success: true; campanhaId: string; total: number; amostra: string[] }
  | { success: false; error: string };

export async function prepararCampanha(
  segmentKey: string,
  mensagem: string,
  filtros?: RemarketingFiltros,
  config?: MensagemConfig,
): Promise<PrepararResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode criar campanhas." };
  }
  const cfg: MensagemConfig = config ?? { canal: "whatsapp", tipo: "texto" };
  const canal = cfg.canal ?? "whatsapp";
  const msg = (mensagem || "").trim();

  if (canal === "email") {
    if (!(cfg.assunto ?? "").trim()) return { success: false, error: "Informe o assunto do e-mail." };
    if (!msg) return { success: false, error: "Escreva o corpo do e-mail." };
    if (cfg.imagemUrl && !isHttpUrl(cfg.imagemUrl)) return { success: false, error: "Imagem do e-mail: URL inválida (https)." };
    if (cfg.linkUrl && !isHttpUrl(cfg.linkUrl)) return { success: false, error: "Botão do e-mail: URL inválida (https)." };
  } else {
    // Caption opcional p/ imagem; corpo obrigatório p/ texto/link.
    if (cfg.tipo !== "imagem" && !msg) return { success: false, error: "Mensagem vazia." };
    if (cfg.tipo === "imagem" && !isHttpUrl(cfg.imagemUrl)) {
      return { success: false, error: "Informe uma URL de imagem válida (https) ou faça upload." };
    }
    if (cfg.tipo === "link") {
      if (!isHttpUrl(cfg.linkUrl)) return { success: false, error: "Informe uma URL de link válida (https)." };
      if (cfg.linkImagem && !isHttpUrl(cfg.linkImagem)) {
        return { success: false, error: "A imagem do link deve ser uma URL válida (https)." };
      }
    }
  }
  if (msg.length > MENSAGEM_MAX) return { success: false, error: `Mensagem excede ${MENSAGEM_MAX} caracteres.` };

  const def = REMARKETING_SEGMENTS.find((s) => s.key === segmentKey);
  if (!def) return { success: false, error: "Segmento inválido." };

  const leads = await fetchSegmentoLeadsFull(segmentKey, filtros);
  const comContato =
    canal === "email"
      ? leads.filter((l) => (l.email || "").includes("@"))
      : leads.filter((l) => toE164(l.whatsapp));
  if (comContato.length === 0) {
    return {
      success: false,
      error:
        canal === "email"
          ? "Nenhum lead com e-mail válido neste segmento/filtros."
          : "Nenhum lead com telefone válido neste segmento/filtros.",
    };
  }

  const supabase = await createAuditedSupabaseClient();
  const user = await getSession();
  const isEmail = canal === "email";
  const isWaLink = canal === "whatsapp" && cfg.tipo === "link";

  const { data: camp, error: errCamp } = await supabase
    .from("remarketing_campanhas")
    .insert({
      segmento: segmentKey,
      mensagem: msg,
      filtros: (filtros ?? {}) as Record<string, unknown>,
      total_alvo: comContato.length,
      status: "rascunho",
      criada_por: user?.id ?? null,
      canal,
      assunto: isEmail ? (cfg.assunto ?? "").trim() : null,
      tipo_mensagem: isEmail ? "texto" : cfg.tipo,
      // Email: imagem_url = header, link_url/link_titulo = botão CTA.
      // WhatsApp: imagem (tipo=imagem) ou link (tipo=link).
      imagem_url: isEmail
        ? ((cfg.imagemUrl ?? "").trim() || null)
        : cfg.tipo === "imagem" ? (cfg.imagemUrl ?? "").trim() : null,
      link_url: isEmail
        ? ((cfg.linkUrl ?? "").trim() || null)
        : isWaLink ? (cfg.linkUrl ?? "").trim() : null,
      link_titulo: isEmail || isWaLink ? ((cfg.linkTitulo ?? "").trim() || null) : null,
      link_descricao: isWaLink ? ((cfg.linkDescricao ?? "").trim() || null) : null,
      link_imagem: isWaLink ? ((cfg.linkImagem ?? "").trim() || null) : null,
    })
    .select("id")
    .single();

  if (errCamp || !camp) {
    return { success: false, error: `Erro ao criar campanha: ${errCamp?.message ?? "desconhecido"}` };
  }

  // Idempotência: UNIQUE(campanha_id, deal_id). Dedup por dealId defensivo.
  const vistos = new Set<string>();
  const envios = comContato
    .filter((l) => (vistos.has(l.dealId) ? false : (vistos.add(l.dealId), true)))
    .map((l) => ({
      campanha_id: camp.id,
      deal_id: l.dealId,
      telefone: isEmail ? null : toE164(l.whatsapp),
      email: isEmail ? (l.email || "").trim().toLowerCase() : null,
      nome: l.nome,
      esporte: l.esporte,
      status: "pendente",
    }));

  const { error: errEnvios } = await supabase.from("remarketing_envios").insert(envios);
  if (errEnvios) {
    return { success: false, error: `Erro ao criar envios: ${errEnvios.message}` };
  }

  revalidatePath("/remarketing");
  return {
    success: true,
    campanhaId: camp.id,
    total: envios.length,
    amostra: comContato.slice(0, 5).map((l) => (l.nome || "").trim().split(/\s+/)[0] || "—"),
  };
}

type DispararResult = { success: boolean; error?: string; enviados?: number; restantes?: number };

export async function dispararCampanha(campanhaId: string): Promise<DispararResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode disparar campanhas." };
  }
  if (!SEND_REMARKETING_URL) {
    return { success: false, error: "SEND_REMARKETING_URL não configurada no Engine." };
  }

  try {
    const resp = await fetch(SEND_REMARKETING_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WEBHOOK_SECRET ? { "x-webhook-secret": WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({ campanha_id: campanhaId }),
    });
    const json = (await resp.json()) as DispararResult;
    revalidatePath("/remarketing");
    if (!resp.ok || json.success === false) {
      return { success: false, error: json.error ?? `HTTP ${resp.status}` };
    }
    return { success: true, enviados: json.enviados ?? 0, restantes: json.restantes };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Falha ao acionar disparo." };
  }
}

export async function cancelarCampanha(campanhaId: string): Promise<{ success: boolean; error?: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode cancelar campanhas." };
  }
  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("remarketing_campanhas")
    .update({ status: "pausada", deleted_at: new Date().toISOString() })
    .eq("id", campanhaId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/remarketing");
  return { success: true };
}
