import { GraduationCap, TrendingUp, Users, Star } from "lucide-react";

import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  type School,
  type SchoolType,
  type SchoolStatus,
  type SchoolSportInfluence,
  type ScholarshipAggressiveness,
} from "@/types/school";
import { PageHeader, StatCard } from "@/components/ui";
import { EscolasClient } from "@/components/escolas/EscolasClient";

// Mapeia dados Supabase (tabela `escolas`) para o tipo School do componente
function mapSupabaseToSchool(row: Record<string, unknown>): School {
  const tipoMap: Record<string, SchoolType> = {
    boarding: "Division I",
    day: "Division II",
    mista: "Division III",
  };

  const statusMap: Record<string, SchoolStatus> = {
    ativa: "ativa",
    inativa: "inativa",
    em_analise: "em_avaliacao",
  };

  const influenceMap: Record<string, SchoolSportInfluence> = {
    decisiva: "decisiva",
    alta: "alta",
    media: "media",
    baixa: "baixa",
  };

  const aggressivenessMap: Record<string, ScholarshipAggressiveness> = {
    agressiva: "agressiva",
    moderada: "moderada",
    conservadora: "conservadora",
  };

  return {
    id: row.id as string,
    name: (row.nome as string) ?? "",
    state: (row.estado_us as string) ?? "",
    city: (row.cidade as string) ?? "",
    type: tipoMap[row.tipo as string] ?? "NAIA",
    status: statusMap[row.status as string] ?? "ativa",
    min_budget_usd: Number(row.budget_minimo_usd) || 0,
    strong_budget_usd: Number(row.budget_forte_usd) || 0,
    sport_influence: influenceMap[row.influencia_esporte as string] ?? "media",
    elite_athlete_exception: (row.aceita_excecao_elite as boolean) ?? false,
    scholarship_aggressiveness: aggressivenessMap[row.agressividade_bolsa as string] ?? "moderada",
    min_english_level: (row.ingles_minimo as string) ?? "Basico",
    required_tests: ((row.testes_exigidos as string[]) ?? []) as School["required_tests"],
    preferred_grade: Array.isArray(row.series_preferenciais) && (row.series_preferenciais as string[]).length > 0
      ? (row.series_preferenciais as string[])[0]
      : "",
    max_grade_accepted: (row.serie_maxima as string) ?? "",
    total_applications: Number(row.total_aplicados) || 0,
    acceptance_count: Number(row.total_aceitos) || 0,
    avg_scholarship_pct: Number(row.bolsa_media_obtida) || 0,
    avg_response_days: Number(row.tempo_medio_resposta) || 0,
    practical_rule: (row.regra_pratica as string) ?? "",
    coach_name: (row.admissions_officer_nome as string) ?? undefined,
    coach_email: (row.admissions_officer_email as string) ?? undefined,
    coach_phone: (row.admissions_officer_telefone as string) ?? undefined,
    notes: (row.notas_internas as string) ?? undefined,
    link_inscricao: (row.link_inscricao as string) ?? null,
    link_plano_saude: (row.link_plano_saude as string) ?? null,
    gpa_minimo: row.gpa_minimo != null ? Number(row.gpa_minimo) : null,
    temperatura_relacionamento: (row.temperatura_relacionamento as string) ?? "neutro",
    ultimo_contato_at: (row.ultimo_contato_at as string) ?? null,
    deadline_fall: (row.deadline_fall as string) ?? null,
    deadline_spring: (row.deadline_spring as string) ?? null,
    rolling_admission: (row.rolling_admission as boolean) ?? false,
    serie_maxima: (row.serie_maxima as string) ?? "",
  };
}

export default async function EscolasPage() {
  await requirePapel("ceo");

  const supabase = await createServerSupabaseClient();

  const { data: rawEscolas } = await supabase
    .from("escolas")
    .select("*")
    .is("deleted_at", null)
    .order("nome", { ascending: true });

  const schools: School[] = (rawEscolas ?? []).map(mapSupabaseToSchool);

  const activeSchools = schools.filter((s) => s.status === "ativa");
  const totalApplications = schools.reduce((s, sc) => s + sc.total_applications, 0);
  const totalAccepted = schools.reduce((s, sc) => s + sc.acceptance_count, 0);
  const overallAcceptance = totalApplications > 0 ? Math.round((totalAccepted / totalApplications) * 100) : 0;
  const schoolsWithScholarship = schools.filter((s) => s.avg_scholarship_pct > 0);
  const avgScholarship = schoolsWithScholarship.length > 0
    ? Math.round(schoolsWithScholarship.reduce((s, sc) => s + sc.avg_scholarship_pct, 0) / schoolsWithScholarship.length)
    : 0;

  return (
    <div className="space-y-5">
      <PageHeader dense
        eyebrow="Inteligência"
        title="Banco de Escolas"
        description={`Inteligência institucional acumulada — ${schools.length} instituições cadastradas`}
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Escolas ativas" value={activeSchools.length} icon={GraduationCap} accent="brand" />
        <StatCard label="Aplicações totais" value={totalApplications} icon={Users} accent="blue" />
        <StatCard label="Taxa de aceite global" value={`${overallAcceptance}%`} icon={TrendingUp} accent="green" />
        <StatCard label="Bolsa média" value={`${avgScholarship}%`} icon={Star} accent="orange" />
      </div>

      {/* Toolbar + grid + sheets (client) */}
      <EscolasClient schools={schools} />
    </div>
  );
}
