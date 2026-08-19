import type { Metadata } from "next";

import { requirePapel } from "@/lib/auth";
import {
  fetchEmailMetricas,
  fetchEmails,
  fetchEmailsContasConfig,
  fetchEmailsRoteamento,
} from "@/lib/emails-queries";
import { createServerSupabaseClient } from "@/lib/supabase-server";

import { EmailsClient, type TabId } from "./client";

export const metadata: Metadata = {
  title: "E-mails",
};

const TABS_VALIDAS: TabId[] = ["caixa", "enviados", "metricas", "roteamento"];

/**
 * Módulo de E-mail (/emails) — apenas CEO.
 * Multi-conta: caixas de `emails_contas`, filtro por caixa via querystring
 * (?caixa=…&tab=…), regras de alias em `emails_roteamento`. Tudo lido de
 * emails_mensagens (RLS SELECT nível CEO).
 */
export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ caixa?: string; tab?: string }>;
}) {
  await requirePapel("ceo");

  const supabase = await createServerSupabaseClient();
  const [{ caixa: caixaParam, tab: tabParam }, contasCfg] = await Promise.all([
    searchParams,
    fetchEmailsContasConfig(supabase),
  ]);

  // Filtro só vale se a caixa é uma conta sincronizada (querystring é input).
  const caixa =
    caixaParam && contasCfg.contas.includes(caixaParam.toLowerCase())
      ? caixaParam.toLowerCase()
      : undefined;
  const tabInicial = TABS_VALIDAS.includes(tabParam as TabId)
    ? (tabParam as TabId)
    : undefined;

  const [recebidos, enviados, metricas, roteamento] = await Promise.all([
    fetchEmails(supabase, "recebido", caixa),
    fetchEmails(supabase, "enviado", caixa),
    fetchEmailMetricas(supabase, 30, caixa),
    fetchEmailsRoteamento(supabase),
  ]);

  return (
    <EmailsClient
      recebidos={recebidos}
      enviados={enviados}
      metricas={metricas}
      contas={contasCfg.contas}
      padraoEnvio={contasCfg.padraoEnvio}
      caixaAtiva={caixa ?? null}
      roteamento={roteamento}
      tabInicial={tabInicial}
    />
  );
}
