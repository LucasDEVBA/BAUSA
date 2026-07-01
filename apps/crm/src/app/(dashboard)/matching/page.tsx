import {
  Shuffle,
  GraduationCap,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Star,
  Zap,
  Target,
  BookOpen,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  type SchoolMatch,
  type MatchClassification,
  getMatchClassification,
  MATCH_CLASSIFICATION_CONFIG,
} from "@/types/matching";
import { EditableStrategyRow } from "@/components/matching/EditableStrategyRow";
import { cn } from "@/lib/utils";

interface StrategyWithEditable extends SchoolMatch {
  estrategia_id: string;
  bolsa_obtida_pct: number | null;
  bolsa_obtida_valor: number | null;
  data_aplicacao: string | null;
  data_resposta: string | null;
  resultado: string;
}

// Mapeia dados de estrategia_escolas para SchoolMatch
function mapEstrategiaToMatch(row: Record<string, unknown>): SchoolMatch {
  const escola = row.escola as Record<string, unknown> | null;
  const score = Number(row.match_score) || 0;
  const classification = getMatchClassification(score);

  return {
    school_id: (row.escola_id as string) ?? "",
    school_name: (escola?.nome as string) ?? "Escola desconhecida",
    school_type: (escola?.tipo as string) ?? "",
    school_state: (escola?.estado_us as string) ?? "",
    school_city: "",
    score,
    classification,
    estimated_scholarship_pct: Number(row.bolsa_estimada_pct) || 0,
    compatibility_notes: row.observacao ? [row.observacao as string] : [],
    blockers: [],
  };
}

function mapEstrategiaToEditable(row: Record<string, unknown>): StrategyWithEditable {
  const base = mapEstrategiaToMatch(row);
  return {
    ...base,
    estrategia_id: (row.id as string) ?? "",
    bolsa_obtida_pct: row.bolsa_obtida_pct != null ? Number(row.bolsa_obtida_pct) : null,
    bolsa_obtida_valor: row.bolsa_obtida_valor != null ? Number(row.bolsa_obtida_valor) : null,
    data_aplicacao: (row.data_aplicacao as string) ?? null,
    data_resposta: (row.data_resposta as string) ?? null,
    resultado: (row.resultado as string) ?? "nao_aplicado",
  };
}

function ScoreMeter({ score }: { score: number }) {
  const cls = getMatchClassification(score);
  const cfg = MATCH_CLASSIFICATION_CONFIG[cls];
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`}
            className={cfg.color}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-xs font-bold", cfg.color)}>{score}</span>
        </div>
      </div>
      <div>
        <p className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</p>
      </div>
    </div>
  );
}

function MatchRow({ match }: { match: SchoolMatch }) {
  const cfg = MATCH_CLASSIFICATION_CONFIG[match.classification];
  return (
    <div className={cn("rounded-lg border p-3 transition-colors hover:bg-accent", cfg.border, cfg.bg)}>
      <div className="flex items-start gap-3">
        <ScoreMeter score={match.score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{match.school_name}</p>
            <span className="text-[10px] font-medium text-muted-foreground">
              {match.school_type} {match.school_state ? `· ${match.school_state}` : ""}
            </span>
          </div>
          {match.estimated_scholarship_pct > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Bolsa estimada: <span className="font-semibold text-sys-green">{match.estimated_scholarship_pct}%</span>
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {match.compatibility_notes.map((n, i) => (
              <span key={i} className="flex items-center gap-1 rounded-md bg-sys-green/10 px-1.5 py-0.5 text-[10px] text-sys-green">
                <CheckCircle className="h-2.5 w-2.5" /> {n}
              </span>
            ))}
            {match.blockers.map((b, i) => (
              <span key={i} className="flex items-center gap-1 rounded-md bg-sys-red/10 px-1.5 py-0.5 text-[10px] text-sys-red">
                <AlertCircle className="h-2.5 w-2.5" /> {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function MatchingPage() {
  const supabase = await createServerSupabaseClient();

  // Buscar escolas ativas
  const { data: rawEscolas } = await supabase
    .from("escolas")
    .select("id, nome, estado_us, tipo, status")
    .eq("status", "ativa")
    .is("deleted_at", null);

  // Buscar atletas com maior lead_score
  const { data: rawAtletas } = await supabase
    .from("atletas")
    .select("id, nome_completo, esporte, serie_escolar, nivel_competitivo, nivel_ingles, faixa_investimento, lead_classificacao")
    .is("deleted_at", null)
    .order("lead_score", { ascending: false })
    .limit(20);

  // Buscar estrategias existentes com join na escola
  const { data: rawEstrategias } = await supabase
    .from("estrategia_escolas")
    .select("*, escola:escolas(nome, estado_us, tipo)")
    .is("deleted_at", null)
    .order("match_score", { ascending: false })
    .limit(50);

  const totalSchools = rawEscolas?.length ?? 0;
  const totalAtletas = rawAtletas?.length ?? 0;
  const matches = (rawEstrategias ?? []).map(mapEstrategiaToMatch);
  const totalMatches = matches.length;
  const avgScore = totalMatches > 0
    ? Math.round(matches.reduce((s, m) => s + m.score, 0) / totalMatches)
    : 0;

  // Agrupar matches por atleta (usando atleta_id das estrategias)
  const atletaMap = new Map<string, { name: string; esporte: string; matches: StrategyWithEditable[] }>();
  for (const row of rawEstrategias ?? []) {
    const atletaId = row.atleta_id as string;
    if (!atletaMap.has(atletaId)) {
      const atleta = (rawAtletas ?? []).find((a: Record<string, unknown>) => a.id === atletaId);
      atletaMap.set(atletaId, {
        name: (atleta?.nome_completo as string) ?? "Atleta",
        esporte: (atleta?.esporte as string) ?? "",
        matches: [],
      });
    }
    atletaMap.get(atletaId)!.matches.push(mapEstrategiaToEditable(row));
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-5 w-5 text-primary" />
            <h1 className="text-title-2 text-foreground">Motor de Match Atleta-Escola</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Cruzamento automatico de perfil do atleta com regras institucionais — {totalSchools} escolas na base
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Escolas ativas", value: totalSchools.toString(), icon: GraduationCap, color: "text-primary", bg: "bg-primary/10" },
          { label: "Atletas no CRM", value: totalAtletas.toString(), icon: Target, color: "text-sys-blue", bg: "bg-sys-blue/10" },
          { label: "Matches gerados", value: totalMatches.toString(), icon: Shuffle, color: "text-sys-green", bg: "bg-sys-green/10" },
          { label: "Score medio", value: `${avgScore}/100`, icon: TrendingUp, color: "text-sys-orange", bg: "bg-sys-orange/10" },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-lg border border-border/70 bg-card/60 p-3">
              <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", kpi.bg)}>
                <Icon className={cn("h-4 w-4", kpi.color)} />
              </div>
              <p className="text-base font-semibold text-foreground">{kpi.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      {/* Legenda de classificacao */}
      <div className="flex flex-wrap gap-3">
        {(["excelente", "forte", "possivel", "fraco"] as const).map((cls) => {
          const cfg = MATCH_CLASSIFICATION_CONFIG[cls];
          return (
            <div key={cls} className={cn("flex items-center gap-2 rounded-lg border px-3 py-1.5", cfg.border, cfg.bg)}>
              <div className={cn("h-2 w-2 rounded-full", cfg.color.replace("text-", "bg-"))} />
              <span className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</span>
              <span className="text-[10px] text-label-tertiary">&gt;= {cfg.scoreMin}</span>
            </div>
          );
        })}
      </div>

      {/* Matches por atleta */}
      {atletaMap.size > 0 ? (
        <div className="space-y-8">
          {Array.from(atletaMap.entries()).map(([atletaId, { name, esporte, matches: athleteMatches }]) => {
            athleteMatches.sort((a, b) => b.score - a.score);
            const excelente = athleteMatches.filter((m) => m.classification === "excelente").length;
            const forte = athleteMatches.filter((m) => m.classification === "forte").length;

            return (
              <div key={atletaId} className="border border-border/70 bg-card/60 rounded-xl overflow-hidden">
                <div className="border-b border-border bg-popover px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-white">
                        {name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">{name}</p>
                          {(() => {
                            const atleta = (rawAtletas ?? []).find((a: Record<string, unknown>) => a.id === atletaId);
                            const isAcademico =
                              !atleta?.esporte ||
                              atleta.esporte === "A definir" ||
                              atleta.nivel_competitivo === "apenas_academico";
                            if (!isAcademico) return null;
                            return (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border border-sys-blue/20 bg-sys-blue/10 px-2 py-0.5 text-[10px] font-bold text-sys-blue"
                                title="Pesos redistribuidos: Academico 50%, Esportivo 0%"
                              >
                                <BookOpen className="h-3 w-3" />
                                Apenas Academico
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-xs text-muted-foreground">{esporte}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 text-center">
                      <div className="rounded-lg bg-sys-green/10 border border-sys-green/20 px-3 py-1.5">
                        <p className="text-lg font-bold text-sys-green">{excelente}</p>
                        <p className="text-[10px] text-muted-foreground">Excelente</p>
                      </div>
                      <div className="rounded-lg bg-sys-blue/10 border border-sys-blue/20 px-3 py-1.5">
                        <p className="text-lg font-bold text-sys-blue">{forte}</p>
                        <p className="text-[10px] text-muted-foreground">Forte</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-label-tertiary mb-3">
                    Ranking de compatibilidade — {athleteMatches.length} escolas analisadas
                  </p>
                  {athleteMatches.slice(0, 6).map((match) => (
                    <EditableStrategyRow
                      key={match.estrategia_id}
                      strategy={{
                        id: match.estrategia_id,
                        school_name: match.school_name,
                        school_type: match.school_type,
                        school_state: match.school_state,
                        score: match.score,
                        classification: match.classification,
                        estimated_scholarship_pct: match.estimated_scholarship_pct,
                        compatibility_notes: match.compatibility_notes,
                        blockers: match.blockers,
                        bolsa_obtida_pct: match.bolsa_obtida_pct,
                        bolsa_obtida_valor: match.bolsa_obtida_valor,
                        data_aplicacao: match.data_aplicacao,
                        data_resposta: match.data_resposta,
                        resultado: match.resultado,
                      }}
                    />
                  ))}
                  {athleteMatches.length > 6 && (
                    <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                      Ver mais {athleteMatches.length - 6} escolas
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Atletas disponiveis sem match */
        <div className="space-y-4">
          {totalAtletas > 0 && (
            <div className="rounded-lg border border-border/70 bg-card/60 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-label-tertiary mb-4">
                Atletas disponiveis para match ({totalAtletas})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(rawAtletas ?? []).slice(0, 9).map((a: Record<string, unknown>) => (
                  <div key={a.id as string} className="rounded-lg border border-border bg-popover p-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{a.nome_completo as string}</p>
                      {(!a.esporte || a.esporte === "A definir" || a.nivel_competitivo === "apenas_academico") && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-sys-blue/20 bg-sys-blue/10 px-1.5 py-0.5 text-[9px] font-bold text-sys-blue"
                          title="Pesos redistribuidos: Academico 50%, Esportivo 0%"
                        >
                          <BookOpen className="h-2.5 w-2.5" />
                          Academico
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      <span>{a.esporte as string}</span>
                      <span className="text-label-tertiary">|</span>
                      <span>{a.serie_escolar as string}</span>
                      <span className="text-label-tertiary">|</span>
                      <span>{(a.faixa_investimento as string)?.replace("_", " ")}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-label-tertiary">
                      <span>Ingles: {a.nivel_ingles as string}</span>
                      <span>Nivel: {(a.nivel_competitivo as string)?.replace("_", " ")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalAtletas === 0 && totalMatches === 0 && (
            <div className="text-center py-12">
              <Shuffle className="h-10 w-10 mx-auto text-label-tertiary mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum match gerado ainda.</p>
              <p className="text-xs text-label-tertiary mt-1">Promova leads e adicione escolas para gerar matches automaticos.</p>
            </div>
          )}
        </div>
      )}

      {/* CTA inteligencia futura */}
      <div className="border border-border/70 bg-card/60 rounded-xl border-primary/20 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Inteligencia Institucional Acumulada</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Cada processo concluido alimenta automaticamente a base de dados com escola aplicada, aceite,
              bolsa obtida, tempo de resposta e sucesso por perfil de atleta. Com o tempo, o sistema passara
              a sugerir escolas automaticamente com base em padroes historicos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
