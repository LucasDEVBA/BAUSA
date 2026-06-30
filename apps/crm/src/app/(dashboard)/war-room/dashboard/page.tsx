import { redirect } from "next/navigation";

// Consolidado no War Room unificado (F1). A antiga tela "Dashboard" virou a
// Visão Geral do War Room por abas. Redirect mantém bookmarks/links funcionando.
export default function WarRoomDashboardRedirect() {
  redirect("/war-room?tab=visao");
}
