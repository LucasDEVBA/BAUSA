import { requirePapel } from "@/lib/auth";
import { getPlanejamento } from "@/lib/actions/planejamento";

import { MetasClient } from "./client";

export const metadata = { title: "Metas · Planejamento" };

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<{ ciclo?: string }>;
}) {
  const papel = await requirePapel(["ceo", "head_sucesso"]);
  const { ciclo: cicloId } = await searchParams;
  const plano = await getPlanejamento(cicloId);

  return <MetasClient plano={plano} podeEditar={papel === "ceo"} />;
}
