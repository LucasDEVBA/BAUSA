import { redirect } from "next/navigation";

// Consolidado no War Room unificado (F1) — agora é a aba "Meta & Receita".
export default function WarRoomMetaRedirect() {
  redirect("/war-room?tab=meta");
}
