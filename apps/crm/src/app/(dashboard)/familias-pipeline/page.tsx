import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePapel } from "@/lib/auth";
import { getFasesFamiliaConfigOverrides } from "@/lib/actions/configuracoes";
import { mergeJourneyConfig, normalizarFase } from "@/lib/fases-familia";
import { FamiliasPipelineClient, type FamiliaPipelineCard } from "./client";
import type { RiskDimension } from "@/types/family";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const VALID_RISK_DIMENSIONS: ReadonlyArray<RiskDimension> = [
  "academico",
  "esportivo",
  "emocional",
  "financeiro",
  "relacional",
  "comunicacao",
];

function normalizarTiposRisco(raw: unknown): RiskDimension[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is RiskDimension =>
    typeof t === "string" &&
    (VALID_RISK_DIMENSIONS as readonly string[]).includes(t),
  );
}

export default async function FamiliasPipelinePage() {
  await requirePapel(["ceo", "head_sucesso"]);

  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const journeyConfig = mergeJourneyConfig(
    await getFasesFamiliaConfigOverrides(),
  );

  const { data: experiencias, error: queryErr } = await supabase
    .from("crm_experiencia")
    .select(
      "id, atleta_id, deal_id, fase, temperatura, status, ansiedade, satisfacao, risco_percebido, tipos_risco, descricao_problema, acao_em_andamento, tipo_crise, nivel_crise, psicologa_acionada, data_ultimo_contato, proximo_contato, data_prevista_embarque, updated_at",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (queryErr) {
    console.error(
      "[familias-pipeline] crm_experiencia query erro:",
      JSON.stringify(queryErr, null, 2),
    );
  }

  const experienciasList = experiencias ?? [];

  const atletaIds = experienciasList
    .map((e) => e.atleta_id as string | null)
    .filter((id): id is string => id !== null);

  type AtletaRow = {
    id: string;
    nome_completo: string | null;
    esporte: string | null;
    whatsapp: string | null;
    email: string | null;
    responsavel_id: string | null;
  };
  type ResponsavelRow = {
    id: string;
    nome: string | null;
    whatsapp: string | null;
  };
  type ContratoRow = { deal_id: string; plano: string | null };

  let atletas: AtletaRow[] = [];
  if (atletaIds.length) {
    const { data, error } = await supabase
      .from("atletas")
      .select("id, nome_completo, esporte, whatsapp, email, responsavel_id")
      .in("id", atletaIds);
    if (error) {
      console.error(
        "[familias-pipeline] atletas query erro:",
        JSON.stringify(error, null, 2),
      );
    }
    atletas = (data ?? []) as AtletaRow[];
  }
  const atletasMap = new Map(atletas.map((a) => [a.id, a]));

  const respIds = atletas
    .map((a) => a.responsavel_id)
    .filter((id): id is string => id !== null);
  let responsaveis: ResponsavelRow[] = [];
  if (respIds.length) {
    const { data } = await supabase
      .from("responsaveis")
      .select("id, nome, whatsapp")
      .in("id", respIds);
    responsaveis = (data ?? []) as ResponsavelRow[];
  }
  const respMap = new Map(responsaveis.map((r) => [r.id, r]));

  const dealIds = experienciasList
    .map((e) => e.deal_id as string | null)
    .filter((id): id is string => id !== null);
  let contratos: ContratoRow[] = [];
  if (dealIds.length) {
    const { data } = await supabase
      .from("contratos_financeiros")
      .select("deal_id, plano")
      .in("deal_id", dealIds)
      .is("deleted_at", null);
    contratos = (data ?? []) as ContratoRow[];
  }
  const contratosMap = new Map(contratos.map((c) => [c.deal_id, c]));

  const cards: FamiliaPipelineCard[] = experienciasList.map((row) => {
    const atleta = row.atleta_id
      ? atletasMap.get(row.atleta_id as string)
      : null;
    const responsavel = atleta?.responsavel_id
      ? respMap.get(atleta.responsavel_id as string)
      : null;
    const contrato = row.deal_id
      ? contratosMap.get(row.deal_id as string)
      : null;

    const lastContact = (row.data_ultimo_contato as string) ?? null;
    const days = lastContact
      ? Math.floor((now - new Date(lastContact).getTime()) / 86400000)
      : null;

    return {
      id: row.id as string,
      atleta_id: (row.atleta_id as string) ?? "",
      deal_id: (row.deal_id as string) ?? null,
      athlete_name: (atleta?.nome_completo as string) ?? "Atleta",
      guardian_name: (responsavel?.nome as string) ?? "Responsável",
      whatsapp:
        (responsavel?.whatsapp as string) ??
        (atleta?.whatsapp as string) ??
        "",
      email: (atleta?.email as string) ?? null,
      plano: (contrato?.plano as string) ?? "—",
      esporte: (atleta?.esporte as string) ?? null,
      fase: normalizarFase((row.fase as string) ?? "admissao"),
      status: (row.status as "satisfeita" | "atencao" | "crise") ?? "satisfeita",
      temperatura:
        (row.temperatura as "verde" | "amarelo" | "vermelho") ?? "verde",
      ansiedade: Number(row.ansiedade) || 3,
      satisfacao: Number(row.satisfacao) || 5,
      risco_percebido: Number(row.risco_percebido) || 1,
      tipos_risco: normalizarTiposRisco(row.tipos_risco),
      descricao_problema: (row.descricao_problema as string) ?? null,
      acao_em_andamento: (row.acao_em_andamento as string) ?? null,
      tipo_crise: (row.tipo_crise as string) ?? null,
      nivel_crise: (row.nivel_crise as string) ?? null,
      psicologa_acionada: Boolean(row.psicologa_acionada),
      dias_sem_contato: days,
      proximo_contato: (row.proximo_contato as string) ?? null,
      data_ultimo_contato: lastContact,
      data_prevista_embarque: (row.data_prevista_embarque as string) ?? null,
    };
  });

  return <FamiliasPipelineClient cards={cards} journeyConfig={journeyConfig} />;
}
