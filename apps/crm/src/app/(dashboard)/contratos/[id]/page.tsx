import { notFound } from "next/navigation";

import { requirePapel } from "@/lib/auth";
import { getContratoDetalhe } from "@/lib/actions/contratos";

import { ContratoDetalheClient } from "./client";

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePapel("ceo");
  const { id } = await params;
  const detalhe = await getContratoDetalhe(id);
  if (!detalhe.contrato) notFound();

  return <ContratoDetalheClient detalhe={detalhe} />;
}
