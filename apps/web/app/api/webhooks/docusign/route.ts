import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const hmacKey = process.env.DOCUSIGN_HMAC_KEY;
    const body = await request.text();

    // Verificar HMAC se configurado
    if (hmacKey) {
      const signature = request.headers.get("x-docusign-signature-1") || "";
      const computed = createHmac("sha256", hmacKey).update(body).digest("base64");
      if (signature !== computed) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(body);
    const envelopeId = payload?.envelopeId || payload?.data?.envelopeId;
    const status = payload?.status || payload?.data?.envelopeSummary?.status;

    if (!envelopeId) {
      return NextResponse.json({ error: "No envelopeId" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Buscar deal por envelope_id
    const { data: deal } = await supabase
      .from("deals")
      .select("id, atleta:atletas(nome_completo)")
      .eq("docusign_envelope_id", envelopeId)
      .single();

    if (!deal) {
      return NextResponse.json({ message: "Deal not found for envelope" }, { status: 200 });
    }

    const atletaNome = (deal as any).atleta?.nome_completo || "Atleta";

    if (status === "completed" || status === "signed") {
      await supabase.from("deals").update({
        etapa: "contrato_assinado",
        contrato_assinado_at: new Date().toISOString(),
        docusign_status: "assinado",
      }).eq("id", deal.id);

      // Notificar CEO
      const { data: ceo } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("papel", "ceo")
        .eq("ativo", true)
        .limit(1)
        .single();

      if (ceo) {
        await supabase.from("notificacoes").insert({
          destinatario_id: ceo.id,
          titulo: "Contrato assinado via DocuSign",
          mensagem: `${atletaNome} assinou o contrato.`,
          tipo: "docusign",
          severidade: "alta",
          deal_id: deal.id,
          link: "/crm/pipeline",
        });
      }
    } else if (status === "declined" || status === "voided") {
      await supabase.from("deals").update({
        docusign_status: "cancelado",
      }).eq("id", deal.id);

      const { data: ceo } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("papel", "ceo")
        .limit(1)
        .single();

      if (ceo) {
        await supabase.from("notificacoes").insert({
          destinatario_id: ceo.id,
          titulo: "Contrato recusado/cancelado",
          mensagem: `${atletaNome} recusou ou cancelou o contrato no DocuSign.`,
          tipo: "docusign",
          severidade: "alta",
          deal_id: deal.id,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DocuSign webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
