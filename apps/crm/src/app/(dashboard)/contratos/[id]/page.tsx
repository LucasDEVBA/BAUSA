import { notFound } from "next/navigation";

import { requirePapel } from "@/lib/auth";
import { getContratoDetalhe } from "@/lib/actions/contratos";
import { carregarContrato } from "@/lib/actions/financeiro-contrato";

import { ContratoDetalheClient } from "./client";

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePapel("ceo");
  const { id } = await params;
  // Contratante (atleta/responsável) continua vindo de getContratoDetalhe; o
  // financeiro (parcelas, itens, custos, histórico, versão CAS) de carregarContrato.
  const [detalhe, completo] = await Promise.all([getContratoDetalhe(id), carregarContrato(id)]);
  if (!detalhe.contrato || !completo?.contrato) notFound();

  return <ContratoDetalheClient detalhe={detalhe} inicial={completo} />;
}
