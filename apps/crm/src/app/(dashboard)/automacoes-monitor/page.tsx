import { redirect } from "next/navigation";

// O Monitor de filas virou a aba principal de /observabilidade (que soma a
// Observabilidade Geral). Redirect preserva links antigos — inclusive os das
// notificações in-app criadas pela CF monitor-health.
export default function AutomacoesMonitorRedirect() {
  redirect("/observabilidade");
}
