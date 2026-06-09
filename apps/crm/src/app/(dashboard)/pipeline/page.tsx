import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PipelineMetricsBar } from "@/components/pipeline/PipelineMetricsBar";
import { PipelineExportButton } from "@/components/pipeline/PipelineExportButton";
import { FutureLeadsSection } from "@/components/pipeline/FutureLeadsSection";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { type Deal, type DealStage } from "@/types/deal";
import { type LeadClassification } from "@/types/lead";

function mapClassificacao(cls: string | null): LeadClassification {
  if (!cls) return "FRIO";
  if (cls === "hot") return "QUENTE";
  if (cls === "warm") return "MORNO";
  return "FRIO";
}

function mapInvestmentRange(faixa: string | null): string {
  if (!faixa) return "";
  const map: Record<string, string> = {
    "40k_mais": "40k-50k",
    "30k_40k": "30k-40k",
    "20k_30k": "20k-30k",
    "ate_20k": "15k-20k",
  };
  return map[faixa] ?? faixa;
}

interface SupabaseDealRow {
  id: string;
  etapa: string;
  valor_estimado: number | null;
  next_action: string | null;
  data_proxima_acao: string | null;
  responsavel_id: string | null;
  created_at: string;
  updated_at: string;
  motivo_perda: string | null;
  detalhe_perda: string | null;
  flag_retrocedido: boolean;
  motivo_retrocesso: string | null;
  notas_reuniao: string | null;
  contrato_assinado_at: string | null;
  sinal_pago_at: string | null;
  pode_reativar: boolean | null;
  data_reativacao: string | null;
  projeto_futuro_ano: number | null;
  projeto_futuro_data_reativacao: string | null;
  deleted_at: string | null;
  flag_valores_customizados: boolean;
  reuniao_agendada_at: string | null;
  reuniao_link: string | null;
  reuniao_data: string | null;
  atleta: {
    id: string;
    nome_completo: string;
    posicao: string | null;
    esporte: string | null;
    serie_escolar: string | null;
    lead_classificacao: string | null;
    whatsapp: string | null;
    faixa_investimento: string | null;
    cidade_estado: string | null;
    lead_score: number | null;
    qualificado_gemini: boolean | null;
    classificacao_gemini: string | null;
    motivo_gemini: string | null;
    confianca_gemini: string | null;
    qualificado_gemini_at: string | null;
    nivel_ingles: string | null;
    nivel_competitivo: string | null;
    instagram: string | null;
    video_highlights_url: string | null;
    escola_atual: string | null;
    desempenho_academico: string | null;
    historico_clubes: string | null;
    conquistas: string | null;
    data_nascimento: string | null;
    email: string | null;
    comprometimento: string | null;
    decisao_familiar: string | null;
    modelo_educacional: string | null;
    momento_inicio: string | null;
    responsavel_id: string | null;
    consentimento_lgpd: boolean | null;
    form_submission: {
      submitted_at: string | null;
      whatsapp_sent_at: string | null;
      followup_1_sent_at: string | null;
      followup_2_sent_at: string | null;
      meeting_scheduled: boolean | null;
      meeting_scheduled_at: string | null;
      qualification_reason: string | null;
      qualification_confidence: string | null;
      qualified_at: string | null;
      guardian_name: string | null;
      guardian_profession: string | null;
      guardian_email: string | null;
    } | null;
  } | null;
}

function mapDealRow(row: SupabaseDealRow): Deal {
  const atleta = row.atleta;
  const fs = atleta?.form_submission;

  return {
    id: row.id,
    athlete_name: atleta?.nome_completo ?? "Atleta desconhecido",
    athlete_position: atleta?.posicao ?? undefined,
    guardian_name: fs?.guardian_name ?? "",
    guardian_profession: fs?.guardian_profession ?? undefined,
    investment_range: mapInvestmentRange(atleta?.faixa_investimento ?? null),
    deal_value_brl: row.valor_estimado ?? 0,
    stage: row.etapa as DealStage,
    classification: mapClassificacao(atleta?.lead_classificacao ?? null),
    address_state: atleta?.cidade_estado?.split(" - ").pop()?.trim() ?? undefined,
    created_at: row.created_at,
    stage_updated_at: row.updated_at,
    next_action: row.next_action ?? undefined,
    next_action_date: row.data_proxima_acao ?? undefined,
    notes: row.notas_reuniao ?? undefined,
    flag_retrocedido: row.flag_retrocedido ?? undefined,
    motivo_retrocesso: row.motivo_retrocesso ?? undefined,
    lost_reason: row.detalhe_perda ?? row.motivo_perda ?? undefined,
    lost_reason_category: row.motivo_perda ?? undefined,
    contract_signed_at: row.contrato_assinado_at ?? undefined,
    signal_paid_at: row.sinal_pago_at ?? undefined,
    is_future_lead: row.pode_reativar ?? undefined,
    future_project_year: row.projeto_futuro_ano ?? undefined,
    future_reactivation_date: row.projeto_futuro_data_reativacao ?? undefined,
    // Gemini qualification
    qualificado_gemini: atleta?.qualificado_gemini ?? undefined,
    classificacao_gemini: atleta?.classificacao_gemini ?? undefined,
    motivo_gemini: atleta?.motivo_gemini ?? undefined,
    confianca_gemini: atleta?.confianca_gemini ?? undefined,
    qualificado_gemini_at: atleta?.qualificado_gemini_at ?? undefined,
    // Lead Score
    lead_score: atleta?.lead_score ?? undefined,
    // Reuniao
    reuniao_agendada_at: row.reuniao_agendada_at ?? undefined,
    reuniao_link: row.reuniao_link ?? undefined,
    reuniao_data: row.reuniao_data ?? undefined,
    // Sport details
    esporte: atleta?.esporte ?? undefined,
    serie_escolar: atleta?.serie_escolar ?? undefined,
    nivel_ingles: atleta?.nivel_ingles ?? undefined,
    nivel_competitivo: atleta?.nivel_competitivo ?? undefined,
    whatsapp: atleta?.whatsapp ?? undefined,
    // Extra athlete data
    instagram: atleta?.instagram ?? undefined,
    video_highlights_url: atleta?.video_highlights_url ?? undefined,
    escola_atual: atleta?.escola_atual ?? undefined,
    cidade_estado: atleta?.cidade_estado ?? undefined,
    desempenho_academico: atleta?.desempenho_academico ?? undefined,
    // Extra athlete data
    historico_clubes: atleta?.historico_clubes ?? undefined,
    conquistas: atleta?.conquistas ?? undefined,
    data_nascimento: atleta?.data_nascimento ?? undefined,
    email: atleta?.email ?? undefined,
    comprometimento: atleta?.comprometimento ?? undefined,
    decisao_familiar: atleta?.decisao_familiar ?? undefined,
    modelo_educacional: atleta?.modelo_educacional ?? undefined,
    momento_inicio: atleta?.momento_inicio ?? undefined,
    // Communication data (from form_submissions)
    submitted_at: fs?.submitted_at ?? row.created_at,
    whatsapp_sent_at: fs?.whatsapp_sent_at ?? undefined,
    followup_1_sent_at: fs?.followup_1_sent_at ?? undefined,
    followup_2_sent_at: fs?.followup_2_sent_at ?? undefined,
    guardian_email: fs?.guardian_email ?? undefined,
    responsavel_id: row.responsavel_id ?? undefined,
    flag_valores_customizados: row.flag_valores_customizados ?? false,
    // LGPD
    consentimento_lgpd: atleta?.consentimento_lgpd ?? undefined,
    aceite_whatsapp: atleta?.consentimento_lgpd ?? undefined,
    aceite_email: atleta?.consentimento_lgpd ?? undefined,
    // Atleta ID for sub-tabs (documentos, contrato)
    atleta_id: atleta?.id,
    // Store responsavelId for siblings lookup
    _responsavelId: atleta?.responsavel_id,
  } as Deal & { _responsavelId?: string | null };
}

export default async function PipelinePage() {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("deals")
    .select(`
      id, etapa, valor_estimado, next_action, data_proxima_acao,
      responsavel_id,
      created_at, updated_at, motivo_perda, detalhe_perda,
      flag_retrocedido, motivo_retrocesso, notas_reuniao,
      contrato_assinado_at, sinal_pago_at,
      pode_reativar, data_reativacao,
      projeto_futuro_ano, projeto_futuro_data_reativacao,
      deleted_at, flag_valores_customizados,
      reuniao_agendada_at, reuniao_link, reuniao_data,
      atleta:atletas(
        id, nome_completo, posicao, esporte, serie_escolar,
        lead_classificacao, whatsapp, faixa_investimento, cidade_estado,
        lead_score, qualificado_gemini, classificacao_gemini,
        motivo_gemini, confianca_gemini, qualificado_gemini_at,
        nivel_ingles, nivel_competitivo, instagram, video_highlights_url,
        escola_atual, desempenho_academico, historico_clubes, conquistas,
        data_nascimento, email, comprometimento, decisao_familiar,
        modelo_educacional, momento_inicio,
        responsavel_id, consentimento_lgpd,
        form_submission:form_submissions(
          submitted_at, whatsapp_sent_at, followup_1_sent_at,
          followup_2_sent_at, meeting_scheduled, meeting_scheduled_at,
          qualification_reason, qualification_confidence, qualified_at,
          guardian_name, guardian_profession, guardian_email
        )
      )
    `)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  const rawDeals = (rows ?? []).map((row) => mapDealRow(row as unknown as SupabaseDealRow));

  // Resolver siblings: agrupar por responsavel_id
  const respMap = new Map<string, { atletaId: string; nome: string; esporte?: string; dealIdx: number }[]>();
  for (let i = 0; i < rawDeals.length; i++) {
    const d = rawDeals[i] as Deal & { _responsavelId?: string | null };
    if (d._responsavelId) {
      const arr = respMap.get(d._responsavelId) ?? [];
      arr.push({ atletaId: d.atleta_id ?? "", nome: d.athlete_name, esporte: d.esporte, dealIdx: i });
      respMap.set(d._responsavelId, arr);
    }
  }
  for (const group of respMap.values()) {
    if (group.length > 1) {
      for (const item of group) {
        const deal = rawDeals[item.dealIdx];
        deal.siblings = group
          .filter((g) => g.atletaId !== item.atletaId)
          .map((g) => ({ id: g.atletaId, nome: g.nome, esporte: g.esporte }));
      }
    }
  }

  // Limpar campos temporarios
  const allDeals: Deal[] = rawDeals.map((d) => {
    const { _responsavelId, ...clean } = d as Deal & { _responsavelId?: string | null };
    return clean;
  });

  // Filtra "lead alternativo" do Kanban (perdido + motivo_perda='timing').
  // Esses leads ficam disponíveis em /leads na tab "Timing alternativo",
  // mas não devem inflar a coluna "perdido" do pipeline operacional.
  const deals: Deal[] = allDeals.filter((d) => {
    if (d.stage !== "perdido") return true;
    return d.lost_reason_category !== "timing";
  });

  // Metricas calculadas a partir dos deals reais
  const activeDeals = deals.filter(
    (d) => d.stage !== "concluido" && d.stage !== "perdido"
  );
  const totalPipelineBrl = activeDeals.reduce((sum, d) => sum + d.deal_value_brl, 0);
  const concluidos = deals.filter((d) => d.stage === "concluido").length;
  const totalFinalizados = concluidos + deals.filter((d) => d.stage === "perdido").length;
  const conversionRate = totalFinalizados > 0 ? Math.round((concluidos / totalFinalizados) * 100) : 0;

  // Previsao 30 dias: deals com proxima acao nos proximos 30 dias e etapa >= proposta_enviada
  const advancedStages: DealStage[] = [
    "proposta_enviada", "followup_proposta", "negociacao",
    "contrato_enviado", "contrato_assinado", "sinal_pago", "admission_process",
  ];
  const forecastDeals = activeDeals.filter((d) => advancedStages.includes(d.stage));
  const forecast30dBrl = forecastDeals.reduce((sum, d) => sum + d.deal_value_brl, 0);

  // Metricas adicionais (mesma fonte de dados — somente leitura)
  const now = Date.now();
  const reunioesMarcadas = deals.filter((d) => d.stage === "reuniao_marcada").length;
  const ticketMedioBrl =
    activeDeals.length > 0 ? Math.round(totalPipelineBrl / activeDeals.length) : 0;
  const signedStages: DealStage[] = [
    "contrato_assinado", "sinal_pago", "admission_process", "concluido",
  ];
  const contratosAssinados = deals.filter((d) => signedStages.includes(d.stage)).length;
  const ganhoBrl = deals
    .filter((d) => d.stage === "concluido")
    .reduce((sum, d) => sum + d.deal_value_brl, 0);
  const perdidos = deals.filter((d) => d.stage === "perdido").length;
  const leadsNovos = deals.filter((d) => d.stage === "lead").length;
  const acoesAtrasadas = activeDeals.filter(
    (d) => d.next_action_date && new Date(d.next_action_date).getTime() < now,
  ).length;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Page header + export na mesma linha (economiza altura) */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-title-2 text-foreground">Pipeline de Vendas</h1>
        <PipelineExportButton deals={deals} />
      </div>

      {/* M\u00e9tricas em dropdown colaps\u00e1vel \u2014 fechado por padr\u00e3o p/ dar altura ao Kanban */}
      <PipelineMetricsBar
        metrics={{
          totalPipelineBrl,
          activeCount: activeDeals.length,
          conversionRate,
          forecast30dBrl,
          reunioesMarcadas,
          ticketMedioBrl,
          contratosAssinados,
          ganhoBrl,
          perdidos,
          leadsNovos,
          acoesAtrasadas,
        }}
      />

      {/* Kanban board */}
      <div className="flex-1 overflow-hidden">
        <PipelineBoard deals={deals} currentUserId={user?.id} />
      </div>

      {/* Leads Futuros */}
      <FutureLeadsSection deals={deals} />
    </div>
  );
}
