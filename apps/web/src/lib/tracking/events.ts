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

export function trackCtaClick(
  source: "hero" | "final" | "header" | "links",
): void {
  pushEvent("cta_click", { cta_source: source });

  if (typeof window !== "undefined") {
    sessionStorage.setItem("bau_cta_source", source);
  }
}
