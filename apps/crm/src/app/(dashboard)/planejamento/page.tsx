import { requirePapel } from "@/lib/auth";
import { getPlanejamento } from "@/lib/actions/planejamento";
import { getRotinas } from "@/lib/actions/planejamento";

import { PainelClient } from "./client";

export const metadata = { title: "Planejamento · BAU Engine" };

export default async function PlanejamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string }>;
}) {
  await requirePapel(["ceo", "head_sucesso"]);
  const { ciclo: cicloId } = await searchParams;

  const [plano, rotinas] = await Promise.all([getPlanejamento(cicloId), getRotinas()]);

  return <PainelClient plano={plano} rotinas={rotinas.rotinas} />;
}
