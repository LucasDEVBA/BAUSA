import { createAuditedSupabaseClient } from "../client/audit";
import { getUserPapel, getUserProfile } from "../auth";
import type { CrmExperiencia } from "../types/crm";

export async function registrarContato(experienciaId: string, dados: {
  tipo: 'whatsapp' | 'email' | 'ligacao' | 'presencial';
  resumo: string;
  proximo_contato: string;
}) {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) {
    return { success: false, error: "Sem permissao." };
  }

  if (!dados.resumo.trim()) {
    return { success: false, error: "Resumo do contato e obrigatorio." };
  }

  if (!dados.proximo_contato) {
    return { success: false, error: "Data do proximo contato e obrigatoria." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Inserir contato
  const { error: contatoError } = await supabase
    .from("contatos_experiencia")
    .insert({
      experiencia_id: experienciaId,
      tipo: dados.tipo,
      resumo: dados.resumo,
      proximo_contato: dados.proximo_contato,
      registrado_por: user?.id,
      created_by: user?.id,
    });

  if (contatoError) {
    return { success: false, error: contatoError.message };
  }

  // Atualizar experiência
  const { error: updateError } = await supabase
    .from("crm_experiencia")
    .update({
      data_ultimo_contato: new Date().toISOString(),
      tipo_ultimo_contato: dados.tipo,
      proximo_contato: dados.proximo_contato,
    })
    .eq("id", experienciaId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}

export async function atualizarExperiencia(experienciaId: string, dados: {
  fase?: string;
  ansiedade?: number;
  satisfacao?: number;
  risco_percebido?: number;
  status?: 'satisfeita' | 'atencao' | 'crise';
  descricao_problema?: string;
  acao_em_andamento?: string;
  tipo_crise?: string;
  nivel_crise?: string;
  psicologa_acionada?: boolean;
  data_prevista_embarque?: string;
}) {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) {
    return { success: false, error: "Sem permissao." };
  }

  // Validar campos obrigatórios para atenção/crise
  if (dados.status === "atencao" || dados.status === "crise") {
    if (!dados.descricao_problema?.trim()) {
      return { success: false, error: "Descricao do problema e obrigatoria para status Atencao/Crise." };
    }
  }

  if (dados.status === "crise") {
    if (!dados.tipo_crise) {
      return { success: false, error: "Tipo de crise e obrigatorio." };
    }
  }

  const supabase = await createAuditedSupabaseClient();

  // Calcular temperatura automática (Regra 8)
  const updateData: Record<string, unknown> = { ...dados };
  if (dados.ansiedade !== undefined || dados.satisfacao !== undefined) {
    // Buscar valores atuais se não fornecidos
    const { data: current } = await supabase
      .from("crm_experiencia")
      .select("ansiedade, satisfacao, status")
      .eq("id", experienciaId)
      .single();

    const ansiedade = dados.ansiedade ?? current?.ansiedade ?? 3;
    const satisfacao = dados.satisfacao ?? current?.satisfacao ?? 5;
    const status = dados.status ?? current?.status ?? "satisfeita";

    if (ansiedade >= 4 || satisfacao <= 2) {
      updateData.temperatura = "vermelho";
    } else if (ansiedade <= 2 && satisfacao >= 4 && status === "satisfeita") {
      updateData.temperatura = "verde";
    } else {
      updateData.temperatura = "amarelo";
    }
  }

  const { error } = await supabase
    .from("crm_experiencia")
    .update(updateData)
    .eq("id", experienciaId);

  if (error) {
    return { success: false, error: error.message };
  }

  // Notificar CEO se mudou para atenção/crise (Regra 6)
  if (dados.status === "atencao" || dados.status === "crise") {
    const { data: ceoUser } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("papel", "ceo")
      .eq("ativo", true)
      .limit(1)
      .single();

    if (ceoUser) {
      const { data: exp } = await supabase
        .from("crm_experiencia")
        .select("atleta:atletas(nome_completo)")
        .eq("id", experienciaId)
        .single();

      const nome = (exp as any)?.atleta?.nome_completo || "Atleta";
      const sev = dados.status === "crise" ? "critica" : "alta";

      await supabase.from("notificacoes").insert({
        destinatario_id: ceoUser.id,
        titulo: `Familia em ${dados.status.toUpperCase()}: ${nome}`,
        mensagem: dados.descricao_problema || `Status alterado para ${dados.status}`,
        tipo: "experiencia_alerta",
        severidade: sev,
      });
    }
  }

  return { success: true };
}

export async function escalonarCEO(experienciaId: string, contexto: string) {
  const papel = await getUserPapel();
  if (papel !== "head_sucesso") {
    return { success: false, error: "Apenas a Head de Sucesso pode escalonar." };
  }

  if (!contexto.trim()) {
    return { success: false, error: "Descreva o contexto do escalonamento." };
  }

  const supabase = await createAuditedSupabaseClient();

  // Buscar CEO
  const { data: ceoUser } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("papel", "ceo")
    .eq("ativo", true)
    .limit(1)
    .single();

  if (!ceoUser) {
    return { success: false, error: "CEO nao encontrado." };
  }

  // Buscar dados da experiência
  const { data: exp } = await supabase
    .from("crm_experiencia")
    .select("deal_id, atleta:atletas(nome_completo)")
    .eq("id", experienciaId)
    .single();

  const nome = (exp as any)?.atleta?.nome_completo || "Atleta";
  const dealId = exp?.deal_id;

  const prazo = new Date();
  prazo.setHours(prazo.getHours() + 2);

  // Criar tarefa crítica para CEO
  await supabase.from("tarefas").insert({
    titulo: `ESCALONAMENTO: ${nome} — atencao necessaria`,
    descricao: contexto,
    responsavel_id: ceoUser.id,
    prazo: prazo.toISOString(),
    prioridade: "critica",
    deal_id: dealId,
    modulo_origem: "experiencia",
    criada_automaticamente: true,
  });

  // Notificação crítica
  await supabase.from("notificacoes").insert({
    destinatario_id: ceoUser.id,
    titulo: `Escalonamento: ${nome}`,
    mensagem: contexto,
    tipo: "escalonamento",
    severidade: "critica",
    deal_id: dealId,
    link: "/crm/experiencia",
  });

  return { success: true };
}

export async function getExperiencias(papel: string, userId: string) {
  const supabase = await createAuditedSupabaseClient();

  const { data } = await supabase
    .from("crm_experiencia")
    .select(`
      *,
      atleta:atletas(nome_completo, whatsapp, esporte, serie_escolar, responsavel_id,
        responsavel:responsaveis(nome, whatsapp)),
      deal:deals(id, etapa, valor_estimado, contrato:contratos_financeiros(plano, valor_total))
    `)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  return data || [];
}

export async function getContatosExperiencia(experienciaId: string) {
  const supabase = await createAuditedSupabaseClient();

  const { data } = await supabase
    .from("contatos_experiencia")
    .select("*")
    .eq("experiencia_id", experienciaId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  return data || [];
}
