import {
  GraduationCap,
  MapPin,
  TrendingUp,
  Users,
  Star,
  Filter,
  Search,
  ExternalLink,
  AlertTriangle,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  SCHOOL_STATUS_CONFIG,
  SCHOOL_TYPE_CONFIG,
  type School,
  type SchoolType,
  type SchoolStatus,
  type SchoolSportInfluence,
  type ScholarshipAggressiveness,
} from "@/types/school";
import { cn } from "@/lib/utils";
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
    gpa_minimo: row.gpa_minimo != null ? Number(row.gpa_minimo) : null,
    temperatura_relacionamento: (row.temperatura_relacionamento as string) ?? "neutro",
    ultimo_contato_at: (row.ultimo_contato_at as string) ?? null,
    deadline_fall: (row.deadline_fall as string) ?? null,
    deadline_spring: (row.deadline_spring as string) ?? null,
    rolling_admission: (row.rolling_admission as boolean) ?? false,
    serie_maxima: (row.serie_maxima as string) ?? "",
  };
}

function SchoolCard({ school }: { school: School }) {
  const statusCfg = SCHOOL_STATUS_CONFIG[school.status];
  const typeCfg = SCHOOL_TYPE_CONFIG[school.type];
  const acceptanceRate = school.total_applications > 0
    ? Math.round((school.acceptance_count / school.total_applications) * 100)
    : 0;

  return (
    <div
      data-school-id={school.id}
      role="button"
      tabIndex={0}
      className="cursor-pointer rounded-xl border border-[#1e2130] bg-[#141720] p-5 transition-colors hover:border-indigo-500/30 hover:bg-[#161b28]">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold", typeCfg.bg, typeCfg.color)}>
              {typeCfg.label}
            </span>
            <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium", statusCfg.bg, statusCfg.color)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", statusCfg.color.replace("text-", "bg-"))} />
              {statusCfg.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white leading-tight">{school.name}</h3>
          <p className="flex items-center gap-1 mt-0.5 text-xs text-zinc-500">
            <MapPin className="h-3 w-3" />
            {school.city}, {school.state}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs text-zinc-600">Match medio</p>
          <p className="text-xl font-bold text-emerald-400">{school.avg_scholarship_pct}%</p>
          <p className="text-[10px] text-zinc-600">bolsa media</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-[#0c0e16] px-3 py-2 text-center">
          <p className="text-lg font-bold text-white">{acceptanceRate}%</p>
          <p className="text-[10px] text-zinc-500">Taxa aceite</p>
        </div>
        <div className="rounded-lg bg-[#0c0e16] px-3 py-2 text-center">
          <p className="text-lg font-bold text-white">{school.total_applications}</p>
          <p className="text-[10px] text-zinc-500">Aplicacoes</p>
        </div>
        <div className="rounded-lg bg-[#0c0e16] px-3 py-2 text-center">
          <p className="text-lg font-bold text-white">{school.avg_response_days}d</p>
          <p className="text-[10px] text-zinc-500">Resp. media</p>
        </div>
      </div>

      {/* Regras financeiras */}
      <div className="mb-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">Budget exigido</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-1.5">
            <p className="text-[10px] text-zinc-600">Minimo</p>
            <p className="text-xs font-semibold text-amber-400">US$ {(school.min_budget_usd / 1000).toFixed(0)}k</p>
          </div>
          <div className="flex-1 rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-1.5">
            <p className="text-[10px] text-zinc-600">Forte</p>
            <p className="text-xs font-semibold text-emerald-400">US$ {(school.strong_budget_usd / 1000).toFixed(0)}k</p>
          </div>
        </div>
      </div>

      {/* Agressividade de bolsa */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] text-zinc-600">Agressividade bolsa</p>
        <span className={cn(
          "rounded-md border px-2 py-0.5 text-[10px] font-medium",
          school.scholarship_aggressiveness === "agressiva"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : school.scholarship_aggressiveness === "moderada"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
            : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
        )}>
          {school.scholarship_aggressiveness.charAt(0).toUpperCase() + school.scholarship_aggressiveness.slice(1)}
        </span>
      </div>

      {/* Influencia esportiva */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] text-zinc-600">Influencia esportiva</p>
        <span className={cn(
          "rounded-md border px-2 py-0.5 text-[10px] font-medium",
          school.sport_influence === "decisiva"
            ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
            : school.sport_influence === "alta"
            ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
            : school.sport_influence === "media"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
            : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
        )}>
          {school.sport_influence.charAt(0).toUpperCase() + school.sport_influence.slice(1)}
        </span>
      </div>

      {/* Temperatura do relacionamento */}
      {school.temperatura_relacionamento && (
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600">Relacionamento</p>
          <span className={cn(
            "rounded-md border px-2 py-0.5 text-[10px] font-medium",
            school.temperatura_relacionamento === "forte"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : school.temperatura_relacionamento === "bom"
              ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
              : school.temperatura_relacionamento === "frio"
              ? "border-red-500/30 bg-red-500/10 text-red-400"
              : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
          )}>
            {school.temperatura_relacionamento.charAt(0).toUpperCase() + school.temperatura_relacionamento.slice(1)}
          </span>
        </div>
      )}

      {/* Ultimo contato */}
      {school.ultimo_contato_at && (() => {
        const dias = Math.floor((Date.now() - new Date(school.ultimo_contato_at!).getTime()) / (1000 * 60 * 60 * 24));
        const isAlert = dias > 90;
        return (
          <div className={cn("mb-3 flex items-center justify-between rounded-md px-2 py-1.5", isAlert && "bg-red-500/5 border border-red-500/20")}>
            <p className="text-[10px] text-zinc-600">Ultimo contato</p>
            <span className={cn("flex items-center gap-1 text-[10px] font-medium", isAlert ? "text-red-400" : "text-zinc-400")}>
              {isAlert && <AlertTriangle className="h-3 w-3" />}
              {dias}d atras
            </span>
          </div>
        );
      })()}

      {/* Deadlines */}
      {(school.deadline_fall || school.deadline_spring) && (
      <div className="mb-3 grid grid-cols-2 gap-2">
        {school.deadline_fall && (
          <div className="rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-1.5">
            <p className="text-[10px] text-zinc-600 flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />Fall</p>
            <p className="text-xs font-medium text-amber-400">{new Date(school.deadline_fall).toLocaleDateString("pt-BR")}</p>
          </div>
        )}
        {school.deadline_spring && (
          <div className="rounded-md border border-[#1e2130] bg-[#0c0e16] px-2.5 py-1.5">
            <p className="text-[10px] text-zinc-600 flex items-center gap-1"><Calendar className="h-2.5 w-2.5" />Spring</p>
            <p className="text-xs font-medium text-blue-400">{new Date(school.deadline_spring).toLocaleDateString("pt-BR")}</p>
          </div>
        )}
      </div>
      )}

      {/* Rolling admission + Serie maxima */}
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
          school.rolling_admission
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-zinc-500/30 bg-zinc-500/10 text-zinc-500"
        )}>
          {school.rolling_admission && <CheckCircle className="h-2.5 w-2.5" />}
          Rolling: {school.rolling_admission ? "Sim" : "Nao"}
        </span>
        {school.serie_maxima && (
          <span className="rounded-md border border-zinc-500/30 bg-zinc-500/10 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            Serie max: {school.serie_maxima}
          </span>
        )}
        {school.gpa_minimo != null && school.gpa_minimo > 0 && (
          <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
            GPA min: {school.gpa_minimo.toFixed(1)}
          </span>
        )}
      </div>

      {/* Regra pratica BAUSA */}
      {school.practical_rule && (
        <div className="mb-4 rounded-md border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
          <p className="text-[10px] font-semibold text-indigo-400 mb-0.5">Regra BAUSA</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">{school.practical_rule}</p>
        </div>
      )}

      {/* Testes exigidos */}
      {school.required_tests.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {school.required_tests.map((test) => (
            <span key={test} className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
              {test}
            </span>
          ))}
        </div>
      )}

      {/* Coach info */}
      {school.coach_name && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Users className="h-3 w-3 flex-shrink-0" />
          <span>{school.coach_name}</span>
          {school.coach_email && (
            <a href={`mailto:${school.coach_email}`} className="ml-auto text-indigo-400 hover:text-indigo-300">
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default async function EscolasPage() {
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Banco de Escolas</h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            Inteligencia institucional acumulada — {schools.length} instituicoes cadastradas
          </p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">
          <GraduationCap className="h-4 w-4" />
          Adicionar escola
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Escolas ativas", value: activeSchools.length.toString(), icon: GraduationCap, color: "text-indigo-400", bg: "bg-indigo-500/10" },
          { label: "Aplicacoes totais", value: totalApplications.toString(), icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Taxa de aceite global", value: `${overallAcceptance}%`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Bolsa media", value: `${avgScholarship}%`, icon: Star, color: "text-amber-400", bg: "bg-amber-500/10" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-[#1e2130] bg-[#141720] p-4">
              <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", kpi.bg)}>
                <Icon className={cn("h-4 w-4", kpi.color)} />
              </div>
              <p className="text-2xl font-bold text-white">{kpi.value}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Buscar escola..."
            className="w-full rounded-lg border border-[#1e2130] bg-[#141720] py-2 pl-9 pr-3 text-sm text-zinc-300 placeholder-zinc-600 focus:border-indigo-500/50 focus:outline-none"
          />
        </div>
        <button className="flex items-center gap-2 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-[#1a1f2e]">
          <Filter className="h-4 w-4" />
          Filtrar
        </button>
      </div>

      {/* Grid por tipo */}
      {(["Division I", "Division II", "Division III", "NAIA", "JUCO"] as const).map((type) => {
        const typeSchools = schools.filter((s) => s.type === type);
        if (typeSchools.length === 0) return null;
        const typeCfg = SCHOOL_TYPE_CONFIG[type];
        return (
          <div key={type}>
            <div className="mb-3 flex items-center gap-2">
              <span className={cn("rounded-md border px-2.5 py-1 text-xs font-bold", typeCfg.bg, typeCfg.color)}>
                {type}
              </span>
              <p className="text-xs text-zinc-600">{typeSchools.length} escola{typeSchools.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {typeSchools.map((school) => (
                <SchoolCard key={school.id} school={school} />
              ))}
            </div>
          </div>
        );
      })}

      {schools.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap className="h-10 w-10 mx-auto text-zinc-600 mb-3" />
          <p className="text-sm text-zinc-500">Nenhuma escola cadastrada.</p>
          <p className="text-xs text-zinc-600 mt-1">Adicione escolas para construir a base institucional.</p>
        </div>
      )}

      {/* Client component for school detail sheet */}
      <EscolasClient schools={schools} />
    </div>
  );
}
