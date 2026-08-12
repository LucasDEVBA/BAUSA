"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserPapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import {
  EXPERIENCIA_DEFAULT,
  MATCH_DEFAULT,
  METAS_DEFAULT,
  SCORE_DEFAULT,
  VALORES_DEFAULT,
} from "@/lib/parametros-defaults";

/**
 * Metas, valores e parâmetros do sistema — leitura e escrita TIPADAS.
 *
 * Escreve nas chaves que o sistema REALMENTE lê (`meta_mensal_padrao`,
 * `lead_score_pesos`, `planos`…). A tela antiga gravava chaves paralelas
 * (`metas_config`, `lead_scoring_pesos`, `planos_valores`) que ninguém
 * consumia — e, como o update não era upsert, nem gravava: mostrava
 * "Configuração atualizada" e o valor sumia no reload.
 */

const PATHS_REVALIDAR = ["/configuracoes", "/war-room", "/financeiro"];

// ─── Defaults (espelham o seed 20260401000300) ───────────────────────────

// ─── Schemas ─────────────────────────────────────────────────────────────

const dinheiro = z.number().int().min(0).max(100_000_000);
const pct = z.number().int().min(0).max(100);

const metasSchema = z.object({
  meta_anual: dinheiro,
  meta_mensal_padrao: dinheiro,
  ticket_medio_alvo: dinheiro,
  contratos_mes_alvo: z.number().int().min(0).max(999),
  pipeline_health_min: z.number().int().min(1).max(20),
  pipeline_health_max: z.number().int().min(1).max(20),
});

const planoSchema = z.object({
  valor: dinheiro,
  valor_pix: dinheiro,
  psicologa: z.boolean(),
});

const valoresSchema = z.object({
  planos: z.object({ legacy: planoSchema, journey: planoSchema, start: planoSchema }),
  entrada_padrao: dinheiro,
  psicologa_custo_padrao: dinheiro,
});

/** Pesos precisam somar exatamente 100 — antes era só um aviso visual. */
const somaCem = <T extends Record<string, number>>(schema: z.ZodType<T>) =>
  schema.refine(
    (p) => Object.values(p).reduce((s, v) => s + v, 0) === 100,
    { message: "Os pesos precisam somar exatamente 100%." },
  );

const scoreSchema = z.object({
  pesos: somaCem(
    z.object({
      investimento: pct,
      timing: pct,
      ingles: pct,
      academico: pct,
      competitivo: pct,
      comprometimento: pct,
      video: pct,
    }),
  ),
  faixas: z.object({ hot: pct, warm: pct }).refine((f) => f.hot > f.warm, {
    message: "A faixa Quente precisa ser maior que a Morna.",
  }),
});

const matchSchema = z.object({
  pesos: somaCem(
    z.object({
      financeiro: pct,
      academico: pct,
      esportivo: pct,
      serie: pct,
      historico_bausa: pct,
    }),
  ),
  faixas: z
    .object({ excelente: pct, forte: pct, possivel: pct })
    .refine((f) => f.excelente > f.forte && f.forte > f.possivel, {
      message: "As faixas precisam ser decrescentes: excelente > forte > possível.",
    }),
});

const experienciaSchema = z.object({
  ansiedade_vermelho: z.number().int().min(1).max(10),
  satisfacao_vermelho: z.number().int().min(1).max(10),
});

export type MetasInput = z.infer<typeof metasSchema>;
export type ValoresInput = z.infer<typeof valoresSchema>;
export type ScoreInput = z.infer<typeof scoreSchema>;
export type MatchInput = z.infer<typeof matchSchema>;
export type ExperienciaInput = z.infer<typeof experienciaSchema>;

export interface ParametrosSistema {
  metas: MetasInput;
  valores: ValoresInput;
  score: ScoreInput;
  match: MatchInput;
  experiencia: ExperienciaInput;
}

type Result = { success: true } | { success: false; error: string };

// ─── Leitura ─────────────────────────────────────────────────────────────

const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const obj = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Lê todas as chaves reais e devolve tipado, com defaults onde faltar. */
export async function getParametrosSistema(): Promise<ParametrosSistema> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("configuracoes_sistema").select("chave, valor");

  const mapa = new Map<string, unknown>();
  for (const row of (data ?? []) as { chave: string; valor: unknown }[]) {
    mapa.set(row.chave, row.valor);
  }

  const health = obj(mapa.get("pipeline_health_ratio"));
  const planosRaw = obj(mapa.get("planos"));
  const plano = (nome: keyof typeof VALORES_DEFAULT.planos) => {
    const p = obj(planosRaw[nome]);
    const d = VALORES_DEFAULT.planos[nome];
    return {
      valor: num(p.valor, d.valor),
      valor_pix: num(p.valor_pix, d.valor_pix),
      psicologa: typeof p.psicologa === "boolean" ? p.psicologa : d.psicologa,
    };
  };
  const pesosScore = obj(mapa.get("lead_score_pesos"));
  const faixasScore = obj(mapa.get("lead_score_faixas"));
  const pesosMatch = obj(mapa.get("match_pesos"));
  const faixasMatch = obj(mapa.get("match_faixas"));
  const thresholds = obj(mapa.get("thresholds_experiencia"));

  return {
    metas: {
      meta_anual: num(mapa.get("meta_anual"), METAS_DEFAULT.meta_anual),
      meta_mensal_padrao: num(mapa.get("meta_mensal_padrao"), METAS_DEFAULT.meta_mensal_padrao),
      ticket_medio_alvo: num(mapa.get("ticket_medio_alvo"), METAS_DEFAULT.ticket_medio_alvo),
      contratos_mes_alvo: num(mapa.get("contratos_mes_alvo"), METAS_DEFAULT.contratos_mes_alvo),
      pipeline_health_min: num(health.min, METAS_DEFAULT.pipeline_health_min),
      pipeline_health_max: num(health.max, METAS_DEFAULT.pipeline_health_max),
    },
    valores: {
      planos: { legacy: plano("legacy"), journey: plano("journey"), start: plano("start") },
      entrada_padrao: num(mapa.get("entrada_padrao"), VALORES_DEFAULT.entrada_padrao),
      psicologa_custo_padrao: num(
        mapa.get("psicologa_custo_padrao"),
        VALORES_DEFAULT.psicologa_custo_padrao,
      ),
    },
    score: {
      pesos: {
        investimento: num(pesosScore.investimento, SCORE_DEFAULT.pesos.investimento),
        timing: num(pesosScore.timing, SCORE_DEFAULT.pesos.timing),
        ingles: num(pesosScore.ingles, SCORE_DEFAULT.pesos.ingles),
        academico: num(pesosScore.academico, SCORE_DEFAULT.pesos.academico),
        competitivo: num(pesosScore.competitivo, SCORE_DEFAULT.pesos.competitivo),
        comprometimento: num(pesosScore.comprometimento, SCORE_DEFAULT.pesos.comprometimento),
        video: num(pesosScore.video, SCORE_DEFAULT.pesos.video),
      },
      faixas: {
        hot: num(faixasScore.hot, SCORE_DEFAULT.faixas.hot),
        warm: num(faixasScore.warm, SCORE_DEFAULT.faixas.warm),
      },
    },
    match: {
      pesos: {
        financeiro: num(pesosMatch.financeiro, MATCH_DEFAULT.pesos.financeiro),
        academico: num(pesosMatch.academico, MATCH_DEFAULT.pesos.academico),
        esportivo: num(pesosMatch.esportivo, MATCH_DEFAULT.pesos.esportivo),
        serie: num(pesosMatch.serie, MATCH_DEFAULT.pesos.serie),
        historico_bausa: num(pesosMatch.historico_bausa, MATCH_DEFAULT.pesos.historico_bausa),
      },
      faixas: {
        excelente: num(faixasMatch.excelente, MATCH_DEFAULT.faixas.excelente),
        forte: num(faixasMatch.forte, MATCH_DEFAULT.faixas.forte),
        possivel: num(faixasMatch.possivel, MATCH_DEFAULT.faixas.possivel),
      },
    },
    experiencia: {
      ansiedade_vermelho: num(thresholds.ansiedade_vermelho, EXPERIENCIA_DEFAULT.ansiedade_vermelho),
      satisfacao_vermelho: num(
        thresholds.satisfacao_vermelho,
        EXPERIENCIA_DEFAULT.satisfacao_vermelho,
      ),
    },
  };
}

// ─── Escrita ─────────────────────────────────────────────────────────────

async function gravar(pares: { chave: string; valor: unknown }[]): Promise<Result> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem alterar parâmetros do sistema." };
  }
  const supabase = await createAuditedSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const agora = new Date().toISOString();

  // Upsert: as chaves de metas/valores existem no seed, mas outras instalações
  // podem não ter — nunca "salvar" sem gravar (bug da tela antiga).
  const { error } = await supabase.from("configuracoes_sistema").upsert(
    pares.map((p) => ({
      chave: p.chave,
      valor: JSON.parse(JSON.stringify(p.valor)),
      updated_by: user?.id,
      updated_at: agora,
    })),
    { onConflict: "chave" },
  );
  if (error) return { success: false, error: `Não foi possível salvar: ${error.message}` };

  for (const path of PATHS_REVALIDAR) revalidatePath(path);
  return { success: true };
}

const primeiroErro = (e: z.ZodError) => e.issues[0]?.message ?? "Dados inválidos.";

export async function salvarMetas(input: MetasInput): Promise<Result> {
  const parsed = metasSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: primeiroErro(parsed.error) };
  if (parsed.data.pipeline_health_min > parsed.data.pipeline_health_max) {
    return { success: false, error: "O mínimo do pipeline saudável não pode ser maior que o máximo." };
  }
  const d = parsed.data;
  return gravar([
    { chave: "meta_anual", valor: d.meta_anual },
    { chave: "meta_mensal_padrao", valor: d.meta_mensal_padrao },
    { chave: "ticket_medio_alvo", valor: d.ticket_medio_alvo },
    { chave: "contratos_mes_alvo", valor: d.contratos_mes_alvo },
    { chave: "pipeline_health_ratio", valor: { min: d.pipeline_health_min, max: d.pipeline_health_max } },
  ]);
}

export async function salvarValores(input: ValoresInput): Promise<Result> {
  const parsed = valoresSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: primeiroErro(parsed.error) };
  const d = parsed.data;
  for (const [nome, p] of Object.entries(d.planos)) {
    if (p.valor_pix > p.valor) {
      return { success: false, error: `No plano ${nome}, o valor no Pix não pode ser maior que o valor padrão.` };
    }
  }
  return gravar([
    { chave: "planos", valor: d.planos },
    { chave: "entrada_padrao", valor: d.entrada_padrao },
    { chave: "psicologa_custo_padrao", valor: d.psicologa_custo_padrao },
  ]);
}

export async function salvarScore(input: ScoreInput): Promise<Result> {
  const parsed = scoreSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: primeiroErro(parsed.error) };
  return gravar([
    { chave: "lead_score_pesos", valor: parsed.data.pesos },
    { chave: "lead_score_faixas", valor: parsed.data.faixas },
  ]);
}

export async function salvarMatch(input: MatchInput): Promise<Result> {
  const parsed = matchSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: primeiroErro(parsed.error) };
  return gravar([
    { chave: "match_pesos", valor: parsed.data.pesos },
    { chave: "match_faixas", valor: parsed.data.faixas },
  ]);
}

export async function salvarExperiencia(input: ExperienciaInput): Promise<Result> {
  const parsed = experienciaSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: primeiroErro(parsed.error) };
  return gravar([{ chave: "thresholds_experiencia", valor: parsed.data }]);
}
