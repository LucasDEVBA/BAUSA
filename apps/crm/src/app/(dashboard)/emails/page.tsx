import type { Metadata } from "next";

import { requirePapel } from "@/lib/auth";
import { fetchEmailMetricas, fetchEmails } from "@/lib/emails-queries";
import { createServerSupabaseClient } from "@/lib/supabase-server";

import { EmailsClient } from "./client";

export const metadata: Metadata = {
  title: "E-mails",
};

/**
 * Módulo de E-mail (/emails) — apenas CEO.
 * Caixa de entrada (sync do Gmail via CF), enviados (compositor) e métricas
 * (eventos do Resend). Tudo lido de emails_mensagens (RLS SELECT nível CEO).
 */
export default async function EmailsPage() {
  await requirePapel("ceo");

  const supabase = await createServerSupabaseClient();
  const [recebidos, enviados, metricas] = await Promise.all([
    fetchEmails(supabase, "recebido"),
    fetchEmails(supabase, "enviado"),
    fetchEmailMetricas(supabase, 30),
  ]);

  return <EmailsClient recebidos={recebidos} enviados={enviados} metricas={metricas} />;
}
