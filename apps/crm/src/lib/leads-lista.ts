import { type createServerSupabaseClient } from "@/lib/supabase-server";
import { BUSCA_LEADS_MIN, type FiltrosLeads, type OrdemLeads } from "@/lib/leads-filtros";
import {
  COLUNAS_LEAD_DOSSIE,
  COLUNAS_LISTA_LEADS,
  mapFormSubmissionToLead,
  mapLinhaListaLead,
  type IrmaoLead,
  type LeadLinha,
  type LinhaListaView,
} from "@/lib/leads-mapper";
import { computarPrioridades, type AlvoPrioridade, type PrioridadeLead } from "@/lib/prioridade-engajamento";
import { montarFiltroBusca } from "@/lib/revisao-leads";
import { buscarTodasAsPaginas } from "@/lib/supabase-paginacao";
import { type Lead } from "@/types/lead";

// ════════════════════════════════════════════════════════════════════════
// /leads paginada no SERVIDOR (T8). Antes: select("*") de form_submissions
// inteiro + atletas inteiro, filtro/ordenação/paginação no navegador — e o
// PostgREST corta em 1000 linhas em silêncio (909 ativos em 08/10).
// Agora: 1 página por requisição (range) + count exact; KPIs por head count.
// Fonte: public.vw_cadastros_situacao (security_invoker — RLS de quem lê).
// Uso SÓ no servidor (Server Component / server actions) — o gate de papel
// fica em quem chama (requirePapel na page, getUserPapel nas actions).
// ════════════════════════════════════════════════════════════════════════

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const VIEW = "vw_cadastros_situacao";
const CLASSES_QUALIFICADAS = ["QUENTE", "MORNO"];
const TIMING_ALTERNATIVO = ["muito_cedo", "tarde_demais"];
const MIN_DIGITOS_DUPLICATA = 8;
const TETO_EXPORT = 20_000;

/** Ordem SQL por coluna da tabela. "prioridade" é calculada em memória. */
const ORDEM_SQL: Record<Exclude<OrdemLeads, "prioridade">, string[]> = {
  submitted_at: ["submitted_at"],
  athlete_name: ["athlete_name"],
  qualification_classification: ["qualification_classification"],
  investment_range: ["investment_range"],
  position: ["position"],
  location: ["address_state", "city_state"],
  comunicacao: ["comunicacao_etapa"],
  pipeline: ["deal_etapa"],
  origem: ["origem"],
};

export interface KpisLeads {
  total: number | null;
  quente: number | null;
  morno: number | null;
  frio: number | null;
  timingAlternativo: number | null;
  pendentesAprovacao: number | null;
}

export type ResultadoPaginaLeads =
  | {
      ok: true;
      linhas: LeadLinha[];
      total: number;
      prioridades: Record<string, PrioridadeLead>;
      /** Página pedida além do fim → devolvemos a última (a URL é corrigida no client). */
      paginaEfetiva: number;
      aviso: string | null;
    }
  | { ok: false; erro: string };

function consultaFiltrada(supabase: SupabaseServer, colunas: string, f: FiltrosLeads, contar: boolean) {
  let q = supabase.from(VIEW).select(colunas, contar ? { count: "exact" } : undefined);
  if (f.classe !== "ALL") q = q.eq("qualification_classification", f.classe);
  const busca = montarFiltroBusca(f.q, BUSCA_LEADS_MIN);
  if (busca) q = q.or(busca);
  return q;
}

/** KPIs da base INTEIRA (não do filtro) — head count, nunca baixa linhas. */
export async function carregarKpisLeads(supabase: SupabaseServer): Promise<KpisLeads> {
  const contar = () =>
    supabase.from("form_submissions").select("id", { count: "exact", head: true }).is("deleted_at", null);
  const [total, quente, morno, frio, timing, pendentes] = await Promise.all([
    contar(),
    contar().eq("qualification_classification", "QUENTE"),
    contar().eq("qualification_classification", "MORNO"),
    contar().eq("qualification_classification", "FRIO"),
    contar().in("timing_status", TIMING_ALTERNATIVO),
    contar().eq("aprovacao_status", "pendente").in("qualification_classification", CLASSES_QUALIFICADAS),
  ]);
  // Erro vira null → a UI mostra "—" (nunca um 0 mentiroso).
  const n = (r: { count: number | null; error: unknown }) => (r.error ? null : (r.count ?? 0));
  return {
    total: n(total),
    quente: n(quente),
    morno: n(morno),
    frio: n(frio),
    timingAlternativo: n(timing),
    pendentesAprovacao: n(pendentes),
  };
}

export async function carregarPaginaLeads(
  supabase: SupabaseServer,
  f: FiltrosLeads,
): Promise<ResultadoPaginaLeads> {
  try {
    if (f.ordem === "prioridade") return await carregarPorPrioridade(supabase, f);
    return await carregarPorColuna(supabase, f, f.pagina);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error({ level: "error", action: "carregar_pagina_leads", message: msg });
    return { ok: false, erro: "Não foi possível carregar os leads. Recarregue a página." };
  }
}

async function carregarPorColuna(
  supabase: SupabaseServer,
  f: FiltrosLeads,
  pagina: number,
): Promise<ResultadoPaginaLeads> {
  const de = (pagina - 1) * f.porPagina;
  let q = consultaFiltrada(supabase, COLUNAS_LISTA_LEADS, f, true);
  const ascending = f.dir === "asc";
  for (const coluna of ORDEM_SQL[f.ordem as Exclude<OrdemLeads, "prioridade">]) {
    q = q.order(coluna, { ascending, nullsFirst: false });
  }
  // Desempate estável: sem ele, páginas vizinhas podem repetir/pular linhas.
  if (f.ordem !== "submitted_at") q = q.order("submitted_at", { ascending: false });
  q = q.order("id", { ascending: false });
  const { data, error, count } = await q.range(de, de + f.porPagina - 1);

  if (error?.code === "PGRST103" && pagina > 1) {
    // Página além do fim (URL antiga, filtro mudou): volta para a última.
    const { count: total } = await consultaFiltrada(supabase, "id", f, true).limit(1);
    const ultima = Math.max(1, Math.ceil((total ?? 0) / f.porPagina));
    return ultima < pagina ? carregarPorColuna(supabase, f, ultima) : { ok: false, erro: error.message };
  }
  if (error) throw new Error(`vw_cadastros_situacao: ${error.message}`);

  const rows = (data ?? []) as unknown as LinhaListaView[];
  // Independentes: em paralelo (prioridade lê whatsapp_mensagens paginado)
  const [linhas, prioridades] = await Promise.all([
    enriquecerLinhas(supabase, rows),
    prioridadesDaPagina(supabase, rows),
  ]);
  return { ok: true, linhas, total: count ?? linhas.length, prioridades, paginaEfetiva: pagina, aviso: null };
}

/**
 * Ordenar por prioridade preserva o recurso da tabela antiga sem baixar a
 * base: P1/P2 só existe para aprovados QUENTE/MORNO (≈250 hoje), então
 * esse subconjunto é lido inteiro (paginado), pontuado, ordenado em memória
 * e fatiado. Quem não é aprovado não tem prioridade e não entra nesta ordem.
 */
async function carregarPorPrioridade(supabase: SupabaseServer, f: FiltrosLeads): Promise<ResultadoPaginaLeads> {
  type Candidato = Pick<LinhaListaView, "id" | "athlete_whatsapp" | "guardian_whatsapp" | "deal_etapa" | "submitted_at">;
  const candidatos = await buscarTodasAsPaginas<Candidato>((de, ate) =>
    consultaFiltrada(supabase, "id, athlete_whatsapp, guardian_whatsapp, deal_etapa, submitted_at", f, false)
      .eq("aprovacao_status", "aprovado")
      .in("qualification_classification", CLASSES_QUALIFICADAS)
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: false })
      .range(de, ate)
      .then((r) => ({ data: (r.data ?? []) as unknown as Candidato[], error: r.error })),
  );
  if (candidatos.error) throw new Error(`prioridade: ${candidatos.error.message}`);

  const alvos: AlvoPrioridade[] = candidatos.data.map((c) => ({
    id: c.id,
    athleteWhatsapp: c.athlete_whatsapp,
    guardianWhatsapp: c.guardian_whatsapp,
    etapaDeal: c.deal_etapa,
  }));
  const mapa = await computarPrioridades(supabase, alvos);
  const peso = (id: string) => {
    const p = mapa.get(id);
    return p ? (p.nivel === "P1" ? 1000 : 0) + p.pontos : -1;
  };
  const ordenados = [...candidatos.data].sort((a, b) => peso(b.id) - peso(a.id));
  if (f.dir === "asc") ordenados.reverse();

  const total = ordenados.length;
  const ultima = Math.max(1, Math.ceil(total / f.porPagina));
  const pagina = Math.min(f.pagina, ultima);
  const ids = ordenados.slice((pagina - 1) * f.porPagina, pagina * f.porPagina).map((c) => c.id);

  const { data, error } = ids.length
    ? await supabase.from(VIEW).select(COLUNAS_LISTA_LEADS).in("id", ids)
    : { data: [], error: null };
  if (error) throw new Error(`vw_cadastros_situacao: ${error.message}`);
  const porId = new Map(((data ?? []) as unknown as LinhaListaView[]).map((r) => [r.id, r]));
  const rows = ids.map((id) => porId.get(id)).filter((r): r is LinhaListaView => r !== undefined);

  const prioridades: Record<string, PrioridadeLead> = {};
  for (const id of ids) {
    const p = mapa.get(id);
    if (p) prioridades[id] = p;
  }
  return {
    ok: true,
    linhas: await enriquecerLinhas(supabase, rows),
    total,
    prioridades,
    paginaEfetiva: pagina,
    aviso: "Ordenado por prioridade: só leads aprovados (Quente/Morno) têm P1/P2 — os demais ficam fora desta ordem.",
  };
}

/** Prioridade P1/P2 só para aprovados QUENTE/MORNO da página (regra antiga). */
async function prioridadesDaPagina(
  supabase: SupabaseServer,
  rows: LinhaListaView[],
): Promise<Record<string, PrioridadeLead>> {
  const alvos: AlvoPrioridade[] = rows
    .filter((r) => r.aprovacao_status === "aprovado" && CLASSES_QUALIFICADAS.includes(r.qualification_classification ?? ""))
    .map((r) => ({
      id: r.id,
      athleteWhatsapp: r.athlete_whatsapp,
      guardianWhatsapp: r.guardian_whatsapp,
      etapaDeal: r.deal_etapa,
    }));
  return Object.fromEntries(await computarPrioridades(supabase, alvos));
}

/** Duplicata (WhatsApp do responsável) + irmãos — calculados na BASE, só p/ a página. */
async function enriquecerLinhas(supabase: SupabaseServer, rows: LinhaListaView[]): Promise<LeadLinha[]> {
  const [duplicadas, irmaos] = await Promise.all([idsDuplicados(supabase, rows), irmaosPorCadastro(supabase, rows)]);
  return rows.map((r) => ({
    ...mapLinhaListaLead(r),
    possible_duplicate: duplicadas.has(r.id),
    siblings: irmaos.get(r.id),
  }));
}

async function idsDuplicados(
  supabase: SupabaseServer,
  rows: Pick<LinhaListaView, "id" | "telefone_resp_digitos">[],
): Promise<Set<string>> {
  const digitos = [
    ...new Set(
      rows
        .map((r) => r.telefone_resp_digitos)
        .filter((d): d is string => d !== null && d.length >= MIN_DIGITOS_DUPLICATA),
    ),
  ];
  if (digitos.length === 0) return new Set();
  const { data, error } = await supabase.from(VIEW).select("id, telefone_resp_digitos").in("telefone_resp_digitos", digitos);
  if (error) {
    console.error({ level: "error", action: "leads_duplicatas", message: error.message });
    return new Set(); // fail-open: sem selo "Duplicata?" (camada de exibição)
  }
  const porTelefone = new Map<string, number>();
  for (const r of (data ?? []) as unknown as { telefone_resp_digitos: string }[]) {
    porTelefone.set(r.telefone_resp_digitos, (porTelefone.get(r.telefone_resp_digitos) ?? 0) + 1);
  }
  return new Set(
    rows.filter((r) => r.telefone_resp_digitos && (porTelefone.get(r.telefone_resp_digitos) ?? 0) > 1).map((r) => r.id),
  );
}

async function irmaosPorCadastro(
  supabase: SupabaseServer,
  rows: Pick<LinhaListaView, "id" | "atleta_id" | "responsavel_id">[],
): Promise<Map<string, IrmaoLead[]>> {
  const responsaveis = [...new Set(rows.map((r) => r.responsavel_id).filter((x): x is string => x !== null))];
  const resultado = new Map<string, IrmaoLead[]>();
  if (responsaveis.length === 0) return resultado;
  const { data, error } = await supabase
    .from("atletas")
    .select("id, nome_completo, esporte, responsavel_id, lead_classificacao, deals(id, etapa, deleted_at)")
    .in("responsavel_id", responsaveis)
    .is("deleted_at", null);
  if (error) {
    console.error({ level: "error", action: "leads_irmaos", message: error.message });
    return resultado;
  }
  type DealEmb = { id: string; etapa: string; deleted_at: string | null };
  type AtletaRow = {
    id: string;
    nome_completo: string;
    esporte: string | null;
    responsavel_id: string;
    lead_classificacao: string | null;
    deals: DealEmb[] | DealEmb | null;
  };
  // Embed pode voltar objeto OU array — normalizar SEMPRE (incidente 2026-09-05).
  const asArray = <T,>(v: T[] | T | null | undefined): T[] => (Array.isArray(v) ? v : v ? [v] : []);
  const atletas = (data ?? []) as unknown as AtletaRow[];
  for (const r of rows) {
    if (!r.responsavel_id || !r.atleta_id) continue;
    const grupo = atletas.filter((a) => a.responsavel_id === r.responsavel_id && a.id !== r.atleta_id);
    if (grupo.length === 0) continue;
    resultado.set(
      r.id,
      grupo.map((a) => ({
        id: a.id,
        nome: a.nome_completo,
        esporte: a.esporte || undefined,
        classificacao: a.lead_classificacao || undefined,
        etapa: asArray(a.deals).find((d) => d.deleted_at === null)?.etapa,
      })),
    );
  }
  return resultado;
}

/** Dossiê completo de 1 cadastro (lista, deep-link ?atleta= e faixa do Pipeline). */
export async function obterLeadDossieInterno(supabase: SupabaseServer, formSubmissionId: string): Promise<Lead | null> {
  const [fsRes, situacaoRes] = await Promise.all([
    supabase.from("form_submissions").select(COLUNAS_LEAD_DOSSIE).eq("id", formSubmissionId).is("deleted_at", null).maybeSingle(),
    supabase
      .from(VIEW)
      .select("id, atleta_id, responsavel_id, deal_id, deal_etapa, telefone_resp_digitos")
      .eq("id", formSubmissionId)
      .maybeSingle(),
  ]);
  if (fsRes.error) throw new Error(`form_submissions: ${fsRes.error.message}`);
  if (situacaoRes.error) throw new Error(`vw_cadastros_situacao: ${situacaoRes.error.message}`);
  if (!fsRes.data) return null;
  const s = situacaoRes.data as unknown as Pick<
    LinhaListaView,
    "id" | "atleta_id" | "responsavel_id" | "deal_id" | "deal_etapa" | "telefone_resp_digitos"
  > | null;
  const lead = mapFormSubmissionToLead(fsRes.data as unknown as Record<string, unknown>, {
    atletaId: s?.atleta_id ?? null,
    dealId: s?.deal_id ?? null,
    etapa: s?.deal_etapa ?? null,
  });
  if (!s) return lead;
  const [duplicadas, irmaos] = await Promise.all([idsDuplicados(supabase, [s]), irmaosPorCadastro(supabase, [s])]);
  return { ...lead, possible_duplicate: duplicadas.has(s.id), siblings: irmaos.get(s.id) };
}

/** Deep-link ?atleta=<atletas.id> → form_submission_id (null se não houver). */
export async function formSubmissionDoAtleta(supabase: SupabaseServer, atletaId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("atletas")
    .select("form_submission_id")
    .eq("id", atletaId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { form_submission_id: string | null }).form_submission_id;
}

/** Linhas do CSV: TODOS os leads do filtro atual (paginando acima de 1000). */
export async function linhasParaExport(
  supabase: SupabaseServer,
  f: FiltrosLeads,
): Promise<{ linhas: LinhaListaView[]; truncado: boolean }> {
  const r = await buscarTodasAsPaginas<LinhaListaView>(
    (de, ate) =>
      consultaFiltrada(supabase, COLUNAS_LISTA_LEADS, f, false)
        .order("submitted_at", { ascending: false })
        .order("id", { ascending: false })
        .range(de, ate)
        .then((res) => ({ data: (res.data ?? []) as unknown as LinhaListaView[], error: res.error })),
    { teto: TETO_EXPORT },
  );
  if (r.error) throw new Error(`export: ${r.error.message}`);
  return { linhas: r.data, truncado: r.truncado };
}
