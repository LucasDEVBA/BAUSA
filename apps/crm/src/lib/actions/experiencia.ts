"use server";

import { revalidatePath } from "next/cache";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

type FaseExperiencia =
  | "envio_opcoes"
  | "admissao"
  | "aprovado"
  | "pagamento_remanescente"
  | "pre_embarque"
  | "embarcado_inicial"
  | "acompanhamento"
  | "encerrado";

type StatusFamilia = "satisfeita" | "atencao" | "crise";
type CanalContato = "whatsapp" | "email" | "ligacao" | "presencial";
type TipoCrise =
  | "emocional"
  | "academica"
  | "financeira"
  | "familiar"
  | "bullying"
  | "saude";
type NivelCrise = "baixo" | "medio" | "alto" | "critico";
type TipoRisco =
  | "academico"
  | "esportivo"
  | "emocional"
  | "financeiro"
  | "relacional"
  | "comunicacao";

function ok<T extends object>(extra?: T) {
  return { success: true as const, ...(extra ?? {}) };
}

function fail(error: string) {
  return { success: false as const, error };
}

async function requireExperiencePapel() {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) {
    return null;
  }
  return papel;
}

function calcTemperatura(
  ansiedade: number,
  satisfacao: number,
  status: StatusFamilia
): "verde" | "amarelo" | "vermelho" {
  if (ansiedade >= 4 || satisfacao <= 2) return "vermelho";
  if (ansiedade <= 2 && satisfacao >= 4 && status === "satisfeita") return "verde";
  return "amarelo";
}

async function notifyCeo(
  supabase: Awaited<ReturnType<typeof createAuditedSupabaseClient>>,
  payload: {
    titulo: string;
    mensagem: string;
    severidade: "media" | "alta" | "critica";
    deal_id?: string | null;
  }
) {
  const { data: ceoUser } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("papel", "ceo")
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (!ceoUser) return;

  await supabase.from("notificacoes").insert({
    destinatario_id: ceoUser.id,
    titulo: payload.titulo,
    mensagem: payload.mensagem,
    tipo: "experiencia_alerta",
    severidade: payload.severidade,
    deal_id: payload.deal_id ?? null,
    link: "/familias-crm",
  });
}

// ─── Registrar contato ───────────────────────────────────────
export interface ContatoAnexo {
  path: string;
  name: string;
  type: string;
  size: number;
  uploaded_at: string;
}

export async function registrarContato(
  experienciaId: string,
  dados: {
    tipo: CanalContato;
    resumo: string;
    proximo_contato: string;
    anexos?: ContatoAnexo[];
  }
) {
  const papel = await requireExperiencePapel();
  if (!papel) return fail("Sem permissao.");
  if (!dados.resumo.trim()) return fail("Resumo do contato e obrigatorio.");
  if (!dados.proximo_contato) return fail("Data do proximo contato e obrigatoria.");

  const supabase = await createAuditedSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: contatoError } = await supabase.from("contatos_experiencia").insert({
    experiencia_id: experienciaId,
    tipo: dados.tipo,
    resumo: dados.resumo,
    proximo_contato: dados.proximo_contato,
    anexos: dados.anexos ?? [],
    registrado_por: user?.id,
    created_by: user?.id,
  });
  if (contatoError) return fail(contatoError.message);

  const { error: updateError } = await supabase
    .from("crm_experiencia")
    .update({
      data_ultimo_contato: new Date().toISOString(),
      tipo_ultimo_contato: dados.tipo,
      proximo_contato: dados.proximo_contato,
    })
    .eq("id", experienciaId);
  if (updateError) return fail(updateError.message);

  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  return ok();
}

// ─── Atualizar experiencia (indicadores, status, fase) ───────
export async function atualizarExperiencia(
  experienciaId: string,
  dados: {
    fase?: FaseExperiencia;
    ansiedade?: number;
    satisfacao?: number;
    risco_percebido?: number;
    tipos_risco?: TipoRisco[];
    status?: StatusFamilia;
    descricao_problema?: string;
    acao_em_andamento?: string;
    proxima_acao?: string;
    tipo_crise?: TipoCrise | null;
    nivel_crise?: NivelCrise | null;
    psicologa_acionada?: boolean;
    data_prevista_embarque?: string | null;
  }
) {
  const papel = await requireExperiencePapel();
  if (!papel) return fail("Sem permissao.");

  // Regras obrigatórias
  if (dados.status === "atencao" || dados.status === "crise") {
    if (!dados.descricao_problema?.trim())
      return fail("Descricao do problema e obrigatoria para Atencao/Crise.");
    if (!dados.acao_em_andamento?.trim())
      return fail("Acao em andamento e obrigatoria para Atencao/Crise.");
  }

  if (dados.status === "crise") {
    if (!dados.tipo_crise) return fail("Tipo de crise e obrigatorio.");
    if (!dados.nivel_crise) return fail("Nivel da crise e obrigatorio.");
  }

  if (dados.ansiedade !== undefined && (dados.ansiedade < 1 || dados.ansiedade > 5))
    return fail("Ansiedade deve estar entre 1 e 5.");
  if (
    dados.satisfacao !== undefined &&
    (dados.satisfacao < 1 || dados.satisfacao > 5)
  )
    return fail("Satisfacao deve estar entre 1 e 5.");
  if (
    dados.risco_percebido !== undefined &&
    (dados.risco_percebido < 1 || dados.risco_percebido > 5)
  )
    return fail("Risco percebido deve estar entre 1 e 5.");

  const supabase = await createAuditedSupabaseClient();

  // Buscar valores atuais para calcular temperatura
  const { data: current } = await supabase
    .from("crm_experiencia")
    .select("ansiedade, satisfacao, status, deal_id, atleta_id")
    .eq("id", experienciaId)
    .maybeSingle();

  if (!current) return fail("Experiencia nao encontrada.");

  const ansiedade = dados.ansiedade ?? current.ansiedade ?? 3;
  const satisfacao = dados.satisfacao ?? current.satisfacao ?? 5;
  const status = (dados.status ?? current.status ?? "satisfeita") as StatusFamilia;

  const updateData: Record<string, unknown> = { ...dados };
  // Combinar acao_em_andamento + proxima_acao em um único campo (separado por “| Proxima:”)
  if (dados.proxima_acao !== undefined) {
    const base = (dados.acao_em_andamento ?? "").trim();
    const proxima = dados.proxima_acao.trim();
    updateData.acao_em_andamento = proxima
      ? `${base}${base ? " | " : ""}Proxima: ${proxima}`
      : base;
    delete (updateData as { proxima_acao?: string }).proxima_acao;
  }
  updateData.temperatura = calcTemperatura(ansiedade, satisfacao, status);

  if (dados.status === "crise" && dados.psicologa_acionada === true) {
    updateData.psicologa_acionada = true;
    updateData.psicologa_acionada_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("crm_experiencia")
    .update(updateData)
    .eq("id", experienciaId);
  if (error) return fail(error.message);

  // Notificar CEO em atenção/crise
  if (dados.status === "atencao" || dados.status === "crise") {
    const { data: exp } = await supabase
      .from("crm_experiencia")
      .select("atleta:atletas(nome_completo)")
      .eq("id", experienciaId)
      .maybeSingle();
    const expAtleta = exp?.atleta as unknown;
    const atletaObj = (Array.isArray(expAtleta) ? expAtleta[0] : expAtleta) as
      | { nome_completo?: string }
      | null;
    const nome = atletaObj?.nome_completo || "Atleta";
    const severidade = dados.status === "crise" ? "critica" : "alta";
    await notifyCeo(supabase, {
      titulo: `Familia em ${dados.status.toUpperCase()}: ${nome}`,
      mensagem:
        dados.descricao_problema || `Status alterado para ${dados.status}`,
      severidade,
      deal_id: current.deal_id ?? null,
    });
  }

  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  return ok();
}

// ─── Registrar nota NPS (6 meses) ────────────────────────────
// A pesquisa é enviada pela CF experiencia-scheduler (WhatsApp); a família
// responde pelo WhatsApp normal e a Head registra a nota aqui manualmente.
export async function registrarNps(experienciaId: string, nota: number) {
  const papel = await requireExperiencePapel();
  if (!papel) return fail("Sem permissao.");
  if (!Number.isInteger(nota) || nota < 0 || nota > 10)
    return fail("Nota NPS deve ser um inteiro entre 0 e 10.");

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("crm_experiencia")
    .update({ nps_6meses: nota })
    .eq("id", experienciaId);
  if (error) return fail(error.message);

  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  revalidatePath("/familias");
  return ok();
}

// ─── Escalonar para CEO ──────────────────────────────────────
export async function escalonarCEO(experienciaId: string, contexto: string) {
  const papel = await getUserPapel();
  if (papel !== "head_sucesso" && papel !== "ceo")
    return fail("Sem permissao para escalonar.");
  if (!contexto.trim()) return fail("Descreva o contexto do escalonamento.");

  const supabase = await createAuditedSupabaseClient();

  const { data: ceoUser } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("papel", "ceo")
    .eq("ativo", true)
    .limit(1)
    .maybeSingle();

  if (!ceoUser) return fail("CEO nao encontrado.");

  const { data: exp } = await supabase
    .from("crm_experiencia")
    .select("deal_id, atleta:atletas(nome_completo)")
    .eq("id", experienciaId)
    .maybeSingle();

  const rawAtleta = exp?.atleta as unknown;
  const atletaObj = (Array.isArray(rawAtleta) ? rawAtleta[0] : rawAtleta) as
    | { nome_completo?: string }
    | null;
  const nome = atletaObj?.nome_completo || "Atleta";
  const dealId = exp?.deal_id ?? null;

  const prazo = new Date(Date.now() + 2 * 60 * 60 * 1000);

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

  await supabase.from("notificacoes").insert({
    destinatario_id: ceoUser.id,
    titulo: `Escalonamento: ${nome}`,
    mensagem: contexto,
    tipo: "escalonamento",
    severidade: "critica",
    deal_id: dealId,
    link: "/familias-crm",
  });

  revalidatePath("/familias-crm");
  return ok();
}

// ─── Mover fase (drag-drop no Kanban Família) ────────────────
export async function moverFaseFamilia(
  experienciaId: string,
  novaFase: FaseExperiencia
) {
  const papel = await requireExperiencePapel();
  if (!papel) return fail("Sem permissao.");

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("crm_experiencia")
    .update({ fase: novaFase })
    .eq("id", experienciaId);
  if (error) return fail(error.message);

  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  return ok();
}

// ─── Criar família manualmente (botão "Nova familia") ────────
export async function criarFamiliaManual(
  atletaId: string,
  dealId: string,
  fase: FaseExperiencia = "admissao"
) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return fail("Apenas o CEO pode criar familias manualmente.");

  const supabase = await createAuditedSupabaseClient();

  const { data: existing } = await supabase
    .from("crm_experiencia")
    .select("id")
    .eq("atleta_id", atletaId)
    .maybeSingle();
  if (existing) return fail("Esta familia ja existe no CRM de Experiencia.");

  const { error } = await supabase.from("crm_experiencia").insert({
    atleta_id: atletaId,
    deal_id: dealId,
    fase,
    temperatura: "verde",
    ansiedade: 3,
    satisfacao: 5,
    risco_percebido: 1,
    status: "satisfeita",
    psicologa_acionada: false,
  });
  if (error) return fail(error.message);

  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  return ok();
}

// ─── Atletas elegíveis para virar família (ainda sem experiencia) ─
export async function listarAtletasElegiveis(): Promise<
  { atleta_id: string; deal_id: string; nome: string; etapa: string }[]
> {
  const papel = await requireExperiencePapel();
  if (!papel) return [];

  const supabase = await createAuditedSupabaseClient();

  const { data } = await supabase
    .from("deals")
    .select(
      "id, etapa, atleta_id, atleta:atletas(nome_completo, crm_experiencia(id))"
    )
    .in("etapa", ["admission_process", "concluido", "sinal_pago"])
    .is("deleted_at", null);

  type Row = {
    id: string;
    etapa: string;
    atleta_id: string | null;
    atleta?: {
      nome_completo?: string;
      crm_experiencia?: { id: string }[];
    } | null;
  };

  return ((data ?? []) as Row[])
    .filter((row) => {
      if (!row.atleta_id) return false;
      const expArr = row.atleta?.crm_experiencia ?? [];
      return expArr.length === 0;
    })
    .map((row) => ({
      atleta_id: row.atleta_id as string,
      deal_id: row.id,
      nome: row.atleta?.nome_completo ?? "Atleta",
      etapa: row.etapa,
    }));
}

// ─── Alertas de inatividade (chama RPC SQL) ──────────────────
export interface AlertaInatividade {
  experiencia_id: string;
  atleta_nome: string;
  dias: number;
  fase: string;
  threshold: number;
}

export async function listarAlertasInatividade(): Promise<AlertaInatividade[]> {
  const papel = await requireExperiencePapel();
  if (!papel) return [];

  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase.rpc("familias_em_alerta_inatividade");

  if (error || !data) return [];

  return (data as AlertaInatividade[]) ?? [];
}

// ─── Detalhes completos para o FamilyDetailModal ─────────────
export interface FamilyModalSnapshot {
  experiencia_id: string;
  atleta_id: string;
  athlete_name: string;
  guardian_name: string;
  whatsapp: string;
  whatsapp_atleta: string | null;
  whatsapp_responsavel: string | null;
  email: string | null;
  email_responsavel: string | null;
  plano: string;
  esporte: string | null;
  fase: FaseExperiencia;
  status: StatusFamilia;
  temperatura: "verde" | "amarelo" | "vermelho";
  ansiedade: number;
  satisfacao: number;
  risco_percebido: number;
  tipos_risco: TipoRisco[];
  descricao_problema: string | null;
  acao_em_andamento: string | null;
  tipo_crise: string | null;
  nivel_crise: string | null;
  psicologa_acionada: boolean;
  data_prevista_embarque: string | null;
  proximo_contato: string | null;
  data_ultimo_contato: string | null;
  dias_sem_contato: number | null;
  nps_6meses: number | null;
  nps_enviado_at: string | null;
}

export async function getFamilyModalData(
  experienciaId: string,
): Promise<FamilyModalSnapshot | null> {
  const papel = await requireExperiencePapel();
  if (!papel) return null;

  const supabase = await createAuditedSupabaseClient();

  const { data: exp } = await supabase
    .from("crm_experiencia")
    .select("*")
    .eq("id", experienciaId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!exp) return null;

  const { data: atleta } = exp.atleta_id
    ? await supabase
        .from("atletas")
        .select("nome_completo, esporte, whatsapp, email, responsavel_id, form_submission_id")
        .eq("id", exp.atleta_id)
        .maybeSingle()
    : { data: null };

  const { data: responsavel } = atleta?.responsavel_id
    ? await supabase
        .from("responsaveis")
        .select("nome, whatsapp")
        .eq("id", atleta.responsavel_id)
        .maybeSingle()
    : { data: null };

  // Buscar email do responsável via form_submissions
  const { data: formSub } = atleta?.form_submission_id
    ? await supabase
        .from("form_submissions")
        .select("guardian_email")
        .eq("id", atleta.form_submission_id)
        .maybeSingle()
    : { data: null };

  const { data: contrato } = exp.deal_id
    ? await supabase
        .from("contratos_financeiros")
        .select("plano")
        .eq("deal_id", exp.deal_id)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null };

  const lastContact = (exp.data_ultimo_contato as string) ?? null;
  const dias = lastContact
    ? Math.floor((Date.now() - new Date(lastContact).getTime()) / 86400000)
    : null;

  return {
    experiencia_id: exp.id,
    atleta_id: (exp.atleta_id as string) ?? "",
    athlete_name: atleta?.nome_completo ?? "Atleta",
    guardian_name: responsavel?.nome ?? "Responsável",
    whatsapp: responsavel?.whatsapp ?? atleta?.whatsapp ?? "",
    whatsapp_atleta: atleta?.whatsapp ?? null,
    whatsapp_responsavel: responsavel?.whatsapp ?? null,
    email: atleta?.email ?? null,
    email_responsavel: formSub?.guardian_email ?? null,
    plano: contrato?.plano ?? "—",
    esporte: atleta?.esporte ?? null,
    fase: ((exp.fase as FaseExperiencia) ?? "admissao") as FaseExperiencia,
    status: ((exp.status as StatusFamilia) ?? "satisfeita") as StatusFamilia,
    temperatura: (exp.temperatura as "verde" | "amarelo" | "vermelho") ?? "verde",
    ansiedade: Number(exp.ansiedade) || 3,
    satisfacao: Number(exp.satisfacao) || 5,
    risco_percebido: Number(exp.risco_percebido) || 1,
    tipos_risco: ((exp.tipos_risco as TipoRisco[]) ?? []) as TipoRisco[],
    descricao_problema: (exp.descricao_problema as string) ?? null,
    acao_em_andamento: (exp.acao_em_andamento as string) ?? null,
    tipo_crise: (exp.tipo_crise as string) ?? null,
    nivel_crise: (exp.nivel_crise as string) ?? null,
    psicologa_acionada: Boolean(exp.psicologa_acionada),
    data_prevista_embarque: (exp.data_prevista_embarque as string) ?? null,
    proximo_contato: (exp.proximo_contato as string) ?? null,
    data_ultimo_contato: lastContact,
    dias_sem_contato: dias,
    nps_6meses: exp.nps_6meses != null ? Number(exp.nps_6meses) : null,
    nps_enviado_at: (exp.nps_enviado_at as string) ?? null,
  };
}

// ─── Histórico de mudanças de fase (audit_logs) ──────────────
export interface HistoricoFase {
  id: string;
  campos_alterados: string[];
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  user_papel: string | null;
  created_at: string;
}

export async function listarHistoricoFase(experienciaId: string): Promise<HistoricoFase[]> {
  const papel = await requireExperiencePapel();
  if (!papel) return [];

  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase
    .from("audit_logs")
    .select(
      "id, campos_alterados, dados_anteriores, dados_novos, user_papel, created_at, operacao",
    )
    .eq("tabela", "crm_experiencia")
    .eq("registro_id", experienciaId)
    .order("created_at", { ascending: false })
    .limit(50);

  return ((data ?? []) as HistoricoFase[]).filter((row) =>
    (row.campos_alterados ?? []).some((c) =>
      [
        "fase",
        "status",
        "temperatura",
        "ansiedade",
        "satisfacao",
        "risco_percebido",
        "psicologa_acionada",
      ].includes(c),
    ),
  );
}

// ─── Listar contatos (timeline) ───────────────────────────────
export async function listarContatosExperiencia(experienciaId: string) {
  const papel = await requireExperiencePapel();
  if (!papel) return [];

  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase
    .from("contatos_experiencia")
    .select("id, tipo, resumo, proximo_contato, anexos, created_at")
    .eq("experiencia_id", experienciaId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
