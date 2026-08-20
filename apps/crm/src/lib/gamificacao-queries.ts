import "server-only";

import {
  CONQUISTAS_CATALOGO,
  NIVEIS,
  nivelDoXp,
  xpParaNivel,
} from "@/lib/gamificacao";
import { rotuloEventoGamificacao } from "@/lib/gamificacao-labels";
import { createAdminClient, hasServiceKey } from "@/lib/supabase-admin";
import type { createServerSupabaseClient } from "@/lib/supabase-server";
import type { PapelUsuario } from "@/types/crm";

// ════════════════════════════════════════════════════════════════════════
// Gamificação — camada de dados (/conquistas). SOMENTE leitura.
//
// Client Supabase INJETADO (padrão emails-queries/fluxos-queries): a page
// cria o client de sessão e passa — o RLS de gamificacao_eventos/_conquistas
// (SELECT p/ authenticated) vale normalmente.
//
// Exceção consciente: o RANKING precisa de nome/papel de TODOS os usuários
// ativos, mas o RLS de user_profiles só devolve a própria linha para quem
// não é CEO. Para o Head ver o ranking completo, a listagem de perfis usa o
// admin client quando disponível (leitura de nome/papel — dado que a própria
// migration de gamificação declara "ranking é público interno"). Sem service
// key degrada para o client de sessão (CEO vê tudo; Head vê só a si).
//
// Gotcha herdado: PostgREST devolve `error` sem lançar — SEMPRE checar.
// ════════════════════════════════════════════════════════════════════════

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabaseClient>>;

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3 (mesmo racional do motor)
const DIA_MS = 24 * 60 * 60 * 1000;
const DIAS_GRAFICO = 30;
const MAX_ACOES_RECENTES = 15;

interface EventoRow {
  tipo: string;
  pontos: number;
  criado_em: string;
}

interface ConquistaRow {
  conquista: string;
  desbloqueada_em: string;
}

export interface AcaoRecente {
  tipo: string;
  rotulo: string;
  pontos: number;
  criadoEm: string;
}

export interface XpDia {
  /** YYYY-MM-DD em BRT */
  dia: string;
  xp: number;
}

export interface ConquistaView {
  id: string;
  nome: string;
  descricao: string;
  selo: string;
  /** epica = marco grande (galeria destaca com anel animado). Vem do catálogo
   *  server-only — replicado aqui porque o client não pode importá-lo. */
  tier: "normal" | "epica";
  desbloqueada: boolean;
  desbloqueadaEm: string | null;
  /** Progresso contável rumo ao critério (null quando não se aplica). */
  progressoAtual: number | null;
  progressoMeta: number | null;
}

export interface PerfilGamificacao {
  xpTotal: number;
  nivel: number;
  nivelNome: string;
  /** XP acumulado dentro do nível atual. */
  xpNoNivel: number;
  /** XP necessário para fechar o nível atual (null = topo). */
  xpProximo: number | null;
  proximoNivelNome: string | null;
  /** 0–100 dentro do nível (100 no topo da escada). */
  progressoPct: number;
  nivelMaximo: number;
  streakDias: number;
  totalAcoes: number;
  xpPorDia: XpDia[];
  ultimasAcoes: AcaoRecente[];
  conquistas: ConquistaView[];
  conquistasDesbloqueadas: number;
}

export interface RankingUsuario {
  userId: string;
  nome: string;
  papel: PapelUsuario;
  /** Foto do bucket público `avatars` (null = cai na inicial). */
  avatarUrl: string | null;
  xpTotal: number;
  nivel: number;
  nivelNome: string;
  progressoPct: number;
  conquistasCount: number;
}

/** Chave de dia (YYYY-MM-DD) na hora local BRT. */
function diaBRT(instante: number): string {
  return new Date(instante - BRT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Streak atual: dias consecutivos com evento, terminando hoje ou ontem (BRT). */
function calcularStreak(dias: Set<string>, agora: number): number {
  let cursor = agora;
  if (!dias.has(diaBRT(cursor))) cursor -= DIA_MS; // hoje ainda sem ação não quebra
  let streak = 0;
  while (dias.has(diaBRT(cursor))) {
    streak += 1;
    cursor -= DIA_MS;
  }
  return streak;
}

/** Maior sequência de dias consecutivos no conjunto (capada em `teto`). */
function maiorSequencia(dias: Set<string>, teto: number): number {
  let melhor = 0;
  for (const dia of dias) {
    let seq = 1;
    const d = new Date(`${dia}T12:00:00Z`);
    while (seq < teto) {
      d.setUTCDate(d.getUTCDate() + 1);
      if (!dias.has(d.toISOString().slice(0, 10))) break;
      seq += 1;
    }
    if (seq > melhor) melhor = seq;
    if (melhor >= teto) break;
  }
  return melhor;
}

/** true se algum evento aconteceu antes das 7h BRT (regra do selo Madrugador). */
function temEventoMadrugada(eventos: EventoRow[]): boolean {
  return eventos.some((e) => {
    const h = (new Date(e.criado_em).getUTCHours() + 21) % 24;
    return h >= 4 && h < 7;
  });
}

function montarConquistas(
  eventos: EventoRow[],
  desbloqueios: ConquistaRow[],
): ConquistaView[] {
  const quando = new Map(desbloqueios.map((c) => [c.conquista, c.desbloqueada_em]));
  const porTipo = new Map<string, number>();
  for (const e of eventos) porTipo.set(e.tipo, (porTipo.get(e.tipo) ?? 0) + 1);
  const dias = new Set(eventos.map((e) => diaBRT(new Date(e.criado_em).getTime())));

  return CONQUISTAS_CATALOGO.map((c) => {
    const desbloqueadaEm = quando.get(c.id) ?? null;
    let progressoAtual: number | null = null;
    let progressoMeta: number | null = null;

    if (c.id === "comunicador") {
      progressoAtual = (porTipo.get("email_enviado") ?? 0) + (porTipo.get("whatsapp_enviado") ?? 0);
      progressoMeta = 100;
    } else if (c.id === "semana_perfeita") {
      progressoAtual = maiorSequencia(dias, 7);
      progressoMeta = 7;
    } else if (c.id === "madrugador") {
      progressoAtual = temEventoMadrugada(eventos) ? 1 : 0;
      progressoMeta = 1;
    } else if (c.tipo === null) {
      progressoAtual = Math.min(eventos.length, c.quantidade);
      progressoMeta = c.quantidade;
    } else {
      progressoAtual = porTipo.get(c.tipo) ?? 0;
      progressoMeta = c.quantidade;
    }

    return {
      id: c.id,
      nome: c.nome,
      descricao: c.descricao,
      selo: c.selo,
      tier: c.tier,
      desbloqueada: desbloqueadaEm !== null,
      desbloqueadaEm,
      progressoAtual: desbloqueadaEm ? progressoMeta : Math.min(progressoAtual, progressoMeta),
      progressoMeta,
    };
  });
}

function progressoPctDoXp(xp: number): number {
  const info = nivelDoXp(xp);
  if (info.xpProximo === null || info.xpProximo <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((info.xpNoNivel / info.xpProximo) * 100)));
}

/** Perfil de gamificação completo de UM usuário (hero + galeria + atividade). */
export async function fetchPerfilGamificacao(
  client: SupabaseServer,
  userId: string,
): Promise<PerfilGamificacao> {
  const [eventosRes, conquistasRes] = await Promise.all([
    client
      .from("gamificacao_eventos")
      .select("tipo, pontos, criado_em")
      .eq("user_id", userId)
      .order("criado_em", { ascending: false }),
    client
      .from("gamificacao_conquistas")
      .select("conquista, desbloqueada_em")
      .eq("user_id", userId),
  ]);

  if (eventosRes.error) {
    console.error({
      level: "error",
      action: "gamificacao_perfil_eventos",
      error: eventosRes.error.message,
    });
  }
  if (conquistasRes.error) {
    console.error({
      level: "error",
      action: "gamificacao_perfil_conquistas",
      error: conquistasRes.error.message,
    });
  }

  const eventos = (eventosRes.data ?? []) as EventoRow[];
  const desbloqueios = (conquistasRes.data ?? []) as ConquistaRow[];

  const xpTotal = eventos.reduce((s, e) => s + (e.pontos || 0), 0);
  const info = nivelDoXp(xpTotal);
  const proximo = NIVEIS.find((n) => n.nivel === info.nivel + 1) ?? null;

  const agora = Date.now();
  const dias = new Set(eventos.map((e) => diaBRT(new Date(e.criado_em).getTime())));

  // Série dos últimos 30 dias (BRT), preenchendo dias sem ação com zero.
  const xpPorDiaMap = new Map<string, number>();
  for (const e of eventos) {
    const dia = diaBRT(new Date(e.criado_em).getTime());
    xpPorDiaMap.set(dia, (xpPorDiaMap.get(dia) ?? 0) + (e.pontos || 0));
  }
  const xpPorDia: XpDia[] = [];
  for (let i = DIAS_GRAFICO - 1; i >= 0; i -= 1) {
    const dia = diaBRT(agora - i * DIA_MS);
    xpPorDia.push({ dia, xp: xpPorDiaMap.get(dia) ?? 0 });
  }

  const ultimasAcoes: AcaoRecente[] = eventos.slice(0, MAX_ACOES_RECENTES).map((e) => ({
    tipo: e.tipo,
    rotulo: rotuloEventoGamificacao(e.tipo),
    pontos: e.pontos,
    criadoEm: e.criado_em,
  }));

  const conquistas = montarConquistas(eventos, desbloqueios);

  return {
    xpTotal,
    nivel: info.nivel,
    nivelNome: info.nome,
    xpNoNivel: info.xpNoNivel,
    xpProximo: info.xpProximo,
    proximoNivelNome: proximo?.nome ?? null,
    progressoPct: progressoPctDoXp(xpTotal),
    nivelMaximo: NIVEIS[NIVEIS.length - 1].nivel,
    streakDias: calcularStreak(dias, agora),
    totalAcoes: eventos.length,
    xpPorDia,
    ultimasAcoes,
    conquistas,
    conquistasDesbloqueadas: conquistas.filter((c) => c.desbloqueada).length,
  };
}

/** Ranking CEO × Head: todos os perfis ativos, ordenados por XP total. */
export async function fetchRanking(client: SupabaseServer): Promise<RankingUsuario[]> {
  // Perfis via admin quando possível (ver nota no topo); eventos/conquistas
  // pelo client de sessão (RLS libera SELECT a authenticated).
  const perfisClient = hasServiceKey()
    ? (createAdminClient() as unknown as SupabaseServer)
    : client;

  const [perfisRes, eventosRes, conquistasRes] = await Promise.all([
    perfisClient.from("user_profiles").select("id, nome, papel, avatar_url").eq("ativo", true),
    client.from("gamificacao_eventos").select("user_id, pontos"),
    client.from("gamificacao_conquistas").select("user_id"),
  ]);

  if (perfisRes.error) {
    console.error({
      level: "error",
      action: "gamificacao_ranking_perfis",
      error: perfisRes.error.message,
    });
    return [];
  }
  if (eventosRes.error) {
    console.error({
      level: "error",
      action: "gamificacao_ranking_eventos",
      error: eventosRes.error.message,
    });
  }
  if (conquistasRes.error) {
    console.error({
      level: "error",
      action: "gamificacao_ranking_conquistas",
      error: conquistasRes.error.message,
    });
  }

  const xpPorUser = new Map<string, number>();
  for (const e of (eventosRes.data ?? []) as Array<{ user_id: string; pontos: number }>) {
    xpPorUser.set(e.user_id, (xpPorUser.get(e.user_id) ?? 0) + (e.pontos || 0));
  }
  const conquistasPorUser = new Map<string, number>();
  for (const c of (conquistasRes.data ?? []) as Array<{ user_id: string }>) {
    conquistasPorUser.set(c.user_id, (conquistasPorUser.get(c.user_id) ?? 0) + 1);
  }

  const perfis = (perfisRes.data ?? []) as Array<{
    id: string;
    nome: string | null;
    papel: PapelUsuario;
    avatar_url: string | null;
  }>;

  return perfis
    .map((p) => {
      const xpTotal = xpPorUser.get(p.id) ?? 0;
      const info = nivelDoXp(xpTotal);
      return {
        userId: p.id,
        nome: p.nome?.trim() || "Sem nome",
        papel: p.papel,
        avatarUrl: p.avatar_url,
        xpTotal,
        nivel: info.nivel,
        nivelNome: info.nome,
        progressoPct: progressoPctDoXp(xpTotal),
        conquistasCount: conquistasPorUser.get(p.id) ?? 0,
      };
    })
    .sort((a, b) => b.xpTotal - a.xpTotal || a.nome.localeCompare(b.nome, "pt-BR"));
}

// Reexport consciente: xpParaNivel é útil para exibir a escada de níveis na
// tela sem importar o motor server-only diretamente na page.
export { xpParaNivel };
