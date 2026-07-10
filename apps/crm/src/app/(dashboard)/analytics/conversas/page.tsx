import { requirePapel } from "@/lib/auth";
import {
  fetchConversaMetrics,
  fetchFunilAvancado,
  fetchCadenciaPosReuniao,
  type ConversaPeriod,
} from "@/lib/conversas-queries";

import { ConversasClient } from "./client";

export const dynamic = "force-dynamic";

const VALID: ConversaPeriod[] = ["7d", "30d", "90d", "tudo"];

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  await requirePapel("ceo");

  const { periodo } = await searchParams;
  const period: ConversaPeriod = VALID.includes(periodo as ConversaPeriod)
    ? (periodo as ConversaPeriod)
    : "30d";

  const [conversa, funil, cadencia] = await Promise.all([
    fetchConversaMetrics(period),
    fetchFunilAvancado(period),
    fetchCadenciaPosReuniao(period),
  ]);

  return (
    <ConversasClient period={period} conversa={conversa} funil={funil} cadencia={cadencia} />
  );
}
