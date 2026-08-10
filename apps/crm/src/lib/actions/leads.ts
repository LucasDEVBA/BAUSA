"use server";

import { revalidatePath } from "next/cache";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { getProbabilidadePorEtapa } from "@/lib/actions/configuracoes";

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
  athlete_name: string;
  birth_date: string | null;
  email: string;
  athlete_whatsapp: string | null;
  guardian_name: string | null;
  guardian_whatsapp: string | null;
  guardian_email: string | null;
  guardian_profession: string | null;
  instagram: string | null;
  position: string | null;
  club_history: string | null;
  achievements: string | null;
  video_link: string | null;
  current_school: string | null;
  school_year: string | null;
  city_state: string | null;
  address_country: string | null;
  english_level: string | null;
  academic_performance: string | null;
  investment_range: string | null;
  qualification_classification: string | null;
  qualification_reason: string | null;
  qualification_confidence: string | null;
  qualified_at: string | null;
  timing_status: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  device_type: string | null;
  submitted_at: string;
}

const COLUNAS_FILA_APROVACAO =
  "id, athlete_name, birth_date, email, athlete_whatsapp, guardian_name, guardian_whatsapp, " +
  "guardian_email, guardian_profession, instagram, position, club_history, achievements, " +
  "video_link, current_school, school_year, city_state, address_country, english_level, " +
  "academic_performance, investment_range, qualification_classification, qualification_reason, " +
  "qualification_confidence, qualified_at, timing_status, utm_source, utm_campaign, device_type, submitted_at";

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
    .eq("aprovacao_status", "pendente")
    .order("submitted_at", { ascending: true });

  if (error) {
    return { success: false, error: `Erro ao listar fila: ${error.message}` };
  }
  return { success: true, leads: (data ?? []) as unknown as LeadPendenteAprovacao[] };
}

/**
 * Aprova um lead pendente: CAS no status (um único vencedor em caso de
 * duplo clique/aba dupla) e promoção ao CRM. Se a promoção falhar, o status
 * volta para 'pendente' para o CEO tentar de novo — nunca fica "aprovado
 * fantasma" (aprovado sem atleta/deal seria elegível ao WhatsApp sem pipeline).
 */
export async function aprovarLead(formSubmissionId: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem aprovar leads." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  // CAS: só transiciona quem ainda está pendente
  const { data: casRows, error: casError } = await supabase
    .from("form_submissions")
    .update({
      aprovacao_status: "aprovado",
      aprovacao_decidida_por: userData.user?.id ?? null,
      aprovacao_decidida_em: new Date().toISOString(),
    })
    .eq("id", formSubmissionId)
    .eq("aprovacao_status", "pendente")
    .select("*");

  if (casError) {
    return { success: false, error: `Erro ao aprovar: ${casError.message}` };
  }
  if (!casRows || casRows.length === 0) {
    return { success: false, error: "Lead não está mais pendente (já decidido em outra aba?)." };
  }

  const fs = casRows[0] as Record<string, unknown>;
  const promocao = await promoverLeadCore(supabase, fs);

  if (!promocao.success) {
    // Rollback do gate: melhor voltar à fila do que aprovado sem pipeline
    await supabase
      .from("form_submissions")
      .update({ aprovacao_status: "pendente", aprovacao_decidida_por: null, aprovacao_decidida_em: null })
      .eq("id", formSubmissionId)
      .eq("aprovacao_status", "aprovado");
    return { success: false, error: `Aprovação revertida — promoção falhou: ${promocao.error}` };
  }

  revalidatePath("/leads");
  revalidatePath("/pipeline");
  revalidatePath("/war-room");
  return { success: true, atletaId: promocao.atletaId, dealId: promocao.dealId };
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

  revalidatePath("/leads");
  revalidatePath("/war-room");
  return { success: true };
}
