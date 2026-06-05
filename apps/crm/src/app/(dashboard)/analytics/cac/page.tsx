import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { fetchCacMetrics, type Period } from "@/lib/cac-queries";
import { CacClient } from "./client";

export interface InvestimentoRow {
  id: string;
  mes: string;
  canal: string;
  valor_gasto: number;
  impressoes: number | null;
  cliques: number | null;
  leads_gerados: number | null;
  observacao: string | null;
  source: string;
}

const VALID_PERIODS: Period[] = ["30d", "90d", "6m", "12m"];

export default async function CacPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requirePapel("ceo");

  const { period } = await searchParams;
  const p: Period = VALID_PERIODS.includes(period as Period)
    ? (period as Period)
    : "90d";

  const supabase = await createServerSupabaseClient();

  const [metrics, lancamentosRes] = await Promise.all([
    fetchCacMetrics(p),
    supabase
      .from("investimentos_marketing")
      .select(
        "id, mes, canal, valor_gasto, impressoes, cliques, leads_gerados, observacao, source",
      )
      .is("deleted_at", null)
      .order("mes", { ascending: false }),
  ]);

  return (
    <CacClient
      metrics={metrics}
      period={p}
      lancamentos={(lancamentosRes.data as InvestimentoRow[]) ?? []}
    />
  );
}
