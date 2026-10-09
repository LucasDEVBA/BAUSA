/**
 * Contrato de retorno de `moverDeal` — discriminated union com código de erro,
 * campo que falta e ação que a UI pode invocar.
 *
 * Ver docs/PIPELINE_NOTIFICATIONS_FIX.md para o racional completo.
 */

import type { StatusDeal } from "@/types/crm";
// import type puro — etapas-deal é módulo puro (client-safe).
import type { DealStageConfigMap } from "@/lib/etapas-deal";
// import type puro — apagado na compilação, seguro em client components
// (o módulo @/lib/gamificacao em si é server-only).
import type { ResultadoGamificacao } from "@/lib/gamificacao";

export type MoveDealErrorCode =
  | "PERMISSION_DENIED"
  | "DEAL_NOT_FOUND"
  | "MISSING_NEXT_ACTION"
  | "MISSING_MEETING_NOTES"
  | "MISSING_CONTRACT"
  | "REQUIRE_RETROCESSO_REASON"
  | "REQUIRE_LOST_REASON"
  | "DEAL_CHANGED"
  | "DB_ERROR";

export type MoveDealAction =
  | { type: "open_deal"; dealId: string }
  | {
      type: "open_retrocesso_modal";
      dealId: string;
      fromStage: StatusDeal;
      toStage: StatusDeal;
    }
  | { type: "open_lost_modal"; dealId: string; toStage: StatusDeal }
  | { type: "create_contract"; dealId: string }
  | { type: "reload" };

export type MoveDealSuccess = {
  success: true;
  dealId: string;
  novaEtapa: StatusDeal;
  /** XP registrado quando o movimento foi um avanço real (fail-open: pode ser null). */
  gamificacao?: ResultadoGamificacao | null;
  /** Próxima ação padrão aplicada pela coluna de destino (T21) — null = mantida. */
  proximaAcao?: string | null;
};

export type MoveDealFailure = {
  success: false;
  code: MoveDealErrorCode;
  error: string;
  field?: string;
  action?: MoveDealAction;
};

export type MoveDealResult = MoveDealSuccess | MoveDealFailure;

// ─── Helpers ──────────────────────────────────────────────────

export function okMove(
  dealId: string,
  novaEtapa: StatusDeal,
  gamificacao?: ResultadoGamificacao | null,
  proximaAcao?: string | null,
): MoveDealSuccess {
  return {
    success: true,
    dealId,
    novaEtapa,
    gamificacao: gamificacao ?? null,
    proximaAcao: proximaAcao ?? null,
  };
}

export function failMove(
  code: MoveDealErrorCode,
  options: {
    error?: string;
    field?: string;
    action?: MoveDealAction;
  } = {}
): MoveDealFailure {
  return {
    success: false,
    code,
    error: options.error ?? DEFAULT_ERROR_LABEL[code],
    field: options.field,
    action: options.action,
  };
}

// ─── Mensagens PT-BR centralizadas ───────────────────────────

export const DEFAULT_ERROR_LABEL: Record<MoveDealErrorCode, string> = {
  PERMISSION_DENIED: "Apenas o CEO pode mover deals.",
  DEAL_NOT_FOUND: "Deal não encontrado. Recarregue a página.",
  MISSING_NEXT_ACTION:
    'Preencha "Próxima ação" e a data antes de avançar o deal.',
  MISSING_MEETING_NOTES:
    "Preencha as notas da reunião antes de avançar para Diagnóstico/Fit.",
  MISSING_CONTRACT:
    "Crie um contrato financeiro antes de marcar como Contrato Assinado.",
  REQUIRE_RETROCESSO_REASON:
    "Retrocesso exige justificativa obrigatória.",
  REQUIRE_LOST_REASON: "Marcar como perdido exige motivo.",
  DEAL_CHANGED: "O deal mudou de etapa em outra aba. Recarregue o pipeline e tente de novo.",
  DB_ERROR: "Erro ao mover deal. Tente novamente em instantes.",
};

// Rótulos ESTÁTICOS — só fallback. O nome que o CEO vê é o da config
// (stageConfig[etapa].label); passe o mapa para labelEtapa sempre que tiver.
export const ETAPA_LABEL: Record<string, string> = {
  contato_feito: "Contato feito",
  lead: "Lead",
  aguardando_timing: "Aguardando Timing",
  reuniao_marcada: "Reunião Marcada",
  reuniao_realizada: "Reunião Realizada",
  diagnostico_fit: "Diagnóstico / Fit",
  alinhamento_estrategico: "Alinhamento Estratégico",
  proposta_enviada: "Proposta Enviada",
  followup_proposta: "Follow-up Proposta",
  negociacao: "Negociação",
  contrato_enviado: "Contrato Enviado",
  contrato_assinado: "Contrato Assinado",
  sinal_pago: "Sinal Pago",
  plano_escolhido: "Plano escolhido",
  admission_process: "Admission Process",
  concluido: "Concluído",
  perdido: "Perdido",
  cancelamento_solicitado: "Cancelamento",
  projeto_futuro: "Projeto Futuro",
  custom_1: "Coluna personalizada 1",
  custom_2: "Coluna personalizada 2",
  custom_3: "Coluna personalizada 3",
  custom_4: "Coluna personalizada 4",
  custom_5: "Coluna personalizada 5",
  custom_6: "Coluna personalizada 6",
};

/**
 * Nome da COLUNA para exibição (T17): rótulo configurado pelo CEO quando o
 * mapa é passado; senão o rótulo estático; nunca o código interno quando há
 * qualquer rótulo conhecido.
 */
export function labelEtapa(etapa: string, config?: DealStageConfigMap | null): string {
  const configurado = (config as Partial<Record<string, { label: string }>> | null | undefined)?.[etapa]?.label;
  return configurado ?? ETAPA_LABEL[etapa] ?? etapa;
}
