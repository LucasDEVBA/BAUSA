"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserPapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import {
  calcularBonus,
  calcularPct,
  farolDe,
  intervaloPeriodo,
  periodoLabel,
  type Ciclo,
  type FonteMeta,
  type Meta,
  type MetaComProgresso,
  type Objetivo,
  type Projecao,
  type Projeto,
} from "@/lib/planejamento-tipos";

/**
 * Planejamento estratégico (3 anos) e tático.
 *
 * Escrita é CEO-only (o RLS também barra, isto é defense-in-depth); leitura
 * é liberada para o time autenticado, porque cada pessoa precisa ver as
 * próprias metas e o próprio bônus.
 */

const PATHS = ["/planejamento", "/planejamento/estrategico", "/planejamento/metas",
  "/planejamento/rotinas", "/planejamento/incentivos"];

type Result<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string };

const ERRO_PAPEL = "Apenas CEO/CTO podem alterar o planejamento.";

async function exigirCeo(): Promise<string | null> {
  return (await getUserPapel()) === "ceo" ? null : ERRO_PAPEL;
}

function revalidar() {
  for (const p of PATHS) revalidatePath(p);
}

const primeiroErro = (e: z.ZodError) => e.issues[0]?.message ?? "Dados inválidos.";

// ─── Leitura ─────────────────────────────────────────────────────────────

export interface PlanejamentoCompleto {
  ciclos: Ciclo[];
  ciclo: Ciclo | null;
  objetivos: Objetivo[];
  projetos: Projeto[];
  projecoes: Projecao[];
  metas: MetaComProgresso[];
  pessoas: { id: string; nome: string; papel: string }[];
}

/** Carrega o ciclo (o informado, senão o ativo, senão o mais recente). */
async function resolverCiclo(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  cicloId?: string,
): Promise<{ ciclos: Ciclo[]; ciclo: Ciclo | null }> {
  const { data } = await supabase
    .from("planejamento_ciclos")
    .select("id,nome,ano_inicio,ano_fim,visao,status")
    .is("deleted_at", null)
    .order("ano_inicio", { ascending: false });
  const ciclos = (data ?? []) as Ciclo[];
  const ciclo =
    ciclos.find((c) => c.id === cicloId) ??
    ciclos.find((c) => c.status === "ativo") ??
    ciclos[0] ??
    null;
  return { ciclos, ciclo };
}

export async function getPlanejamento(cicloId?: string): Promise<PlanejamentoCompleto> {
  const supabase = await createServerSupabaseClient();
  const { ciclos, ciclo } = await resolverCiclo(supabase, cicloId);

  const vazio: PlanejamentoCompleto = {
    ciclos, ciclo, objetivos: [], projetos: [], projecoes: [], metas: [], pessoas: [],
  };
  if (!ciclo) return { ...vazio, pessoas: await listarPessoas(supabase) };

  const [objRes, projecRes, metasRes, pessoas] = await Promise.all([
    supabase.from("planejamento_objetivos").select("*").eq("ciclo_id", ciclo.id)
      .is("deleted_at", null).order("ordem"),
    supabase.from("planejamento_projecoes").select("*").eq("ciclo_id", ciclo.id)
      .is("deleted_at", null).order("ano"),
    supabase.from("metas_corporativas").select("*").eq("ciclo_id", ciclo.id)
      .is("deleted_at", null).order("ano").order("mes", { nullsFirst: true }),
    listarPessoas(supabase),
  ]);

  const objetivos = (objRes.data ?? []) as Objetivo[];
  const projetos = objetivos.length ? await listarProjetos(supabase, objetivos.map((o) => o.id)) : [];
  const metas = await comProgresso(supabase, (metasRes.data ?? []) as Meta[]);

  return {
    ciclos, ciclo, objetivos, projetos,
    projecoes: (projecRes.data ?? []) as Projecao[],
    metas, pessoas,
  };
}

async function listarPessoas(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data } = await supabase
    .from("user_profiles")
    .select("id,nome,papel")
    .eq("ativo", true)
    .order("nome");
  return (data ?? []) as { id: string; nome: string; papel: string }[];
}

async function listarProjetos(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  objetivoIds: string[],
): Promise<Projeto[]> {
  const { data } = await supabase
    .from("planejamento_projetos")
    .select("*")
    .in("objetivo_id", objetivoIds)
    .is("deleted_at", null)
    .order("prioridade");
  return (data ?? []) as Projeto[];
}

// ─── Realizado automático ────────────────────────────────────────────────

type Janela = { inicio: string; fim: string };

/**
 * Resolve o realizado de cada meta.
 *
 * Agrupa por (fonte, janela) e faz UMA consulta por combinação — com uma
 * query por meta, um ciclo com 40 metas viraria 40 idas ao banco a cada
 * abertura da tela.
 */
async function comProgresso(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  metas: Meta[],
): Promise<MetaComProgresso[]> {
  const chaves = new Map<string, { fonte: FonteMeta; janela: Janela }>();
  for (const m of metas) {
    if (m.fonte === "manual") continue;
    const janela = intervaloPeriodo(m);
    chaves.set(`${m.fonte}|${janela.inicio}|${janela.fim}`, { fonte: m.fonte, janela });
  }

  const valores = new Map<string, number>();
  await Promise.all(
    [...chaves.entries()].map(async ([chave, { fonte, janela }]) => {
      valores.set(chave, await medir(supabase, fonte, janela));
    }),
  );

  return metas.map((m) => {
    const janela = intervaloPeriodo(m);
    const automatico = m.fonte !== "manual";
    const realizado = automatico
      ? valores.get(`${m.fonte}|${janela.inicio}|${janela.fim}`) ?? 0
      : Number(m.realizado_manual ?? 0);
    const pct = calcularPct(realizado, Number(m.alvo), m.direcao);
    return {
      ...m,
      realizado,
      pct,
      farol: farolDe(pct),
      bonusPrevisto: calcularBonus(m, pct, realizado),
      periodoLabel: periodoLabel(m),
      automatico,
    };
  });
}

/** Uma métrica do próprio banco, na janela pedida. */
async function medir(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  fonte: FonteMeta,
  { inicio, fim }: Janela,
): Promise<number> {
  if (fonte === "receita") return somaReceita(supabase, inicio, fim);
  if (fonte === "contratos") return contar(supabase, "deals", "sinal_pago_at", inicio, fim);
  if (fonte === "leads") return contar(supabase, "form_submissions", "submitted_at", inicio, fim);
  if (fonte === "reunioes") return contar(supabase, "deals", "reuniao_realizada_at", inicio, fim);
  if (fonte === "cac") return custoPorLead(supabase, inicio, fim);
  return 0;
}

/** Mesma definição do War Room: parcela recebida dentro da janela. */
async function somaReceita(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  inicio: string,
  fim: string,
): Promise<number> {
  const { data } = await supabase
    .from("parcelas")
    .select("valor")
    .eq("status", "recebido")
    .is("deleted_at", null)
    .gte("recebido_at", inicio)
    .lt("recebido_at", fim);
  return (data ?? []).reduce((s, p) => s + Number(p.valor ?? 0), 0);
}

async function contar(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  tabela: "deals" | "form_submissions",
  coluna: string,
  inicio: string,
  fim: string,
): Promise<number> {
  let q = supabase
    .from(tabela)
    .select("*", { count: "exact", head: true })
    .gte(coluna, inicio)
    .lt(coluna, fim);
  // form_submissions não tem soft delete.
  if (tabela === "deals") q = q.is("deleted_at", null);
  const { count } = await q;
  return count ?? 0;
}

/** Investimento de marketing da janela ÷ leads da janela. */
async function custoPorLead(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  inicio: string,
  fim: string,
): Promise<number> {
  const [{ data: inv }, leads] = await Promise.all([
    supabase
      .from("investimentos_marketing")
      .select("valor_gasto")
      .is("deleted_at", null)
      .gte("mes", inicio)
      .lt("mes", fim),
    contar(supabase, "form_submissions", "submitted_at", inicio, fim),
  ]);
  const gasto = (inv ?? []).reduce((s, i) => s + Number(i.valor_gasto ?? 0), 0);
  return leads > 0 ? Math.round((gasto / leads) * 100) / 100 : 0;
}

// ─── Escrita: ciclo ──────────────────────────────────────────────────────

const cicloSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(3, "Dê um nome ao ciclo.").max(120),
  ano_inicio: z.number().int().min(2020).max(2100),
  ano_fim: z.number().int().min(2020).max(2100),
  visao: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["rascunho", "ativo", "encerrado"]),
});

export async function salvarCiclo(input: unknown): Promise<Result> {
  const erroPapel = await exigirCeo();
  if (erroPapel) return { success: false, error: erroPapel };
  const parsed = cicloSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: primeiroErro(parsed.error) };
  if (parsed.data.ano_fim < parsed.data.ano_inicio) {
    return { success: false, error: "O ano final não pode ser antes do inicial." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { id, ...campos } = parsed.data;
  const { error } = id
    ? await supabase.from("planejamento_ciclos").update(campos).eq("id", id)
    : await supabase.from("planejamento_ciclos").insert(campos);
  if (error) return { success: false, error: `Não foi possível salvar: ${error.message}` };

  // Só um ciclo ativo por vez — senão a tela não sabe qual abrir.
  if (parsed.data.status === "ativo") {
    const alvo = id ?? (await ultimoCicloId(supabase, parsed.data.nome));
    if (alvo) {
      await supabase
        .from("planejamento_ciclos")
        .update({ status: "encerrado" })
        .eq("status", "ativo")
        .neq("id", alvo);
    }
  }
  revalidar();
  return { success: true };
}

async function ultimoCicloId(
  supabase: Awaited<ReturnType<typeof createAuditedSupabaseClient>>,
  nome: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("planejamento_ciclos")
    .select("id")
    .eq("nome", nome)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0]?.id ?? null;
}

// ─── Escrita: objetivo / projeto / projeção ──────────────────────────────

const objetivoSchema = z.object({
  id: z.string().uuid().optional(),
  ciclo_id: z.string().uuid(),
  titulo: z.string().trim().min(3, "Descreva o objetivo.").max(160),
  descricao: z.string().trim().max(2000).nullable().optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  ordem: z.number().int().min(0).max(99).default(0),
  accent: z.enum(["blue", "green", "orange", "red", "purple", "neutral"]).default("blue"),
  status: z.enum(["nao_iniciado", "em_andamento", "concluido", "pausado", "cancelado"]),
});

export async function salvarObjetivo(input: unknown): Promise<Result> {
  return gravar("planejamento_objetivos", objetivoSchema, input);
}

const projetoSchema = z.object({
  id: z.string().uuid().optional(),
  objetivo_id: z.string().uuid(),
  nome: z.string().trim().min(3, "Dê um nome ao projeto.").max(160),
  descricao: z.string().trim().max(2000).nullable().optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  status: z.enum(["nao_iniciado", "em_andamento", "concluido", "pausado", "cancelado"]),
  prioridade: z.enum(["alta", "media", "baixa"]),
  inicio: z.string().nullable().optional(),
  fim: z.string().nullable().optional(),
  progresso: z.number().int().min(0).max(100),
  orcamento: z.number().min(0).max(100_000_000).nullable().optional(),
});

export async function salvarProjeto(input: unknown): Promise<Result> {
  const parsed = projetoSchema.safeParse(input);
  if (parsed.success && parsed.data.inicio && parsed.data.fim && parsed.data.fim < parsed.data.inicio) {
    return { success: false, error: "O fim do projeto não pode ser antes do início." };
  }
  return gravar("planejamento_projetos", projetoSchema, input);
}

const projecaoSchema = z.object({
  id: z.string().uuid().optional(),
  ciclo_id: z.string().uuid(),
  ano: z.number().int().min(2020).max(2100),
  receita: z.number().min(0).max(1_000_000_000),
  contratos: z.number().int().min(0).max(100_000),
  ticket_medio: z.number().min(0).max(10_000_000),
  investimento_marketing: z.number().min(0).max(1_000_000_000),
  custo_fixo: z.number().min(0).max(1_000_000_000),
  premissas: z.string().trim().max(2000).nullable().optional(),
});

export async function salvarProjecao(input: unknown): Promise<Result> {
  return gravar("planejamento_projecoes", projecaoSchema, input);
}

// ─── Escrita: meta ───────────────────────────────────────────────────────

const metaSchema = z
  .object({
    id: z.string().uuid().optional(),
    ciclo_id: z.string().uuid(),
    objetivo_id: z.string().uuid().nullable().optional(),
    titulo: z.string().trim().min(3, "Descreva a meta.").max(160),
    descricao: z.string().trim().max(2000).nullable().optional(),
    responsavel_id: z.string().uuid().nullable().optional(),
    periodo_tipo: z.enum(["ano", "semestre", "mes"]),
    ano: z.number().int().min(2020).max(2100),
    semestre: z.number().int().min(1).max(2).nullable().optional(),
    mes: z.number().int().min(1).max(12).nullable().optional(),
    unidade: z.enum(["moeda", "quantidade", "percentual"]),
    direcao: z.enum(["maior_melhor", "menor_melhor"]),
    alvo: z.number().min(0).max(1_000_000_000),
    minimo: z.number().min(0).max(1_000_000_000).nullable().optional(),
    fonte: z.enum(["manual", "receita", "contratos", "leads", "reunioes", "cac"]),
    realizado_manual: z.number().min(0).max(1_000_000_000).nullable().optional(),
    peso: z.number().int().min(1).max(10),
    incentivo_tipo: z.enum(["nenhum", "valor_fixo", "percentual_meta"]),
    incentivo_valor: z.number().min(0).max(10_000_000).nullable().optional(),
    incentivo_gatilho_pct: z.number().int().min(1).max(200),
    incentivo_teto: z.number().min(0).max(10_000_000).nullable().optional(),
    status: z.enum(["ativa", "concluida", "cancelada"]),
  })
  // Espelha o CHECK do banco: erro claro na tela em vez de 23514 cru.
  .superRefine((d, ctx) => {
    const erro = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (d.periodo_tipo === "mes" && !d.mes) erro("Meta mensal precisa do mês.");
    if (d.periodo_tipo === "semestre" && !d.semestre) erro("Meta semestral precisa do semestre.");
    if (d.periodo_tipo === "ano" && (d.mes || d.semestre)) erro("Meta anual não leva mês nem semestre.");
    if (d.incentivo_tipo !== "nenhum" && !d.incentivo_valor) erro("Informe o valor do incentivo.");
  });

export async function salvarMeta(input: unknown): Promise<Result> {
  const erroPapel = await exigirCeo();
  if (erroPapel) return { success: false, error: erroPapel };
  const parsed = metaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: primeiroErro(parsed.error) };

  const supabase = await createAuditedSupabaseClient();
  const { id, ...campos } = parsed.data;
  // Zera o recorte que não pertence ao tipo escolhido (troca de mensal para
  // anual deixaria o mês antigo para trás e violaria o CHECK).
  const limpo = {
    ...campos,
    mes: campos.periodo_tipo === "mes" ? campos.mes : null,
    semestre: campos.periodo_tipo === "semestre" ? campos.semestre : null,
  };
  const { error } = id
    ? await supabase.from("metas_corporativas").update(limpo).eq("id", id)
    : await supabase.from("metas_corporativas").insert(limpo);
  if (error) return { success: false, error: `Não foi possível salvar: ${error.message}` };
  revalidar();
  return { success: true };
}

// ─── Check-in ────────────────────────────────────────────────────────────

const checkinSchema = z.object({
  meta_id: z.string().uuid(),
  valor: z.number().min(0).max(1_000_000_000).nullable().optional(),
  farol: z.enum(["verde", "amarelo", "vermelho"]),
  comentario: z.string().trim().max(2000).nullable().optional(),
});

/**
 * Check-in da rotina de acompanhamento.
 *
 * Aberto ao time (não só CEO): quem toca a meta é quem registra o andamento.
 * Em meta manual o valor informado passa a ser o realizado.
 */
export async function registrarCheckin(input: unknown): Promise<Result> {
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: primeiroErro(parsed.error) };

  const supabase = await createAuditedSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { success: false, error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase.from("metas_checkins").insert({
    ...parsed.data,
    autor_id: auth.user.id,
    created_by: auth.user.id,
  });
  if (error) return { success: false, error: `Não foi possível registrar: ${error.message}` };

  if (parsed.data.valor !== null && parsed.data.valor !== undefined) {
    const { data: meta } = await supabase
      .from("metas_corporativas")
      .select("fonte")
      .eq("id", parsed.data.meta_id)
      .maybeSingle();
    if (meta?.fonte === "manual") {
      await supabase
        .from("metas_corporativas")
        .update({ realizado_manual: parsed.data.valor })
        .eq("id", parsed.data.meta_id);
    }
  }
  revalidar();
  return { success: true };
}

export async function listarCheckins(metaId: string) {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("metas_checkins")
    .select("id,data,valor,farol,comentario,autor_id")
    .eq("meta_id", metaId)
    .is("deleted_at", null)
    .order("data", { ascending: false })
    .limit(50);
  return data ?? [];
}

// ─── Incentivos ──────────────────────────────────────────────────────────

/**
 * Congela o bônus das metas do ciclo numa apuração por pessoa.
 *
 * O valor é gravado, não recalculado depois: o realizado continua se movendo
 * e o que foi aprovado para pagamento não pode mudar sozinho.
 */
export async function apurarIncentivos(cicloId: string): Promise<Result<number>> {
  const erroPapel = await exigirCeo();
  if (erroPapel) return { success: false, error: erroPapel };

  const { metas } = await getPlanejamento(cicloId);
  const elegiveis = metas.filter(
    (m) => m.incentivo_tipo !== "nenhum" && m.responsavel_id && m.bonusPrevisto > 0,
  );
  if (!elegiveis.length) return { success: true, data: 0 };

  const supabase = await createAuditedSupabaseClient();
  // Não mexe no que já foi aprovado/pago — apuração só atualiza previsões.
  const { data: travadas } = await supabase
    .from("incentivos_apuracoes")
    .select("meta_id,pessoa_id")
    .in("meta_id", elegiveis.map((m) => m.id))
    .in("status", ["aprovado", "pago"])
    .is("deleted_at", null);
  const travado = new Set((travadas ?? []).map((t) => `${t.meta_id}|${t.pessoa_id}`));

  const linhas = elegiveis
    .filter((m) => !travado.has(`${m.id}|${m.responsavel_id}`))
    .map((m) => ({
      meta_id: m.id,
      pessoa_id: m.responsavel_id as string,
      pct_atingido: m.pct,
      valor_apurado: m.bonusPrevisto,
      status: "previsto" as const,
    }));
  if (!linhas.length) return { success: true, data: 0 };

  const { error } = await supabase
    .from("incentivos_apuracoes")
    .upsert(linhas, { onConflict: "meta_id,pessoa_id" });
  if (error) return { success: false, error: `Não foi possível apurar: ${error.message}` };
  revalidar();
  return { success: true, data: linhas.length };
}

const statusApuracaoSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["previsto", "aprovado", "pago", "cancelado"]),
});

export async function mudarStatusApuracao(input: unknown): Promise<Result> {
  const erroPapel = await exigirCeo();
  if (erroPapel) return { success: false, error: erroPapel };
  const parsed = statusApuracaoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: primeiroErro(parsed.error) };

  const supabase = await createAuditedSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  const agora = new Date().toISOString();
  const patch: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "aprovado") {
    patch.aprovado_por = auth.user?.id ?? null;
    patch.aprovado_em = agora;
  }
  if (parsed.data.status === "pago") patch.pago_em = agora;

  const { error } = await supabase
    .from("incentivos_apuracoes")
    .update(patch)
    .eq("id", parsed.data.id);
  if (error) return { success: false, error: `Não foi possível atualizar: ${error.message}` };
  revalidar();
  return { success: true };
}

export async function listarApuracoes(cicloId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: metas } = await supabase
    .from("metas_corporativas")
    .select("id")
    .eq("ciclo_id", cicloId)
    .is("deleted_at", null);
  const ids = (metas ?? []).map((m) => m.id);
  if (!ids.length) return [];

  const { data } = await supabase
    .from("incentivos_apuracoes")
    .select("*, metas_corporativas(titulo,periodo_tipo,ano,semestre,mes), user_profiles!incentivos_apuracoes_pessoa_id_fkey(nome)")
    .in("meta_id", ids)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── Rotinas de acompanhamento ───────────────────────────────────────────

const rotinaSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(3, "Dê um nome à rotina.").max(120),
  descricao: z.string().trim().max(1000).nullable().optional(),
  frequencia: z.enum(["semanal", "quinzenal", "mensal", "trimestral"]),
  dia_semana: z.number().int().min(0).max(6).nullable().optional(),
  dia_mes: z.number().int().min(1).max(31).nullable().optional(),
  hora: z.string().nullable().optional(),
  escopo: z.enum(["ciclo", "objetivo", "meta"]),
  escopo_id: z.string().uuid().nullable().optional(),
  participantes: z.array(z.string().uuid()).max(50).default([]),
  pauta: z.string().trim().max(4000).nullable().optional(),
  ativa: z.boolean(),
  proxima_em: z.string().nullable().optional(),
});

export async function salvarRotina(input: unknown): Promise<Result> {
  return gravar("rotinas_acompanhamento", rotinaSchema, input);
}

const execucaoSchema = z.object({
  rotina_id: z.string().uuid(),
  data: z.string(),
  notas: z.string().trim().max(8000).nullable().optional(),
  decisoes: z.string().trim().max(8000).nullable().optional(),
  participantes: z.array(z.string().uuid()).max(50).default([]),
});

export async function registrarExecucaoRotina(input: unknown): Promise<Result> {
  const parsed = execucaoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: primeiroErro(parsed.error) };

  const supabase = await createAuditedSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  // created_by NULL faria o RLS ("created_by = auth.uid()") recusar o insert
  // com um erro que não explica nada — falha aqui, com mensagem clara.
  if (!auth.user) return { success: false, error: "Sessão expirada. Entre novamente." };

  const { error } = await supabase.from("rotinas_execucoes").insert({
    ...parsed.data,
    autor_id: auth.user.id,
    created_by: auth.user.id,
  });
  if (error) return { success: false, error: `Não foi possível registrar: ${error.message}` };
  revalidar();
  return { success: true };
}

export async function getRotinas() {
  const supabase = await createServerSupabaseClient();
  const { data: rotinas } = await supabase
    .from("rotinas_acompanhamento")
    .select("*")
    .is("deleted_at", null)
    .order("ativa", { ascending: false })
    .order("nome");
  const lista = rotinas ?? [];
  if (!lista.length) return { rotinas: [], execucoes: [] };

  const { data: execucoes } = await supabase
    .from("rotinas_execucoes")
    .select("*")
    .in("rotina_id", lista.map((r) => r.id))
    .is("deleted_at", null)
    .order("data", { ascending: false })
    .limit(100);
  return { rotinas: lista, execucoes: execucoes ?? [] };
}

// ─── Exclusão (soft delete) ──────────────────────────────────────────────

const TABELAS_REMOVIVEIS = [
  "planejamento_ciclos", "planejamento_objetivos", "planejamento_projetos",
  "planejamento_projecoes", "metas_corporativas", "rotinas_acompanhamento",
] as const;

export async function removerRegistro(
  tabela: (typeof TABELAS_REMOVIVEIS)[number],
  id: string,
): Promise<Result> {
  const erroPapel = await exigirCeo();
  if (erroPapel) return { success: false, error: erroPapel };
  if (!TABELAS_REMOVIVEIS.includes(tabela)) {
    return { success: false, error: "Registro não pode ser removido por aqui." };
  }
  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, error: "Registro inválido." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from(tabela)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: `Não foi possível remover: ${error.message}` };
  revalidar();
  return { success: true };
}

// ─── Helper de escrita genérico ──────────────────────────────────────────

/** Insert/update CEO-only validado — o corpo é idêntico para 4 entidades. */
async function gravar(
  tabela: string,
  schema: z.ZodTypeAny,
  input: unknown,
): Promise<Result> {
  const erroPapel = await exigirCeo();
  if (erroPapel) return { success: false, error: erroPapel };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: primeiroErro(parsed.error) };

  const supabase = await createAuditedSupabaseClient();
  const { id, ...campos } = parsed.data as { id?: string } & Record<string, unknown>;
  const { error } = id
    ? await supabase.from(tabela).update(campos).eq("id", id)
    : await supabase.from(tabela).insert(campos);
  if (error) return { success: false, error: `Não foi possível salvar: ${error.message}` };
  revalidar();
  return { success: true };
}
