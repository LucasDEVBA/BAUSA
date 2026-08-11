"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Grupos de WhatsApp (Fase A dos agents) — CEO-only.
// A CF zapi-inbox registra a EXISTÊNCIA de cada grupo (whatsapp_grupos); o
// CONTEÚDO só é capturado para grupos com capturar=true (opt-in). Estas actions
// listam os grupos, ligam/desligam a captura e vinculam cada grupo a uma família
// (atleta). Sem retroativo — a Z-API não fornece histórico (documentado na UI).
// ════════════════════════════════════════════════════════════════════════

const MENSAGENS_LIMIT = 300;

export interface GrupoItem {
  id: string;
  grupoId: string;
  nome: string | null;
  capturar: boolean;
  atletaId: string | null;
  atletaNome: string | null;
  experienciaId: string | null;
  lastMessageAt: string | null;
  totalMensagens: number;
  firstSeenAt: string;
}

export interface AtletaOpcao {
  id: string;
  nome: string;
}

export interface GrupoMensagem {
  id: string;
  fromMe: boolean;
  texto: string | null;
  tipo: string;
  mediaUrl: string | null;
  fileName: string | null;
  participanteNome: string | null;
  timestamp: number | null;
}

type ListarGruposResult =
  | { success: true; grupos: GrupoItem[] }
  | { success: false; error: string };

type MutationResult = { success: true } | { success: false; error: string };

type MensagensResult =
  | { success: true; mensagens: GrupoMensagem[] }
  | { success: false; error: string };

export interface GrupoParticipante {
  nome: string;
  total: number;
}

export interface GrupoAtividadeDia {
  /** Data ISO (YYYY-MM-DD, BRT) — rótulo do bucket diário. */
  dia: string;
  total: number;
}

export interface MetricasGrupo {
  total: number;
  enviadasNos: number;
  recebidas: number;
  /** % das mensagens que partiram de nós (from_me). null = sem mensagens. */
  pctEnviadasNos: number | null;
  /** Nº de participantes distintos que já falaram (fora nós). */
  participantesAtivos: number;
  /** Quem mais fala (top 5, desc). */
  topParticipantes: GrupoParticipante[];
  ultimaAtividadeMs: number | null;
  /** Mensagens nos últimos 7 / 30 dias (dentro da janela lida). */
  ativos7d: number;
  ativos30d: number;
  /** Série diária dos últimos DIAS_SERIE dias (p/ mini-timeline). */
  serie: GrupoAtividadeDia[];
  /** A conversa excede o limite lido: contadores refletem só a janela recente. */
  janelaTruncada: boolean;
}

type MetricasGrupoResult =
  | { success: true; metricas: MetricasGrupo }
  | { success: false; error: string };

interface GrupoRow {
  id: string;
  grupo_id: string;
  nome: string | null;
  capturar: boolean;
  atleta_id: string | null;
  experiencia_id: string | null;
  last_message_at: string | null;
  total_mensagens: number;
  first_seen_at: string;
  atletas: { nome_completo: string | null } | null;
}

const NEGADO = "Apenas o CEO." as const;
const NEGADO_ACESSO = "Você não tem acesso aos grupos." as const;
const ERRO_GENERICO = "Não foi possível concluir a operação." as const;

async function garantirCeo(): Promise<boolean> {
  const papel = await getUserPapel();
  return papel === "ceo";
}

/**
 * Leitura dos grupos (listar/mensagens/métricas): CEO ou Head de Sucesso.
 * O ESCOPO do Head (só grupos vinculados) é imposto pela RLS — a policy
 * `whatsapp_grupos_head_select` / `whatsapp_msg_head_grupo_select`. Mutações
 * (captura/vínculo) seguem CEO-only via garantirCeo().
 */
async function garantirAcessoGrupos(): Promise<boolean> {
  const papel = await getUserPapel();
  return papel === "ceo" || papel === "head_sucesso";
}

/** Lista os grupos detectados (não deletados), com vínculo e contadores.
 *  CEO vê todos; Head só os grupos vinculados a uma família (imposto pela RLS). */
export async function listarGrupos(): Promise<ListarGruposResult> {
  if (!(await garantirAcessoGrupos())) return { success: false, error: NEGADO_ACESSO };

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("whatsapp_grupos")
      .select(
        "id, grupo_id, nome, capturar, atleta_id, experiencia_id, last_message_at, total_mensagens, first_seen_at, atletas ( nome_completo )",
      )
      .is("deleted_at", null)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("first_seen_at", { ascending: false });

    if (error) return { success: false, error: "Não foi possível carregar os grupos." };

    const grupos: GrupoItem[] = ((data as unknown as GrupoRow[] | null) ?? []).map((row) => ({
      id: row.id,
      grupoId: row.grupo_id,
      nome: row.nome,
      capturar: row.capturar,
      atletaId: row.atleta_id,
      atletaNome: row.atletas?.nome_completo ?? null,
      experienciaId: row.experiencia_id,
      lastMessageAt: row.last_message_at,
      totalMensagens: row.total_mensagens,
      firstSeenAt: row.first_seen_at,
    }));

    return { success: true, grupos };
  } catch {
    return { success: false, error: ERRO_GENERICO };
  }
}

/** Atletas para o seletor de vínculo (id + nome). */
export async function listarAtletasParaVinculo(): Promise<AtletaOpcao[]> {
  if (!(await garantirCeo())) return [];

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome_completo")
      .is("deleted_at", null)
      .order("nome_completo", { ascending: true })
      .limit(2000);

    if (error) return [];

    return ((data as { id: string; nome_completo: string | null }[] | null) ?? [])
      .filter((a) => (a.nome_completo ?? "").trim().length > 0)
      .map((a) => ({ id: a.id, nome: (a.nome_completo as string).trim() }));
  } catch {
    return [];
  }
}

const capturaSchema = z.object({
  grupoId: z.string().min(1, "Grupo inválido."),
  capturar: z.boolean(),
});

/** Liga/desliga a captura de conteúdo de UM grupo (opt-in consciente do CEO). */
export async function definirCapturaGrupo(
  grupoId: string,
  capturar: boolean,
): Promise<MutationResult> {
  if (!(await garantirCeo())) return { success: false, error: NEGADO };

  const parsed = capturaSchema.safeParse({ grupoId, capturar });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { error } = await supabase
      .from("whatsapp_grupos")
      .update({ capturar: parsed.data.capturar })
      .eq("grupo_id", parsed.data.grupoId)
      .is("deleted_at", null);

    if (error) return { success: false, error: "Não foi possível atualizar a captura." };

    revalidatePath("/whatsapp");
    return { success: true };
  } catch {
    return { success: false, error: ERRO_GENERICO };
  }
}

const vinculoSchema = z.object({
  grupoId: z.string().min(1, "Grupo inválido."),
  // null desvincula; UUID vincula a um atleta (família).
  atletaId: z.string().uuid("Atleta inválido.").nullable(),
});

/**
 * Vincula (ou desvincula) um grupo a uma família (atleta). Quando há atleta,
 * resolve também a experiência pós-venda dele (best-effort) para o vínculo
 * ficar completo; ao desvincular, limpa ambos.
 */
export async function vincularGrupoFamilia(
  grupoId: string,
  atletaId: string | null,
): Promise<MutationResult> {
  if (!(await garantirCeo())) return { success: false, error: NEGADO };

  const parsed = vinculoSchema.safeParse({ grupoId, atletaId });
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();

    let experienciaId: string | null = null;
    if (parsed.data.atletaId) {
      // Best-effort: nem todo atleta tem experiência (só pós-venda) — sem ela o
      // vínculo fica só no atleta, o que já é suficiente para a Fase A.
      const { data: exp } = await supabase
        .from("crm_experiencia")
        .select("id")
        .eq("atleta_id", parsed.data.atletaId)
        .is("deleted_at", null)
        .maybeSingle();
      experienciaId = (exp as { id: string } | null)?.id ?? null;
    }

    const { error } = await supabase
      .from("whatsapp_grupos")
      .update({ atleta_id: parsed.data.atletaId, experiencia_id: experienciaId })
      .eq("grupo_id", parsed.data.grupoId)
      .is("deleted_at", null);

    if (error) return { success: false, error: "Não foi possível vincular o grupo." };

    revalidatePath("/whatsapp");
    return { success: true };
  } catch {
    return { success: false, error: ERRO_GENERICO };
  }
}

/** Mensagens capturadas de UM grupo (ordem cronológica). CEO ou Head (Head só
 *  de grupo vinculado — a RLS de whatsapp_mensagens escopa a leitura). */
export async function listarMensagensGrupo(grupoId: string): Promise<MensagensResult> {
  if (!(await garantirAcessoGrupos())) return { success: false, error: NEGADO_ACESSO };
  if (!grupoId || grupoId.trim().length === 0) {
    return { success: false, error: "Grupo inválido." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    // DESC + limit p/ manter as RECENTES; reordena p/ cronológico em JS.
    const selecionar = (comMediaPath: boolean) =>
      supabase
        .from("whatsapp_mensagens")
        .select(
          comMediaPath
            ? "message_id, from_me, texto, tipo, media_url, media_filename, media_path, participante_nome, momment"
            : "message_id, from_me, texto, tipo, media_url, media_filename, participante_nome, momment",
        )
        .eq("grupo_id", grupoId)
        .eq("is_grupo", true)
        .order("momment", { ascending: false, nullsFirst: false })
        .limit(MENSAGENS_LIMIT);

    let { data, error } = await selecionar(true);
    // Janela pré-migration (coluna media_path ausente) → re-tenta sem ela
    if (error && (error.code === "42703" || error.code === "PGRST204")) {
      ({ data, error } = await selecionar(false));
    }

    if (error) return { success: false, error: "Não foi possível carregar as mensagens." };

    const rows = (
      (data as unknown as
        | {
            message_id: string;
            from_me: boolean;
            texto: string | null;
            tipo: string | null;
            media_url: string | null;
            media_filename: string | null;
            media_path?: string | null;
            participante_nome: string | null;
            momment: string | null;
          }[]
        | null) ?? []
    );

    // URLs assinadas do bucket próprio (media_url da Z-API expira em ~semanas).
    // A policy do bucket espelha o escopo de leitura: CEO tudo; Head só grupo
    // vinculado (EXISTS sob a RLS de whatsapp_grupos do próprio usuário).
    // Fail-open: erro na assinatura → mapa vazio → media_url legada.
    const paths = [...new Set(rows.map((r) => r.media_path).filter((p): p is string => Boolean(p)))];
    const assinadas = new Map<string, string>();
    if (paths.length > 0) {
      try {
        const { data: signed } = await supabase.storage
          .from("whatsapp-midia")
          .createSignedUrls(paths, 3600);
        for (const item of signed ?? []) {
          if (item.path && item.signedUrl && !item.error) assinadas.set(item.path, item.signedUrl);
        }
      } catch {
        /* fallback à media_url legada */
      }
    }

    const mensagens: GrupoMensagem[] = rows
      .map((row) => ({
        id: row.message_id,
        fromMe: row.from_me,
        texto: row.texto,
        tipo: row.tipo ?? "text",
        mediaUrl: (row.media_path && assinadas.get(row.media_path)) || row.media_url,
        fileName: row.media_filename,
        participanteNome: row.participante_nome,
        timestamp: row.momment ? Date.parse(row.momment) : null,
      }))
      .reverse();

    return { success: true, mensagens };
  } catch {
    return { success: false, error: ERRO_GENERICO };
  }
}

// ─── Métricas do grupo (painel direito) ──────────────────────────────────

const METRICAS_MAX_MENSAGENS = 3000;
const DIAS_SERIE = 14;
const TOP_PARTICIPANTES = 5;
const MS_DIA = 86_400_000;

interface MetricaRow {
  from_me: boolean;
  momment: string | null;
  created_at: string;
  participante_nome: string | null;
  participante_phone: string | null;
}

/**
 * Métricas de UM grupo (volume, participantes ativos, top faladores, atividade
 * 7/30 dias + série diária, última atividade, % enviadas por nós). CEO ou Head
 * (Head só de grupo vinculado — a RLS de whatsapp_mensagens escopa a leitura).
 */
export async function metricasGrupo(grupoId: string): Promise<MetricasGrupoResult> {
  if (!(await garantirAcessoGrupos())) return { success: false, error: NEGADO_ACESSO };
  if (!grupoId || grupoId.trim().length === 0) {
    return { success: false, error: "Grupo inválido." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("whatsapp_mensagens")
      .select("from_me, momment, created_at, participante_nome, participante_phone")
      .eq("grupo_id", grupoId)
      .eq("is_grupo", true)
      .order("created_at", { ascending: false })
      .limit(METRICAS_MAX_MENSAGENS);

    if (error) return { success: false, error: "Não foi possível carregar as métricas." };

    const rows = (data as MetricaRow[] | null) ?? [];
    const tempoMs = (r: MetricaRow) => Date.parse(r.momment ?? r.created_at);

    if (rows.length === 0) {
      return {
        success: true,
        metricas: {
          total: 0,
          enviadasNos: 0,
          recebidas: 0,
          pctEnviadasNos: null,
          participantesAtivos: 0,
          topParticipantes: [],
          ultimaAtividadeMs: null,
          ativos7d: 0,
          ativos30d: 0,
          serie: serieVazia(),
          janelaTruncada: false,
        },
      };
    }

    const agora = Date.now();
    const diaFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    let enviadasNos = 0;
    let recebidas = 0;
    let ativos7d = 0;
    let ativos30d = 0;
    let ultimaAtividadeMs = 0;
    const porParticipante = new Map<string, { nome: string; total: number }>();
    const porDia = new Map<string, number>();

    for (const r of rows) {
      const t = tempoMs(r);
      if (Number.isFinite(t)) {
        if (t > ultimaAtividadeMs) ultimaAtividadeMs = t;
        const idade = agora - t;
        if (idade <= 7 * MS_DIA) ativos7d++;
        if (idade <= 30 * MS_DIA) ativos30d++;
        const dia = diaFmt.format(new Date(t));
        porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
      }

      if (r.from_me) {
        enviadasNos++;
        continue;
      }
      recebidas++;
      // Participante distinto por telefone (fallback nome); rótulo = nome.
      const chave =
        (r.participante_phone ?? "").trim() ||
        (r.participante_nome ?? "").trim().toLowerCase() ||
        "desconhecido";
      const nome = (r.participante_nome ?? "").trim() || "Participante";
      const atual = porParticipante.get(chave);
      if (atual) atual.total++;
      else porParticipante.set(chave, { nome, total: 1 });
    }

    const topParticipantes = [...porParticipante.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, TOP_PARTICIPANTES)
      .map((p) => ({ nome: p.nome, total: p.total }));

    // Série diária dos últimos DIAS_SERIE dias (mais antigo → mais recente).
    const serie: GrupoAtividadeDia[] = [];
    for (let i = DIAS_SERIE - 1; i >= 0; i--) {
      const dia = diaFmt.format(new Date(agora - i * MS_DIA));
      serie.push({ dia, total: porDia.get(dia) ?? 0 });
    }

    const total = rows.length;
    return {
      success: true,
      metricas: {
        total,
        enviadasNos,
        recebidas,
        pctEnviadasNos: total > 0 ? (enviadasNos / total) * 100 : null,
        participantesAtivos: porParticipante.size,
        topParticipantes,
        ultimaAtividadeMs: ultimaAtividadeMs > 0 ? ultimaAtividadeMs : null,
        ativos7d,
        ativos30d,
        serie,
        janelaTruncada: rows.length >= METRICAS_MAX_MENSAGENS,
      },
    };
  } catch {
    return { success: false, error: ERRO_GENERICO };
  }
}

function serieVazia(): GrupoAtividadeDia[] {
  const diaFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const agora = Date.now();
  const serie: GrupoAtividadeDia[] = [];
  for (let i = DIAS_SERIE - 1; i >= 0; i--) {
    serie.push({ dia: diaFmt.format(new Date(agora - i * MS_DIA)), total: 0 });
  }
  return serie;
}
