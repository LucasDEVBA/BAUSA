import { requirePapel } from "@/lib/auth";
import { fetchReunioesMetrics, type ReunioesPeriod } from "@/lib/reunioes-queries";

import { ReunioesClient } from "./client";

export const dynamic = "force-dynamic";

const VALID: ReunioesPeriod[] = ["30d", "90d", "6m", "12m", "tudo"];

export default async function ReunioesPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requirePapel("ceo");

  const { periodo } = await searchParams;
  const period: ReunioesPeriod = VALID.includes(periodo as ReunioesPeriod)
    ? (periodo as ReunioesPeriod)
    : "90d";

  const metrics = await fetchReunioesMetrics(period);

  return <ReunioesClient metrics={metrics} />;
}
