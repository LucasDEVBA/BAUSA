import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserProfile } from "@/lib/auth";
import { isCeoLevel } from "@/lib/papel";
import { listarOnboardingsAtivos } from "@/lib/actions/onboarding";
import { listarProximasReunioes } from "@/lib/actions/reunioes";
import { getFasesFamiliaConfigOverrides } from "@/lib/actions/configuracoes";
import { mergeJourneyConfig, normalizarFase } from "@/lib/fases-familia";
import { redirect } from "next/navigation";
import { MinhaAreaClient } from "./client";
import type {
  Family,
  FamilyStatus,
  FamilyTemperature,
} from "@/types/family";
import type { Tarefa } from "@/types/crm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ProximaEtapaOnboarding {
  titulo: string;
  prazo: string | null;
}

function mapExperienciaToFamily(
  row: Record<string, unknown>,
  proximaEtapa?: ProximaEtapaOnboarding,
): Family {
  const atleta = row.atleta as Record<string, unknown> | null;
  const responsavel = atleta?.responsavel as Record<string, unknown> | null;
  const deal = row.deal as Record<string, unknown> | null;
  const contrato = deal?.contrato as Record<string, unknown>[] | null;
  const primeiroContrato = Array.isArray(contrato) ? contrato[0] : contrato;

  const planMap: Record<string, "Journey" | "Legacy" | "Start"> = {
    journey: "Journey",
    legacy: "Legacy",
    start: "Start",
  };

  const planoRaw = (primeiroContrato?.plano as string) ?? "";
  const plan = planMap[planoRaw] ?? "Journey";

  const fase = normalizarFase((row.fase as string) ?? "admissao");
  const temperatura = (row.temperatura as string) ?? "verde";
  const status = (row.status as string) ?? "satisfeita";

  const lastContact =
    (row.data_ultimo_contato as string) ?? new Date().toISOString();
  const daysWithout = Math.floor(
    (Date.now() - new Date(lastContact).getTime()) / 86400000
  );

  return {
    id: row.id as string,
    athlete_name: (atleta?.nome_completo as string) ?? "Atleta",
    athlete_position: (atleta?.posicao as string) ?? undefined,
    guardian_name: (responsavel?.nome as string) ?? "Responsavel",
    email: (atleta?.email as string) ?? "",
    whatsapp:
      (responsavel?.whatsapp as string) ??
      (atleta?.whatsapp as string) ??
      "",
    plan,
    journey_stage: fase,
    family_status: status as FamilyStatus,
    temperature: temperatura as FamilyTemperature,
    anxiety_level: Number(row.ansiedade) || 1,
    satisfaction_level: Number(row.satisfacao) || 3,
    perceived_risk: Number(row.risco_percebido) || 1,
    last_contact_at: lastContact,
    last_contact_type: "whatsapp",
    next_contact_date:
      (row.proximo_contato as string) ??
      new Date(Date.now() + 7 * 86400000).toISOString(),
    days_without_contact: daysWithout,
    contract_value_brl: Number(primeiroContrato?.valor_total) || 0,
    contracted_at: (row.created_at as string) ?? "",
    target_school: undefined,
    target_sport: (atleta?.esporte as string) ?? undefined,
    address_state:
      (atleta?.cidade_estado as string)?.split("/").pop()?.trim() ?? undefined,
    attention_records: row.descricao_problema
      ? [
          {
            id: `att-${row.id}`,
            problem_description: row.descricao_problema as string,
            action_ongoing: (row.acao_em_andamento as string) ?? "Acompanhamento em andamento",
            next_action: "Verificar na proxima interacao",
            recorded_at:
              (row.updated_at as string) ?? new Date().toISOString(),
          },
        ]
      : [],
    crisis_records:
      status === "crise" && row.descricao_problema
        ? [
            {
              id: `cr-${row.id}`,
              description: row.descricao_problema as string,
              crisis_type: (row.tipo_crise as string) ?? "Geral",
              crisis_level: (Number(row.nivel_crise === "critico" ? 5 : row.nivel_crise === "alto" ? 4 : row.nivel_crise === "medio" ? 3 : row.nivel_crise === "baixo" ? 2 : 3)) as
                | 1
                | 2
                | 3
                | 4
                | 5,
              action_taken: (row.acao_em_andamento as string) ?? "Protocolo de crise acionado",
              psychologist_activated: Boolean(row.psicologa_acionada),
              recorded_at:
                (row.updated_at as string) ?? new Date().toISOString(),
            },
          ]
        : [],
    tipo_crise: (row.tipo_crise as string) ?? null,
    nivel_crise: (row.nivel_crise as string) ?? null,
    psicologa_acionada: Boolean(row.psicologa_acionada),
    psicologa_acionada_at: (row.psicologa_acionada_at as string) ?? null,
    retencao_segundo_ano: row.retencao_segundo_ano as boolean | null ?? null,
    nps_6meses: row.nps_6meses != null ? Number(row.nps_6meses) : null,
    nps_enviado_at: (row.nps_enviado_at as string) ?? null,
    indicacoes_geradas: Number(row.indicacoes_geradas) || 0,
    escola_confirmada_id: (row.escola_confirmada_id as string) ?? null,
    // Marco real: a próxima etapa do onboarding da família (quando existe)
    next_milestone: proximaEtapa?.titulo,
    next_milestone_date: proximaEtapa?.prazo ?? undefined,
  };
}

export default async function MinhaAreaPage() {
  const profile = await getUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const isCeo = isCeoLevel(profile.papel);

  if (!isCeo && profile.papel !== "head_sucesso") {
    redirect("/war-room");
  }

  const supabase = await createServerSupabaseClient();

  // Buscar experiencias (todas se CEO, ou atribuidas ao usuario)
  const { data: rawExperiencias } = await supabase
    .from("crm_experiencia")
    .select(
      `
      *,
      atleta:atletas(nome_completo, posicao, whatsapp, email, esporte, cidade_estado,
        responsavel:responsaveis(nome, whatsapp)),
      deal:deals(id, etapa, valor_estimado, contrato:contratos_financeiros(plano, valor_total))
    `
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  // Onboardings + próximas reuniões (server actions já filtram por papel).
  // Buscados ANTES do mapeamento: a próxima etapa do onboarding vira o
  // marco real (next_milestone) de cada família.
  const [onboardings, proximasReunioes, fasesOverrides] = await Promise.all([
    listarOnboardingsAtivos(),
    listarProximasReunioes(10),
    getFasesFamiliaConfigOverrides(),
  ]);
  const journeyConfig = mergeJourneyConfig(fasesOverrides);

  const proximaEtapaByExperiencia = new Map(
    onboardings
      .filter((o) => o.proxima_titulo)
      .map((o) => [
        o.experiencia_id,
        { titulo: o.proxima_titulo as string, prazo: o.proxima_prazo },
      ]),
  );

  const families: Family[] = (rawExperiencias ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return mapExperienciaToFamily(
      r,
      proximaEtapaByExperiencia.get(r.id as string),
    );
  });

  // Buscar tarefas do usuario (atrasadas e proximos 7 dias)
  // Head só vê tarefas dos módulos pertinentes a ela.
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);

  let tarefasQuery = supabase
    .from("tarefas")
    .select("*")
    .eq("responsavel_id", profile.id)
    .is("deleted_at", null)
    .in("status", ["pendente", "em_andamento", "atrasada"])
    .lte("prazo", sevenDaysFromNow.toISOString())
    .order("prazo", { ascending: true });

  if (profile.papel === "head_sucesso") {
    tarefasQuery = tarefasQuery.in("modulo_origem", ["experiencia", "admissao"]);
  }

  const { data: rawTarefas } = await tarefasQuery;
  const tarefas: Tarefa[] = (rawTarefas ?? []) as Tarefa[];

  // Contatos desta semana — do PRÓPRIO usuário ("Meu desempenho", não global)
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const { count: contatosSemana } = await supabase
    .from("contatos_experiencia")
    .select("*", { count: "exact", head: true })
    .eq("registrado_por", profile.id)
    .gte("created_at", startOfWeek.toISOString())
    .is("deleted_at", null);

  // Performance metrics
  const totalFamilias = families.length;
  const mediaSatisfacao =
    totalFamilias > 0
      ? +(
          families.reduce((s, f) => s + f.satisfaction_level, 0) / totalFamilias
        ).toFixed(1)
      : 0;
  const mediaAnsiedade =
    totalFamilias > 0
      ? +(
          families.reduce((s, f) => s + f.anxiety_level, 0) / totalFamilias
        ).toFixed(1)
      : 0;

  const performance = {
    totalFamilias,
    mediaSatisfacao,
    mediaAnsiedade,
    contatosSemana: contatosSemana ?? 0,
  };

  return (
    <MinhaAreaClient
      families={families}
      tarefas={tarefas}
      userName={profile.nome}
      performance={performance}
      onboardings={onboardings}
      proximasReunioes={proximasReunioes}
      journeyConfig={journeyConfig}
    />
  );
}
