/**
 * Contrato de retorno de `moverDeal` — discriminated union com código de erro,
 * campo que falta e ação que a UI pode invocar.
 *
 * Ver docs/PIPELINE_NOTIFICATIONS_FIX.md para o racional completo.
 */

import type { StatusDeal } from "@/types/crm";

export type MoveDealErrorCode =
  | "PERMISSION_DENIED"
  | "DEAL_NOT_FOUND"
  | "MISSING_NEXT_ACTION"
  | "MISSING_MEETING_NOTES"
  | "MISSING_CONTRACT"
  | "REQUIRE_RETROCESSO_REASON"
  | "REQUIRE_LOST_REASON"
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
  novaEtapa: StatusDeal
): MoveDealSuccess {
  return { success: true, dealId, novaEtapa };
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
  DB_ERROR: "Erro ao mover deal. Tente novamente em instantes.",
};

// Mapeamento de etapa → label amigável (usa o tipo do crm.ts)
export const ETAPA_LABEL: Record<string, string> = {
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
  admission_process: "Admission Process",
  concluido: "Concluído",
  perdido: "Perdido",
  cancelamento_solicitado: "Cancelamento",
  projeto_futuro: "Projeto Futuro",
};

export function labelEtapa(etapa: string): string {
  return ETAPA_LABEL[etapa] ?? etapa;
}
