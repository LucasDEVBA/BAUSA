import { requirePapel } from "@/lib/auth";
import { getPlanejamento } from "@/lib/actions/planejamento";

import { EstrategicoClient } from "./client";

export const metadata = { title: "Estratégico · Planejamento" };

export default async function EstrategicoPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string }>;
}) {
  const papel = await requirePapel(["ceo", "head_sucesso"]);
  const { ciclo: cicloId } = await searchParams;
  const plano = await getPlanejamento(cicloId);

  return <EstrategicoClient plano={plano} podeEditar={papel === "ceo"} />;
}
