"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { isCeoLevel } from "@/lib/papel";

export interface WarRoomFamiliaResumo {
  experiencia_id: string;
  atleta_nome: string;
  responsavel_nome: string;
  fase: string;
  status: "satisfeita" | "atencao" | "crise";
  temperatura: "verde" | "amarelo" | "vermelho";
  ansiedade: number;
  satisfacao: number;
  risco_percebido: number;
  dias_sem_contato: number | null;
  health_score: number;
  head_nome: string | null;
  nps_6meses: number | null;
}

export interface WarRoomFamiliasData {
  kpis: {
    total: number;
    em_onboarding: number;
    onboardings_concluidos: number;
    em_crise: number;
    em_atencao: number;
    satisfeitas: number;
    satisfacao_media: number;
    ansiedade_media: number;
    health_score_medio: number;
    sem_contato_critico: number; // > 30 dias
    nps_promotores: number; // >= 9
    nps_detratores: number; // <= 6
    nps_score: number;
  };
  top_criticas: WarRoomFamiliaResumo[];
  top_satisfeitas: WarRoomFamiliaResumo[];
  por_fase: Record<string, number>;
  por_temperatura: { verde: number; amarelo: number; vermelho: number };
  ranking_heads: Array<{
    head_id: string;
    nome: string;
    total_familias: number;
    satisfacao_media: number;
    health_score_medio: number;
    em_crise: number;
  }>;
  alertas_executivos: Array<{
    tipo: "crise" | "sem_contato_critico" | "psicologa_pendente" | "nps_detrator";
    experiencia_id: string;
    atleta_nome: string;
    descricao: string;
  }>;
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

export async function getWarRoomFamilias(): Promise<WarRoomFamiliasData> {
  const papel = await getUserPapel();
  if (!papel || !isCeoLevel(papel)) {
    return emptyData();
  }

  const supabase = await createAuditedSupabaseClient();

  // Buscar todas experiencias ativas
  const { data: expRaw } = await supabase
    .from("crm_experiencia")
    .select(
      "id, atleta_id, fase, temperatura, status, ansiedade, satisfacao, risco_percebido, psicologa_acionada, nps_6meses, data_ultimo_contato",
    )
    .is("deleted_at", null);

  type Row = {
    id: string;
    atleta_id: string;
    fase: string;
    temperatura: "verde" | "amarelo" | "vermelho";
    status: "satisfeita" | "atencao" | "crise";
    ansiedade: number;
    satisfacao: number;
    risco_percebido: number;
    psicologa_acionada: boolean | null;
    nps_6meses: number | null;
    data_ultimo_contato: string | null;
  };
  const exps = (expRaw ?? []) as Row[];

  if (exps.length === 0) return emptyData();

  // Buscar atletas + responsáveis em paralelo
  const atletaIds = exps.map((e) => e.atleta_id).filter(Boolean);
  const { data: atletas } = await supabase
    .from("atletas")
    .select("id, nome_completo, responsavel_id")
    .in("id", atletaIds);

  const respIds = (atletas ?? [])
    .map((a) => a.responsavel_id as string | null)
    .filter((id): id is string => !!id);
  const { data: responsaveis } = respIds.length
    ? await supabase
        .from("responsaveis")
        .select("id, nome")
        .in("id", respIds)
    : { data: [] };

  const atletaMap = new Map(
    (atletas ?? []).map((a) => [a.id as string, a]),
  );
  const respMap = new Map(
    (responsaveis ?? []).map((r) => [r.id as string, r.nome as string]),
  );

  // Buscar onboardings
  const { data: onbInst } = await supabase
    .from("onboarding_instancias")
    .select("experiencia_id, status, responsavel_id")
    .is("deleted_at", null);
  const onbMap = new Map(
    (onbInst ?? []).map((o) => [
      o.experiencia_id as string,
      { status: o.status as string, head_id: o.responsavel_id as string | null },
    ]),
  );

  // Buscar nomes dos heads
  const headIds = Array.from(
    new Set(
      (onbInst ?? [])
        .map((o) => o.responsavel_id as string | null)
        .filter((id): id is string => !!id),
    ),
  );
  const { data: heads } = headIds.length
    ? await supabase
        .from("user_profiles")
        .select("id, nome")
        .in("id", headIds)
    : { data: [] };
  const headNomeMap = new Map(
    (heads ?? []).map((h) => [h.id as string, h.nome as string]),
  );

  // Construir resumos
  const now = Date.now();
  const resumos: WarRoomFamiliaResumo[] = exps.map((e) => {
    const atleta = atletaMap.get(e.atleta_id);
    const respNome = atleta?.responsavel_id
      ? respMap.get(atleta.responsavel_id as string) ?? "—"
      : "—";
    const dias = e.data_ultimo_contato
      ? Math.floor(
          (now - new Date(e.data_ultimo_contato).getTime()) / 86400000,
        )
      : 999;
    const onb = onbMap.get(e.id);
    const headNome = onb?.head_id
      ? headNomeMap.get(onb.head_id) ?? null
      : null;
    return {
      experiencia_id: e.id,
      atleta_nome: (atleta?.nome_completo as string) ?? "Atleta",
      responsavel_nome: respNome,
      fase: e.fase,
      status: e.status,
      temperatura: e.temperatura,
      ansiedade: e.ansiedade,
      satisfacao: e.satisfacao,
      risco_percebido: e.risco_percebido,
      dias_sem_contato: e.data_ultimo_contato ? dias : null,
      health_score: calcHealthScore({
        ansiedade: e.ansiedade,
        satisfacao: e.satisfacao,
        risco_percebido: e.risco_percebido,
        status: e.status,
        temperatura: e.temperatura,
        dias_sem_contato: dias,
      }),
      head_nome: headNome,
      nps_6meses: e.nps_6meses,
    };
  });

  // KPIs
  const total = resumos.length;
  const em_onboarding = (onbInst ?? []).filter(
    (o) => o.status === "em_andamento",
  ).length;
  const onboardings_concluidos = (onbInst ?? []).filter(
    (o) => o.status === "concluido",
  ).length;
  const em_crise = resumos.filter((r) => r.status === "crise").length;
  const em_atencao = resumos.filter((r) => r.status === "atencao").length;
  const satisfeitas = resumos.filter((r) => r.status === "satisfeita").length;
  const sem_contato_critico = resumos.filter(
    (r) => (r.dias_sem_contato ?? 0) > 30,
  ).length;
  const satisfacao_media =
    total === 0
      ? 0
      : +(
          resumos.reduce((s, r) => s + r.satisfacao, 0) / total
        ).toFixed(1);
  const ansiedade_media =
    total === 0
      ? 0
      : +(
          resumos.reduce((s, r) => s + r.ansiedade, 0) / total
        ).toFixed(1);
  const health_score_medio =
    total === 0
      ? 0
      : Math.round(
          resumos.reduce((s, r) => s + r.health_score, 0) / total,
        );

  const npsRespondidas = resumos.filter((r) => r.nps_6meses != null);
  const promotores = npsRespondidas.filter((r) => (r.nps_6meses ?? 0) >= 9).length;
  const detratores = npsRespondidas.filter((r) => (r.nps_6meses ?? 0) <= 6).length;
  const nps_score =
    npsRespondidas.length === 0
      ? 0
      : Math.round(
          ((promotores - detratores) / npsRespondidas.length) * 100,
        );

  // Por fase
  const por_fase: Record<string, number> = {};
  resumos.forEach((r) => {
    por_fase[r.fase] = (por_fase[r.fase] ?? 0) + 1;
  });

  const por_temperatura = {
    verde: resumos.filter((r) => r.temperatura === "verde").length,
    amarelo: resumos.filter((r) => r.temperatura === "amarelo").length,
    vermelho: resumos.filter((r) => r.temperatura === "vermelho").length,
  };

  // Top críticas (menor health score)
  const top_criticas = [...resumos]
    .sort((a, b) => a.health_score - b.health_score)
    .slice(0, 5);

  // Top satisfeitas (maior health score, satisfação >= 4)
  const top_satisfeitas = [...resumos]
    .filter((r) => r.satisfacao >= 4 && r.status === "satisfeita")
    .sort((a, b) => b.health_score - a.health_score)
    .slice(0, 5);

  // Ranking heads
  const heads_stats = new Map<
    string,
    {
      head_id: string;
      nome: string;
      familias: WarRoomFamiliaResumo[];
    }
  >();
  resumos.forEach((r) => {
    const onb = onbMap.get(r.experiencia_id);
    const headId = onb?.head_id;
    if (!headId) return;
    const nome = headNomeMap.get(headId) ?? "Head";
    if (!heads_stats.has(headId)) {
      heads_stats.set(headId, { head_id: headId, nome, familias: [] });
    }
    heads_stats.get(headId)!.familias.push(r);
  });
  const ranking_heads = Array.from(heads_stats.values())
    .map((h) => ({
      head_id: h.head_id,
      nome: h.nome,
      total_familias: h.familias.length,
      satisfacao_media:
        h.familias.length === 0
          ? 0
          : +(
              h.familias.reduce((s, f) => s + f.satisfacao, 0) /
              h.familias.length
            ).toFixed(1),
      health_score_medio:
        h.familias.length === 0
          ? 0
          : Math.round(
              h.familias.reduce((s, f) => s + f.health_score, 0) /
                h.familias.length,
            ),
      em_crise: h.familias.filter((f) => f.status === "crise").length,
    }))
    .sort((a, b) => b.satisfacao_media - a.satisfacao_media);

  // Alertas executivos
  const alertas_executivos: WarRoomFamiliasData["alertas_executivos"] = [];
  resumos.forEach((r) => {
    if (r.status === "crise") {
      alertas_executivos.push({
        tipo: "crise",
        experiencia_id: r.experiencia_id,
        atleta_nome: r.atleta_nome,
        descricao: `Status: Crise · Health Score ${r.health_score}/100`,
      });
    }
    if ((r.dias_sem_contato ?? 0) > 30) {
      alertas_executivos.push({
        tipo: "sem_contato_critico",
        experiencia_id: r.experiencia_id,
        atleta_nome: r.atleta_nome,
        descricao: `${r.dias_sem_contato}d sem contato (fase ${r.fase})`,
      });
    }
    if (r.nps_6meses != null && r.nps_6meses <= 6) {
      alertas_executivos.push({
        tipo: "nps_detrator",
        experiencia_id: r.experiencia_id,
        atleta_nome: r.atleta_nome,
        descricao: `NPS 6 meses: ${r.nps_6meses}/10 (detrator)`,
      });
    }
  });
  // Buscar psicóloga pendente
  exps
    .filter(
      (e) =>
        e.status === "crise" &&
        (e.psicologa_acionada === false || e.psicologa_acionada === null),
    )
    .forEach((e) => {
      const r = resumos.find((rr) => rr.experiencia_id === e.id);
      if (r) {
        alertas_executivos.push({
          tipo: "psicologa_pendente",
          experiencia_id: e.id,
          atleta_nome: r.atleta_nome,
          descricao: "Crise sem psicóloga acionada",
        });
      }
    });

  return {
    kpis: {
      total,
      em_onboarding,
      onboardings_concluidos,
      em_crise,
      em_atencao,
      satisfeitas,
      satisfacao_media,
      ansiedade_media,
      health_score_medio,
      sem_contato_critico,
      nps_promotores: promotores,
      nps_detratores: detratores,
      nps_score,
    },
    top_criticas,
    top_satisfeitas,
    por_fase,
    por_temperatura,
    ranking_heads,
    alertas_executivos: alertas_executivos.slice(0, 15),
  };
}

function emptyData(): WarRoomFamiliasData {
  return {
    kpis: {
      total: 0,
      em_onboarding: 0,
      onboardings_concluidos: 0,
      em_crise: 0,
      em_atencao: 0,
      satisfeitas: 0,
      satisfacao_media: 0,
      ansiedade_media: 0,
      health_score_medio: 0,
      sem_contato_critico: 0,
      nps_promotores: 0,
      nps_detratores: 0,
      nps_score: 0,
    },
    top_criticas: [],
    top_satisfeitas: [],
    por_fase: {},
    por_temperatura: { verde: 0, amarelo: 0, vermelho: 0 },
    ranking_heads: [],
    alertas_executivos: [],
  };
}
