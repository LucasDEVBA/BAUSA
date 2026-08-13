import Link from "next/link";
import { BarChart3, Users, UserPlus, TrendingDown, MessageSquare } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { fetchFluxos, fetchFluxoMetricas, fetchFluxoSerie, FluxosError } from "@/lib/fluxos-queries";
import { FluxosNav } from "@/components/fluxos/FluxosNav";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { MetricasClient } from "./client";
import type { FluxoMetricas } from "@/types/fluxo";

// /fluxos/metricas — dashboard. O destaque é o FUNIL POR BLOCO: onde as
// pessoas param de responder. É a pergunta que o ManyChat não respondia.
export const dynamic = "force-dynamic";

const PERIODOS = [7, 30, 90] as const;
const pct = (v: number | null): string => (v === null ? "—" : `${Math.round(v * 100)}%`);

export default async function FluxosMetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string; fluxo?: string }>;
}) {
  await requirePapel("ceo");
  const sp = await searchParams;
  const dias = PERIODOS.includes(Number(sp.dias) as (typeof PERIODOS)[number]) ? Number(sp.dias) : 30;
  const supabase = await createServerSupabaseClient();

  let fluxos: Awaited<ReturnType<typeof fetchFluxos>> = [];
  let erro: string | null = null;
  try {
    fluxos = await fetchFluxos(supabase);
  } catch (e) {
    erro = e instanceof FluxosError ? e.message : "Falha ao carregar.";
  }

  const fluxoId = sp.fluxo && fluxos.some((f) => f.id === sp.fluxo) ? sp.fluxo : (fluxos[0]?.id ?? null);

  let metricas: FluxoMetricas | null = null;
  let serie: Awaited<ReturnType<typeof fetchFluxoSerie>> = [];
  if (fluxoId) {
    try {
      [metricas, serie] = await Promise.all([
        fetchFluxoMetricas(supabase, fluxoId, dias),
        fetchFluxoSerie(supabase, fluxoId, dias),
      ]);
    } catch {
      metricas = null;
    }
  }

  const selecionado = fluxos.find((f) => f.id === fluxoId) ?? null;

  return (
    <div className="space-y-5">
      <FluxosNav />
      <PageHeader title="Métricas dos fluxos" description={`Últimos ${dias} dias`} dense />

      {erro || fluxos.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={erro ? "Não foi possível carregar" : "Nenhum fluxo ainda"}
          description={erro ?? "Crie um fluxo para começar a medir entradas, respostas e capturas."}
        />
      ) : (
        <>
          <MetricasClient
            fluxos={fluxos.map((f) => ({ id: f.id, nome: f.nome }))}
            fluxoAtivo={fluxoId}
            diasAtivo={dias}
            periodos={[...PERIODOS]}
            serie={serie}
          />

          {metricas ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <StatCard label="Entradas" value={String(metricas.entradas)} icon={Users} accent="brand" />
                <StatCard
                  label="Responderam"
                  value={String(metricas.respostas)}
                  context={`${pct(metricas.taxaResposta)} de quem entrou`}
                  icon={MessageSquare}
                  accent="blue"
                />
                <StatCard
                  label="Capturas"
                  value={String(metricas.capturas)}
                  context={`${pct(metricas.taxaCaptura)} de conversão`}
                  icon={UserPlus}
                  accent="green"
                />
                <StatCard
                  label="Abandonos"
                  value={String(metricas.abandonadas)}
                  context="ficaram sem responder"
                  icon={TrendingDown}
                  accent="orange"
                />
                <StatCard
                  label="Concluíram"
                  value={String(metricas.concluidas)}
                  context={pct(metricas.taxaConclusao)}
                  icon={BarChart3}
                  accent="purple"
                />
              </div>

              <Card className="p-5">
                <h2 className="text-sm font-bold text-foreground">Funil por bloco — onde as pessoas param</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  &quot;Chegaram&quot; = quantas execuções passaram pelo bloco. &quot;Seguiram&quot; = quantas avançaram para o próximo.
                  Queda grande num bloco é o gargalo real.
                </p>
                {metricas.blocos.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">Este fluxo ainda não tem blocos.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {metricas.blocos.map((b) => {
                      const max = Math.max(...metricas.blocos.map((x) => x.chegaram), 1);
                      const largura = Math.max(2, Math.round((b.chegaram / max) * 100));
                      const ruim = b.taxaAvanco !== null && b.taxaAvanco < 0.5 && b.chegaram >= 5;
                      return (
                        <li key={b.blocoId} className="flex items-center gap-2 text-xs">
                          <span className="w-44 shrink-0 truncate text-muted-foreground" title={b.rotulo}>{b.rotulo}</span>
                          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                            <span
                              className={ruim ? "block h-full rounded-full bg-sys-red/70" : "block h-full rounded-full bg-primary/70"}
                              style={{ width: `${largura}%` }}
                            />
                          </span>
                          <span className="w-16 shrink-0 text-right font-semibold text-foreground">{b.chegaram}</span>
                          <span className="w-20 shrink-0 text-right">
                            {b.taxaAvanco !== null ? (
                              <Badge tone={ruim ? "red" : "neutral"} size="sm">{Math.round(b.taxaAvanco * 100)}%</Badge>
                            ) : (
                              <span className="text-label-tertiary">—</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {selecionado ? (
                  <Link
                    href={`/fluxos/${selecionado.id}`}
                    className="mt-3 inline-block text-xs font-semibold text-primary hover:underline"
                  >
                    Editar &quot;{selecionado.nome}&quot; →
                  </Link>
                ) : null}
              </Card>
            </>
          ) : (
            <EmptyState icon={BarChart3} title="Sem dados no período" description="Este fluxo ainda não teve execuções nesse intervalo." />
          )}
        </>
      )}
    </div>
  );
}
