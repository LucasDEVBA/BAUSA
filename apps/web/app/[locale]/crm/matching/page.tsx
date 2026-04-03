import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { requirePapel } from "@/lib/crm/auth";
import { MetricCard } from "@/components/crm/shared/MetricCard";
import { Shuffle, GraduationCap, Target, TrendingUp } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function MatchingPage({ params }: PageProps) {
  const { locale } = await params;
  await requirePapel("ceo", locale);
  const supabase = await createServerSupabaseClient();

  // Buscar atletas com deals ativos para matching
  const { data: atletas } = await supabase
    .from("atletas")
    .select("id, nome_completo, esporte, serie_escolar, nivel_competitivo, nivel_ingles, faixa_investimento, lead_classificacao")
    .is("deleted_at", null)
    .order("lead_score", { ascending: false })
    .limit(20);

  // Buscar escolas ativas
  const { data: escolas } = await supabase
    .from("escolas")
    .select("id, nome, estado_us, tipo, status")
    .eq("status", "ativa")
    .is("deleted_at", null);

  // Buscar estratégias existentes
  const { data: estrategias } = await supabase
    .from("estrategia_escolas")
    .select("*, escola:escolas(nome, estado_us, tipo)")
    .is("deleted_at", null)
    .order("match_score", { ascending: false })
    .limit(50);

  const totalEscolas = escolas?.length || 0;
  const totalAtletas = atletas?.length || 0;
  const totalMatches = estrategias?.length || 0;
  const avgScore = totalMatches > 0
    ? Math.round((estrategias || []).reduce((s, e) => s + (e.match_score || 0), 0) / totalMatches)
    : 0;

  const classLabel = (score: number) => {
    if (score >= 85) return { label: "Excelente", color: "text-[var(--crm-success)] bg-[var(--crm-success-tint)] border-[var(--crm-success)]/20" };
    if (score >= 70) return { label: "Forte", color: "text-[var(--crm-info)] bg-[var(--crm-info-tint)] border-[var(--crm-info)]/20" };
    if (score >= 50) return { label: "Possivel", color: "text-[var(--crm-warning)] bg-[var(--crm-warning-tint)] border-[var(--crm-warning)]/20" };
    return { label: "Fraco", color: "text-[var(--crm-error)] bg-[var(--crm-error-tint)] border-[var(--crm-error)]/20" };
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="crm-page-title">Motor de Match</h1>
        <p className="crm-page-subtitle">Conexao inteligente entre atletas e universidades</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Escolas Ativas" value={String(totalEscolas)} icon={GraduationCap} variant="purple" />
        <MetricCard title="Atletas no CRM" value={String(totalAtletas)} icon={Target} variant="cold" />
        <MetricCard title="Matches Gerados" value={String(totalMatches)} icon={Shuffle} variant="hot" />
        <MetricCard title="Score Medio" value={`${avgScore}/100`} icon={TrendingUp} variant="default" />
      </div>

      {/* Matches existentes */}
      <div className="crm-card">
        <p className="text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] uppercase tracking-[var(--crm-tracking-widest)] text-[var(--crm-text-secondary)] mb-4">
          Estrategias de Match ({totalMatches})
        </p>
        {totalMatches === 0 ? (
          <div className="text-center py-12">
            <Shuffle className="h-10 w-10 mx-auto text-[var(--crm-text-disabled)] mb-3" />
            <p className="text-[var(--crm-text-sm)] text-[var(--crm-text-tertiary)]">Nenhuma estrategia criada.</p>
            <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)] mt-1">Promova leads e adicione escolas para gerar matches.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--crm-border)] text-left">
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Escola</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Local</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)] text-center">Score</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Classificacao</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Prioridade</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Status</th>
                  <th className="pb-2 font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {(estrategias || []).map((e: any) => {
                  const cls = classLabel(e.match_score || 0);
                  return (
                    <tr key={e.id} className="border-b border-[var(--crm-border)]/50 last:border-0">
                      <td className="py-2.5 text-[var(--crm-text-primary)] font-[var(--crm-weight-medium)]">{e.escola?.nome || "—"}</td>
                      <td className="py-2.5 text-[var(--crm-text-tertiary)]">{e.escola?.estado_us || "—"}</td>
                      <td className="py-2.5 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          <div className="w-10 h-1.5 rounded-full bg-[var(--crm-neutral-200)] overflow-hidden">
                            <div className={`h-full rounded-full ${e.match_score >= 70 ? "bg-[var(--crm-success)]" : e.match_score >= 50 ? "bg-[var(--crm-warning)]" : "bg-[var(--crm-error)]"}`} style={{ width: `${e.match_score || 0}%` }} />
                          </div>
                          <span className="text-[var(--crm-text-xs)] font-[var(--crm-weight-bold)] text-[var(--crm-text-secondary)]">{e.match_score || 0}</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span className={`text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] px-2 py-0.5 rounded-full border ${cls.color}`}>{cls.label}</span>
                      </td>
                      <td className="py-2.5 text-[var(--crm-text-secondary)] capitalize">{e.prioridade?.replace("_", " ") || "—"}</td>
                      <td className="py-2.5 text-[var(--crm-text-secondary)] capitalize">{e.status?.replace("_", " ") || "—"}</td>
                      <td className="py-2.5 text-[var(--crm-text-secondary)] capitalize">{e.resultado?.replace("_", " ") || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Atletas disponíveis para match */}
      <div className="crm-card">
        <p className="text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] uppercase tracking-[var(--crm-tracking-widest)] text-[var(--crm-text-secondary)] mb-4">
          Atletas para Match ({totalAtletas})
        </p>
        {totalAtletas === 0 ? (
          <p className="text-[var(--crm-text-sm)] text-[var(--crm-text-tertiary)]">Nenhum atleta no CRM.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(atletas || []).slice(0, 9).map((a: any) => (
              <div key={a.id} className="crm-card hover:bg-[var(--crm-surface)] transition-colors">
                <p className="text-[var(--crm-text-sm)] font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">{a.nome_completo}</p>
                <div className="flex items-center gap-2 mt-1 text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">
                  <span>{a.esporte}</span>
                  <span className="text-[var(--crm-text-disabled)]">|</span>
                  <span>{a.serie_escolar}</span>
                  <span className="text-[var(--crm-text-disabled)]">|</span>
                  <span>{a.faixa_investimento?.replace("_", " ")}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Ingles: {a.nivel_ingles}</span>
                  <span className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Nivel: {a.nivel_competitivo?.replace("_", " ")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
