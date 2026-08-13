import { Workflow, Users, UserPlus, Percent } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { fetchFluxos, fetchResumoGeral, FluxosError, type FluxoResumo } from "@/lib/fluxos-queries";
import { getEscopoFluxos } from "@/lib/actions/fluxos-escopo";
import { EscopoCard } from "@/components/fluxos/EscopoCard";
import { FluxosNav } from "@/components/fluxos/FluxosNav";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { FluxosClient } from "./client";

// /fluxos — o "ManyChat" próprio: lista de fluxos + KPIs de captura.
// A métrica de topo é CAPTURA, não disparo: o ManyChat externo mostrava 213
// disparos com 0 contatos — número grande que não vira pipeline é vaidade.
export const dynamic = "force-dynamic";

const pct = (v: number | null): string => (v === null ? "—" : `${Math.round(v * 100)}%`);

export default async function FluxosPage() {
  await requirePapel("ceo");
  const supabase = await createServerSupabaseClient();

  let fluxos: FluxoResumo[] = [];
  let resumo = { fluxosAtivos: 0, entradas: 0, capturas: 0, leads: 0, taxaCaptura: null as number | null, contatosTotal: 0 };
  let erro: string | null = null;
  try {
    [fluxos, resumo] = await Promise.all([fetchFluxos(supabase), fetchResumoGeral(supabase, 30)]);
  } catch (e) {
    erro = e instanceof FluxosError ? e.message : "Falha ao carregar os fluxos.";
  }
  const escopo = await getEscopoFluxos();

  return (
    <div className="space-y-5">
      <FluxosNav />
      <PageHeader
        title="Fluxos"
        description="Conversas automáticas que qualificam e capturam contato — no WhatsApp hoje, no Instagram quando a Meta liberar"
        dense
      />

      <EscopoCard escopo={escopo} />

      {erro ? (
        <EmptyState icon={Workflow} title="Não foi possível carregar" description={erro} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Fluxos ativos"
              value={String(resumo.fluxosAtivos)}
              context={`${fluxos.length} no total`}
              icon={Workflow}
              accent="brand"
            />
            <StatCard
              label="Entradas 30d"
              value={String(resumo.entradas)}
              context="pessoas que entraram num fluxo"
              icon={Users}
              accent="blue"
            />
            <StatCard
              label="Contatos capturados"
              value={String(resumo.capturas)}
              context={`${resumo.contatosTotal} na base`}
              icon={UserPlus}
              accent="green"
            />
            <StatCard
              label="Taxa de captura"
              value={pct(resumo.taxaCaptura)}
              context={resumo.leads > 0 ? `${resumo.leads} viraram lead` : "entradas que viraram contato"}
              icon={Percent}
              accent={resumo.taxaCaptura !== null && resumo.taxaCaptura >= 0.15 ? "green" : "orange"}
            />
          </div>

          <FluxosClient fluxos={fluxos} />
        </>
      )}
    </div>
  );
}
