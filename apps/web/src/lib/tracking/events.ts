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
 * Origem do clique no CTA (vai para form_submissions.cta_source, coluna text
 * sem CHECK). "dock" = barra de navegação mobile; os nomes de página marcam o
 * CTA de cada página de conteúdo do multipage.
 */
export const CTA_SOURCES = ["hero", "final", "header", "footer", "links", "dock", "metodo", "historias", "escolas", "sobre"] as const;
export type CtaSource = (typeof CTA_SOURCES)[number];

export function trackCtaClick(source: CtaSource): void {
  pushEvent("cta_click", { cta_source: source });

  if (typeof window !== "undefined") {
    sessionStorage.setItem("bau_cta_source", source);
  }
}
