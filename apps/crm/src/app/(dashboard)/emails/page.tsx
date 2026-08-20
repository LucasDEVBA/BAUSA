import type { Metadata } from "next";

import { requirePapel } from "@/lib/auth";
import {
  fetchEmailMetricas,
  fetchEmails,
  fetchEmailsAssinaturas,
  fetchEmailsContagens,
  fetchEmailsContasConfig,
  fetchEmailsPermissoesHead,
  fetchEmailsRoteamento,
} from "@/lib/emails-queries";
import { createServerSupabaseClient } from "@/lib/supabase-server";

import { EmailsClient, type TabId } from "./client";

export const metadata: Metadata = {
  title: "E-mails",
};

const TABS_VALIDAS: TabId[] = [
  "caixa",
  "enviados",
  "metricas",
  "roteamento",
  "assinaturas",
  "acessos",
];

/** Abas de configuração — só o CEO vê/abre. */
const TABS_CEO: TabId[] = ["roteamento", "assinaturas", "acessos"];

/**
 * Módulo de E-mail (/emails) — CEO (acesso total) + Head (recorte por
 * `emails_permissoes`: caixas visíveis e contas de envio que o CEO liberou
 * na aba Acessos; fail-closed — sem liberação, a tela abre vazia).
 * Multi-conta: caixas de `emails_contas`, filtro por caixa via querystring
 * (?caixa=…&tab=…), regras de alias em `emails_roteamento`.
 * A tabela guarda o histórico completo das caixas — a page carrega só a
 * PRIMEIRA página (cursor keyset, 50 por direção); as demais chegam via
 * server action `paginarEmails` no scroll infinito do client.
 */
export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ caixa?: string; tab?: string }>;
}) {
  const papel = await requirePapel(["ceo", "head_sucesso"]);
  const isCeo = papel === "ceo";

  const supabase = await createServerSupabaseClient();
  const [{ caixa: caixaParam, tab: tabParam }, contasCfg, permissoes] = await Promise.all([
    searchParams,
    fetchEmailsContasConfig(supabase),
    // Permissões só importam p/ a Head — mas a query alimenta a aba Acessos do CEO.
    fetchEmailsPermissoesHead(supabase),
  ]);

  // Recorte da Head: caixas/contas = interseção com o que o CEO liberou.
  const caixas = isCeo
    ? contasCfg.caixas
    : contasCfg.caixas.filter((c) => permissoes.caixas.includes(c));
  const contas = isCeo
    ? contasCfg.contas
    : contasCfg.contas.filter((c) => permissoes.envio.includes(c));
  const padraoEnvio = contas.includes(contasCfg.padraoEnvio)
    ? contasCfg.padraoEnvio
    : (contas[0] ?? contasCfg.padraoEnvio);
  /** Filtro global das queries: undefined = sem recorte (CEO). */
  const caixasPermitidas = isCeo ? undefined : caixas;

  // Filtro só vale se a caixa é uma caixa visível PARA ESTE papel.
  const caixa =
    caixaParam && caixas.includes(caixaParam.toLowerCase())
      ? caixaParam.toLowerCase()
      : undefined;
  const tabInicial =
    TABS_VALIDAS.includes(tabParam as TabId) && (isCeo || !TABS_CEO.includes(tabParam as TabId))
      ? (tabParam as TabId)
      : undefined;

  const [recebidos, enviados, metricas, roteamento, contagens, assinaturas] =
    await Promise.all([
      fetchEmails(supabase, { direcao: "recebido", caixa, caixasPermitidas }),
      fetchEmails(supabase, { direcao: "enviado", caixa, caixasPermitidas }),
      fetchEmailMetricas(supabase, 30, caixa, caixasPermitidas),
      isCeo ? fetchEmailsRoteamento(supabase) : Promise.resolve([]),
      fetchEmailsContagens(supabase, caixa, caixasPermitidas),
      fetchEmailsAssinaturas(supabase),
    ]);

  // Head só recebe as assinaturas das contas de envio liberadas p/ ela.
  const assinaturasVisiveis = isCeo
    ? assinaturas
    : Object.fromEntries(Object.entries(assinaturas).filter(([c]) => contas.includes(c)));

  return (
    <EmailsClient
      isCeo={isCeo}
      recebidos={recebidos.itens}
      cursorRecebidos={recebidos.proximoCursor}
      enviados={enviados.itens}
      cursorEnviados={enviados.proximoCursor}
      contagens={contagens}
      metricas={metricas}
      contas={contas}
      caixas={caixas}
      padraoEnvio={padraoEnvio}
      caixaAtiva={caixa ?? null}
      roteamento={roteamento}
      assinaturas={assinaturasVisiveis}
      contasEnvioTodas={contasCfg.contas}
      permissoesHead={permissoes}
      tabInicial={tabInicial}
    />
  );
}
