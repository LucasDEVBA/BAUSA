"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { isCeoLevel } from "@/lib/papel";
import type {
  OnboardingEtapaEstado,
  OnboardingInstancia,
  OnboardingProgresso,
} from "@/lib/actions/onboarding";
import type { ReuniaoFamilia } from "@/lib/actions/reunioes";

export interface AcompanhamentoHeadData {
  has_experiencia: boolean;
  experiencia?: {
    id: string;
    fase: string;
    status: "satisfeita" | "atencao" | "crise";
    temperatura: "verde" | "amarelo" | "vermelho";
    ansiedade: number;
    satisfacao: number;
    risco_percebido: number;
    descricao_problema: string | null;
    acao_em_andamento: string | null;
    tipo_crise: string | null;
    nivel_crise: string | null;
    psicologa_acionada: boolean;
    data_prevista_embarque: string | null;
    proximo_contato: string | null;
    data_ultimo_contato: string | null;
    dias_sem_contato: number | null;
    health_score: number;
    head_nome: string | null;
    nps_6meses: number | null;
  };
  onboarding?: {
    instancia: OnboardingInstancia | null;
    etapas: OnboardingEtapaEstado[];
    progresso: OnboardingProgresso;
  };
  reunioes: ReuniaoFamilia[];
  contatos_recentes: Array<{
    id: string;
    tipo: string;
    descricao: string;
    quando: string;
    autor_nome: string | null;
  }>;
  proxima_reuniao: ReuniaoFamilia | null;
}

function calcHealthScore(input: {
  ansiedade: number;
  satisfacao: number;
  risco_percebido: number;
  status: string;
  temperatura: string;
  dias_sem_contato: number;
}): number {
  let score = 0;
  score += (Math.max(1, Math.min(5, input.satisfacao)) - 1) * 10;
  score += (5 - Math.max(1, Math.min(5, input.ansiedade))) * 7.5;
  score += (5 - Math.max(1, Math.min(5, input.risco_percebido))) * 3.75;
  const dias = Math.max(0, Math.min(30, input.dias_sem_contato ?? 30));
  score += (30 - dias) * 0.5;
  if (input.status === "crise") score -= 30;
  else if (input.status === "atencao") score -= 10;
  if (input.temperatura === "vermelho") score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function getAcompanhamentoByAtleta(
  atletaId: string,
): Promise<AcompanhamentoHeadData> {
  const papel = await getUserPapel();
  const empty: AcompanhamentoHeadData = {
    has_experiencia: false,
    reunioes: [],
    contatos_recentes: [],
    proxima_reuniao: null,
  };
  if (!papel || (!isCeoLevel(papel) && papel !== "head_sucesso")) return empty;
  if (!atletaId) return empty;

  const supabase = await createAuditedSupabaseClient();

  type ExpRow = {
    id: string;
    fase: string;
    status: "satisfeita" | "atencao" | "crise";
    temperatura: "verde" | "amarelo" | "vermelho";
    ansiedade: number;
    satisfacao: number;
    risco_percebido: number;
    descricao_problema: string | null;
    acao_em_andamento: string | null;
    tipo_crise: string | null;
    nivel_crise: string | null;
    psicologa_acionada: boolean | null;
    data_prevista_embarque: string | null;
    proximo_contato: string | null;
    data_ultimo_contato: string | null;
    nps_6meses: number | null;
  };

  // Buscar experiência pelo atleta
  const { data: expRaw } = await supabase
    .from("crm_experiencia")
    .select(
      "id, fase, status, temperatura, ansiedade, satisfacao, risco_percebido, " +
        "descricao_problema, acao_em_andamento, tipo_crise, nivel_crise, " +
        "psicologa_acionada, data_prevista_embarque, proximo_contato, " +
        "data_ultimo_contato, nps_6meses",
    )
    .eq("atleta_id", atletaId)
    .is("deleted_at", null)
    .maybeSingle();

  const exp = expRaw as unknown as ExpRow | null;
  if (!exp) return empty;

  const dias = exp.data_ultimo_contato
    ? Math.floor(
        (Date.now() - new Date(exp.data_ultimo_contato).getTime()) / 86400000,
      )
    : null;

  // Onboarding (instância + etapas + progresso) em paralelo
  const [
    { data: instancia },
    { data: progressoRaw },
    { data: reunioesRaw },
    { data: contatosRaw },
  ] = await Promise.all([
    supabase
      .from("onboarding_instancias")
      .select("*")
      .eq("experiencia_id", exp.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.rpc("progresso_onboarding", { p_experiencia_id: exp.id }),
    supabase
      .from("reunioes_familia")
      .select("*")
      .eq("experiencia_id", exp.id)
      .is("deleted_at", null)
      .order("data_hora", { ascending: false }),
    supabase
      .from("contatos_experiencia")
      .select(
        "id, tipo, descricao, quando:created_at, autor:user_profiles(nome)",
      )
      .eq("experiencia_id", exp.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  let etapas: OnboardingEtapaEstado[] = [];
  if (instancia) {
    const { data: etapasRaw } = await supabase
      .from("onboarding_etapa_estado")
      .select("*")
      .eq("instancia_id", (instancia as { id: string }).id)
      .order("ordem", { ascending: true });
    etapas = (etapasRaw ?? []) as OnboardingEtapaEstado[];
  }

  // Nome do head responsável pelo onboarding
  let headNome: string | null = null;
  const headId = (instancia as { responsavel_id?: string } | null)?.responsavel_id;
  if (headId) {
    const { data: head } = await supabase
      .from("user_profiles")
      .select("nome")
      .eq("id", headId)
      .maybeSingle();
    headNome = (head?.nome as string) ?? null;
  }

  const reunioes = (reunioesRaw ?? []) as ReuniaoFamilia[];
  const proxima_reuniao =
    reunioes.find(
      (r) =>
        r.status === "agendada" && new Date(r.data_hora).getTime() > Date.now(),
    ) ?? null;

  type ContatoRow = {
    id: string;
    tipo: string;
    descricao: string;
    quando: string;
    autor?: { nome?: string } | { nome?: string }[] | null;
  };
  const contatos_recentes = ((contatosRaw ?? []) as ContatoRow[]).map((c) => {
    const a = Array.isArray(c.autor) ? c.autor[0] : c.autor;
    return {
      id: c.id,
      tipo: c.tipo,
      descricao: c.descricao,
      quando: c.quando,
      autor_nome: a?.nome ?? null,
    };
  });

  const health_score = calcHealthScore({
    ansiedade: exp.ansiedade as number,
    satisfacao: exp.satisfacao as number,
    risco_percebido: exp.risco_percebido as number,
    status: exp.status as string,
    temperatura: exp.temperatura as string,
    dias_sem_contato: dias ?? 30,
  });

  return {
    has_experiencia: true,
    experiencia: {
      id: exp.id as string,
      fase: exp.fase as string,
      status: exp.status as "satisfeita" | "atencao" | "crise",
      temperatura: exp.temperatura as "verde" | "amarelo" | "vermelho",
      ansiedade: Number(exp.ansiedade) || 3,
      satisfacao: Number(exp.satisfacao) || 5,
      risco_percebido: Number(exp.risco_percebido) || 1,
      descricao_problema: (exp.descricao_problema as string) ?? null,
      acao_em_andamento: (exp.acao_em_andamento as string) ?? null,
      tipo_crise: (exp.tipo_crise as string) ?? null,
      nivel_crise: (exp.nivel_crise as string) ?? null,
      psicologa_acionada: Boolean(exp.psicologa_acionada),
      data_prevista_embarque: (exp.data_prevista_embarque as string) ?? null,
      proximo_contato: (exp.proximo_contato as string) ?? null,
      data_ultimo_contato: (exp.data_ultimo_contato as string) ?? null,
      dias_sem_contato: dias,
      health_score,
      head_nome: headNome,
      nps_6meses: (exp.nps_6meses as number) ?? null,
    },
    onboarding: instancia
      ? {
          instancia: instancia as OnboardingInstancia,
          etapas,
          progresso: (progressoRaw ?? { existe: false }) as OnboardingProgresso,
        }
      : undefined,
    reunioes,
    contatos_recentes,
    proxima_reuniao,
  };
}
