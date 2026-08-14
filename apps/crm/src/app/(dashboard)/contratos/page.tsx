import { requirePapel } from "@/lib/auth";
import { getContratos } from "@/lib/actions/contratos";

import { ContratosClient } from "./client";

export const metadata = { title: "Contratos · BAU Engine" };

export default async function ContratosPage() {
  await requirePapel("ceo");
  const { contratos, resumo } = await getContratos();
  return <ContratosClient contratos={contratos} resumo={resumo} />;
}
