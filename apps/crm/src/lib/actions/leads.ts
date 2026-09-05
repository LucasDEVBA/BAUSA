"use server";

import { revalidatePath } from "next/cache";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { getProbabilidadePorEtapa } from "@/lib/actions/configuracoes";
import { registrarEventoGamificacao } from "@/lib/gamificacao";

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
  };

  if (timingStatus === "muito_cedo") {
    const proximoAno = new Date().getFullYear() + 1;
    Object.assign(dealBase, {
      etapa: "aguardando_timing",
      probabilidade_fechamento: 5,
      next_action: "Retomar contato em novembro (lead muito cedo)",
      data_proxima_acao: `${proximoAno}-11-01`,
    });
  } else if (timingStatus === "tarde_demais") {
    Object.assign(dealBase, {
      etapa: "perdido",
      probabilidade_fechamento: 0,
      motivo_perda: "timing",
      detalhe_perda: "Lead chegou tarde demais (graduated_2plus)",
      pode_reativar: true,
    });
  } else {
    Object.assign(dealBase, {
      etapa: "lead",
      probabilidade_fechamento: probabilidadePorEtapa["lead"] ?? 10,
    });
  }

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
  "guardian_email, guardian_whatsapp, guardian_profession, address_cep, address_street, " +
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
  qualification_classification: string | null;
  city_state: string | null;
  position: string | null;
  timing_status: string | null;
  submitted_at: string;
}

/**
 * Cards da coluna "Aguardando aprovação" do Kanban.
 *
 * A coluna é alimentada pela FILA (form_submissions), não por deals: o deal só
 * nasce na aprovação. Assim o board mostra o funil inteiro sem que um lead
 * não-aprovado entre em métrica, automação ou outreach.
 */
export async function listarLeadsPendentesCards(): Promise<LeadPendenteCard[]> {
  if ((await getUserPapel()) !== "ceo") return [];
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .select("id, athlete_name, qualification_classification, city_state, position, timing_status, submitted_at")
    .is("deleted_at", null)
    .eq("aprovacao_status", "pendente")
    .in("qualification_classification", ["QUENTE", "MORNO"])
    .order("submitted_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as unknown as LeadPendenteCard[];
}

export interface LeadFrioCard {
  id: string;
  athlete_name: string;
  city_state: string | null;
  position: string | null;
  score_financeiro: number | null;
  qualification_reason: string | null;
  submitted_at: string;
}

/** Janela da coluna Frios: só FRIOs recentes entram na revisão. */
const FRIOS_REVISAO_DIAS = 90;
const FRIOS_REVISAO_LIMITE = 80;

/**
 * Cards da coluna "Frios — revisão" do Kanban (pedido do CEO, 2026-09-04):
 * FRIO deixava de aparecer em qualquer lugar do board; agora os últimos 90
 * dias ficam visíveis para revisão humana. SÓ leitura + resgate explícito —
 * FRIO continua fora de fila, pipeline, métricas e outreach (invariantes
 * intactos). Exclui quem já tem deal (rebaixados do mutirão vivem em Perdido).
 */
export async function listarLeadsFriosCards(): Promise<LeadFrioCard[]> {
  if ((await getUserPapel()) !== "ceo") return [];
  const corte = new Date(Date.now() - FRIOS_REVISAO_DIAS * 86400000).toISOString();
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .select(
      "id, athlete_name, city_state, position, score_financeiro, qualification_reason, submitted_at, atletas(id, deals(id, deleted_at))",
    )
    .is("deleted_at", null)
    .eq("qualification_classification", "FRIO")
    .is("aprovacao_status", null)
    .gte("submitted_at", corte)
    .order("submitted_at", { ascending: false })
    .limit(FRIOS_REVISAO_LIMITE);
  if (error) return [];

  // PostgREST: atletas.form_submission_id é UNIQUE → o embed volta como
  // OBJETO (1:1), não array (incidente 2026-09-05: flatMap em objeto
  // derrubou /pipeline em PRD; a anon key não lê atletas e mascarou o
  // formato no teste). Normaliza os dois formatos, nas duas camadas.
  type DealEmb = { id: string; deleted_at: string | null };
  type AtletaEmb = { deals: DealEmb[] | DealEmb | null };
  type Row = LeadFrioCard & { atletas: AtletaEmb[] | AtletaEmb | null };
  const asArray = <T,>(v: T[] | T | null | undefined): T[] =>
    Array.isArray(v) ? v : v ? [v] : [];
  return ((data ?? []) as unknown as Row[])
    .filter((row) => {
      const deals = asArray(row.atletas).flatMap((a) => asArray(a.deals));
      return !deals.some((d) => d.deleted_at === null);
    })
    .map((row) => ({
      id: row.id,
      athlete_name: row.athlete_name,
      city_state: row.city_state,
      position: row.position,
      score_financeiro: row.score_financeiro,
      qualification_reason: row.qualification_reason,
      submitted_at: row.submitted_at,
    }));
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

  // 2. CAS: um único vencedor libera a elegibilidade
  const { data: casRows, error: casError } = await supabase
    .from("form_submissions")
    .update({
      aprovacao_status: "aprovado",
      aprovacao_decidida_por: userData.user?.id ?? null,
      aprovacao_decidida_em: new Date().toISOString(),
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
  let reativacao = false;
  if (fsRow.whatsapp_sent_at) {
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
    } else {
      reativacao = true;
    }
  }

  // Gamificação (fail-open — null nunca quebra a aprovação)
  const gamificacao = await registrarEventoGamificacao(
    "lead_aprovado",
    promocao.dealId ? { tipo: "deal", id: promocao.dealId } : undefined,
  );

  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/war-room");
  return { success: true, atletaId: promocao.atletaId, dealId: promocao.dealId, gamificacao, reativacao };
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
