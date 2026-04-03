import { createAuditedSupabaseClient } from "../client/audit";
import { getUserPapel } from "../auth";

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

export async function promoverLead(formSubmissionId: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode promover leads." };
  }

  const supabase = await createAuditedSupabaseClient();

  // 1. Buscar form_submission
  const { data: fs, error: fsError } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("id", formSubmissionId)
    .single();

  if (fsError || !fs) {
    return { success: false, error: "Lead nao encontrado." };
  }

  // 2. Verificar se já foi promovido
  const { data: existing } = await supabase
    .from("atletas")
    .select("id")
    .eq("form_submission_id", formSubmissionId)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "Este lead ja foi promovido para o CRM." };
  }

  // 3. Verificar/criar responsável (dedup por whatsapp)
  let responsavelId: string;
  const whatsapp = fs.guardian_whatsapp || fs.email;

  if (whatsapp) {
    const { data: existingResp } = await supabase
      .from("responsaveis")
      .select("id")
      .eq("whatsapp", whatsapp)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingResp) {
      responsavelId = existingResp.id;
    } else {
      const { data: newResp, error: respError } = await supabase
        .from("responsaveis")
        .insert({
          nome: fs.guardian_name || "Responsavel",
          email: fs.guardian_email || fs.email,
          whatsapp: whatsapp,
          profissao: fs.guardian_profession,
          consentimento_lgpd: true,
          aceite_whatsapp: true,
          aceite_email: true,
          form_submission_ids: [fs.id],
        })
        .select("id")
        .single();

      if (respError || !newResp) {
        return { success: false, error: `Erro ao criar responsavel: ${respError?.message}` };
      }
      responsavelId = newResp.id;
    }
  } else {
    return { success: false, error: "Lead sem WhatsApp ou email do responsavel." };
  }

  // 4. Criar endereço (se tiver dados)
  let enderecoId: string | null = null;
  if (fs.city_state || fs.family_address) {
    const { data: newEnd } = await supabase
      .from("enderecos")
      .insert({
        cidade: fs.city_state || "N/A",
        pais: fs.address_country || "BR",
      })
      .select("id")
      .single();

    enderecoId = newEnd?.id || null;
  }

  // 5. Criar atleta
  const { data: atleta, error: atletaError } = await supabase
    .from("atletas")
    .insert({
      nome_completo: fs.athlete_name,
      data_nascimento: fs.birth_date || "2008-01-01",
      whatsapp: fs.guardian_whatsapp || fs.email,
      email: fs.email,
      instagram: fs.instagram,
      esporte: fs.position ? "Futebol" : "Outro",
      posicao: fs.position,
      nivel_competitivo: "base_medio",
      nivel_ingles: mapNivelIngles(fs.english_level),
      desempenho_academico: mapDesempenho(null),
      serie_escolar: mapSchoolYear(fs.school_year),
      escola_atual: fs.current_school,
      cidade_estado: fs.city_state || "N/A",
      video_highlights_url: fs.video_link,
      historico_clubes: fs.club_history,
      conquistas: fs.achievements,
      momento_inicio: "proximo_semestre",
      comprometimento: "medio",
      decisao_familiar: "em_discussao",
      faixa_investimento: mapInvestmentToEnum(fs.investment_range),
      safra: "fall_2026",
      responsavel_id: responsavelId,
      form_submission_id: fs.id,
      origem: "formulario_web",
      consentimento_lgpd: true,
    })
    .select("id")
    .single();

  if (atletaError || !atleta) {
    return { success: false, error: `Erro ao criar atleta: ${atletaError?.message}` };
  }

  // 6. Criar deal
  const { data: { user } } = await supabase.auth.getUser();

  const { data: deal, error: dealError } = await supabase
    .from("deals")
    .insert({
      atleta_id: atleta.id,
      etapa: "lead",
      responsavel_id: user?.id,
      valor_estimado: mapInvestmentToValor(fs.investment_range),
      probabilidade_fechamento: 10,
      status_decisao_familia: "em_discussao",
      safra: "fall_2026",
    })
    .select("id")
    .single();

  if (dealError || !deal) {
    return { success: false, error: `Erro ao criar deal: ${dealError?.message}` };
  }

  return { success: true, atletaId: atleta.id, dealId: deal.id };
}
