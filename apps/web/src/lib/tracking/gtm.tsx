/**
 * Google Tag Manager loader.
 *
 * Wrapper sobre `<GoogleTagManager>` de `@next/third-parties/google`
 * que respeita a env `NEXT_PUBLIC_GTM_ID` e degrada silenciosamente
 * quando ela não está definida (ex.: builds locais sem tracking).
 *
 * Container produção: GTM-5J87JXSR (orquestra GA4 + Meta Pixel +
 * eventos `form_submit` / `cta_click`). Detalhes: docs/INTEGRATIONS.md.
 */
import { GoogleTagManager as NextGoogleTagManager } from "@next/third-parties/google";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export function GoogleTagManager() {
  if (!GTM_ID) return null;
  return <NextGoogleTagManager gtmId={GTM_ID} />;
}
