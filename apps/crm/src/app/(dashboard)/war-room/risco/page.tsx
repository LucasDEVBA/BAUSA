import { redirect } from "next/navigation";

// Consolidado no War Room unificado (F1) — agora é a aba "Risco".
export default function WarRoomRiscoRedirect() {
  redirect("/war-room?tab=risco");
}
