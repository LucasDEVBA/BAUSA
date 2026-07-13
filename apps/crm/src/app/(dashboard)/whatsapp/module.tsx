"use client";

import { useState } from "react";
import { MessageCircle, Users } from "lucide-react";

import type { PapelUsuario } from "@/types/crm";
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
export function WhatsAppModule({ papel }: { papel: PapelUsuario }) {
  const [tab, setTab] = useState<WhatsAppTab>("conversas");
  const isCeo = papel === "ceo"; // cto já resolve p/ ceo em getUserPapel()

  // Head: sem abas, direto no painel de grupos (só gerência p/ CEO).
  if (!isCeo) {
    return <GruposClient podeGerenciar={false} />;
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

      {tab === "conversas" ? <WhatsAppEspelhoClient /> : <GruposClient podeGerenciar />}
    </div>
  );
}
