import { requirePapel } from "@/lib/auth";
import {
  estatisticasOnboarding,
  listarOnboardingsAtivos,
} from "@/lib/actions/onboarding";
import { listarTemplatesAdmin } from "@/lib/actions/onboarding-admin";
import { listarProximasReunioes } from "@/lib/actions/reunioes";
import { FamiliasOnboardingClient } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FamiliasOnboardingPage() {
  // Apenas papéis nível CEO podem ver War Room
  await requirePapel(["ceo", "cto"]);

  const [onboardings, proximasReunioes, estatisticas, templates] =
    await Promise.all([
      listarOnboardingsAtivos(),
      listarProximasReunioes(30),
      estatisticasOnboarding(),
      listarTemplatesAdmin(),
    ]);

  return (
    <FamiliasOnboardingClient
      onboardings={onboardings}
      proximasReunioes={proximasReunioes}
      estatisticas={estatisticas}
      templates={templates}
    />
  );
}
