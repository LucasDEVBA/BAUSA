"use client";

import { useState } from "react";
import { MessageCircle, Users } from "lucide-react";

import { BrandTabs } from "@/components/ui";

import { WhatsAppEspelhoClient } from "./client";
import { GruposClient } from "./grupos-client";

type WhatsAppTab = "conversas" | "grupos";

/**
 * Módulo WhatsApp (CEO-only): alterna entre o espelho das conversas 1:1 e o
 * coletor de grupos (Fase A dos agents). O switcher é local — cada aba monta seu
 * próprio conteúdo (o espelho só polla enquanto está ativo).
 */
export function WhatsAppModule() {
  const [tab, setTab] = useState<WhatsAppTab>("conversas");

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

      {tab === "conversas" ? <WhatsAppEspelhoClient /> : <GruposClient />}
    </div>
  );
}
