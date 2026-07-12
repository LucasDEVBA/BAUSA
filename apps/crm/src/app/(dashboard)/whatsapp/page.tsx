import type { Metadata } from "next";

import { requirePapel } from "@/lib/auth";

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
 */
export default async function WhatsAppPage() {
  const papel = await requirePapel(["ceo", "head_sucesso"]);

  return <WhatsAppModule papel={papel} />;
}
