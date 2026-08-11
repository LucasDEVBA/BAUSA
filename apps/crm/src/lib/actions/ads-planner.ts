"use server";

import { z } from "zod";

import { getUserPapel, getUserProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { fetchCampanhaMetrics } from "@/lib/cac-queries";
import { calcularConfianca, type EvidenciaAds, type MapaConfianca } from "@/lib/ads-confianca";
import { fetchBreakdown, fetchTopCampanhas, resolverRange, MetaAdsError } from "@/lib/meta-ads";
import { gerarConteudoGemini, GeminiNotConfiguredError } from "@/lib/gemini";
import { ADS_PLANNER_INSTRUCOES_DEFAULT } from "@/lib/automacoes/ads-planner-prompt";

// ════════════════════════════════════════════════════════════════════════
// A4-Planner — gera o briefing completo da próxima campanha (CEO preenche
// no Ads Manager; o Engine NUNCA cria campanha — invariante).
//
// Confiança: calculada DETERMINISTICAMENTE (ads-confianca.ts) a partir da
// massa de dados e INFORMADA ao modelo — a IA escreve o porquê, nunca dá
// o próprio badge. Cérebro: aprendizados anteriores (ads_aprendizados)
// entram no prompt; cada plano gerado vira um novo aprendizado.
// ════════════════════════════════════════════════════════════════════════

// Parâmetros dinâmicos: a Meta preenche {{campaign.id}} na entrega — é o que
// casa o lead com meta_ads_campanha.campanha_id (ROI exato).
const UTM_BLOCO =
  "utm_source=instagram&utm_medium=paid&utm_campaign={{campaign.name}}&utm_id={{campaign.id}}";

const secaoSchema = z.object({
  recomendacao: z.string().min(1).max(600),
  porque: z.string().min(1).max(600),
});

const planoSchema = z.object({
  resumoEstrategia: z.string().min(1).max(800),
  objetivo: secaoSchema,
  publico: secaoSchema.extend({
    idades: z.string().min(1).max(120),
    genero: z.string().min(1).max(120),
    localizacoes: z.string().min(1).max(300),
  }),
  criativo: secaoSchema,
  orcamento: secaoSchema.extend({
    diarioBrl: z.number().min(10).max(2000),
    duracaoDias: z.number().int().min(3).max(60),
  }),
  cplAlvo: secaoSchema.extend({ valorBrl: z.number().min(1).max(2000) }),
  testes: z.array(z.object({ hipotese: z.string().min(1).max(300), comoMedir: z.string().min(1).max(300) })).min(1).max(4),
  copyHints: z.array(z.string().min(1).max(300)).min(1).max(4),
  checklistMeta: z.array(z.string().min(1).max(300)).min(4).max(14),
});

export type PlanoCampanha = z.infer<typeof planoSchema>;

export interface PlanoResult {
  success: boolean;
  error?: string;
  notConfigured?: boolean;
  plano?: PlanoCampanha;
  confianca?: MapaConfianca;
  evidencia?: EvidenciaAds;
  utmBloco?: string;
}

function sanitizeExterno(value: string): string {
  const semControle = Array.from(value)
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
  return semControle.replace(/\s+/g, " ").slice(0, 80).trim();
}

function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export async function gerarPlanoCampanha(input?: { agentId?: string; foco?: string }): Promise<PlanoResult> {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas CEO/CTO podem gerar planos." };

  const foco = typeof input?.foco === "string" ? input.foco.slice(0, 300).trim() : "";
  const agentId = typeof input?.agentId === "string" && /^[0-9a-f-]{36}$/.test(input.agentId) ? input.agentId : null;

  try {
    const supabase = await createServerSupabaseClient();
    const range12m = resolverRange({ periodo: "12m" }).range;
    const range90d = resolverRange({ periodo: "90d" }).range;

    // Instruções: agent (capacidade analise) > config editável > default do código
    const [{ data: cfgRow }, agentRow, metrics, top, idade, genero, aprendizadosRes] = await Promise.all([
      supabase.from("configuracoes_sistema").select("valor").eq("chave", "ads_planner_prompt").maybeSingle(),
      agentId
        ? supabase.from("agents").select("prompt").eq("id", agentId).eq("ativo", true).is("deleted_at", null).contains("capacidades", ["analise"]).maybeSingle()
        : Promise.resolve({ data: null }),
      fetchCampanhaMetrics("12m"),
      fetchTopCampanhas(supabase, range12m, 10),
      fetchBreakdown("age", range90d).catch(() => []),
      fetchBreakdown("gender", range90d).catch(() => []),
      supabase.from("ads_aprendizados").select("tipo, resumo, created_at").order("created_at", { ascending: false }).limit(20),
    ]);

    const cfg = (cfgRow?.valor ?? {}) as { instrucoes?: string };
    const agentPrompt = typeof (agentRow as { data?: { prompt?: unknown } | null })?.data?.prompt === "string"
      ? String((agentRow as { data: { prompt: string } }).data.prompt)
      : null;
    const instrucoes =
      agentPrompt?.trim() ||
      (typeof cfg.instrucoes === "string" && cfg.instrucoes.trim() ? cfg.instrucoes.trim() : ADS_PLANNER_INSTRUCOES_DEFAULT);

    // ── Evidência → confiança (DETERMINÍSTICO — a IA recebe pronto) ──
    const leadsAtribuidos = metrics.porCampanha.reduce((s, c) => s + c.leads, 0);
    const clientesAtribuidos = metrics.porCampanha.reduce((s, c) => s + c.clientes, 0);
    const evidencia: EvidenciaAds = {
      leadsAtribuidos,
      clientesAtribuidos,
      campanhasComGasto: metrics.porCampanha.filter((c) => c.gasto > 0).length,
      gastoTotal: metrics.gastoTotal,
      diasComDados: metrics.porDia.length,
    };
    const confianca = calcularConfianca(evidencia);

    const topTxt = top
      .map((t) => {
        const ctr = t.impressoes > 0 ? ((t.cliques / t.impressoes) * 100).toFixed(2) : "—";
        return `- "${sanitizeExterno(t.nome)}": gasto ${brl.format(t.gasto)}, CTR ${ctr}%, ${t.cliques} cliques`;
      })
      .join("\n");
    const idadeTxt = idade.map((i) => `${i.chave}: ${brl.format(i.gasto)}`).join(" · ") || "sem dados";
    const generoTxt = genero.map((g) => `${g.chave}: ${brl.format(g.gasto)}`).join(" · ") || "sem dados";
    const aprendizados = (aprendizadosRes.data ?? [])
      .map((a) => `- [${String(a.tipo)}] ${sanitizeExterno(String(a.resumo)).slice(0, 200)}`)
      .join("\n");

    const confTxt = (Object.entries(confianca) as Array<[string, { nivel: string; motivo: string }]>)
      .map(([dim, c]) => `- ${dim}: ${c.nivel.toUpperCase()} (${c.motivo})`)
      .join("\n");

    const prompt = `${instrucoes}

TAREFA (fixa): monte o briefing COMPLETO da próxima campanha de Meta Ads para o CEO preencher manualmente no Gerenciador de Anúncios. Responda APENAS o JSON pedido.

CONFIANÇA POR DIMENSÃO (calculada por regras sobre a massa de dados — respeite: onde estiver SUGESTIVA, deixe claro no "porque" que é hipótese; onde ASSERTIVA/PARCIAL, cite os números):
${confTxt}

EVIDÊNCIA (12 meses):
- Gasto total: ${brl.format(evidencia.gastoTotal)} em ${evidencia.campanhasComGasto} campanhas, ${evidencia.diasComDados} dias com dados
- Funil atribuído: ${leadsAtribuidos} leads, ${clientesAtribuidos} clientes
- Leads SEM atribuição no período: ${metrics.leadsSemCampanha} (campanhas antigas sem UTM)

TOP CAMPANHAS HISTÓRICAS (gasto/CTR):
${topTxt || "sem histórico"}

DEMOGRAFIA DO GASTO (90d): idades → ${idadeTxt} | gênero → ${generoTxt}

APRENDIZADOS ANTERIORES (cérebro — memória acumulada, use e não contradiga sem justificar):
${aprendizados || "nenhum registrado ainda"}
${foco ? `\nFOCO PEDIDO PELO CEO: ${sanitizeExterno(foco)}` : ""}

FORMATO (JSON estrito): {"resumoEstrategia": string, "objetivo": {"recomendacao","porque"}, "publico": {"recomendacao","porque","idades","genero","localizacoes"}, "criativo": {"recomendacao","porque"}, "orcamento": {"recomendacao","porque","diarioBrl": number, "duracaoDias": number}, "cplAlvo": {"recomendacao","porque","valorBrl": number}, "testes": [{"hipotese","comoMedir"}], "copyHints": [string], "checklistMeta": [string, 5 a 12 passos NA ORDEM das telas do Gerenciador de Anúncios, incluindo onde colar os parâmetros de URL]}
Regras do formato: "idades", "genero" e "localizacoes" são RÓTULOS CURTOS para chips (ex.: "35-54", "Masculino" ou "Todos", "Brasil: capitais SP/RJ/MG") — detalhes vão em "recomendacao"/"porque". Valores numéricos SEM aspas.`;

    // Teto folgado: o modelo consome tokens de raciocínio no mesmo orçamento
    // e o JSON do briefing é grande (memória do projeto: gemini-thinking).
    // Geração longa → orçamento de tempo maior que o default do client.
    const texto = await gerarConteudoGemini(prompt, {
      json: true,
      temperature: 0.3,
      maxOutputTokens: 8192,
      timeoutMs: 60_000,
      deadlineMs: 110_000,
    });
    const plano = planoSchema.parse(parseJson(texto));

    // DETERMINÍSTICO: se a IA escrever UTMs próprios no checklist (já aconteceu —
    // sem utm_id a atribuição quebra), substitui pela referência ao bloco canônico.
    plano.checklistMeta = plano.checklistMeta.map((passo) =>
      /utm_[a-z_]+=/i.test(passo)
        ? passo.replace(/utm_[a-z_]+=[^\s,'".]+(?:&utm_[a-z_]+=[^\s,'".]+)*/gi, "os Parâmetros de URL do bloco verde desta tela (com utm_id dinâmico)")
        : passo,
    );

    // ── Cérebro: o plano gerado vira aprendizado (append-only) ──
    const perfil = await getUserProfile();
    const { error: aprendErro } = await supabase.from("ads_aprendizados").insert({
      tipo: "plano_gerado",
      resumo: `Plano: ${plano.resumoEstrategia.slice(0, 400)} | Público ${plano.publico.idades}/${plano.publico.genero} | Budget ${plano.orcamento.diarioBrl}/dia | CPL alvo ${plano.cplAlvo.valorBrl}`,
      evidencia: { evidencia, confianca },
      confianca: confianca.publico.nivel,
      created_by: perfil?.id ?? null,
    });
    if (aprendErro) {
      console.error(JSON.stringify({ level: "WARN", action: "ads_aprendizado_falhou", error: aprendErro.message }));
    }

    return { success: true, plano, confianca, evidencia, utmBloco: UTM_BLOCO };
  } catch (e) {
    if (e instanceof GeminiNotConfiguredError) {
      return { success: false, notConfigured: true, error: "IA não configurada (GEMINI_API_KEY ausente neste ambiente)." };
    }
    if (e instanceof MetaAdsError) return { success: false, error: e.message };
    if (e instanceof z.ZodError) {
      console.error(JSON.stringify({ level: "WARN", action: "ads_planner_zod", issues: e.issues.slice(0, 3) }));
      return { success: false, error: "A IA respondeu fora do formato — tente novamente." };
    }
    console.error(JSON.stringify({ level: "ERROR", action: "ads_planner_falhou", error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }));
    return { success: false, error: "Falha inesperada ao gerar o plano." };
  }
}

const observacaoSchema = z.object({ resumo: z.string().min(10, "Mínimo de 10 caracteres.").max(2000) });

export async function registrarAprendizadoAds(input: z.input<typeof observacaoSchema>): Promise<{ success: boolean; error?: string }> {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas CEO/CTO." };
  const parsed = observacaoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Entrada inválida." };

  const supabase = await createServerSupabaseClient();
  const perfil = await getUserProfile();
  const { error } = await supabase.from("ads_aprendizados").insert({
    tipo: "observacao",
    resumo: parsed.data.resumo.trim(),
    created_by: perfil?.id ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}
