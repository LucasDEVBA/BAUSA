import { redirect } from "next/navigation";

// Consolidado no War Room unificado (F1) — agora é a aba "Funil".
export default function WarRoomFunilRedirect() {
  redirect("/war-room?tab=funil");
}
