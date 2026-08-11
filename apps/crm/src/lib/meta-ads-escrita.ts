// ════════════════════════════════════════════════════════════════════════
// Meta Ads — ESCRITA (A2). Server-only, token DEDICADO de gestão.
// ════════════════════════════════════════════════════════════════════════
//
// Usa META_ACCESS_TOKEN_MANAGE (ads_management) — token SEPARADO do de
// leitura, por desenho: o sync/telas leem com ads_read; só as ações de
// escrita (CEO/CTO, com confirmação + audit) tocam neste. Nunca em URL,
// nunca no client, nunca com cache.
//
// Escopo A2: pausar/reativar (campanha/conjunto/anúncio) e orçamento
// diário (campanha/conjunto). Criação de campanha fica p/ A4.
// ════════════════════════════════════════════════════════════════════════

const GRAPH_BASE = "https://graph.facebook.com";
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";

export class MetaAdsEscritaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaAdsEscritaError";
  }
}

export function metaAdsEscritaConfigurada(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN_MANAGE);
}

function tokenGestao(): string {
  const token = process.env.META_ACCESS_TOKEN_MANAGE;
  if (!token) throw new MetaAdsEscritaError("META_ACCESS_TOKEN_MANAGE não configurado.");
  return token;
}

interface GraphResposta {
  success?: boolean;
  effective_status?: string;
  daily_budget?: string;
  name?: string;
  error?: { message?: string; code?: number };
}

async function graphManage(path: string, init: { method: "GET" | "POST"; body?: URLSearchParams }): Promise<GraphResposta> {
  const res = await fetch(`${GRAPH_BASE}/${GRAPH_VERSION}/${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${tokenGestao()}` },
    body: init.body,
    cache: "no-store",
  });
  const json = (await res.json()) as GraphResposta;
  if (!res.ok || json.error) {
    throw new MetaAdsEscritaError(json.error?.message ?? `Meta API HTTP ${res.status}`);
  }
  return json;
}

export interface EstadoObjeto {
  nome: string;
  status: string;
  budgetDiarioCentavos: number | null;
}

/** Estado atual ANTES da mudança — vira `dados_anteriores` no audit trail. */
export async function lerEstadoAtual(objetoId: string): Promise<EstadoObjeto> {
  const json = await graphManage(`${objetoId}?fields=name,effective_status,daily_budget`, { method: "GET" });
  const budget = Number(json.daily_budget);
  return {
    nome: json.name ?? objetoId,
    status: json.effective_status ?? "UNKNOWN",
    budgetDiarioCentavos: Number.isFinite(budget) ? budget : null,
  };
}

export async function alterarStatus(objetoId: string, status: "ACTIVE" | "PAUSED"): Promise<void> {
  const json = await graphManage(objetoId, { method: "POST", body: new URLSearchParams({ status }) });
  if (json.success !== true) throw new MetaAdsEscritaError("A Meta não confirmou a alteração de status.");
}

export async function alterarOrcamentoDiario(objetoId: string, centavos: number): Promise<void> {
  const json = await graphManage(objetoId, {
    method: "POST",
    body: new URLSearchParams({ daily_budget: String(centavos) }),
  });
  if (json.success !== true) throw new MetaAdsEscritaError("A Meta não confirmou a alteração de orçamento.");
}
