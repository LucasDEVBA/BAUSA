import type { Metadata } from "next";

import { requirePapel } from "@/lib/auth";

import { WhatsAppModule } from "./module";

export const metadata: Metadata = {
  title: "WhatsApp",
};

/**
 * Módulo WhatsApp (CEO-only, cto resolve p/ ceo): espelho das conversas 1:1
 * (proxy Z-API /api/whatsapp/*) + coletor de grupos de clientes (Fase A dos
 * agents — captura opt-in por grupo + vínculo à família).
 */
export default async function WhatsAppPage() {
  await requirePapel("ceo");

  return <WhatsAppModule />;
}
