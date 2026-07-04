import type { Metadata } from "next";

import { requirePapel } from "@/lib/auth";

import { WhatsAppEspelhoClient } from "./client";

export const metadata: Metadata = {
  title: "WhatsApp",
};

/**
 * Espelho do WhatsApp — leitura e resposta das conversas do número comercial
 * via proxy Z-API (/api/whatsapp/*). Acesso restrito a CEO (cto resolve p/ ceo).
 */
export default async function WhatsAppPage() {
  await requirePapel("ceo");

  return <WhatsAppEspelhoClient />;
}
