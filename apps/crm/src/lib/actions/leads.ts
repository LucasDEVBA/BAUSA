"use server";

import { revalidatePath } from "next/cache";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { getProbabilidadePorEtapa } from "@/lib/actions/configuracoes";
import { registrarEventoGamificacao } from "@/lib/gamificacao";
import {
  DETALHE_REVISAO_PAGINA,
  FRIOS_REVISAO_DIAS,
  INCOMPLETOS_REVISAO_DIAS,
  PENDENTES_PAGINA,
  REVISAO_PAGINA,
  paginacaoSegura,
  type ResultadoPaginaRevisao,
} from "@/lib/revisao-leads";

function mapInvestmentToEnum(range: string | null): string {
  if (!range) return "ate_20k";
  const lower = range.toLowerCase();
  if (lower.includes("40") || lower.includes("50") || lower.includes("70") || lower.includes("over")) return "40k_mais";
  if (lower.includes("30")) return "30k_40k";
  if (lower.includes("20")) return "20k_30k";
  return "ate_20k";
}

function mapInvestmentToValor(range: string | null): number {
  const mapped = mapInvestmentToEnum(range);
  const valores: Record<string, number> = {
    "40k_mais": 32000,
    "30k_40k": 28000,
    "20k_30k": 22000,
    "ate_20k": 16000,
  };
  return valores[mapped] || 16000;
}

function mapClassificacao(cls: string | null): "hot" | "warm" | "cold" {
  if (!cls) return "cold";
  const upper = cls.toUpperCase();
  if (upper === "QUENTE" || upper === "HOT") return "hot";
  if (upper === "MORNO" || upper === "WARM") return "warm";
  return "cold";
}

function mapNivelIngles(level: string | null): string {
  if (!level) return "basico";
  const lower = level.toLowerCase();
  if (lower.includes("fluent") || lower.includes("fluente")) return "fluente";
  if (lower.includes("avanc") || lower.includes("advanced")) return "avancado";
  if (lower.includes("interm")) return "intermediario";
  if (lower.includes("basic") || lower.includes("basico") || lower.includes("básico")) return "basico";
  return "nenhum";
}

function mapDesempenho(perf: string | null): string {
  if (!perf) return "regular";
  const lower = perf.toLowerCase();
  if (lower.includes("excelent")) return "excelente";
  if (lower.includes("bom") || lower.includes("good")) return "bom";
  if (lower.includes("fraco") || lower.includes("weak") || lower.includes("poor")) return "fraco";
  return "regular";
}

function mapSchoolYear(year: string | null): string {
  if (!year) return "9th";
  const lower = year.toLowerCase();
  if (lower.includes("pg") || lower.includes("post")) return "pg_year";
  if (lower.includes("12") || lower.includes("3")) return "12th";
  if (lower.includes("11") || lower.includes("2")) return "11th";
  if (lower.includes("10") || lower.includes("1")) return "10th";
  return "9th";
}

type SupabaseClient = Awaited<ReturnType<typeof createAuditedSupabaseClient>>;

type PromocaoResult =
  | { success: true; atletaId: string; dealId: string }
  | { success: false; error: string };

/**
 * Núcleo da promoção form_submission → atleta + deal.
 * Paridade com autoPromoteToCRM da CF qualify-lead: campos Gemini no atleta
 * e ramificação do deal por timing_status (aguardando_timing / perdido / lead).
 * Idempotente: se o atleta já existe, retorna sucesso com os ids existentes.
 */
/**
 * Campos de etapa do deal por timing_status — fonte ÚNICA para criar
 * (promoverLeadCore) e reabrir (garantirDealAtivoNaAprovacao) um deal.
 * ideal → lead · muito_cedo → aguardando_timing (retoma em novembro) ·
 * tarde_demais → perdido/timing (destino natural; nunca na coluna Lead).
 */
function dealCamposPorTiming(
  timingStatus: string,
  probabilidadePorEtapa: Record<string, number>,
): Record<string, unknown> {
  if (timingStatus === "muito_cedo") {
    const proximoAno = new Date().getFullYear() + 1;
    return {
      etapa: "aguardando_timing",
      probabilidade_fechamento: 5,
      next_action: "Retomar contato em novembro (lead muito cedo)",
      data_proxima_acao: `${proximoAno}-11-01`,
    };
  }
  if (timingStatus === "tarde_demais") {
    return {
      etapa: "perdido",
      probabilidade_fechamento: 0,
      motivo_perda: "timing",
      detalhe_perda: "Lead chegou tarde demais (graduated_2plus)",
      pode_reativar: true,
    };
  }
  return {
    etapa: "lead",
    probabilidade_fechamento: probabilidadePorEtapa["lead"] ?? 10,
  };
}

/** Etapas em que o lead ainda NÃO avançou: só nelas a reativação pode ser re-armada. */
const ETAPAS_REARMAVEIS = ["contato_feito", "lead"];
/** Pré-reunião: um deal perdido daqui nunca passou de conversa inicial. */
const ETAPAS_PRE_REUNIAO = ["contato_feito", "lead", "aguardando_timing"];
/** Para onde um deal perdido NÃO pode ser reaberto (estados sem funil). */
const ETAPAS_NAO_REABRIVEIS = ["perdido", "cancelamento_solicitado", "projeto_futuro"];

async function promoverLeadCore(
  supabase: SupabaseClient,
  fs: Record<string, unknown>,
): Promise<PromocaoResult> {
  const fsId = String(fs.id);

  // Idempotência (backstop: UNIQUE em atletas.form_submission_id)
  const { data: existing } = await supabase
    .from("atletas")
    .select("id, deals(id)")
    .eq("form_submission_id", fsId)
    .maybeSingle();

  if (existing) {
    const dealsExistentes = (existing as { deals?: { id: string }[] }).deals ?? [];
    return {
      success: true,
      atletaId: String((existing as { id: string }).id),
      dealId: dealsExistentes[0]?.id ?? "",
    };
  }

  // Responsável (dedup por whatsapp)
  const guardianWhatsapp = (fs.guardian_whatsapp as string | null) || (fs.email as string | null);
  if (!guardianWhatsapp) {
    return { success: false, error: "Lead sem WhatsApp ou email do responsavel." };
  }

  let responsavelId: string;
  const { data: existingResp } = await supabase
    .from("responsaveis")
    .select("id")
    .eq("whatsapp", guardianWhatsapp)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingResp) {
    responsavelId = String((existingResp as { id: string }).id);
  } else {
    const { data: newResp, error: respError } = await supabase
      .from("responsaveis")
      .insert({
        nome: (fs.guardian_name as string | null) || "Responsavel",
        email: (fs.guardian_email as string | null) || (fs.email as string | null),
        whatsapp: guardianWhatsapp,
        profissao: fs.guardian_profession as string | null,
        consentimento_lgpd: true,
        aceite_whatsapp: true,
        aceite_email: true,
        form_submission_ids: [fsId],
      })
      .select("id")
      .single();

    if (respError || !newResp) {
      return { success: false, error: `Erro ao criar responsavel: ${respError?.message}` };
    }
    responsavelId = String((newResp as { id: string }).id);
  }

  // Endereço (best-effort)
  if (fs.city_state || fs.family_address) {
    await supabase
      .from("enderecos")
      .insert({
        cidade: (fs.city_state as string | null) || "N/A",
        pais: (fs.address_country as string | null) || "BR",
      })
      .select("id")
      .single();
  }

  // Atleta — inclui os campos da pré-qualificação Gemini (paridade com a CF)
  const classificacaoGemini = (fs.qualification_classification as string | null) ?? null;
  const { data: atleta, error: atletaError } = await supabase
    .from("atletas")
    .insert({
      nome_completo: fs.athlete_name as string,
      data_nascimento: (fs.birth_date as string | null) || "2008-01-01",
      whatsapp: guardianWhatsapp,
      email: fs.email as string | null,
      instagram: fs.instagram as string | null,
      esporte: fs.position ? "Futebol" : "Outro",
      posicao: fs.position as string | null,
      nivel_competitivo: "base_medio",
      nivel_ingles: mapNivelIngles(fs.english_level as string | null),
      desempenho_academico: mapDesempenho(fs.academic_performance as string | null),
      serie_escolar: mapSchoolYear(fs.school_year as string | null),
      escola_atual: fs.current_school as string | null,
      cidade_estado: (fs.city_state as string | null) || "N/A",
      video_highlights_url: fs.video_link as string | null,
      historico_clubes: fs.club_history as string | null,
      conquistas: fs.achievements as string | null,
      momento_inicio: "proximo_semestre",
      comprometimento: "medio",
      decisao_familiar: "em_discussao",
      faixa_investimento: mapInvestmentToEnum(fs.investment_range as string | null),
      lead_classificacao: mapClassificacao(classificacaoGemini),
      qualificado_gemini: classificacaoGemini === "QUENTE" || classificacaoGemini === "MORNO",
      classificacao_gemini: classificacaoGemini,
      motivo_gemini: fs.qualification_reason as string | null,
      confianca_gemini: fs.qualification_confidence as string | null,
      qualificado_gemini_at: fs.qualified_at as string | null,
      safra: "fall_2026",
      responsavel_id: responsavelId,
      form_submission_id: fsId,
      origem: "formulario_web",
      consentimento_lgpd: true,
    })
    .select("id")
    .single();

  if (atletaError || !atleta) {
    return { success: false, error: `Erro ao criar atleta: ${atletaError?.message}` };
  }
  const atletaId = String((atleta as { id: string }).id);

  // Deal — ramificação por timing_status (paridade com a CF qualify-lead)
  const { data: userData } = await supabase.auth.getUser();
  const probabilidadePorEtapa = await getProbabilidadePorEtapa();
  const timingStatus = (fs.timing_status as string | null) ?? "ideal";

  const dealBase: Record<string, unknown> = {
    atleta_id: atletaId,
    responsavel_id: userData.user?.id,
    valor_estimado: mapInvestmentToValor(fs.investment_range as string | null),
    status_decisao_familia: "em_discussao",
    safra: "fall_2026",
    ...dealCamposPorTiming(timingStatus, probabilidadePorEtapa),
  };

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .insert(dealBase)
    .select("id")
    .single();

  if (dealError || !deal) {
    return { success: false, error: `Erro ao criar deal: ${dealError?.message}` };
  }

  return { success: true, atletaId, dealId: String((deal as { id: string }).id) };
}

export async function promoverLead(formSubmissionId: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode promover leads." };
  }

  const supabase = await createAuditedSupabaseClient();

  const { data: fs, error: fsError } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("id", formSubmissionId)
    .single();

  if (fsError || !fs) {
    return { success: false, error: "Lead nao encontrado." };
  }

  const result = await promoverLeadCore(supabase, fs as Record<string, unknown>);
  if (result.success) {
    revalidatePath("/leads");
    revalidatePath("/pipeline");
  }
  return result;
}

// ─── Fila de aprovação manual ────────────────────────────────────────────
// Todo lead QUENTE/MORNO nasce aprovacao_status='pendente' (CF qualify-lead)
// e só entra no pipeline + outreach automático após decisão do CEO/CTO.

export interface LeadPendenteAprovacao {
  id: string;
  // Atleta
  athlete_name: string;
  birth_date: string | null;
  age: string | null;
  gender: string | null;
  email: string;
  athlete_whatsapp: string | null;
  instagram: string | null;
  video_link: string | null;
  video_highlights: string | null;
  // Esporte
  position: string | null;
  club_history: string | null;
  achievements: string | null;
  // Acadêmico
  school_year: string | null;
  current_school: string | null;
  school_city_state: string | null;
  is_high_school: string | null;
  education_model: string | null;
  english_level: string | null;
  english_exam: string | null;
  exam_result: string | null;
  academic_performance: string | null;
  school_priorities: string | null;
  school_graduated_from: string | null;
  graduated_when: string | null;
  // Responsável
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_whatsapp: string | null;
  guardian_profession: string | null;
  // Segundo responsável (form: hasSecondGuardian=sim; null = não existe)
  guardian_name_2: string | null;
  guardian_email_2: string | null;
  guardian_whatsapp_2: string | null;
  guardian_profession_2: string | null;
  // Endereço
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_country: string | null;
  city_state: string | null;
  family_address: string | null;
  // Decisão / investimento
  investment_range: string | null;
  start_timing: string | null;
  project_direction: string | null;
  behavioral_profile: string | null;
  youth_commitment: string | null;
  family_decision_structure: string | null;
  why_international: string | null;
  how_did_you_find: string | null;
  how_did_you_find_other: string | null;
  // IA / timing
  qualification_classification: string | null;
  qualification_reason: string | null;
  qualification_confidence: string | null;
  qualified_at: string | null;
  timing_status: string | null;
  // Classificador v2 (migration 20260825120000) — NULL em leads pré-v2
  score_financeiro: number | null;
  tier_profissao: string | null;
  sinais_reforco: string[] | null;
  sinais_alerta: string[] | null;
  /** Potencial ESPORTIVO (ALTA/MEDIA/PADRAO) — eixo independente do financeiro. */
  prioridade_estrategica: string | null;
  acao_recomendada: string | null;
  // Origem
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer_url: string | null;
  landing_url: string | null;
  cta_source: string | null;
  device_type: string | null;
  form_started_at: string | null;
  submitted_at: string;
}

// Todos os campos do formulário que ajudam na decisão — o CEO decide com o
// dossiê completo na tela (pedido do CEO 2026-08-11), não só com o resumo.
const COLUNAS_FILA_APROVACAO =
  "id, athlete_name, birth_date, age, gender, email, athlete_whatsapp, instagram, video_link, " +
  "video_highlights, position, club_history, achievements, school_year, current_school, " +
  "school_city_state, is_high_school, education_model, english_level, english_exam, exam_result, " +
  "academic_performance, school_priorities, school_graduated_from, graduated_when, guardian_name, " +
  "guardian_email, guardian_whatsapp, guardian_profession, " +
  "guardian_name_2, guardian_email_2, guardian_whatsapp_2, guardian_profession_2, " +
  "address_cep, address_street, " +
  "address_number, address_complement, address_neighborhood, address_city, address_state, " +
  "address_country, city_state, family_address, investment_range, start_timing, project_direction, " +
  "behavioral_profile, youth_commitment, family_decision_structure, why_international, " +
  "how_did_you_find, how_did_you_find_other, qualification_classification, qualification_reason, " +
  "qualification_confidence, qualified_at, timing_status, score_financeiro, tier_profissao, " +
  "sinais_reforco, sinais_alerta, prioridade_estrategica, acao_recomendada, " +
  "utm_source, utm_medium, utm_campaign, " +
  "utm_content, utm_term, referrer_url, landing_url, cta_source, device_type, form_started_at, " +
  "submitted_at";

/**
 * Contagem da fila para o ícone do Header global (client-side).
 * null = usuário sem permissão (Head) → o botão não renderiza.
 */
export async function contarLeadsPendentesAprovacao(): Promise<number | null> {
  const papel = await getUserPapel();
  if (papel !== "ceo") return null;

  const supabase = await createAuditedSupabaseClient();
  const { count, error } = await supabase
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("aprovacao_status", "pendente")
    .in("qualification_classification", ["QUENTE", "MORNO"]);

  if (error) return 0;
  return count ?? 0;
}

export interface LeadPendenteCard {
  id: string;
  athlete_name: string;
  /** Busca do board casa também pelo responsável (T13). */
  guardian_name: string | null;
  qualification_classification: string | null;
  city_state: string | null;
  position: string | null;
  timing_status: string | null;
  submitted_at: string;
  /** Reunião detectada pelo Calendar: badge + topo da coluna (T13). */
  meeting_scheduled: boolean | null;
  meeting_scheduled_at: string | null;
}

/**
 * Cards da coluna "Aguardando aprovação" do Kanban.
 *
 * A coluna é alimentada pela FILA (form_submissions), não por deals: o deal só
 * nasce na aprovação. Assim o board mostra o funil inteiro sem que um lead
 * não-aprovado entre em métrica, automação ou outreach.
 * Paginada (T7): o PostgREST corta em 1000 linhas em silêncio — a coluna
 * mostra o total real (count exact) e carrega o resto sob demanda.
 */
export async function listarLeadsPendentesCards(
  opts: { offset?: number; limite?: number } = {},
): Promise<ResultadoPaginaRevisao<LeadPendenteCard>> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: "Apenas CEO/CTO." };
  // offset/limite vêm do client: inteiros e dentro dos limites (limite ≤ max_rows)
  const { offset, limite } = paginacaoSegura(opts, PENDENTES_PAGINA);
  const supabase = await createAuditedSupabaseClient();
  const { data, error, count } = await supabase
    .from("form_submissions")
    .select(
      "id, athlete_name, guardian_name, qualification_classification, city_state, position, timing_status, submitted_at, meeting_scheduled, meeting_scheduled_at",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .eq("aprovacao_status", "pendente")
    .in("qualification_classification", ["QUENTE", "MORNO"])
    .order("meeting_scheduled", { ascending: false, nullsFirst: false })
    .order("submitted_at", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limite - 1);
  if (error?.code === "PGRST103") return { success: true, itens: [], total: offset };
  if (error) return { success: false, error: `Erro ao listar a fila: ${error.message}` };
  return { success: true, itens: (data ?? []) as unknown as LeadPendenteCard[], total: count ?? 0 };
}

export interface LeadFrioCard {
  id: string;
  athlete_name: string;
  guardian_name: string | null;
  city_state: string | null;
  position: string | null;
  score_financeiro: number | null;
  qualification_reason: string | null;
  submitted_at: string;
  meeting_scheduled: boolean | null;
  meeting_scheduled_at: string | null;
}

const COLUNAS_CARD_REVISAO =
  "id, athlete_name, guardian_name, city_state, position, score_financeiro, qualification_reason, submitted_at, meeting_scheduled, meeting_scheduled_at";

type ClasseRevisao = "FRIO" | "INCOMPLETO";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Recorte das colunas de revisão (Frios/Incompletos) em
 * public.vw_cadastros_situacao: classe + SEM decisão + janela + SEM deal
 * ativo — tudo NO BANCO, antes do range (bug T7: o .limit(80) vinha antes do
 * filtro de deal, feito no Node; 114 de 194 FRIOs sumiam do board).
 * Reunião detectada primeiro (T13), depois o mais recente.
 */
// SÍNCRONA de propósito: o builder do PostgREST é "thenable" — devolvido por
// uma função async, ele seria EXECUTADO no await (e o .range() sumiria).
function consultarRevisao(
  supabase: Awaited<ReturnType<typeof createAuditedSupabaseClient>>,
  classe: ClasseRevisao,
  dias: number,
  colunas: string,
  contar: boolean,
) {
  const corte = new Date(Date.now() - dias * 86400000).toISOString();
  return supabase
    .from("vw_cadastros_situacao")
    .select(colunas, contar ? { count: "exact" } : undefined)
    .eq("qualification_classification", classe)
    .is("aprovacao_status", null)
    .gte("submitted_at", corte)
    .eq("tem_deal_ativo", false)
    .order("meeting_scheduled", { ascending: false, nullsFirst: false })
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false });
}

async function paginaCardsRevisao<T>(
  classe: ClasseRevisao,
  dias: number,
  opts: { offset?: number; limite?: number },
): Promise<ResultadoPaginaRevisao<T>> {
  // limite > página: o hook recarrega de uma vez o que o CEO já tinha aberto
  // no "Mostrar mais" quando o board dá refresh (lista sempre = servidor).
  const { offset: inicio, limite } = paginacaoSegura(opts, REVISAO_PAGINA);
  const supabase = await createAuditedSupabaseClient();
  const { data, error, count } = await consultarRevisao(supabase, classe, dias, COLUNAS_CARD_REVISAO, true)
    .range(inicio, inicio + limite - 1);
  // Offset além do fim (cards decididos em outra aba): fim da lista, não erro.
  if (error?.code === "PGRST103") return { success: true, itens: [], total: inicio };
  if (error) return { success: false, error: `Erro ao listar ${classe === "FRIO" ? "frios" : "incompletos"}: ${error.message}` };
  return { success: true, itens: (data ?? []) as unknown as T[], total: count ?? 0 };
}

/**
 * Dossiê COMPLETO de uma página da revisão (modais Frios/Incompletos).
 * 1) ids da página na view (mesmo recorte das colunas); 2) se o card clicado
 * não está na página (veio de "Mostrar mais"), entra junto — o modal abre
 * SEMPRE no lead certo; 3) colunas completas em form_submissions por id.
 */
async function paginaDetalheRevisao(
  classe: ClasseRevisao,
  dias: number,
  opts: { offset?: number; garantirId?: string },
): Promise<
  | { success: true; leads: LeadPendenteAprovacao[]; total: number; proximoOffset: number }
  | { success: false; error: string }
> {
  const { offset } = paginacaoSegura(opts, DETALHE_REVISAO_PAGINA);
  // garantirId vem do client: só UUID chega ao filtro (senão é ignorado)
  const garantirId =
    typeof opts.garantirId === "string" && UUID_RE.test(opts.garantirId) ? opts.garantirId : undefined;
  const supabase = await createAuditedSupabaseClient();
  const { data, error, count } = await consultarRevisao(supabase, classe, dias, "id", true)
    .range(offset, offset + DETALHE_REVISAO_PAGINA - 1);
  if (error?.code === "PGRST103") return { success: true, leads: [], total: offset, proximoOffset: offset };
  if (error) return { success: false, error: `Erro ao listar a revisão: ${error.message}` };
  const idsPagina = ((data ?? []) as unknown as { id: string }[]).map((r) => r.id);
  const ids = [...idsPagina];
  if (garantirId && !ids.includes(garantirId)) {
    const { data: alvo } = await consultarRevisao(supabase, classe, dias, "id", false)
      .eq("id", garantirId)
      .maybeSingle();
    if (alvo) ids.unshift(garantirId);
  }
  if (ids.length === 0) return { success: true, leads: [], total: count ?? 0, proximoOffset: offset };
  const { data: rows, error: errRows } = await supabase
    .from("form_submissions")
    .select(COLUNAS_FILA_APROVACAO)
    .in("id", ids)
    .is("deleted_at", null);
  if (errRows) return { success: false, error: `Erro ao carregar o dossiê: ${errRows.message}` };
  const porId = new Map(((rows ?? []) as unknown as LeadPendenteAprovacao[]).map((r) => [r.id, r]));
  const leads = ids.map((id) => porId.get(id)).filter((l): l is LeadPendenteAprovacao => l !== undefined);
  return { success: true, leads, total: count ?? leads.length, proximoOffset: offset + idsPagina.length };
}

/**
 * Cards da coluna "Frios — revisão" do Kanban (pedido do CEO, 2026-09-04):
 * FRIO deixava de aparecer em qualquer lugar do board; agora os últimos 90
 * dias ficam visíveis para revisão humana. SÓ leitura + resgate explícito —
 * FRIO continua fora de fila, pipeline, métricas e outreach (invariantes
 * intactos). Exclui quem já tem deal (rebaixados do mutirão vivem em Perdido)
 * — no BANCO, antes da paginação (T7).
 */
export async function listarLeadsFriosCards(
  opts: { offset?: number; limite?: number } = {},
): Promise<ResultadoPaginaRevisao<LeadFrioCard>> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: "Apenas CEO/CTO." };
  return paginaCardsRevisao<LeadFrioCard>("FRIO", FRIOS_REVISAO_DIAS, opts ?? {});
}

/**
 * Dossiê COMPLETO dos frios elegíveis (mesmas colunas da fila de aprovação):
 * alimenta o modal em modo "frios" — clicar no card expande os dados com as
 * abas Conversa/E-mail. Mesmo recorte do listarLeadsFriosCards, paginado.
 */
export async function listarLeadsFriosDetalhe(
  opts: { offset?: number; garantirId?: string } = {},
): Promise<
  | { success: true; leads: LeadPendenteAprovacao[]; total: number; proximoOffset: number }
  | { success: false; error: string }
> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem revisar leads frios." };
  }
  return paginaDetalheRevisao("FRIO", FRIOS_REVISAO_DIAS, opts ?? {});
}

/**
 * Resgata um FRIO para a fila de aprovação (mesmo desenho do caso Pietro,
 * 2026-09-04): vira MORNO provisório + pendente, com o motivo registrado.
 * A fila exige QUENTE/MORNO (defesa em profundidade) — o provisório é
 * documentado e uma requalificação futura sobrescreve com o score real.
 * Pendente NUNCA recebe mensagem (gate humano intacto).
 */
export async function enviarFrioParaAprovacao(
  leadId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem resgatar um lead frio." };
  }
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .update({
      qualification_classification: "MORNO",
      aprovacao_status: "pendente",
      aprovacao_decidida_por: null,
      aprovacao_decidida_em: null,
      aprovacao_motivo:
        "Resgatado da coluna Frios para revisão manual (classificação provisória MORNO)",
    })
    .eq("id", leadId)
    .eq("qualification_classification", "FRIO")
    .is("aprovacao_status", null)
    .is("deleted_at", null)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) {
    return { success: false, error: "Lead não está mais elegível (já revisado ou requalificado)." };
  }
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  return { success: true };
}

export async function listarLeadsPendentesAprovacao(): Promise<
  { success: true; leads: LeadPendenteAprovacao[] } | { success: false; error: string }
> {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem ver a fila de aprovação." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .select(COLUNAS_FILA_APROVACAO)
    .is("deleted_at", null)
    .eq("aprovacao_status", "pendente")
    // Defesa em profundidade: um 'pendente' residual requalificado como FRIO
    // não deve ser aprovável (a CF também limpa pendente→NULL nesse caso).
    .in("qualification_classification", ["QUENTE", "MORNO"])
    // Fila por score do Classificador v2 (spec §8): maior score primeiro,
    // leads pré-v2 (NULL) por último; empate = mais antigo primeiro.
    .order("score_financeiro", { ascending: false, nullsFirst: false })
    .order("submitted_at", { ascending: true });

  if (error) {
    return { success: false, error: `Erro ao listar fila: ${error.message}` };
  }
  return { success: true, leads: (data ?? []) as unknown as LeadPendenteAprovacao[] };
}

/**
 * Aprova um lead pendente. ORDEM É SEGURANÇA (revisão adversarial 2026-08-10):
 * promove PRIMEIRO (idempotente — UNIQUE em atletas.form_submission_id) e só
 * então faz o CAS pendente→aprovado. Assim o estado "aprovado sem pipeline"
 * (que tornaria o lead elegível ao WhatsApp sem deal) é impossível: se a
 * promoção falha, o lead segue 'pendente' e nada é enviado. O pior caso é o
 * inverso e inofensivo: atleta/deal criados com lead ainda pendente — o CEO
 * clica de novo e o CAS completa.
 */
/**
 * Garante que o lead aprovado tenha um deal ATIVO e VISÍVEL no board, na
 * etapa CERTA (bug 2026-10-05). Leads resgatados — do INVALIDO, de Frios/
 * Incompletos ou re-filas antigas — podem já ter: atleta com deal 'perdido'
 * (mutirão de requalificação de 24/08), só deals excluídos, deal avançado
 * (cliente em admissão re-enfileirado) ou reunião já detectada sem deal
 * (Samuel Santana, 21/09). Antes, a aprovação devolvia o deal como estava e
 * o disparo automático mandava convite de reunião a quem já tinha reunião.
 *
 * Etapa final do deal:
 * - deal ativo fora de 'perdido' → mantido (muito_cedo em lead/contato_feito
 *   é estacionado em aguardando_timing — regra do CEO de 2026-09-08);
 * - deal 'perdido' → reaberto: se já houve reunião no histórico, volta para
 *   a etapa anterior à perda; senão, para o ramo de timing (ou Reunião
 *   marcada, se o formulário já tem reunião detectada). tarde_demais fica
 *   em perdido/timing;
 * - sem deal ativo → criado no ramo de timing (ou Reunião marcada).
 *
 * `rearmavel` = a reativação (mensagem automática) PODE ser re-armada: só
 * timing ideal, sem reunião em lugar nenhum e deal pré-reunião. Cliente em
 * admissão, família que desistiu após reunião, muito_cedo (contato manual)
 * e tarde_demais NUNCA recebem convite automático por causa da aprovação.
 */
type GarantiaDeal =
  | {
      ok: true;
      dealId: string;
      etapa: string;
      reaberto: boolean;
      rearmavel: boolean;
      /** Lead de timing ideal que JÁ passou do convite (reunião no histórico ou
       *  deal além da pré-reunião): o convite inicial seria indevido. */
      semConviteInicial: boolean;
    }
  | { ok: false; error: string };

async function garantirDealAtivoNaAprovacao(
  supabase: SupabaseClient,
  atletaId: string,
  fs: Record<string, unknown>,
): Promise<GarantiaDeal> {
  const { data: deals, error: dealsErr } = await supabase
    .from("deals")
    .select("id, etapa, deleted_at, etapa_anterior, reuniao_realizada_at, reuniao_data, reuniao_agendada_at")
    .eq("atleta_id", atletaId);
  if (dealsErr) return { ok: false, error: `Erro ao ler deals: ${dealsErr.message}` };

  const timingStatus = (fs.timing_status as string | null) ?? "ideal";
  const timingIdeal = timingStatus === "ideal";
  const reuniaoNoFormulario = fs.meeting_scheduled === true;
  const resultado = (
    dealId: string,
    etapa: string,
    reaberto: boolean,
    houveReuniao = false,
  ): GarantiaDeal => ({
    ok: true,
    dealId,
    etapa,
    reaberto,
    rearmavel:
      timingIdeal && !reuniaoNoFormulario && !houveReuniao && ETAPAS_REARMAVEIS.includes(etapa),
    semConviteInicial:
      timingIdeal && (reuniaoNoFormulario || houveReuniao || !ETAPAS_PRE_REUNIAO.includes(etapa)),
  });

  type DealRow = {
    id: string;
    etapa: string;
    deleted_at: string | null;
    etapa_anterior: string | null;
    reuniao_realizada_at: string | null;
    reuniao_data: string | null;
    reuniao_agendada_at: string | null;
  };
  const ativos = ((deals ?? []) as DealRow[]).filter((d) => d.deleted_at === null);
  const dealTeveReuniao = (d: DealRow): boolean =>
    Boolean(d.reuniao_realizada_at || d.reuniao_data || d.reuniao_agendada_at);
  const hoje = new Date().toISOString().split("T")[0];
  const probabilidadePorEtapa = await getProbabilidadePorEtapa();

  const camposReuniao = (motivo: string): Record<string, unknown> => ({
    etapa: "reuniao_marcada",
    probabilidade_fechamento: probabilidadePorEtapa["reuniao_marcada"] ?? 20,
    next_action: motivo,
    data_proxima_acao: hoje,
  });
  const MOTIVO_REUNIAO_FORM = "Reunião detectada antes da aprovação — confirmar se aconteceu";

  // Etapa de destino para um deal sem histórico de reunião no DEAL.
  // Reunião no formulário: ideal → Reunião marcada; muito_cedo → Lead
  // (visível, nunca estacionado — recorte da regra de 2026-09-08).
  const camposSemHistorico = (): Record<string, unknown> => {
    if (reuniaoNoFormulario && timingIdeal) return camposReuniao(MOTIVO_REUNIAO_FORM);
    if (reuniaoNoFormulario && timingStatus === "muito_cedo") {
      return dealCamposPorTiming("ideal", probabilidadePorEtapa);
    }
    return dealCamposPorTiming(timingStatus, probabilidadePorEtapa);
  };

  const visivel = ativos.find((d) => d.etapa !== "perdido");
  if (visivel) {
    const sinalReuniao = reuniaoNoFormulario || dealTeveReuniao(visivel);
    // CAS genérico de transição do deal visível (só a partir de etapas
    // pré-reunião; deal avançado nunca é mexido pela aprovação).
    const transicionar = async (campos: Record<string, unknown>, de: string[]) => {
      const { data: casRows, error: casErr } = await supabase
        .from("deals")
        .update(campos)
        .eq("id", visivel.id)
        .in("etapa", de)
        .is("deleted_at", null)
        .select("id");
      if (casErr) return { erro: casErr.message, moveu: false };
      return { erro: null, moveu: Boolean(casRows && casRows.length > 0) };
    };

    // Timing ideal com reunião e deal ainda pré-reunião (inclui o deal que o
    // promoverLeadCore acabou de criar em 'lead' — caso Samuel Santana): o
    // card vai para Reunião marcada. Avanço 2/3→4, sem falso retrocesso.
    if (timingIdeal && sinalReuniao && ETAPAS_PRE_REUNIAO.includes(visivel.etapa)) {
      const r = await transicionar(
        camposReuniao(
          reuniaoNoFormulario ? MOTIVO_REUNIAO_FORM : "Reunião no histórico do deal — confirmar o próximo passo",
        ),
        ETAPAS_PRE_REUNIAO,
      );
      if (r.erro) return { ok: false, error: `Erro ao mover deal para Reunião marcada: ${r.erro}` };
      if (r.moveu) return resultado(visivel.id, "reuniao_marcada", false, true);
    }
    if (timingStatus === "muito_cedo") {
      // Com reunião: visível em Lead (nunca estacionado — recorte da regra de
      // 2026-09-08). aguardando_timing→lead é isento de retrocesso no trigger.
      if (sinalReuniao && visivel.etapa === "aguardando_timing") {
        const r = await transicionar(dealCamposPorTiming("ideal", probabilidadePorEtapa), ["aguardando_timing"]);
        if (r.erro) return { ok: false, error: `Erro ao tirar deal do estacionamento: ${r.erro}` };
        if (r.moveu) return resultado(visivel.id, "lead", false, true);
      }
      // Sem reunião: estacionado em aguardando_timing (não mora na coluna Lead).
      if (!sinalReuniao && ETAPAS_REARMAVEIS.includes(visivel.etapa)) {
        const r = await transicionar(dealCamposPorTiming("muito_cedo", probabilidadePorEtapa), ETAPAS_REARMAVEIS);
        if (r.erro) return { ok: false, error: `Erro ao estacionar deal: ${r.erro}` };
        if (r.moveu) return resultado(visivel.id, "aguardando_timing", false);
      }
    }
    return resultado(visivel.id, visivel.etapa, false, sinalReuniao);
  }

  const perdido = ativos[0];
  if (perdido) {
    const anterior = perdido.etapa_anterior;
    const houveReuniao =
      dealTeveReuniao(perdido) ||
      Boolean(anterior && !ETAPAS_PRE_REUNIAO.includes(anterior) && !ETAPAS_NAO_REABRIVEIS.includes(anterior));
    if (timingStatus === "tarde_demais") {
      return resultado(perdido.id, "perdido", false, houveReuniao);
    }

    // Já houve reunião: o deal volta de onde parou (nunca para o início).
    const destino: Record<string, unknown> = houveReuniao
      ? (() => {
          const etapaVolta =
            anterior && !ETAPAS_PRE_REUNIAO.includes(anterior) && !ETAPAS_NAO_REABRIVEIS.includes(anterior)
              ? anterior
              : "reuniao_marcada";
          return {
            etapa: etapaVolta,
            probabilidade_fechamento: probabilidadePorEtapa[etapaVolta] ?? 20,
            next_action: "Deal reaberto na re-aprovação — retomar de onde parou",
            data_proxima_acao: hoje,
          };
        })()
      : {
          next_action: "Lead re-aprovado pelo CEO — retomar contato",
          data_proxima_acao: hoje,
          ...camposSemHistorico(),
        };
    const etapa = String(destino.etapa);

    // CAS: só reabre se AINDA estiver perdido (outra aba pode ter movido).
    const { data: casRows, error: casErr } = await supabase
      .from("deals")
      .update({ motivo_perda: null, detalhe_perda: null, pode_reativar: null, ...destino })
      .eq("id", perdido.id)
      .eq("etapa", "perdido")
      .is("deleted_at", null)
      .select("id");
    if (casErr) return { ok: false, error: `Erro ao reabrir deal: ${casErr.message}` };
    if (!casRows || casRows.length === 0) {
      return { ok: false, error: "Deal mudou de etapa durante a aprovação — confira no pipeline." };
    }
    // trg_deals_check_etapa marca perdido(16)→etapa menor como retrocesso;
    // reabrir por re-aprovação não é retrocesso de funil. aguardando_timing é
    // isento no trigger. CAS sobre a PRÓPRIA transição para não apagar um
    // retrocesso legítimo (com motivo) de outra aba.
    if (etapa !== "aguardando_timing") {
      const { error: flagErr } = await supabase
        .from("deals")
        .update({ flag_retrocedido: false, motivo_retrocesso: null })
        .eq("id", perdido.id)
        .eq("etapa", etapa)
        .eq("etapa_anterior", "perdido")
        .eq("flag_retrocedido", true)
        .is("motivo_retrocesso", null);
      if (flagErr) console.warn("[aprovarLead] limpar flag_retrocedido falhou", flagErr.message);
    }
    // Perda do mutirão (pré-reunião) deixou de ser verdade; perda orgânica
    // pós-reunião segue no loop de aprendizado.
    if (!houveReuniao) {
      const { error: desfechoErr } = await supabase
        .from("form_submissions")
        .update({ desfecho_real: null })
        .eq("id", String(fs.id))
        .eq("desfecho_real", "perdeu");
      if (desfechoErr) console.warn("[aprovarLead] limpar desfecho_real falhou", desfechoErr.message);
    }
    return resultado(perdido.id, etapa, true, houveReuniao);
  }

  const campos = camposSemHistorico();
  const { data: userData } = await supabase.auth.getUser();
  const { data: novo, error: novoErr } = await supabase
    .from("deals")
    .insert({
      atleta_id: atletaId,
      responsavel_id: userData.user?.id,
      valor_estimado: mapInvestmentToValor(fs.investment_range as string | null),
      status_decisao_familia: "em_discussao",
      safra: "fall_2026",
      ...campos,
    })
    .select("id")
    .single();
  if (novoErr || !novo) return { ok: false, error: `Erro ao criar deal: ${novoErr?.message}` };
  return resultado(String((novo as { id: string }).id), String(campos.etapa), false);
}

export async function aprovarLead(formSubmissionId: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem aprovar leads." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: fs, error: fsError } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("id", formSubmissionId)
    .single();

  if (fsError || !fs) {
    return { success: false, error: "Lead não encontrado." };
  }
  const fsRow = fs as Record<string, unknown>;
  if (fsRow.aprovacao_status !== "pendente") {
    return { success: false, error: "Lead não está mais pendente (já decidido em outra aba?)." };
  }

  // 1. Promoção primeiro (idempotente)
  const promocao = await promoverLeadCore(supabase, fsRow);
  if (!promocao.success) {
    return { success: false, error: `Promoção falhou — lead segue na fila: ${promocao.error}` };
  }

  // 2. CAS: um único vencedor libera a elegibilidade.
  // Reunião já detectada e nenhum envio: o convite inicial ("agende sua
  // reunião") seria indevido — o Bucket A não olha meeting_scheduled. O
  // carimbo no MESMO update (atômico com a aprovação) tira o lead da fila de
  // envio; usa a data da detecção (antiga) para não acusar "envio sem
  // espelho" no monitor.
  const bloquearInicial = fsRow.meeting_scheduled === true && !fsRow.whatsapp_sent_at;
  const { data: casRows, error: casError } = await supabase
    .from("form_submissions")
    .update({
      aprovacao_status: "aprovado",
      aprovacao_decidida_por: userData.user?.id ?? null,
      aprovacao_decidida_em: new Date().toISOString(),
      ...(bloquearInicial
        ? { whatsapp_sent_at: (fsRow.meeting_scheduled_at as string | null) ?? (fsRow.submitted_at as string) }
        : {}),
    })
    .eq("id", formSubmissionId)
    .eq("aprovacao_status", "pendente")
    .select("id");

  if (casError) {
    return { success: false, error: `Erro ao aprovar: ${casError.message}` };
  }
  if (!casRows || casRows.length === 0) {
    // Outra aba decidiu entre a leitura e o CAS. Se aprovou, tudo certo; se
    // REPROVOU, o pipeline recém-criado contradiz a decisão — avisar o CEO.
    const { data: atual } = await supabase
      .from("form_submissions")
      .select("aprovacao_status")
      .eq("id", formSubmissionId)
      .maybeSingle();
    if ((atual as { aprovacao_status?: string } | null)?.aprovacao_status === "aprovado") {
      revalidatePath("/leads");
      revalidatePath("/pipeline");
      // Sem XP aqui: quem venceu o CAS (outra aba) já pontuou.
      return { success: true, atletaId: promocao.atletaId, dealId: promocao.dealId, gamificacao: null };
    }
    return {
      success: false,
      error:
        "Lead foi REPROVADO em outra aba durante a aprovação — o atleta/deal criados precisam de revisão manual no pipeline.",
    };
  }

  // ─── Reativação (ordem do CEO, 2026-08-24) ─────────────────────────────
  // Lead re-aprovado que JÁ recebeu o outreach num ciclo anterior: a
  // aprovação RE-ARMA o ciclo — a 1ª mensagem do novo ciclo é a de
  // REABERTURA ('reactivation', enviada pelo whatsapp-scheduler no próximo
  // tick com o CAS/anti-ban/gate de sempre) e, depois dela, o lead cai no
  // MESMO follow-up (FU1 48h / FU2 7d). meeting_scheduled volta a false
  // (flag de reunião morta do ciclo antigo não blinda os follow-ups novos;
  // se agendarem de novo, o calendar-webhook re-seta). Best-effort: falha
  // aqui não desfaz a aprovação — o CEO vê o lead aprovado e o monitor de
  // filas acusa se o outreach não sair.
  // Deal ativo e visível ANTES de qualquer outreach (bug 2026-10-05).
  const garantia = await garantirDealAtivoNaAprovacao(supabase, promocao.atletaId, fsRow);
  if (!garantia.ok) {
    // ORDEM É SEGURANÇA: o CAS acima já tornou o lead elegível ao disparo
    // inicial. Sem deal visível, desfaz a aprovação (CAS reverso) — o lead
    // volta à fila e nenhuma mensagem sai com o deal escondido.
    console.error("[aprovarLead] deal ativo não garantido — revertendo aprovação", garantia.error);
    let reverter = supabase
      .from("form_submissions")
      .update({
        aprovacao_status: "pendente",
        aprovacao_decidida_por: null,
        aprovacao_decidida_em: null,
        // desfaz também o carimbo anti-convite deste mesmo CAS
        ...(bloquearInicial ? { whatsapp_sent_at: null } : {}),
      })
      .eq("id", formSubmissionId)
      .eq("aprovacao_status", "aprovado");
    if (userData.user?.id) reverter = reverter.eq("aprovacao_decidida_por", userData.user.id);
    const { data: revertidos, error: revertErr } = await reverter.select("id");
    if (revertErr || !revertidos || revertidos.length === 0) {
      console.error("[aprovarLead] reversão da aprovação FALHOU", {
        formSubmissionId,
        erro: revertErr?.message ?? "0 linhas",
      });
      return {
        success: false,
        error: `ATENÇÃO: o deal não pôde ser aberto no pipeline (${garantia.error}) e a aprovação NÃO pôde ser desfeita. O lead está aprovado sem deal visível — confira antes do próximo disparo automático (de hora em hora).`,
      };
    }
    return {
      success: false,
      error: `O deal não pôde ser aberto no pipeline (${garantia.error}). A aprovação foi desfeita — o lead segue na fila.`,
    };
  }
  const dealId = garantia.dealId;
  let aviso: string | null = null;

  // Reunião no HISTÓRICO do deal (ou deal já além da pré-reunião) sem nenhum
  // envio: o convite inicial seria indevido. O CAS acima só sabia do flag do
  // formulário; este carimbo cobre o resto (CAS no próprio NULL, data antiga
  // para não acusar "envio sem espelho" no monitor).
  if (!bloquearInicial && !fsRow.whatsapp_sent_at && garantia.semConviteInicial) {
    // Fecha o ciclo INTEIRO (inicial + FU1 + FU2): só carimbar o inicial
    // liberaria o FU1 "agende sua reunião" 48h depois — o followup-scheduler
    // não olha a etapa do deal.
    const marca = (fsRow.submitted_at as string) ?? new Date(0).toISOString();
    const { data: carimbados, error: carimboErr } = await supabase
      .from("form_submissions")
      .update({ whatsapp_sent_at: marca, followup_1_sent_at: marca, followup_2_sent_at: marca })
      .eq("id", formSubmissionId)
      .is("whatsapp_sent_at", null)
      .select("id");
    if (carimboErr || !carimbados || carimbados.length === 0) {
      console.error("[aprovarLead] bloqueio do convite inicial falhou", {
        formSubmissionId,
        erro: carimboErr?.message ?? "0 linhas (corrida com o disparo?)",
      });
      aviso = `ATENÇÃO: o deal está em "${garantia.etapa}", mas não foi possível bloquear as mensagens automáticas — o convite pode ter saído; confira.`;
    } else {
      aviso = `Aprovado sem mensagem automática: o deal já está em "${garantia.etapa}".`;
    }
  }

  let reativacao = false;
  if (bloquearInicial) {
    aviso = `Aprovado sem mensagem automática: a reunião já foi detectada — deal em "${garantia.etapa}".`;
  }
  if (fsRow.whatsapp_sent_at && !garantia.rearmavel) {
    // Histórico de outreach, mas o deal já avançou (ex.: cliente em
    // admissão) ou o timing é alternativo: aprovar NUNCA re-dispara convite.
    aviso = `Aprovado sem nova mensagem: o deal está em "${garantia.etapa}"${
      fsRow.timing_status && fsRow.timing_status !== "ideal" ? ` e o timing é ${String(fsRow.timing_status)}` : ""
    } — a reativação automática não foi disparada.`;
  }
  if (fsRow.whatsapp_sent_at && garantia.rearmavel) {
    const { error: reativErr } = await supabase
      .from("form_submissions")
      .update({
        reativacao_em: new Date().toISOString(),
        whatsapp_sent_at: null,
        followup_1_sent_at: null,
        followup_2_sent_at: null,
        meeting_scheduled: false,
      })
      .eq("id", formSubmissionId);
    if (reativErr) {
      console.error("[aprovarLead] re-arme de reativação falhou", reativErr.message);
      aviso = "Aprovado, mas o re-arme da mensagem de reativação falhou — o lead não receberá a reabertura automática.";
    } else {
      reativacao = true;
    }
  }

  // Gamificação (fail-open — null nunca quebra a aprovação)
  const gamificacao = await registrarEventoGamificacao(
    "lead_aprovado",
    dealId ? { tipo: "deal", id: dealId } : undefined,
  );

  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/war-room");
  return {
    success: true,
    atletaId: promocao.atletaId,
    dealId,
    gamificacao,
    reativacao,
    dealReaberto: garantia.reaberto,
    aviso,
  };
}

export async function reprovarLead(formSubmissionId: string, motivo?: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem reprovar leads." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  const { data: casRows, error: casError } = await supabase
    .from("form_submissions")
    .update({
      aprovacao_status: "reprovado",
      aprovacao_decidida_por: userData.user?.id ?? null,
      aprovacao_decidida_em: new Date().toISOString(),
      aprovacao_motivo: motivo?.trim() || null,
    })
    .eq("id", formSubmissionId)
    .eq("aprovacao_status", "pendente")
    .select("id");

  if (casError) {
    return { success: false, error: `Erro ao reprovar: ${casError.message}` };
  }
  if (!casRows || casRows.length === 0) {
    return { success: false, error: "Lead não está mais pendente (já decidido em outra aba?)." };
  }

  // Gamificação: decidir também é trabalho (evita viés de aprovar tudo)
  const gamificacao = await registrarEventoGamificacao("lead_reprovado", {
    tipo: "form_submission",
    id: formSubmissionId,
  });

  revalidatePath("/leads");
  revalidatePath("/war-room");
  return { success: true, gamificacao };
}

// ─── Muito cedo — revisão (ordem do CEO, 2026-09-08) ─────────────────────────
// Com as mensagens de timing E a retomada de novembro DESLIGADAS em
// sistema_automacoes_ativas, os leads muito_cedo aprovados ficam estacionados
// em aguardando_timing sem nenhum contato automático. Esta revisão dá ao CEO
// o mesmo dossiê dos Frios (dados + conversa + e-mail) e a decisão manual de
// ativar o lead no funil quando ELE quiser.

const MUITO_CEDO_REVISAO_LIMITE = 80;

export async function listarLeadsMuitoCedoDetalhe(): Promise<
  { success: true; leads: LeadPendenteAprovacao[] } | { success: false; error: string }
> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem revisar leads muito cedo." };
  }
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .select(`${COLUNAS_FILA_APROVACAO}, atletas(id, deals(id, etapa, deleted_at))`)
    .is("deleted_at", null)
    .eq("timing_status", "muito_cedo")
    .in("qualification_classification", ["QUENTE", "MORNO"])
    .eq("aprovacao_status", "aprovado")
    .order("submitted_at", { ascending: false })
    .limit(MUITO_CEDO_REVISAO_LIMITE);
  if (error) return { success: false, error: `Erro ao listar muito cedo: ${error.message}` };

  // Embed 1:1 pode voltar OBJETO (FK UNIQUE) — normalizar SEMPRE (incidente 05/09).
  type DealEmb = { id: string; etapa: string; deleted_at: string | null };
  type AtletaEmb = { deals: DealEmb[] | DealEmb | null };
  type Row = LeadPendenteAprovacao & { atletas: AtletaEmb[] | AtletaEmb | null };
  const asArr = <T,>(v: T[] | T | null | undefined): T[] =>
    Array.isArray(v) ? v : v ? [v] : [];
  const leads = ((data ?? []) as unknown as Row[])
    // Só quem está de fato estacionado: deal ativo em aguardando_timing.
    // Quem já avançou (reunião marcada etc.) sai da revisão sozinho.
    .filter((row) =>
      asArr(row.atletas)
        .flatMap((a) => asArr(a.deals))
        .some((d) => d.deleted_at === null && d.etapa === "aguardando_timing"),
    )
    .map((row) => {
      const { atletas: _embed, ...rest } = row;
      void _embed;
      return rest as LeadPendenteAprovacao;
    });
  return { success: true, leads };
}

export async function ativarLeadMuitoCedo(
  leadId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem ativar um lead muito cedo." };
  }
  const supabase = await createAuditedSupabaseClient();
  const { data: atletas, error: atletaError } = await supabase
    .from("atletas")
    .select("id, deals(id, etapa, deleted_at)")
    .eq("form_submission_id", leadId);
  if (atletaError) {
    return { success: false, error: `Erro ao localizar o deal: ${atletaError.message}` };
  }
  type DealEmb = { id: string; etapa: string; deleted_at: string | null };
  type AtletaRow = { id: string; deals: DealEmb[] | DealEmb | null };
  const asArr = <T,>(v: T[] | T | null | undefined): T[] =>
    Array.isArray(v) ? v : v ? [v] : [];
  const deal = ((atletas ?? []) as unknown as AtletaRow[])
    .flatMap((a) => asArr(a.deals))
    .find((d) => d.deleted_at === null && d.etapa === "aguardando_timing");
  if (!deal) {
    return { success: false, error: "Lead não está mais em Aguardando timing (já ativado?)." };
  }

  const updateData: Record<string, unknown> = { etapa: "lead" };
  const probabilidadePorEtapa = await getProbabilidadePorEtapa();
  if (probabilidadePorEtapa.lead !== undefined) {
    updateData.probabilidade_fechamento = probabilidadePorEtapa.lead;
  }

  // CAS: só sai de aguardando_timing (o trigger isenta essa saída de
  // retrocesso; um deal que avançou em outra aba nunca é puxado de volta).
  const { data: casRows, error: casError } = await supabase
    .from("deals")
    .update(updateData)
    .eq("id", deal.id)
    .eq("etapa", "aguardando_timing")
    .is("deleted_at", null)
    .select("id");
  if (casError) return { success: false, error: `Erro ao ativar: ${casError.message}` };
  if (!casRows || casRows.length === 0) {
    return { success: false, error: "Deal já saiu de Aguardando timing em outra aba." };
  }

  revalidatePath("/pipeline");
  revalidatePath("/war-room");
  return { success: true };
}

/**
 * Reprova um FRIO direto da revisão (pedido do CEO, 2026-09-10): sai da
 * coluna Frios para sempre, sem pipeline e sem mensagens (FRIO já estava
 * fora de todo outreach — isto só registra a decisão humana).
 * CAS: só age sobre FRIO ainda SEM decisão — nunca sobrescreve.
 */
export async function reprovarFrio(
  leadId: string,
  motivo?: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem reprovar um lead frio." };
  }
  const supabase = await createAuditedSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("form_submissions")
    .update({
      aprovacao_status: "reprovado",
      aprovacao_decidida_por: userData.user?.id ?? null,
      aprovacao_decidida_em: new Date().toISOString(),
      aprovacao_motivo: motivo?.trim() || "Reprovado na revisão de Frios",
    })
    .eq("id", leadId)
    .eq("qualification_classification", "FRIO")
    .is("aprovacao_status", null)
    .is("deleted_at", null)
    .select("id");
  if (error) return { success: false, error: `Erro ao reprovar: ${error.message}` };
  if (!data || data.length === 0) {
    return { success: false, error: "Lead não está mais elegível (já revisado ou requalificado)." };
  }
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  return { success: true };
}

// ─── Incompletos — revisão (ordem do CEO, 2026-09-23) ────────────────────────
// INCOMPLETO (classificador v2: profissão/faixa ausentes) ficava invisível —
// fora de fila, board e outreach. Caso real: 6 INCOMPLETOs num único dia
// (21/09), gente de verdade que só preencheu mal. Mesma revisão dos Frios:
// coluna própria, dossiê completo, resgate explícito (padrão Pietro) ou
// reprovação. INVALIDO segue fora de tudo (dado sujo/injeção — proteção).

export interface LeadIncompletoCard {
  id: string;
  athlete_name: string;
  guardian_name: string | null;
  city_state: string | null;
  position: string | null;
  qualification_reason: string | null;
  submitted_at: string;
  meeting_scheduled: boolean | null;
  meeting_scheduled_at: string | null;
}

export async function listarLeadsIncompletosCards(
  opts: { offset?: number; limite?: number } = {},
): Promise<ResultadoPaginaRevisao<LeadIncompletoCard>> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: "Apenas CEO/CTO." };
  // Mesmo recorte dos Frios (view: sem decisão + janela + sem deal ativo, no
  // BANCO). O resgate cria deal — o lead resgatado não duplica no board.
  return paginaCardsRevisao<LeadIncompletoCard>("INCOMPLETO", INCOMPLETOS_REVISAO_DIAS, opts ?? {});
}

/**
 * Dossiê COMPLETO dos incompletos elegíveis — alimenta o modal em modo
 * "incompletos" (mesmas abas Dossiê/Conversa/E-mail), paginado.
 */
export async function listarLeadsIncompletosDetalhe(
  opts: { offset?: number; garantirId?: string } = {},
): Promise<
  | { success: true; leads: LeadPendenteAprovacao[]; total: number; proximoOffset: number }
  | { success: false; error: string }
> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem revisar leads incompletos." };
  }
  return paginaDetalheRevisao("INCOMPLETO", INCOMPLETOS_REVISAO_DIAS, opts ?? {});
}

/**
 * Resgata um INCOMPLETO para a fila de aprovação — literalmente o caso
 * Pietro (aguardava profissão): MORNO provisório + pendente, motivo
 * documentado; requalificação futura sobrescreve. Pendente NUNCA recebe
 * mensagem (gate humano intacto).
 */
export async function enviarIncompletoParaAprovacao(
  leadId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem resgatar um lead incompleto." };
  }
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .update({
      qualification_classification: "MORNO",
      aprovacao_status: "pendente",
      aprovacao_decidida_por: null,
      aprovacao_decidida_em: null,
      aprovacao_motivo:
        "Resgatado da coluna Incompletos para revisão manual (classificação provisória MORNO — completar dados e requalificar)",
    })
    .eq("id", leadId)
    .eq("qualification_classification", "INCOMPLETO")
    .is("aprovacao_status", null)
    .is("deleted_at", null)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) {
    return { success: false, error: "Lead não está mais elegível (já revisado ou requalificado)." };
  }
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  return { success: true };
}

/**
 * Reprova um INCOMPLETO direto da revisão: sai da coluna para sempre, sem
 * pipeline e sem mensagens. CAS: só sobre INCOMPLETO ainda sem decisão.
 */
export async function reprovarIncompleto(
  leadId: string,
  motivo?: string,
): Promise<{ success: true } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem reprovar um lead incompleto." };
  }
  const supabase = await createAuditedSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("form_submissions")
    .update({
      aprovacao_status: "reprovado",
      aprovacao_decidida_por: userData.user?.id ?? null,
      aprovacao_decidida_em: new Date().toISOString(),
      aprovacao_motivo: motivo?.trim() || "Reprovado na revisão de Incompletos",
    })
    .eq("id", leadId)
    .eq("qualification_classification", "INCOMPLETO")
    .is("aprovacao_status", null)
    .is("deleted_at", null)
    .select("id");
  if (error) return { success: false, error: `Erro ao reprovar: ${error.message}` };
  if (!data || data.length === 0) {
    return { success: false, error: "Lead não está mais elegível (já revisado ou requalificado)." };
  }
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  return { success: true };
}
