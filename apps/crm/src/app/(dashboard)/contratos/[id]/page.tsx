import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { EmptyState } from "@/components/ui";
import { requirePapel } from "@/lib/auth";
import { getContratoDetalhe } from "@/lib/actions/contratos";
import { carregarContrato } from "@/lib/actions/financeiro-contrato";
import type { ContratoCompleto } from "@/types/contrato";

import { ContratoDetalheClient } from "./client";

export default async function ContratoPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePapel("ceo");
  const { id } = await params;
  // Contratante (atleta/responsável) continua vindo de getContratoDetalhe; o
  // financeiro (parcelas, itens, custos, histórico, versão CAS) de carregarContrato.
  // Falha de leitura ≠ "não encontrado": mostra o erro em vez de um 404 falso.
  const [detalhe, completo] = await Promise.all([
    getContratoDetalhe(id),
    carregarContrato(id).catch((): "erro" => "erro"),
  ]);
  if (completo === "erro") return <ErroCarga id={id} />;
  if (!detalhe.contrato || !completo?.contrato) notFound();

  return <ContratoDetalheClient detalhe={detalhe} inicial={completo as ContratoCompleto} />;
}

function ErroCarga({ id }: { id: string }) {
  return (
    <EmptyState
      icon={AlertTriangle}
      title="Não foi possível carregar o contrato"
      description="Falha momentânea na leitura. Tente de novo; se persistir, avise o suporte."
      action={
        <Link href={`/contratos/${id}`} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent">
          Tentar de novo
        </Link>
      }
    />
  );
}
