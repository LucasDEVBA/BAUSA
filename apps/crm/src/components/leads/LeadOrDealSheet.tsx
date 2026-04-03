"use client";

import { useState, useEffect } from "react";
import { type Lead } from "@/types/lead";
import { type Deal, type DealStage } from "@/types/deal";
import { type LeadClassification } from "@/types/lead";
import { LeadDetailSheet } from "./LeadDetailSheet";
import { DealDetailSheet } from "@/components/pipeline/DealDetailSheet";
import { createBrowserClient } from "@/lib/supabase-browser";

interface LeadOrDealSheetProps {
  lead: Lead | null;
  onClose: () => void;
}

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

async function fetchDeal(dealId: string): Promise<Deal | null> {
  const supabase = createBrowserClient();

  const { data } = await supabase
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
    .eq("id", dealId)
    .single();

  if (!data) return null;

  const row = data as Record<string, unknown>;
  const atleta = row.atleta as Record<string, unknown> | null;
  const fs = atleta?.form_submission as Record<string, unknown> | null;
  return {
    id: row.id as string,
    atleta_id: atleta?.id as string | undefined,
    athlete_name: (atleta?.nome_completo as string) ?? "Atleta desconhecido",
    athlete_position: (atleta?.posicao as string) ?? undefined,
    guardian_name: (fs?.guardian_name as string) ?? "",
    guardian_profession: (fs?.guardian_profession as string) ?? undefined,
    investment_range: mapInvestmentRange((atleta?.faixa_investimento as string) ?? null),
    deal_value_brl: (row.valor_estimado as number) ?? 0,
    stage: row.etapa as DealStage,
    classification: mapClassificacao((atleta?.lead_classificacao as string) ?? null),
    address_state: (atleta?.cidade_estado as string)?.split(" - ").pop()?.trim() ?? undefined,
    created_at: row.created_at as string,
    stage_updated_at: row.updated_at as string,
    next_action: (row.next_action as string) ?? undefined,
    next_action_date: (row.data_proxima_acao as string) ?? undefined,
    notes: (row.notas_reuniao as string) ?? undefined,
    flag_retrocedido: (row.flag_retrocedido as boolean) ?? undefined,
    motivo_retrocesso: (row.motivo_retrocesso as string) ?? undefined,
    lost_reason: (row.detalhe_perda as string) ?? (row.motivo_perda as string) ?? undefined,
    contract_signed_at: (row.contrato_assinado_at as string) ?? undefined,
    signal_paid_at: (row.sinal_pago_at as string) ?? undefined,
    is_future_lead: (row.pode_reativar as boolean) ?? undefined,
    future_project_year: (row.projeto_futuro_ano as number) ?? undefined,
    future_reactivation_date: (row.projeto_futuro_data_reativacao as string) ?? undefined,
    // Gemini qualification
    qualificado_gemini: (atleta?.qualificado_gemini as boolean) ?? undefined,
    classificacao_gemini: (atleta?.classificacao_gemini as string) ?? undefined,
    motivo_gemini: (atleta?.motivo_gemini as string) ?? undefined,
    confianca_gemini: (atleta?.confianca_gemini as string) ?? undefined,
    qualificado_gemini_at: (atleta?.qualificado_gemini_at as string) ?? undefined,
    // Lead Score
    lead_score: (atleta?.lead_score as number) ?? undefined,
    // Reuniao
    reuniao_agendada_at: (row.reuniao_agendada_at as string) ?? undefined,
    reuniao_link: (row.reuniao_link as string) ?? undefined,
    reuniao_data: (row.reuniao_data as string) ?? undefined,
    // Sport details
    esporte: (atleta?.esporte as string) ?? undefined,
    serie_escolar: (atleta?.serie_escolar as string) ?? undefined,
    nivel_ingles: (atleta?.nivel_ingles as string) ?? undefined,
    nivel_competitivo: (atleta?.nivel_competitivo as string) ?? undefined,
    whatsapp: (atleta?.whatsapp as string) ?? undefined,
    // Extra athlete data
    instagram: (atleta?.instagram as string) ?? undefined,
    video_highlights_url: (atleta?.video_highlights_url as string) ?? undefined,
    escola_atual: (atleta?.escola_atual as string) ?? undefined,
    cidade_estado: (atleta?.cidade_estado as string) ?? undefined,
    desempenho_academico: (atleta?.desempenho_academico as string) ?? undefined,
    historico_clubes: (atleta?.historico_clubes as string) ?? undefined,
    conquistas: (atleta?.conquistas as string) ?? undefined,
    data_nascimento: (atleta?.data_nascimento as string) ?? undefined,
    email: (atleta?.email as string) ?? undefined,
    comprometimento: (atleta?.comprometimento as string) ?? undefined,
    decisao_familiar: (atleta?.decisao_familiar as string) ?? undefined,
    modelo_educacional: (atleta?.modelo_educacional as string) ?? undefined,
    momento_inicio: (atleta?.momento_inicio as string) ?? undefined,
    // Communication data (from form_submissions)
    submitted_at: (fs?.submitted_at as string) ?? (row.created_at as string),
    whatsapp_sent_at: (fs?.whatsapp_sent_at as string) ?? undefined,
    followup_1_sent_at: (fs?.followup_1_sent_at as string) ?? undefined,
    followup_2_sent_at: (fs?.followup_2_sent_at as string) ?? undefined,
    guardian_email: (fs?.guardian_email as string) ?? undefined,
    responsavel_id: (row.responsavel_id as string) ?? undefined,
    flag_valores_customizados: (row.flag_valores_customizados as boolean) ?? false,
    // LGPD
    consentimento_lgpd: (atleta?.consentimento_lgpd as boolean) ?? undefined,
    aceite_whatsapp: (atleta?.consentimento_lgpd as boolean) ?? undefined,
    aceite_email: (atleta?.consentimento_lgpd as boolean) ?? undefined,
  };
}

export function LeadOrDealSheet({ lead, onClose }: LeadOrDealSheetProps) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lead || !lead.is_in_pipeline || !lead.pipeline_deal_id) {
      setDeal(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchDeal(lead.pipeline_deal_id).then((d) => {
      if (!cancelled) {
        setDeal(d);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setDeal(null);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [lead?.id, lead?.pipeline_deal_id, lead?.is_in_pipeline]);

  if (!lead) return null;

  // Lead no pipeline e deal carregado: mostrar DealDetailSheet completo
  if (lead.is_in_pipeline && deal) {
    return <DealDetailSheet key={deal.id} deal={deal} onClose={onClose} />;
  }

  // Lead no pipeline mas ainda carregando
  if (lead.is_in_pipeline && loading) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg items-center justify-center border-l border-[#1e2130] bg-[#0f1117]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <span className="text-sm text-zinc-500">Carregando deal...</span>
          </div>
        </div>
      </>
    );
  }

  // Nao esta no pipeline: mostrar LeadDetailSheet simples
  return <LeadDetailSheet lead={lead} onClose={onClose} />;
}
