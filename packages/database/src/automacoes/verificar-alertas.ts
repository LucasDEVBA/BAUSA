import { createServerSupabaseClient } from "../client/server";

export async function verificarAlertas() {
  const supabase = await createServerSupabaseClient();
  const alertas: Array<{ tipo: string; titulo: string; mensagem: string; deal_id?: string; severidade: string }> = [];

  const agora = new Date();

  // 1. Deals sem next_action há 48h
  const limite48h = new Date(agora.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const { data: semAction } = await supabase
    .from("deals")
    .select("id, atleta:atletas(nome_completo), etapa")
    .is("next_action", null)
    .is("deleted_at", null)
    .lt("updated_at", limite48h)
    .not("etapa", "in", "(perdido,concluido,cancelamento_solicitado,admission_process)");

  (semAction || []).forEach((d: any) => {
    alertas.push({
      tipo: "sem_next_action",
      titulo: "Deal sem proxima acao",
      mensagem: `${d.atleta?.nome_completo || "Atleta"} — etapa ${d.etapa} sem next action ha 48h+`,
      deal_id: d.id,
      severidade: "alta",
    });
  });

  // 2. Reunião realizada sem proposta há 12h
  const limite12h = new Date(agora.getTime() - 12 * 60 * 60 * 1000).toISOString();
  const { data: semProposta } = await supabase
    .from("deals")
    .select("id, atleta:atletas(nome_completo)")
    .eq("etapa", "reuniao_realizada")
    .is("deleted_at", null)
    .lt("reuniao_realizada_at", limite12h);

  (semProposta || []).forEach((d: any) => {
    alertas.push({
      tipo: "reuniao_sem_proposta",
      titulo: "Preparar proposta",
      mensagem: `Reuniao com ${d.atleta?.nome_completo || "atleta"} realizada ha 12h+ sem proposta.`,
      deal_id: d.id,
      severidade: "alta",
    });
  });

  // 3. Proposta enviada sem follow-up há 48h
  const { data: semFollowup } = await supabase
    .from("deals")
    .select("id, atleta:atletas(nome_completo)")
    .eq("etapa", "proposta_enviada")
    .is("deleted_at", null)
    .lt("updated_at", limite48h);

  (semFollowup || []).forEach((d: any) => {
    alertas.push({
      tipo: "proposta_sem_followup",
      titulo: "Follow-up proposta pendente",
      mensagem: `Proposta para ${d.atleta?.nome_completo || "atleta"} enviada ha 48h+ sem follow-up.`,
      deal_id: d.id,
      severidade: "media",
    });
  });

  // 4. Negociação parada há 4 dias
  const limite4d = new Date(agora.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const { data: negParada } = await supabase
    .from("deals")
    .select("id, atleta:atletas(nome_completo)")
    .eq("etapa", "negociacao")
    .is("deleted_at", null)
    .lt("updated_at", limite4d);

  (negParada || []).forEach((d: any) => {
    alertas.push({
      tipo: "negociacao_parada",
      titulo: "Negociacao parada",
      mensagem: `Negociacao com ${d.atleta?.nome_completo || "atleta"} parada ha 4+ dias.`,
      deal_id: d.id,
      severidade: "critica",
    });
  });

  // 5. Contrato enviado sem assinatura há 48h
  const { data: semAssinatura } = await supabase
    .from("deals")
    .select("id, atleta:atletas(nome_completo)")
    .eq("etapa", "contrato_enviado")
    .is("deleted_at", null)
    .lt("updated_at", limite48h);

  (semAssinatura || []).forEach((d: any) => {
    alertas.push({
      tipo: "contrato_sem_assinatura",
      titulo: "Contrato sem assinatura",
      mensagem: `Contrato de ${d.atleta?.nome_completo || "atleta"} enviado ha 48h+ sem assinatura.`,
      deal_id: d.id,
      severidade: "alta",
    });
  });

  // 6. Alinhamento estratégico sem avanço há 3 dias
  const limite3d = new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: alinhamentoParado } = await supabase
    .from("deals")
    .select("id, atleta:atletas(nome_completo)")
    .eq("etapa", "alinhamento_estrategico")
    .is("deleted_at", null)
    .lt("updated_at", limite3d);

  (alinhamentoParado || []).forEach((d: any) => {
    alertas.push({
      tipo: "alinhamento_sem_avanco",
      titulo: "Alinhamento parado",
      mensagem: `Alinhamento estrategico com ${d.atleta?.nome_completo || "atleta"} parado ha 3+ dias.`,
      deal_id: d.id,
      severidade: "alta",
    });
  });

  // 7. Contrato assinado sem sinal há 48h
  const { data: semSinal } = await supabase
    .from("deals")
    .select("id, atleta:atletas(nome_completo)")
    .eq("etapa", "contrato_assinado")
    .is("deleted_at", null)
    .lt("updated_at", limite48h);

  (semSinal || []).forEach((d: any) => {
    alertas.push({
      tipo: "contrato_sem_sinal",
      titulo: "Contrato assinado sem sinal",
      mensagem: `${d.atleta?.nome_completo || "Atleta"} assinou contrato ha 48h+ sem pagamento do sinal.`,
      deal_id: d.id,
      severidade: "critica",
    });
  });

  return alertas;
}
