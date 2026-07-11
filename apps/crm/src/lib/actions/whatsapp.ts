"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

export async function enviarWhatsAppManual(params: {
  destinatario: string;
  mensagem: string;
  dealId?: string;
}) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO." };

  const url = process.env.SEND_WHATSAPP_URL;
  const secret = process.env.WEBHOOK_SECRET;

  if (!url) return { success: false, error: "SEND_WHATSAPP_URL nao configurada." };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": secret || "",
      },
      body: JSON.stringify({
        phone: params.destinatario,
        message: params.mensagem,
        messageType: "manual",
      }),
    });

    if (!response.ok) {
      return { success: false, error: `Erro HTTP ${response.status}` };
    }

    // Registrar no log
    const supabase = await createAuditedSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (params.dealId && user) {
      await supabase.from("notificacoes").insert({
        destinatario_id: user.id,
        titulo: "WhatsApp enviado",
        mensagem: `Mensagem enviada para ${params.destinatario}`,
        tipo: "whatsapp_manual",
        severidade: "baixa",
        deal_id: params.dealId,
      });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: "Erro ao enviar WhatsApp." };
  }
}

export async function enviarConviteReuniao(dealId: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO." };

  const supabase = await createAuditedSupabaseClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, atleta:atletas(nome_completo, whatsapp, esporte, responsavel:responsaveis!atletas_responsavel_id_fkey(nome, whatsapp))")
    .eq("id", dealId)
    .single();

  if (!deal) return { success: false, error: "Deal nao encontrado." };

  const atleta = (deal as any).atleta;
  const whatsapp = atleta?.responsavel?.whatsapp || atleta?.whatsapp;

  if (!whatsapp) return { success: false, error: "Sem numero WhatsApp." };

  const calendlyUrl = process.env.CALENDLY_URL || "https://calendly.com/bolsaatletausa";
  const mensagem = `Ola! Sou da Bolsa Atleta USA. Gostariamos de agendar uma reuniao para conversar sobre o projeto do(a) ${atleta?.nome_completo || "atleta"}. Acesse o link para escolher o melhor horario: ${calendlyUrl}`;

  return enviarWhatsAppManual({ destinatario: whatsapp, mensagem, dealId });
}
