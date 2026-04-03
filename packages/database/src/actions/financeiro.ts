import { createAuditedSupabaseClient } from "../client/audit";
import { getUserPapel } from "../auth";
import { PLANO_VALORES, ENTRADA_PADRAO } from "../types/crm";

export async function criarContrato(dealId: string, dados: {
  plano: 'journey' | 'legacy' | 'start';
  forma_pagamento_plano: 'padrao' | 'pix_avista';
  entrada_valor?: number;
  entrada_forma: 'pix' | 'getnet_parcelado';
  entrada_parcelas?: number;
  saldo_forma: 'pix_avista' | 'getnet_parcelado';
  saldo_parcelas?: number;
}) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode criar contratos." };
  }

  const supabase = await createAuditedSupabaseClient();

  // Verificar duplicata
  const { data: existing } = await supabase
    .from("contratos_financeiros")
    .select("id")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "Ja existe contrato para este deal." };
  }

  const planoConfig = PLANO_VALORES[dados.plano];
  const valorTotal = dados.forma_pagamento_plano === "pix_avista"
    ? planoConfig.pix
    : planoConfig.padrao;
  const entradaValor = dados.entrada_valor ?? ENTRADA_PADRAO;
  const saldoRemanescente = valorTotal - entradaValor;

  const { data: contrato, error: contratoError } = await supabase
    .from("contratos_financeiros")
    .insert({
      deal_id: dealId,
      plano: dados.plano,
      forma_pagamento_plano: dados.forma_pagamento_plano,
      valor_total: valorTotal,
      entrada_valor: entradaValor,
      entrada_forma: dados.entrada_forma,
      entrada_parcelas: dados.entrada_parcelas ?? 1,
      saldo_forma: dados.saldo_forma,
      saldo_parcelas: dados.saldo_parcelas ?? 1,
      inclui_psicologa: planoConfig.psicologa,
      custo_psicologa: planoConfig.psicologa ? 1200 : 0,
    })
    .select("id")
    .single();

  if (contratoError || !contrato) {
    return { success: false, error: `Erro ao criar contrato: ${contratoError?.message}` };
  }

  // Gerar parcelas
  const parcelas: Array<{
    contrato_id: string;
    tipo: string;
    numero_parcela: string;
    valor: number;
    vencimento: string;
    metodo: string;
    status: string;
  }> = [];

  const hoje = new Date();

  // Parcela(s) de entrada
  const numEntrada = dados.entrada_parcelas ?? 1;
  const valorPorEntrada = entradaValor / numEntrada;
  for (let i = 0; i < numEntrada; i++) {
    const venc = new Date(hoje);
    venc.setDate(venc.getDate() + 30 * i);
    parcelas.push({
      contrato_id: contrato.id,
      tipo: "entrada",
      numero_parcela: numEntrada === 1 ? "Entrada" : `Entrada ${i + 1}/${numEntrada}`,
      valor: Math.round(valorPorEntrada * 100) / 100,
      vencimento: venc.toISOString().split("T")[0],
      metodo: dados.entrada_forma === "getnet_parcelado" ? "getnet" : "pix",
      status: "previsto",
    });
  }

  // Parcela(s) de saldo
  if (saldoRemanescente > 0) {
    if (dados.saldo_forma === "pix_avista") {
      const vencSaldo = new Date(hoje);
      vencSaldo.setDate(vencSaldo.getDate() + 30);
      parcelas.push({
        contrato_id: contrato.id,
        tipo: "saldo",
        numero_parcela: "Saldo (Pix)",
        valor: saldoRemanescente,
        vencimento: vencSaldo.toISOString().split("T")[0],
        metodo: "pix",
        status: "previsto",
      });
    } else {
      const numSaldo = dados.saldo_parcelas ?? 6;
      const valorPorSaldo = saldoRemanescente / numSaldo;
      for (let i = 0; i < numSaldo; i++) {
        const venc = new Date(hoje);
        venc.setDate(venc.getDate() + 30 * (i + 1));
        parcelas.push({
          contrato_id: contrato.id,
          tipo: "saldo",
          numero_parcela: `${i + 1}/${numSaldo}`,
          valor: Math.round(valorPorSaldo * 100) / 100,
          vencimento: venc.toISOString().split("T")[0],
          metodo: "getnet",
          status: "previsto",
        });
      }
    }
  }

  if (parcelas.length > 0) {
    const { error: parcError } = await supabase.from("parcelas").insert(parcelas);
    if (parcError) {
      return { success: false, error: `Erro ao criar parcelas: ${parcError.message}` };
    }
  }

  return { success: true, contratoId: contrato.id };
}

export async function confirmarPagamento(parcelaId: string, dados?: { comprovante_url?: string }) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode confirmar pagamentos." };
  }

  const supabase = await createAuditedSupabaseClient();

  const { data: parcela, error: fetchErr } = await supabase
    .from("parcelas")
    .select("*, contrato:contratos_financeiros(deal_id)")
    .eq("id", parcelaId)
    .single();

  if (fetchErr || !parcela) {
    return { success: false, error: "Parcela nao encontrada." };
  }

  const { error: updateErr } = await supabase
    .from("parcelas")
    .update({
      status: "recebido",
      recebido_at: new Date().toISOString(),
      comprovante_url: dados?.comprovante_url || null,
    })
    .eq("id", parcelaId);

  if (updateErr) {
    return { success: false, error: updateErr.message };
  }

  // Se é entrada, confirmar sinal pago no deal
  if (parcela.tipo === "entrada") {
    const dealId = (parcela as any).contrato?.deal_id;
    if (dealId) {
      await confirmarSinalPago(dealId);
    }
  }

  return { success: true };
}

export async function confirmarSinalPago(dealId: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode confirmar sinal." };
  }

  const supabase = await createAuditedSupabaseClient();

  // Atualizar deal
  const { error: dealErr } = await supabase
    .from("deals")
    .update({
      sinal_pago_at: new Date().toISOString(),
      etapa: "sinal_pago",
    })
    .eq("id", dealId);

  if (dealErr) {
    return { success: false, error: dealErr.message };
  }

  // Handoff: criar registro de experiência
  const { data: deal } = await supabase
    .from("deals")
    .select("atleta_id, atleta:atletas(nome_completo, responsavel_id, escola_atual, cidade_estado)")
    .eq("id", dealId)
    .single();

  if (deal?.atleta_id) {
    // Verificar se já existe experiência
    const { data: existingExp } = await supabase
      .from("crm_experiencia")
      .select("id")
      .eq("atleta_id", deal.atleta_id)
      .maybeSingle();

    if (!existingExp) {
      // Verificar se contrato inclui psicologa
      const { data: contrato } = await supabase
        .from("contratos_financeiros")
        .select("inclui_psicologa")
        .eq("deal_id", dealId)
        .is("deleted_at", null)
        .maybeSingle();

      const expInsert: Record<string, unknown> = {
        atleta_id: deal.atleta_id,
        deal_id: dealId,
        fase: "admissao",
        temperatura: "verde",
        ansiedade: 3,
        satisfacao: 5,
        risco_percebido: 1,
        status: "satisfeita",
        escola_confirmada_id: null,
        data_prevista_embarque: null,
      };

      if (contrato?.inclui_psicologa) {
        expInsert.psicologa_acionada = false;
      }

      await supabase.from("crm_experiencia").insert(expInsert);

      // Criar tarefa de onboarding para Head de Sucesso
      const { data: headUser } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("papel", "head_sucesso")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const headId = headUser?.id || currentUser?.id;

      if (headId) {
        const prazo = new Date();
        prazo.setHours(prazo.getHours() + 48);

        const atletaNome = (deal as any).atleta?.nome_completo || "Atleta";

        await supabase.from("tarefas").insert({
          titulo: `Reuniao de onboarding — ${atletaNome}`,
          descricao: "Realizar reuniao de onboarding com a familia. Prazo: 48h.",
          responsavel_id: headId,
          prazo: prazo.toISOString(),
          prioridade: "alta",
          deal_id: dealId,
          modulo_origem: "experiencia",
          criada_automaticamente: true,
        });
      }

      // Notificações
      if (currentUser?.id) {
        const atletaNome = (deal as any).atleta?.nome_completo || "Atleta";
        const notifs = [
          {
            destinatario_id: currentUser.id,
            titulo: "Sinal pago — Handoff para Experiencia",
            mensagem: `${atletaNome} pagou o sinal. Registro de experiencia criado. Onboarding em 48h.`,
            tipo: "handoff",
            severidade: "alta",
            deal_id: dealId,
            link: "/crm/experiencia",
          },
        ];

        if (headId && headId !== currentUser.id) {
          notifs.push({
            destinatario_id: headId,
            titulo: "Nova familia para onboarding",
            mensagem: `${atletaNome} assinou e pagou o sinal. Realizar onboarding em 48h.`,
            tipo: "handoff",
            severidade: "alta",
            deal_id: dealId,
            link: "/crm/experiencia",
          });
        }

        await supabase.from("notificacoes").insert(notifs);
      }
    }
  }

  return { success: true };
}

export async function updateNfData(dados: {
  contractId: string;
  nfNumero: string | null;
  nfEmitidaAt: string | null;
  nfValor: number | null;
  nfStatus: "pendente" | "emitida" | "nao_aplicavel";
}) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode editar dados de NF." };
  }

  const supabase = await createAuditedSupabaseClient();

  const { error } = await supabase
    .from("contratos_financeiros")
    .update({
      nf_numero: dados.nfNumero,
      nf_emitida_at: dados.nfEmitidaAt,
      nf_valor: dados.nfValor,
      nf_status: dados.nfStatus,
    })
    .eq("id", dados.contractId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Revalidar a pagina financeiro
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/financeiro");

  return { success: true };
}

export async function solicitarCancelamento(dealId: string, dados: {
  motivo_cancelamento: string;
  valor_reembolso: number;
  justificativa_reembolso: string;
  comprovante_url?: string;
}) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode processar cancelamentos." };
  }

  const supabase = await createAuditedSupabaseClient();

  // Buscar deal
  const { data: deal, error: fetchErr } = await supabase
    .from("deals")
    .select("id, etapa, atleta:atletas(nome_completo, responsavel_id)")
    .eq("id", dealId)
    .single();

  if (fetchErr || !deal) {
    return { success: false, error: "Deal nao encontrado." };
  }

  // Atualizar deal com dados de cancelamento
  const { error: updateErr } = await supabase
    .from("deals")
    .update({
      etapa: "perdido",
      etapa_anterior: deal.etapa,
      motivo_perda: "cancelamento_processado",
      detalhe_perda: dados.motivo_cancelamento,
    })
    .eq("id", dealId);

  if (updateErr) {
    return { success: false, error: `Erro ao processar cancelamento: ${updateErr.message}` };
  }

  // Cancelar parcelas pendentes do contrato
  const { data: contrato } = await supabase
    .from("contratos_financeiros")
    .select("id")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .maybeSingle();

  if (contrato) {
    await supabase
      .from("parcelas")
      .update({ status: "cancelado" })
      .eq("contrato_id", contrato.id)
      .eq("status", "previsto");
  }

  // Criar notificacao para CEO
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser?.id) {
    const rawAtleta = deal.atleta as unknown;
    const atletaData = (Array.isArray(rawAtleta) ? rawAtleta[0] : rawAtleta) as Record<string, unknown> | null;
    const atletaNome = (atletaData?.nome_completo as string) ?? "Atleta";

    await supabase.from("notificacoes").insert({
      destinatario_id: currentUser.id,
      titulo: "Cancelamento processado",
      mensagem: `Cancelamento de ${atletaNome} processado. Reembolso: R$ ${dados.valor_reembolso.toLocaleString("pt-BR")}. Motivo: ${dados.motivo_cancelamento}`,
      tipo: "cancelamento",
      severidade: "alta",
      deal_id: dealId,
      link: "/financeiro?tab=cancelamentos",
    });
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/financeiro");

  return { success: true };
}

export async function getContratoByDeal(dealId: string) {
  const supabase = await createAuditedSupabaseClient();

  const { data: contrato } = await supabase
    .from("contratos_financeiros")
    .select("*")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!contrato) return { contrato: null, parcelas: [] };

  const { data: parcelas } = await supabase
    .from("parcelas")
    .select("*")
    .eq("contrato_id", contrato.id)
    .is("deleted_at", null)
    .order("vencimento", { ascending: true });

  return { contrato, parcelas: parcelas || [] };
}
