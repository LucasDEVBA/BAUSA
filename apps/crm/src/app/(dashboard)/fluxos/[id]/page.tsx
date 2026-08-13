import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { fetchBlocos, fetchFluxo, fetchFluxoMetricas } from "@/lib/fluxos-queries";
import { listarAgentsAtivos } from "@/lib/actions/agents";
import { FluxosNav } from "@/components/fluxos/FluxosNav";
import { PageHeader } from "@/components/ui/PageHeader";
import { BuilderClient } from "./client";
import type { FluxoMetricas } from "@/types/fluxo";

// /fluxos/[id] — construtor do fluxo: blocos encadeados, sugestão de IA e o
// funil real por bloco (mostrado ao lado do bloco, para o CEO ver onde vaza).
export const dynamic = "force-dynamic";

export default async function FluxoBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePapel("ceo");
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const fluxo = await fetchFluxo(supabase, id);
  if (!fluxo) notFound();

  const blocos = await fetchBlocos(supabase, id);

  // Enriquecimentos: cada um degrada sozinho, nunca derruba o builder.
  let metricas: FluxoMetricas | null = null;
  try {
    metricas = await fetchFluxoMetricas(supabase, id, 90);
  } catch {
    metricas = null;
  }
  let agents: Array<{ id: string; nome: string }> = [];
  try {
    const lista = await listarAgentsAtivos("automacao");
    agents = lista.map((a) => ({ id: a.id, nome: a.nome }));
  } catch {
    agents = [];
  }

  return (
    <div className="space-y-5">
      <FluxosNav />
      <Link
        href="/fluxos"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Todos os fluxos
      </Link>
      <PageHeader
        eyebrow="Fluxo"
        title={fluxo.nome}
        description={fluxo.descricao ?? "Monte a conversa: cada bloco é um passo. Capture o contato antes do fim."}
        dense
      />
      <BuilderClient fluxo={fluxo} blocosIniciais={blocos} metricas={metricas} agents={agents} />
    </div>
  );
}
