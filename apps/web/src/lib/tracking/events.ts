import { pushEvent } from "./dataLayer";

export function trackFormStart(sessionId: string): void {
  pushEvent("form_start", { session_id: sessionId });
}

export function trackFormStep(step: number, stepName: string): void {
  pushEvent("form_step_completed", {
    step_number: step,
    step_name: stepName,
  });
}

export function trackFormSubmit(submissionId: string): void {
  pushEvent("form_submit", {
    submission_id: submissionId,
    conversion: true,
  });
}

export function trackFormError(step: number, errorMessage: string): void {
  pushEvent("form_error", {
    step_number: step,
    error_message: errorMessage,
  });
}

/**
 * Vocabulário fechado de origem do CTA. Vira a coluna `cta_source` em
 * `form_submissions` e é rotulado no relatório de Atribuição do Engine
 * (`apps/crm/src/app/(dashboard)/analytics/atribuicao/client.tsx`).
 *
 * ⚠️ Acrescentar um valor aqui SEM adicionar o rótulo correspondente no Engine
 * faz a string crua aparecer no relatório do CEO. São apps e deploys distintos:
 * publique a web primeiro, o Engine depois.
 */
export type CtaSource =
  // Origens do site institucional
  | "header"
  | "hero"
  | "final"
  // CTA de fecho de cada página de narrativa
  | "conceito"
  | "metodo"
  | "jornada"
  | "boarding"
  | "historias"
  | "fundador"
  // Hub de links (/acesso)
  | "links";

export function trackCtaClick(source: CtaSource): void {
  pushEvent("cta_click", { cta_source: source });

  if (typeof window !== "undefined") {
    sessionStorage.setItem("bau_cta_source", source);
  }
}
