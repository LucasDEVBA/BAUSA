"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { createAdminClient, hasServiceKey } from "@/lib/supabase-admin";
import { getUserPapel } from "@/lib/auth";
import { getProbabilidadePorEtapa, getRotulosEtapas } from "@/lib/actions/configuracoes";
import { excluirLead } from "@/lib/actions/leads-excluir";
import {
  faixaInvestimentoConhecida,
  mapInvestmentToEnum,
  mapInvestmentToValor,
} from "@/lib/faixa-investimento";
import { registrarEventoGamificacao, type ResultadoGamificacao } from "@/lib/gamificacao";
import {
  DETALHE_REVISAO_PAGINA,
  FRIOS_REVISAO_DIAS,
  INCOMPLETOS_REVISAO_DIAS,
  PENDENTES_PAGINA,
  REVISAO_PAGINA,
  paginacaoSegura,
  type ResultadoPaginaRevisao,
} from "@/lib/revisao-leads";

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

  // Faixa fora do dicionário cai no piso (ate_20k / R$ 16.000). Loga para um
  // código novo do formulário não virar estimativa errada silenciosa (T4).
  const investmentRange = (fs.investment_range as string | null) ?? null;
  if (investmentRange && !faixaInvestimentoConhecida(investmentRange)) {
    console.warn(JSON.stringify({
      level: "warn",
      action: "faixa_investimento_desconhecida",
      formSubmissionId: fsId,
      investment_range: investmentRange.slice(0, 40),
    }));
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
      faixa_investimento: mapInvestmentToEnum(investmentRange),
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
    valor_estimado: mapInvestmentToValor(investmentRange),
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
  // T14: reunião detectada no Calendar — badge no dossiê da fila/revisão
  meeting_scheduled: boolean | null;
  meeting_scheduled_at: string | null;
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
  "submitted_at, meeting_scheduled, meeting_scheduled_at";

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
const MS_POR_DIA = 86_400_000;

/**
 * Recorte das colunas de revisão (Frios/Incompletos) em
 * public.vw_cadastros_situacao: classe + SEM decisão + janela + SEM deal
 * ativo — tudo NO BANCO, antes do range (bug T7: o .limit(80) vinha antes do
 * filtro de deal, feito no Node; 114 de 194 FRIOs sumiam do board).
 * Reunião detectada primeiro (T13), depois o mais recente.
 * `dias = null` tira SÓ a janela (lead fora dela aberto pela faixa "Fora do
 * pipeline"); classe + sem decisão + sem deal ativo continuam valendo.
 */
// SÍNCRONA de propósito: o builder do PostgREST é "thenable" — devolvido por
// uma função async, ele seria EXECUTADO no await (e o .range() sumiria).
function consultarRevisao(
  supabase: Awaited<ReturnType<typeof createAuditedSupabaseClient>>,
  classe: ClasseRevisao,
  dias: number | null,
  colunas: string,
  contar: boolean,
) {
  const recorte = supabase
    .from("vw_cadastros_situacao")
    .select(colunas, contar ? { count: "exact" } : undefined)
    .eq("qualification_classification", classe)
    .is("aprovacao_status", null)
    .eq("tem_deal_ativo", false);
  const comJanela =
    dias === null ? recorte : recorte.gte("submitted_at", new Date(Date.now() - dias * MS_POR_DIA).toISOString());
  return comJanela
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

export type ResultadoDetalheRevisao =
  | {
      success: true;
      leads: LeadPendenteAprovacao[];
      /** Total do recorte da coluna (com a janela de dias) — base do "Carregar mais". */
      total: number;
      proximoOffset: number;
      /** Mostrados FORA do recorte (garantirId além da janela, aberto pela faixa
       *  "Fora do pipeline"): não contam no total nem no offset. */
      foraDoRecorte: string[];
    }
  | { success: false; error: string };

/**
 * Dossiê COMPLETO de uma página da revisão (modais Frios/Incompletos).
 * 1) ids da página na view (mesmo recorte das colunas); 2) se o card clicado
 * não está na página (veio de "Mostrar mais" ou da faixa "Fora do pipeline"),
 * entra junto — o modal abre SEMPRE no lead certo; 3) colunas completas em
 * form_submissions por id.
 */
async function paginaDetalheRevisao(
  classe: ClasseRevisao,
  dias: number,
  opts: { offset?: number; garantirId?: string },
): Promise<ResultadoDetalheRevisao> {
  const { offset } = paginacaoSegura(opts, DETALHE_REVISAO_PAGINA);
  // garantirId vem do client: só UUID chega ao filtro (senão é ignorado)
  const garantirId =
    typeof opts.garantirId === "string" && UUID_RE.test(opts.garantirId) ? opts.garantirId : undefined;
  const supabase = await createAuditedSupabaseClient();
  const { data, error, count } = await consultarRevisao(supabase, classe, dias, "id", true)
    .range(offset, offset + DETALHE_REVISAO_PAGINA - 1);
  if (error?.code === "PGRST103") {
    return { success: true, leads: [], total: offset, proximoOffset: offset, foraDoRecorte: [] };
  }
  if (error) return { success: false, error: `Erro ao listar a revisão: ${error.message}` };
  const idsPagina = ((data ?? []) as unknown as { id: string }[]).map((r) => r.id);
  const ids = [...idsPagina];
  const foraDoRecorte: string[] = [];
  if (garantirId && !ids.includes(garantirId)) {
    // SEM a janela (T13/T12): a faixa "Fora do pipeline" abre aqui o FRIO/
    // INCOMPLETO de mais de N dias para aprovar direto. Classe, sem decisão e
    // sem deal ativo continuam exigidos (e o CAS da aprovação reconfere).
    const { data: alvo, error: errAlvo } = await consultarRevisao(supabase, classe, null, "id, submitted_at", false)
      .eq("id", garantirId)
      .maybeSingle();
    if (errAlvo) {
      console.error({ level: "warn", action: "revisao_garantir_lead_falhou", classe, error: errAlvo.message });
    }
    const alvoRow = alvo as unknown as { id: string; submitted_at: string } | null;
    if (alvoRow) {
      ids.unshift(garantirId);
      if (Date.parse(alvoRow.submitted_at) < Date.now() - dias * MS_POR_DIA) foraDoRecorte.push(garantirId);
    }
  }
  if (ids.length === 0) {
    return { success: true, leads: [], total: count ?? 0, proximoOffset: offset, foraDoRecorte };
  }
  const { data: rows, error: errRows } = await supabase
    .from("form_submissions")
    .select(COLUNAS_FILA_APROVACAO)
    .in("id", ids)
    .is("deleted_at", null);
  if (errRows) return { success: false, error: `Erro ao carregar o dossiê: ${errRows.message}` };
  const porId = new Map(((rows ?? []) as unknown as LeadPendenteAprovacao[]).map((r) => [r.id, r]));
  const leads = ids.map((id) => porId.get(id)).filter((l): l is LeadPendenteAprovacao => l !== undefined);
  return {
    success: true,
    leads,
    total: count ?? leads.length,
    proximoOffset: offset + idsPagina.length,
    foraDoRecorte,
  };
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
): Promise<ResultadoDetalheRevisao> {
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

/** Idade mínima do carimbo "fechado sem envio" (> janela de 48h do /observabilidade). */
const IDADE_MIN_CARIMBO_SEM_ENVIO_MS = 72 * 60 * 60 * 1000;

export interface AprovarLeadOpcoes {
  /**
   * T12 — "Aprovar sem mensagem": o CEO já conversou com a família. Fecha o
   * ciclo automático INTEIRO (inicial + FU1 + FU2 e, se muito_cedo, a
   * retomada de novembro) no MESMO update atômico da aprovação e nunca re-arma
   * a reativação. Lead com envio anterior: os FU1/FU2 em aberto fecham antes
   * da promoção (o followup-scheduler não olha aprovacao_status). Lead/deal
   * entram normalmente.
   */
  semMensagemAutomatica?: boolean;
}

export type AprovarLeadResultado =
  | { success: false; error: string }
  | {
      success: true;
      atletaId: string;
      dealId: string;
      gamificacao: ResultadoGamificacao | null;
      reativacao?: boolean;
      dealReaberto?: boolean;
      aviso?: string | null;
      /** Etapa (chave do enum) em que o deal ficou — o client traduz o rótulo. */
      etapa?: string;
    };

export async function aprovarLead(
  formSubmissionId: string,
  opcoes?: AprovarLeadOpcoes,
): Promise<AprovarLeadResultado> {
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
  if (fsRow.deleted_at) {
    return { success: false, error: "Lead excluído — não pode ser aprovado." };
  }
  if (fsRow.aprovacao_status !== "pendente") {
    return { success: false, error: "Lead não está mais pendente (já decidido em outra aba?)." };
  }
  const semMensagem = opcoes?.semMensagemAutomatica === true;
  // Carimbo "fechado sem envio": a data real (detecção/cadastro), mas NUNCA
  // dentro das janelas dos checks de espelho (monitor-health 6h → alerta
  // WhatsApp+e-mail; /observabilidade 48h). Lead recém-chegado aprovado sem
  // mensagem com a data do cadastro viraria "envio sem espelho" falso.
  const baseCicloMs = Date.parse(String(fsRow.meeting_scheduled_at ?? fsRow.submitted_at ?? ""));
  const tetoCicloMs = Date.now() - IDADE_MIN_CARIMBO_SEM_ENVIO_MS;
  const marcaCiclo = new Date(
    Number.isFinite(baseCicloMs) ? Math.min(baseCicloMs, tetoCicloMs) : tetoCicloMs,
  ).toISOString();

  // "Sem mensagem" com histórico de envio (convite de um ciclo anterior, lead
  // requalificado): o followup-scheduler NÃO olha aprovacao_status — FU1/FU2
  // em aberto sairiam no próximo tick (já com o lead MORNO pendente, e com
  // mais razão depois de aprovado). Fecha só os que ainda estão abertos.
  // FU2 também: ele dispara com o FU1 preenchido.
  const fecharFollowupsSemMensagem = semMensagem && Boolean(fsRow.whatsapp_sent_at);
  const fecharFu1SemMensagem = fecharFollowupsSemMensagem && !fsRow.followup_1_sent_at;
  const fecharFu2SemMensagem = fecharFollowupsSemMensagem && !fsRow.followup_2_sent_at;
  if (fecharFu1SemMensagem || fecharFu2SemMensagem) {
    // ANTES da promoção (lead ainda pendente): se qualquer passo seguinte
    // falhar, o lead fica na fila sem FU nenhum a sair — a escolha "sem
    // mensagem" do CEO vale desde o clique. Só FECHA (nunca abre envio); a
    // reversão não os reabre. CAS: só lead ainda pendente e vivo.
    const { error: fuErr } = await supabase
      .from("form_submissions")
      .update({
        ...(fecharFu1SemMensagem ? { followup_1_sent_at: marcaCiclo } : {}),
        ...(fecharFu2SemMensagem ? { followup_2_sent_at: marcaCiclo } : {}),
      })
      .eq("id", formSubmissionId)
      .eq("aprovacao_status", "pendente")
      .is("deleted_at", null);
    if (fuErr) {
      return {
        success: false,
        error: `Não foi possível fechar os follow-ups pendentes — nada foi aprovado: ${fuErr.message}`,
      };
    }
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
  // T12 "Aprovar sem mensagem" (lead sem histórico de envio): fecha inicial +
  // FU1 + FU2 no MESMO update do CAS — sem janela em que o lead fique
  // aprovado e elegível ao disparo. Data antiga (detecção/cadastro) para não
  // acusar "envio sem espelho" no monitor.
  const fecharCicloSemMensagem = semMensagem && !fsRow.whatsapp_sent_at;
  // muito_cedo: a retomada de novembro (scheduled_return) também é mensagem
  // automática — "sem mensagem" fecha ela junto (hoje o toggle já está off).
  const fecharRetomadaSemMensagem =
    semMensagem && fsRow.timing_status === "muito_cedo" && !fsRow.scheduled_followup_sent_at;
  const { data: casRows, error: casError } = await supabase
    .from("form_submissions")
    .update({
      aprovacao_status: "aprovado",
      aprovacao_decidida_por: userData.user?.id ?? null,
      aprovacao_decidida_em: new Date().toISOString(),
      ...(bloquearInicial
        ? { whatsapp_sent_at: (fsRow.meeting_scheduled_at as string | null) ?? (fsRow.submitted_at as string) }
        : {}),
      ...(fecharCicloSemMensagem
        ? { whatsapp_sent_at: marcaCiclo, followup_1_sent_at: marcaCiclo, followup_2_sent_at: marcaCiclo }
        : {}),
      ...(fecharRetomadaSemMensagem ? { scheduled_followup_sent_at: marcaCiclo } : {}),
    })
    .eq("id", formSubmissionId)
    .eq("aprovacao_status", "pendente")
    .is("deleted_at", null)
    .select("id");

  if (casError) {
    return { success: false, error: `Erro ao aprovar: ${casError.message}` };
  }
  if (!casRows || casRows.length === 0) {
    // Outra aba decidiu entre a leitura e o CAS. Se aprovou, tudo certo; se
    // REPROVOU, o pipeline recém-criado contradiz a decisão — avisar o CEO.
    const { data: atual } = await supabase
      .from("form_submissions")
      .select("aprovacao_status, deleted_at")
      .eq("id", formSubmissionId)
      .maybeSingle();
    if ((atual as { deleted_at?: string | null } | null)?.deleted_at) {
      // Excluído em outra aba DURANTE a aprovação: o promoverLeadCore pode ter
      // criado atleta/deal para um lead excluído — e eles não aparecem em
      // tela nenhuma (board suspende lead pendente; /leads e a faixa filtram
      // fs excluída). excluir_lead é idempotente: com a fs já excluída cai no
      // caminho de reparo e recolhe esses vínculos aqui mesmo.
      const reparo = await excluirLead(formSubmissionId);
      if (!reparo.success) {
        console.error({
          level: "error",
          action: "aprovar_lead_reparo_exclusao_falhou",
          formSubmissionId,
          error: reparo.error,
        });
        return {
          success: false,
          error: `O lead foi EXCLUÍDO em outra aba durante a aprovação e a remoção do atleta/deal criados agora falhou (${reparo.error.replace(/\.$/, "")}). Avise o suporte com o nome do atleta.`,
        };
      }
      return {
        success: false,
        error:
          "O lead foi EXCLUÍDO em outra aba durante a aprovação — nada foi aprovado e o atleta/deal criados agora foram removidos.",
      };
    }
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
        // e o fechamento do ciclo do "Aprovar sem mensagem" (lead SEM envio
        // volta à fila como estava: pendente sem whatsapp_sent_at não recebe
        // nada — Bucket A/B exigem aprovado e o FU exige o envio inicial).
        // Os FU1/FU2 fechados de lead COM histórico ficam fechados de
        // propósito: o followup-scheduler não olha aprovacao_status, então
        // reabri-los mandaria o follow-up que o CEO recusou com o lead ainda
        // pendente. "Aprovar lead" depois, se o deal for rearmável, re-arma o
        // ciclo (zera os FUs); senão nenhum FU "agende sua reunião" cabe.
        ...(fecharCicloSemMensagem
          ? { whatsapp_sent_at: null, followup_1_sent_at: null, followup_2_sent_at: null }
          : {}),
        ...(fecharRetomadaSemMensagem ? { scheduled_followup_sent_at: null } : {}),
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
  // T17: o aviso mostra o NOME DA COLUNA (rótulo do CEO), nunca o código.
  const rotulos: Record<string, string> = await getRotulosEtapas();
  const colunaDoDeal = rotulos[garantia.etapa] ?? garantia.etapa;

  // Reunião no HISTÓRICO do deal (ou deal já além da pré-reunião) sem nenhum
  // envio: o convite inicial seria indevido. O CAS acima só sabia do flag do
  // formulário; este carimbo cobre o resto (CAS no próprio NULL, data antiga
  // para não acusar "envio sem espelho" no monitor).
  if (!bloquearInicial && !fsRow.whatsapp_sent_at && garantia.semConviteInicial && !fecharCicloSemMensagem) {
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
      aviso = `ATENÇÃO: o deal está em "${colunaDoDeal}", mas não foi possível bloquear as mensagens automáticas — o convite pode ter saído; confira.`;
    } else {
      aviso = `Aprovado sem mensagem automática: o deal já está em "${colunaDoDeal}".`;
    }
  }

  let reativacao = false;
  if (bloquearInicial) {
    aviso = `Aprovado sem mensagem automática: a reunião já foi detectada — deal em "${colunaDoDeal}".`;
  }
  if (fsRow.whatsapp_sent_at && !garantia.rearmavel) {
    // Histórico de outreach, mas o deal já avançou (ex.: cliente em
    // admissão) ou o timing é alternativo: aprovar NUNCA re-dispara convite.
    aviso = `Aprovado sem nova mensagem: o deal está em "${colunaDoDeal}"${
      fsRow.timing_status && fsRow.timing_status !== "ideal" ? ` e o timing é ${String(fsRow.timing_status)}` : ""
    } — a reativação automática não foi disparada.`;
  }
  if (fsRow.whatsapp_sent_at && garantia.rearmavel) {
    if (semMensagem) {
      // T12: o CEO escolheu aprovar SEM mensagem — nem a reabertura sai (e os
      // FU1/FU2 em aberto já foram fechados antes da promoção).
      aviso = `Aprovado sem mensagem automática: a reativação (reabertura) não foi re-armada${
        fecharFu1SemMensagem || fecharFu2SemMensagem ? " e os follow-ups pendentes foram fechados" : ""
      }.`;
    } else {
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
    etapa: garantia.etapa,
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

// ─── Aprovação DIRETA na revisão de Frios/Incompletos (T12, CEO 2026-09-28) ──
// "Não tem sentido revisar, ver que o perfil é qualificado e ter que enviar
// pra fila pra aprovar em outro lugar." Um clique = o MESMO caminho de dois:
// (1) o CAS do resgate (classe de origem + sem decisão → MORNO provisório +
// pendente, motivo registrado) e (2) aprovarLead — promoção idempotente, CAS
// pendente→aprovado, deal garantido/visível, bloqueio de convite com reunião,
// gamificação. NUNCA grava 'aprovado' por conta própria: a elegibilidade dos
// schedulers (QUENTE/MORNO + timing + aprovado) só nasce dentro do aprovarLead.
// Se o aprovarLead falhar, o lead fica MORNO + pendente na fila: sem convite
// inicial nem reabertura (Bucket A/B exigem aprovado). Ressalva: lead com
// envio de ciclo anterior e FU em aberto é elegível ao followup-scheduler
// (não olha aprovacao_status) — por isso o "sem mensagem" fecha os FUs antes
// de promover e a reversão não os reabre.
// Posição: ANTES de listarLeadsMuitoCedoDetalhe — o guard
// pipeline-frios-colunas recorta leads.ts de ativarLeadMuitoCedo até o FIM.

const ORIGENS_REVISAO = ["FRIO", "INCOMPLETO"] as const;
type OrigemRevisao = (typeof ORIGENS_REVISAO)[number];
const ROTULO_REVISAO: Record<OrigemRevisao, string> = { FRIO: "Frios", INCOMPLETO: "Incompletos" };

const aprovarDaRevisaoSchema = z.object({
  leadId: z.string().uuid(),
  origem: z.enum(ORIGENS_REVISAO),
  semMensagemAutomatica: z.boolean().optional(),
});

export type AprovarDaRevisaoResultado =
  | {
      success: true;
      dealId: string;
      /** Chave da etapa do deal (o client traduz pelo stageConfig). */
      etapa: string | null;
      semMensagem: boolean;
      /** Lead com envio de ciclo anterior: a 1ª mensagem é a REABERTURA, não o convite inicial. */
      reativacao: boolean;
      dealReaberto: boolean;
      aviso: string | null;
      gamificacao: ResultadoGamificacao | null;
    }
  | {
      success: false;
      error: string;
      /** inalterado = nada mudou · na_fila = ficou MORNO+pendente em Aguardando
       *  aprovação · atencao = aprovado sem deal visível (reversão falhou). */
      estado: "inalterado" | "na_fila" | "atencao";
    };

/** Trilha explícita (form_submissions não tem trigger de audit). Best-effort. */
async function registrarAuditAprovacaoDaRevisao(params: {
  leadId: string;
  userId: string | null;
  origem: OrigemRevisao;
  score: number | null;
  semMensagem: boolean;
  dealId: string;
  etapa: string | null;
  motivo: string;
}): Promise<void> {
  if (!hasServiceKey()) {
    console.error({ level: "warn", action: "aprovar_da_revisao_audit_indisponivel", leadId: params.leadId });
    return;
  }
  try {
    const admin = createAdminClient();
    // Papel REAL (cto ≠ ceo na trilha — paridade com os triggers de audit).
    let papelReal = "ceo";
    if (params.userId) {
      const { data: perfil } = await admin
        .from("user_profiles")
        .select("papel")
        .eq("id", params.userId)
        .maybeSingle();
      papelReal = (perfil as { papel?: string } | null)?.papel ?? papelReal;
    }
    const { error } = await admin.from("audit_logs").insert({
      tabela: "form_submissions",
      registro_id: params.leadId,
      operacao: "UPDATE",
      dados_anteriores: {
        qualification_classification: params.origem,
        aprovacao_status: null,
        score_financeiro: params.score,
      },
      dados_novos: {
        qualification_classification: "MORNO",
        aprovacao_status: "aprovado",
        origem: `revisao_${params.origem.toLowerCase()}`,
        sem_mensagem_automatica: params.semMensagem,
        deal_id: params.dealId,
        etapa: params.etapa,
      },
      campos_alterados: ["qualification_classification", "aprovacao_status"],
      user_id: params.userId,
      user_papel: papelReal,
      justificativa: params.motivo,
    });
    if (error) {
      console.error({ level: "warn", action: "aprovar_da_revisao_audit_falhou", leadId: params.leadId, error: error.message });
    }
  } catch (err) {
    console.error({
      level: "warn",
      action: "aprovar_da_revisao_audit_falhou",
      leadId: params.leadId,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}

export async function aprovarLeadDaRevisao(
  leadId: string,
  origem: OrigemRevisao,
  opcoes?: { semMensagemAutomatica?: boolean },
): Promise<AprovarDaRevisaoResultado> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, estado: "inalterado", error: "Apenas CEO/CTO podem aprovar leads." };
  }
  const parsed = aprovarDaRevisaoSchema.safeParse({
    leadId,
    origem,
    semMensagemAutomatica: opcoes?.semMensagemAutomatica,
  });
  if (!parsed.success) {
    return { success: false, estado: "inalterado", error: "Dados inválidos para aprovar." };
  }
  const semMensagem = parsed.data.semMensagemAutomatica === true;
  const origemOk = parsed.data.origem;

  const supabase = await createAuditedSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  // Score só compõe o motivo (texto) — a decisão é do CAS abaixo.
  const { data: atual, error: leituraErr } = await supabase
    .from("form_submissions")
    .select("score_financeiro")
    .eq("id", parsed.data.leadId)
    .maybeSingle();
  if (leituraErr) {
    return { success: false, estado: "inalterado", error: `Erro ao ler o lead: ${leituraErr.message}` };
  }
  const score = (atual as { score_financeiro: number | null } | null)?.score_financeiro ?? null;
  const motivo =
    `Aprovado direto na revisão de ${ROTULO_REVISAO[origemOk]} ` +
    `(classe original ${origemOk}, score ${score ?? "—"}) — MORNO provisório` +
    (semMensagem ? " · sem mensagem automática" : "");

  // 1. CAS do resgate — MESMO filtro de enviarFrio/IncompletoParaAprovacao.
  const { data: casRows, error: casErr } = await supabase
    .from("form_submissions")
    .update({
      qualification_classification: "MORNO",
      aprovacao_status: "pendente",
      aprovacao_decidida_por: null,
      aprovacao_decidida_em: null,
      aprovacao_motivo: motivo,
    })
    .eq("id", parsed.data.leadId)
    .eq("qualification_classification", origemOk)
    .is("aprovacao_status", null)
    .is("deleted_at", null)
    .select("id");
  if (casErr) return { success: false, estado: "inalterado", error: `Erro ao aprovar: ${casErr.message}` };
  if (!casRows || casRows.length === 0) {
    return {
      success: false,
      estado: "inalterado",
      error: "Lead não está mais elegível (já revisado, excluído ou requalificado em outra aba).",
    };
  }

  // 2. Aprovação pelo caminho ÚNICO.
  const res = await aprovarLead(parsed.data.leadId, { semMensagemAutomatica: semMensagem });
  if (!res.success) {
    // 3. Relê o estado para contar a verdade ao CEO (não presumir).
    const { data: depois } = await supabase
      .from("form_submissions")
      .select("aprovacao_status, qualification_classification, deleted_at")
      .eq("id", parsed.data.leadId)
      .maybeSingle();
    const estadoDepois = depois as {
      aprovacao_status: string | null;
      qualification_classification: string | null;
      deleted_at: string | null;
    } | null;
    const status = estadoDepois?.aprovacao_status ?? null;
    console.error({
      level: "error",
      action: "aprovar_da_revisao_falhou",
      leadId: parsed.data.leadId,
      origem: origemOk,
      statusDepois: status,
      error: res.error,
    });
    revalidatePath("/pipeline");
    revalidatePath("/leads");
    if (status === "pendente" && !estadoDepois?.deleted_at) {
      const falha = res.error.replace(/\.$/, "");
      return {
        success: false,
        estado: "na_fila",
        // A fila tem os dois botões: "Aprovar lead" de lá LIBERA as mensagens —
        // quem escolheu "sem mensagem" precisa saber qual apertar.
        error: semMensagem
          ? `O lead foi para Aguardando aprovação (MORNO provisório), mas a aprovação falhou (${falha}). Para manter SEM mensagem, aprove por lá em "Aprovar sem mensagem" — "Aprovar lead" na fila libera as mensagens automáticas.`
          : `O lead foi para Aguardando aprovação (MORNO provisório), mas a aprovação falhou (${falha}). Aprove por lá.`,
      };
    }
    // Só é "inalterado" se o lead VOLTOU à revisão (requalificação devolveu a
    // classe de origem sem decisão). Qualquer outro estado (aprovado sem deal,
    // reprovado/excluído em outra aba) saiu da revisão: atenção.
    if (status === null && !estadoDepois?.deleted_at && estadoDepois?.qualification_classification === origemOk) {
      return { success: false, estado: "inalterado", error: res.error };
    }
    return { success: false, estado: "atencao", error: res.error };
  }

  await registrarAuditAprovacaoDaRevisao({
    leadId: parsed.data.leadId,
    userId: userData.user?.id ?? null,
    origem: origemOk,
    score,
    semMensagem,
    dealId: res.dealId,
    etapa: res.etapa ?? null,
    motivo,
  });

  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/war-room");
  return {
    success: true,
    dealId: res.dealId,
    etapa: res.etapa ?? null,
    semMensagem,
    reativacao: res.reativacao ?? false,
    dealReaberto: res.dealReaberto ?? false,
    aviso: res.aviso ?? null,
    gamificacao: res.gamificacao,
  };
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
): Promise<ResultadoDetalheRevisao> {
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
