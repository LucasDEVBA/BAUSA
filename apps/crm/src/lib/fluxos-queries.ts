import type { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  BLOCO_CATALOG,
  type BlocoMetrica,
  type Fluxo,
  type FluxoBloco,
  type FluxoBlocoTipo,
  type FluxoCanal,
  type FluxoDia,
  type FluxoGatilho,
  type FluxoMetricas,
} from "@/types/fluxo";

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// ════════════════════════════════════════════════════════════════════════
// Consultas dos Fluxos — leitura e MÉTRICAS.
//
// A métrica por bloco sai de `fluxo_eventos` (append-only), não de contadores
// mutáveis: contador que se atualiza mente quando um run morre no meio; o log
// de eventos não. "Chegaram" = bloco_executado; "seguiram" = chegou no bloco
// seguinte pelo caminho declarado — é assim que o funil de abandono aparece.
// ════════════════════════════════════════════════════════════════════════

export class FluxosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FluxosError";
  }
}

interface FluxoRow {
  id: string;
  nome: string;
  descricao: string | null;
  canal: string;
  gatilho: string;
  gatilho_config: unknown;
  bloco_inicial_id: string | null;
  ativo: boolean;
  limite_hora: number;
  reentrada_horas: number;
  created_at: string;
}

const objeto = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const mapFluxo = (r: FluxoRow): Fluxo => ({
  id: r.id,
  nome: r.nome,
  descricao: r.descricao,
  canal: r.canal as FluxoCanal,
  gatilho: r.gatilho as FluxoGatilho,
  gatilhoConfig: objeto(r.gatilho_config),
  blocoInicialId: r.bloco_inicial_id,
  ativo: r.ativo === true,
  limiteHora: Number(r.limite_hora) || 60,
  reentradaHoras: Number(r.reentrada_horas) || 0,
  criadoEm: r.created_at,
});

/** Um fluxo na listagem, com os números de 30 dias que importam. */
export interface FluxoResumo extends Fluxo {
  entradas30d: number;
  capturas30d: number;
  leads30d: number;
  taxaCaptura: number | null;
  blocosTotal: number;
}

export async function fetchFluxos(supabase: SupabaseServer): Promise<FluxoResumo[]> {
  const { data, error } = await supabase
    .from("fluxos")
    .select("id, nome, descricao, canal, gatilho, gatilho_config, bloco_inicial_id, ativo, limite_hora, reentrada_horas, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new FluxosError(`fluxos: ${error.message}`);

  const fluxos = (data ?? []).map((r) => mapFluxo(r as FluxoRow));
  if (fluxos.length === 0) return [];
  const ids = fluxos.map((f) => f.id);
  const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();

  // Enriquecimentos: cada um degrada para zero sem derrubar a lista.
  const [execRes, evRes, blocosRes] = await Promise.all([
    supabase.from("fluxo_execucoes").select("fluxo_id").in("fluxo_id", ids).gte("iniciada_em", desde),
    supabase.from("fluxo_eventos").select("fluxo_id, tipo").in("fluxo_id", ids).gte("created_at", desde),
    supabase.from("fluxo_blocos").select("fluxo_id").in("fluxo_id", ids),
  ]);

  const conta = <T extends { fluxo_id?: unknown }>(rows: T[] | null, filtro?: (r: T) => boolean): Map<string, number> => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) {
      if (filtro && !filtro(r)) continue;
      const k = String(r.fluxo_id ?? "");
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };

  const entradas = conta(execRes.data as Array<{ fluxo_id?: unknown }> | null);
  const eventos = (evRes.data ?? []) as Array<{ fluxo_id?: unknown; tipo?: unknown }>;
  const capturas = conta(eventos, (e) => e.tipo === "campo_capturado");
  const leads = conta(eventos, (e) => e.tipo === "lead_criado");
  const blocos = conta(blocosRes.data as Array<{ fluxo_id?: unknown }> | null);

  return fluxos.map((f) => {
    const ent = entradas.get(f.id) ?? 0;
    const cap = capturas.get(f.id) ?? 0;
    return {
      ...f,
      entradas30d: ent,
      capturas30d: cap,
      leads30d: leads.get(f.id) ?? 0,
      taxaCaptura: ent > 0 ? cap / ent : null,
      blocosTotal: blocos.get(f.id) ?? 0,
    };
  });
}

export async function fetchFluxo(supabase: SupabaseServer, id: string): Promise<Fluxo | null> {
  const { data, error } = await supabase
    .from("fluxos")
    .select("id, nome, descricao, canal, gatilho, gatilho_config, bloco_inicial_id, ativo, limite_hora, reentrada_horas, created_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new FluxosError(`fluxo: ${error.message}`);
  return data ? mapFluxo(data as FluxoRow) : null;
}

interface BlocoRow {
  id: string;
  fluxo_id: string;
  tipo: string;
  conteudo: unknown;
  proximo_id: string | null;
  ramos: unknown;
  ordem: number;
}

export async function fetchBlocos(supabase: SupabaseServer, fluxoId: string): Promise<FluxoBloco[]> {
  const { data, error } = await supabase
    .from("fluxo_blocos")
    .select("id, fluxo_id, tipo, conteudo, proximo_id, ramos, ordem")
    .eq("fluxo_id", fluxoId)
    .order("ordem", { ascending: true });
  if (error) throw new FluxosError(`fluxo_blocos: ${error.message}`);

  return (data ?? []).map((r) => {
    const row = r as BlocoRow;
    const ramosRaw = Array.isArray(row.ramos) ? row.ramos : [];
    return {
      id: row.id,
      fluxoId: row.fluxo_id,
      tipo: row.tipo as FluxoBlocoTipo,
      conteudo: objeto(row.conteudo),
      proximoId: row.proximo_id,
      ramos: ramosRaw.map((x) => {
        const o = objeto(x);
        return {
          valor: String(o.valor ?? ""),
          blocoId: typeof o.blocoId === "string" ? o.blocoId : null,
        };
      }),
      ordem: Number(row.ordem) || 0,
    };
  });
}

// ─── Métricas de UM fluxo ────────────────────────────────────────────────

const rotuloBloco = (b: FluxoBloco): string => {
  const texto = typeof b.conteudo.texto === "string" ? b.conteudo.texto : "";
  const curto = texto.trim().slice(0, 42);
  return curto.length > 0 ? curto : BLOCO_CATALOG[b.tipo].label;
};

export async function fetchFluxoMetricas(
  supabase: SupabaseServer,
  fluxoId: string,
  dias: number,
): Promise<FluxoMetricas> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();

  const [execRes, evRes, blocos] = await Promise.all([
    supabase.from("fluxo_execucoes").select("status").eq("fluxo_id", fluxoId).gte("iniciada_em", desde),
    supabase.from("fluxo_eventos").select("tipo, bloco_id").eq("fluxo_id", fluxoId).gte("created_at", desde),
    fetchBlocos(supabase, fluxoId),
  ]);
  if (execRes.error) throw new FluxosError(`fluxo_execucoes: ${execRes.error.message}`);
  if (evRes.error) throw new FluxosError(`fluxo_eventos: ${evRes.error.message}`);

  const execs = (execRes.data ?? []) as Array<{ status?: unknown }>;
  const eventos = (evRes.data ?? []) as Array<{ tipo?: unknown; bloco_id?: unknown }>;

  const porStatus = (s: string): number => execs.filter((e) => e.status === s).length;
  const porTipo = (t: string): number => eventos.filter((e) => e.tipo === t).length;

  const entradas = execs.length;
  const concluidas = porStatus("concluida");
  const respostas = porTipo("resposta_recebida") + porTipo("botao_clicado");
  const capturas = porTipo("campo_capturado");

  // Chegadas por bloco (a partir do log — não de contador mutável)
  const chegadas = new Map<string, number>();
  for (const e of eventos) {
    if (e.tipo !== "bloco_executado") continue;
    const id = typeof e.bloco_id === "string" ? e.bloco_id : "";
    if (id) chegadas.set(id, (chegadas.get(id) ?? 0) + 1);
  }

  // "Seguiram" = quantos chegaram no(s) bloco(s) seguinte(s) declarado(s).
  const metricasBlocos: BlocoMetrica[] = blocos.map((b) => {
    const chegaram = chegadas.get(b.id) ?? 0;
    const destinos = [b.proximoId, ...b.ramos.map((r) => r.blocoId)].filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
    const seguiram = destinos.reduce((s, id) => s + (chegadas.get(id) ?? 0), 0);
    return {
      blocoId: b.id,
      tipo: b.tipo,
      rotulo: rotuloBloco(b),
      chegaram,
      // nunca reportar mais avanço do que chegada (ramos convergentes)
      seguiram: Math.min(seguiram, chegaram),
      taxaAvanco: chegaram > 0 ? Math.min(seguiram, chegaram) / chegaram : null,
    };
  });

  return {
    fluxoId,
    entradas,
    concluidas,
    emAndamento: porStatus("ativa") + porStatus("aguardando_resposta"),
    abandonadas: porStatus("abandonada"),
    handoffs: porStatus("handoff"),
    erros: porStatus("erro"),
    respostas,
    capturas,
    leadsCriados: porTipo("lead_criado"),
    reunioes: 0, // preenchido pela page (cruzamento com deals)
    taxaConclusao: entradas > 0 ? concluidas / entradas : null,
    taxaResposta: entradas > 0 ? respostas / entradas : null,
    taxaCaptura: entradas > 0 ? capturas / entradas : null,
    blocos: metricasBlocos,
  };
}

/** Série diária para o gráfico (entradas × concluídas × capturas). */
export async function fetchFluxoSerie(
  supabase: SupabaseServer,
  fluxoId: string | null,
  dias: number,
): Promise<FluxoDia[]> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  let execQ = supabase.from("fluxo_execucoes").select("iniciada_em, status").gte("iniciada_em", desde);
  let evQ = supabase.from("fluxo_eventos").select("created_at, tipo").gte("created_at", desde).eq("tipo", "campo_capturado");
  if (fluxoId) {
    execQ = execQ.eq("fluxo_id", fluxoId);
    evQ = evQ.eq("fluxo_id", fluxoId);
  }
  const [execRes, evRes] = await Promise.all([execQ, evQ]);
  if (execRes.error) throw new FluxosError(`fluxo_execucoes: ${execRes.error.message}`);

  const porDia = new Map<string, FluxoDia>();
  const garante = (dia: string): FluxoDia => {
    const atual = porDia.get(dia) ?? { dia, entradas: 0, concluidas: 0, capturas: 0 };
    porDia.set(dia, atual);
    return atual;
  };
  for (const r of (execRes.data ?? []) as Array<{ iniciada_em?: unknown; status?: unknown }>) {
    const dia = String(r.iniciada_em ?? "").slice(0, 10);
    if (!dia) continue;
    const d = garante(dia);
    d.entradas += 1;
    if (r.status === "concluida") d.concluidas += 1;
  }
  for (const r of (evRes.data ?? []) as Array<{ created_at?: unknown }>) {
    const dia = String(r.created_at ?? "").slice(0, 10);
    if (dia) garante(dia).capturas += 1;
  }
  return [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

/** Contatos capturados por um fluxo (aba Contatos). */
export interface ContatoFluxo {
  id: string;
  canal: FluxoCanal;
  externoId: string;
  nome: string | null;
  username: string | null;
  tags: string[];
  campos: Record<string, unknown>;
  temLead: boolean;
  ultimoContatoEm: string | null;
}

export async function fetchContatos(supabase: SupabaseServer, limite: number): Promise<ContatoFluxo[]> {
  const { data, error } = await supabase
    .from("fluxo_contatos")
    .select("id, canal, externo_id, nome, username, tags, campos, form_submission_id, ultimo_contato_at")
    .is("deleted_at", null)
    .order("ultimo_contato_at", { ascending: false, nullsFirst: false })
    .limit(limite);
  if (error) throw new FluxosError(`fluxo_contatos: ${error.message}`);

  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id),
      canal: String(row.canal) as FluxoCanal,
      externoId: String(row.externo_id),
      nome: typeof row.nome === "string" ? row.nome : null,
      username: typeof row.username === "string" ? row.username : null,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      campos: objeto(row.campos),
      temLead: typeof row.form_submission_id === "string",
      ultimoContatoEm: typeof row.ultimo_contato_at === "string" ? row.ultimo_contato_at : null,
    };
  });
}

/** KPIs do topo da tela principal (todos os fluxos, período). */
export interface FluxosResumoGeral {
  fluxosAtivos: number;
  entradas: number;
  capturas: number;
  leads: number;
  taxaCaptura: number | null;
  contatosTotal: number;
}

export async function fetchResumoGeral(supabase: SupabaseServer, dias: number): Promise<FluxosResumoGeral> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  const [fluxosRes, execRes, evRes, contatosRes] = await Promise.all([
    supabase.from("fluxos").select("ativo").is("deleted_at", null),
    supabase.from("fluxo_execucoes").select("id", { count: "exact", head: true }).gte("iniciada_em", desde),
    supabase.from("fluxo_eventos").select("tipo").gte("created_at", desde).in("tipo", ["campo_capturado", "lead_criado"]),
    supabase.from("fluxo_contatos").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);

  const eventos = (evRes.data ?? []) as Array<{ tipo?: unknown }>;
  const capturas = eventos.filter((e) => e.tipo === "campo_capturado").length;
  const entradas = execRes.count ?? 0;

  return {
    fluxosAtivos: ((fluxosRes.data ?? []) as Array<{ ativo?: unknown }>).filter((f) => f.ativo === true).length,
    entradas,
    capturas,
    leads: eventos.filter((e) => e.tipo === "lead_criado").length,
    taxaCaptura: entradas > 0 ? capturas / entradas : null,
    contatosTotal: contatosRes.count ?? 0,
  };
}
