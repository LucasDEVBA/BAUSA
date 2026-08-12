import { requirePapel } from "@/lib/auth";
import { getPlanejamento, listarApuracoes } from "@/lib/actions/planejamento";

import { IncentivosClient } from "./client";

export const metadata = { title: "Incentivos · Planejamento" };

export default async function IncentivosPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string }>;
}) {
  const papel = await requirePapel(["ceo", "head_sucesso"]);
  const { ciclo: cicloId } = await searchParams;
  const plano = await getPlanejamento(cicloId);
  const apuracoes = plano.ciclo ? await listarApuracoes(plano.ciclo.id) : [];

  return <IncentivosClient plano={plano} apuracoes={apuracoes} podeEditar={papel === "ceo"} />;
}
