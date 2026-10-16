"use client";

import { useEffect } from "react";

import { captureUTMs } from "@/lib/tracking/utm";
import { captureLandingUrl, captureReferrer } from "@/lib/tracking/session";

/**
 * Captura a atribuição (UTMs first-touch, landing URL e referrer) na PRIMEIRA
 * página da visita, seja ela qual for. Antes só o /forms capturava: quem
 * chegava em /?utm_... e ia ao formulário por navegação client-side perdia a
 * query, gravando utm_* nulo e landing_url = /forms. Idempotente (as funções
 * só gravam se ainda não houver valor), então pode montar em todas as páginas.
 */
export default function AttributionCapture() {
  useEffect(() => {
    captureUTMs();
    captureLandingUrl();
    captureReferrer();
  }, []);

  return null;
}
