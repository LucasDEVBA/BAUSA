import type { PapelUsuario } from "@/types/crm";

/**
 * true se o papel tem nível de acesso de CEO (ceo OU cto).
 *
 * O CTO compartilha EXATAMENTE as permissões do CEO — a distinção existe só
 * para exibição. A autorização efetiva é resolvida em `getUserPapel()` (app) e
 * `public.get_user_papel()` (RLS), que mapeiam cto→ceo. Use `isCeoLevel()`
 * apenas onde se lê o papel REAL (ex.: `getUserProfile().papel`), pois ali o
 * cto ainda aparece como 'cto'.
 */
export function isCeoLevel(papel?: PapelUsuario | null): boolean {
  return papel === "ceo" || papel === "cto";
}

/** Rótulos de exibição dos papéis RBAC. */
export const PAPEL_LABEL: Record<PapelUsuario, string> = {
  ceo: "CEO",
  cto: "CTO",
  head_sucesso: "Head de Sucesso",
  comercial: "Comercial",
};
