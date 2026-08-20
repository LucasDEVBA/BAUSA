import type { Metadata } from "next";

import { requirePapel } from "@/lib/auth";
import {
  fetchEmailMetricas,
  fetchEmails,
  fetchEmailsContagens,
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
 * A tabela guarda o histórico completo das caixas — a page carrega só a
 * PRIMEIRA página (cursor keyset, 50 por direção); as demais chegam via
 * server action `paginarEmails` no scroll infinito do client.
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

  const [recebidos, enviados, metricas, roteamento, contagens] = await Promise.all([
    fetchEmails(supabase, { direcao: "recebido", caixa }),
    fetchEmails(supabase, { direcao: "enviado", caixa }),
    fetchEmailMetricas(supabase, 30, caixa),
    fetchEmailsRoteamento(supabase),
    fetchEmailsContagens(supabase, caixa),
  ]);

  return (
    <EmailsClient
      recebidos={recebidos.itens}
      cursorRecebidos={recebidos.proximoCursor}
      enviados={enviados.itens}
      cursorEnviados={enviados.proximoCursor}
      contagens={contagens}
      metricas={metricas}
      contas={contasCfg.contas}
      padraoEnvio={contasCfg.padraoEnvio}
      caixaAtiva={caixa ?? null}
      roteamento={roteamento}
      tabInicial={tabInicial}
    />
  );
}
