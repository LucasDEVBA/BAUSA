import { requirePapel } from "@/lib/auth";
import { listarOnboardingsAtivos } from "@/lib/actions/onboarding";
import { listarProximasReunioes } from "@/lib/actions/reunioes";
import { FamiliasOnboardingClient } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FamiliasOnboardingPage() {
  // Apenas papéis nível CEO podem ver War Room
  await requirePapel(["ceo", "cto"]);

  const [onboardings, proximasReunioes] = await Promise.all([
    listarOnboardingsAtivos(),
    listarProximasReunioes(30),
  ]);

  return (
    <FamiliasOnboardingClient
      onboardings={onboardings}
      proximasReunioes={proximasReunioes}
    />
  );
}
