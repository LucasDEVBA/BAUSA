import { redirect } from "next/navigation";

// Consolidado no War Room unificado (F1) — agora é a aba "Caixa".
export default function WarRoomCaixaRedirect() {
  redirect("/war-room?tab=caixa");
}
