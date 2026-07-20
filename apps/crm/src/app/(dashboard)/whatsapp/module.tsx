"use client";

import { useState } from "react";
import { MessageCircle, Users } from "lucide-react";

import type { PapelUsuario } from "@/types/crm";
import type { AgentResumo } from "@/types/agent";
import { BrandTabs } from "@/components/ui";

import { WhatsAppEspelhoClient } from "./client";
import { GruposClient } from "./grupos-client";

type WhatsAppTab = "conversas" | "grupos";

/**
 * Módulo WhatsApp. Para o CEO alterna entre o espelho das conversas 1:1 e o
 * painel de grupos; para o Head de Sucesso mostra SÓ os grupos (a aba 1:1 fica
 * escondida — a RLS também a bloqueia). O switcher é local — cada aba monta seu
 * próprio conteúdo (o espelho 1:1 só polla enquanto está ativo).
 *
 * `podeGerenciar` (CEO/CTO) libera ligar captura + vincular família no painel de
 * grupos; o Head só lê/responde/vê métricas dos grupos vinculados.
 */
export function WhatsAppModule({
  papel,
  agentsConversa,
  agentsAnalise,
  agentsChatbot,
}: {
  papel: PapelUsuario;
  agentsConversa: AgentResumo[];
  agentsAnalise: AgentResumo[];
  /** Agents `chatbot_autonomo` p/ o seletor por conversa do espelho 1:1 (CEO). */
  agentsChatbot: AgentResumo[];
}) {
  const [tab, setTab] = useState<WhatsAppTab>("conversas");
  const isCeo = papel === "ceo"; // cto já resolve p/ ceo em getUserPapel()

  // Head: sem abas, direto no painel de grupos (só gerência p/ CEO).
  if (!isCeo) {
    return (
      <GruposClient
        podeGerenciar={false}
        agentsConversa={agentsConversa}
        agentsAnalise={agentsAnalise}
      />
    );
  }

  return (
    <div className="space-y-4">
      <BrandTabs
        variant="segmented"
        items={[
          { id: "conversas", label: "Conversas", icon: MessageCircle },
          { id: "grupos", label: "Grupos", icon: Users },
        ]}
        activeId={tab}
        onSelect={(id) => setTab(id as WhatsAppTab)}
        ariaLabel="Visões do WhatsApp"
      />

      {tab === "conversas" ? (
        <WhatsAppEspelhoClient
          agentsConversa={agentsConversa}
          agentsAnalise={agentsAnalise}
          agentsChatbot={agentsChatbot}
        />
      ) : (
        <GruposClient podeGerenciar agentsConversa={agentsConversa} agentsAnalise={agentsAnalise} />
      )}
    </div>
  );
}
