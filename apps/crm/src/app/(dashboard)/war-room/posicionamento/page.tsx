import { redirect } from "next/navigation";

// Consolidado no War Room unificado (F1) — agora é a aba "Posicionamento".
export default function WarRoomPosicionamentoRedirect() {
  redirect("/war-room?tab=posicionamento");
}
