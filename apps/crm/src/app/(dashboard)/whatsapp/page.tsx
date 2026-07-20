import type { Metadata } from "next";

import { requirePapel } from "@/lib/auth";
import { listarAgentsAtivos } from "@/lib/actions/agents";

import { WhatsAppModule } from "./module";

export const metadata: Metadata = {
  title: "WhatsApp",
};

/**
 * Módulo WhatsApp:
 *  • CEO (cto resolve p/ ceo) → espelho das conversas 1:1 (proxy Z-API
 *    /api/whatsapp/*) + coletor/painel de grupos de clientes.
 *  • Head de Sucesso → SÓ a aba Grupos (grupos vinculados às famílias que
 *    acompanha). A aba Conversas 1:1 fica escondida (e a RLS já a bloqueia).
 *
 * Agents custom: `conversa` alimenta o seletor de copiloto da sugestão (CEO e
 * Head); `analise` alimenta o "Analisar com agent" (CEO-only — para o Head a
 * action devolve lista vazia e o bloco não renderiza); `chatbot_autonomo`
 * alimenta o seletor "Agent do chatbot" por conversa no espelho 1:1 (CEO-only
 * — substitui SÓ a persona do bot; o critério de segurança segue global).
 */
export default async function WhatsAppPage() {
  const papel = await requirePapel(["ceo", "head_sucesso"]);

  const [agentsConversa, agentsAnalise, agentsChatbot] = await Promise.all([
    listarAgentsAtivos("conversa"),
    listarAgentsAtivos("analise"),
    listarAgentsAtivos("chatbot_autonomo"),
  ]);

  return (
    <WhatsAppModule
      papel={papel}
      agentsConversa={agentsConversa}
      agentsAnalise={agentsAnalise}
      agentsChatbot={agentsChatbot}
    />
  );
}
