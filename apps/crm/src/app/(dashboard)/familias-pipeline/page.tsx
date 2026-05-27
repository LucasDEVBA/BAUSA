import { createServerSupabaseClient } from "@/lib/supabase-server";
import { requirePapel } from "@/lib/auth";
import { FamiliasPipelineClient, type FamiliaPipelineCard } from "./client";
import type { FamilyJourneyStage } from "@/types/family";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function normalizarFase(fase: string): FamilyJourneyStage {
  if (
    fase === "admissao" ||
    fase === "aprovado" ||
    fase === "pre_embarque" ||
    fase === "embarcado_inicial" ||
    fase === "acompanhamento" ||
    fase === "encerrado"
  ) {
    return fase;
  }
  if (fase === "embarcado") return "embarcado_inicial";
  return "admissao";
}

export default async function FamiliasPipelinePage() {
  await requirePapel(["ceo", "head_sucesso"]);

  const supabase = await createServerSupabaseClient();
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const { data: experiencias } = await supabase
    .from("crm_experiencia")
    .select(
      `
      id, fase, temperatura, status, ansiedade, satisfacao,
      data_ultimo_contato, proximo_contato, data_prevista_embarque,
      atleta:atletas(nome_completo, esporte, responsavel:responsaveis(nome, whatsapp)),
      deal:deals(etapa, contrato:contratos_financeiros(plano))
    `
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  const cards: FamiliaPipelineCard[] = (experiencias ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const atleta = r.atleta as Record<string, unknown> | null;
    const responsavel = atleta?.responsavel as Record<string, unknown> | null;
    const deal = r.deal as Record<string, unknown> | null;
    const contratoRaw = deal?.contrato as
      | Record<string, unknown>[]
      | Record<string, unknown>
      | null
      | undefined;
    const contrato = Array.isArray(contratoRaw) ? contratoRaw[0] : contratoRaw;

    const lastContact = (r.data_ultimo_contato as string) ?? null;
    const days = lastContact
      ? Math.floor((now - new Date(lastContact).getTime()) / 86400000)
      : null;

    return {
      id: r.id as string,
      athlete_name: (atleta?.nome_completo as string) ?? "Atleta",
      guardian_name: (responsavel?.nome as string) ?? "Responsável",
      whatsapp:
        (responsavel?.whatsapp as string) ??
        (atleta?.whatsapp as string) ??
        "",
      plano: (contrato?.plano as string) ?? "—",
      esporte: (atleta?.esporte as string) ?? null,
      fase: normalizarFase((r.fase as string) ?? "admissao"),
      status: (r.status as "satisfeita" | "atencao" | "crise") ?? "satisfeita",
      temperatura:
        (r.temperatura as "verde" | "amarelo" | "vermelho") ?? "verde",
      ansiedade: Number(r.ansiedade) || 3,
      satisfacao: Number(r.satisfacao) || 5,
      dias_sem_contato: days,
      proximo_contato: (r.proximo_contato as string) ?? null,
      data_prevista_embarque: (r.data_prevista_embarque as string) ?? null,
    };
  });

  return <FamiliasPipelineClient cards={cards} />;
}
