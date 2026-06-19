import { requirePapel } from "@/lib/auth";
import { getWarRoomFamilias } from "@/lib/actions/war-room-familias";
import { listarOnboardingsAtivos } from "@/lib/actions/onboarding";
import { listarProximasReunioes } from "@/lib/actions/reunioes";
import { WarRoomFamiliasGerencial } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function WarRoomFamiliasPage() {
  await requirePapel(["ceo", "cto"]);

  const [data, onboardings, proximasReunioes] = await Promise.all([
    getWarRoomFamilias(),
    listarOnboardingsAtivos(),
    listarProximasReunioes(20),
  ]);

  return (
    <WarRoomFamiliasGerencial
      data={data}
      onboardings={onboardings}
      proximasReunioes={proximasReunioes}
    />
  );
}
