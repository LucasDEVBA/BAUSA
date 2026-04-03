import { createServerSupabaseClient } from "@/lib/supabase-server";
import { FamiliasCrmClient } from "./client";
import type { Family, FamilyJourneyStage, FamilyStatus, FamilyTemperature } from "@/types/family";

// Mapeia crm_experiencia (com joins) para o tipo Family do componente
function mapExperienciaToFamily(row: Record<string, unknown>): Family {
  const atleta = row.atleta as Record<string, unknown> | null;
  const responsavel = atleta?.responsavel as Record<string, unknown> | null;
  const deal = row.deal as Record<string, unknown> | null;
  const contrato = deal?.contrato as Record<string, unknown>[] | null;
  const primeiroContrato = Array.isArray(contrato) ? contrato[0] : contrato;

  const planMap: Record<string, "Journey" | "Legacy" | "Start"> = {
    journey: "Journey",
    legacy: "Legacy",
    start: "Start",
  };

  const planoRaw = (primeiroContrato?.plano as string) ?? "";
  const plan = planMap[planoRaw] ?? "Journey";

  const fase = (row.fase as string) ?? "admissao";
  const temperatura = (row.temperatura as string) ?? "verde";
  const status = (row.status as string) ?? "satisfeita";

  const lastContact = (row.data_ultimo_contato as string) ?? new Date().toISOString();
  const daysWithout = Math.floor(
    (Date.now() - new Date(lastContact).getTime()) / 86400000
  );

  return {
    id: row.id as string,
    athlete_name: (atleta?.nome_completo as string) ?? "Atleta",
    athlete_position: (atleta?.posicao as string) ?? undefined,
    guardian_name: (responsavel?.nome as string) ?? "Responsavel",
    email: (atleta?.email as string) ?? "",
    whatsapp: (responsavel?.whatsapp as string) ?? (atleta?.whatsapp as string) ?? "",
    plan,
    journey_stage: fase as FamilyJourneyStage,
    family_status: status as FamilyStatus,
    temperature: temperatura as FamilyTemperature,
    anxiety_level: Number(row.ansiedade) || 1,
    satisfaction_level: Number(row.satisfacao) || 3,
    perceived_risk: Number(row.risco_percebido) || 1,
    risk_profile: [
      { dimension: "academico", score: 2 },
      { dimension: "esportivo", score: 1 },
      { dimension: "emocional", score: Number(row.ansiedade) >= 4 ? 4 : 2 },
      { dimension: "financeiro", score: 2 },
      { dimension: "relacional", score: 2 },
      { dimension: "comunicacao", score: 2 },
    ],
    last_contact_at: lastContact,
    last_contact_type: "whatsapp",
    next_contact_date: (row.proximo_contato as string) ?? new Date(Date.now() + 7 * 86400000).toISOString(),
    days_without_contact: daysWithout,
    contract_value_brl: Number(primeiroContrato?.valor_total) || 0,
    contracted_at: (row.created_at as string) ?? "",
    target_school: undefined,
    target_sport: (atleta?.esporte as string) ?? undefined,
    address_state: (atleta?.cidade_estado as string)?.split("/").pop()?.trim() ?? undefined,
    attention_records: row.descricao_problema
      ? [{
          id: `att-${row.id}`,
          problem_description: row.descricao_problema as string,
          action_ongoing: (row.acao_em_andamento as string) ?? "Acompanhamento em andamento",
          next_action: "Verificar na proxima interacao",
          recorded_at: (row.updated_at as string) ?? new Date().toISOString(),
        }]
      : [],
    crisis_records: status === "crise" && row.descricao_problema
      ? [{
          id: `cr-${row.id}`,
          description: row.descricao_problema as string,
          crisis_type: (row.tipo_crise as string) ?? "Geral",
          crisis_level: (Number(row.nivel_crise === "critico" ? 5 : row.nivel_crise === "alto" ? 4 : row.nivel_crise === "medio" ? 3 : row.nivel_crise === "baixo" ? 2 : 3)) as 1 | 2 | 3 | 4 | 5,
          action_taken: (row.acao_em_andamento as string) ?? "Protocolo de crise acionado",
          psychologist_activated: Boolean(row.psicologa_acionada),
          recorded_at: (row.updated_at as string) ?? new Date().toISOString(),
        }]
      : [],
    tipo_crise: (row.tipo_crise as string) ?? null,
    nivel_crise: (row.nivel_crise as string) ?? null,
    psicologa_acionada: Boolean(row.psicologa_acionada),
    psicologa_acionada_at: (row.psicologa_acionada_at as string) ?? null,
    retencao_segundo_ano: row.retencao_segundo_ano as boolean | null ?? null,
    nps_6meses: row.nps_6meses != null ? Number(row.nps_6meses) : null,
    nps_enviado_at: (row.nps_enviado_at as string) ?? null,
    indicacoes_geradas: Number(row.indicacoes_geradas) || 0,
    escola_confirmada_id: (row.escola_confirmada_id as string) ?? null,
    next_milestone: "Proximo marco do processo",
    next_milestone_date: (row.proximo_contato as string) ?? new Date(Date.now() + 14 * 86400000).toISOString(),
    consultant: "Leandro Ribeiro",
  };
}

export default async function FamiliasCrmPage() {
  const supabase = await createServerSupabaseClient();

  const { data: rawExperiencias } = await supabase
    .from("crm_experiencia")
    .select(`
      *,
      atleta:atletas(nome_completo, posicao, whatsapp, email, esporte, cidade_estado,
        responsavel:responsaveis(nome, whatsapp)),
      deal:deals(id, etapa, valor_estimado, contrato:contratos_financeiros(plano, valor_total))
    `)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  const families: Family[] = (rawExperiencias ?? []).map(
    (row) => mapExperienciaToFamily(row as Record<string, unknown>)
  );

  // Metricas calculadas
  const metrics = {
    total: families.length,
    satisfeita: families.filter((f) => f.family_status === "satisfeita").length,
    atencao: families.filter((f) => f.family_status === "atencao").length,
    crise: families.filter((f) => f.family_status === "crise").length,
    avg_satisfaction: families.length > 0
      ? +(families.reduce((s, f) => s + f.satisfaction_level, 0) / families.length).toFixed(1)
      : 0,
    avg_anxiety: families.length > 0
      ? +(families.reduce((s, f) => s + f.anxiety_level, 0) / families.length).toFixed(1)
      : 0,
    temperatura_verde: families.filter((f) => f.temperature === "verde").length,
    temperatura_amarelo: families.filter((f) => f.temperature === "amarelo").length,
    temperatura_vermelho: families.filter((f) => f.temperature === "vermelho").length,
  };

  return <FamiliasCrmClient families={families} metrics={metrics} />;
}
