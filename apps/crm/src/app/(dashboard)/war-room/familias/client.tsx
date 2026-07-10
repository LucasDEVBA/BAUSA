"use client";

import Link from "next/link";
import {
  HeartPulse,
  Sparkles,
  AlertTriangle,
  Activity,
  TrendingUp,
  Flame,
  Users2,
  CheckCircle2,
  CircleAlert,
  Clock,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  PieChart as PieChartIcon,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PageHeader, ScrollList } from "@/components/ui";
import { FamiliasViewSwitcher } from "@/components/familias/FamiliasViewSwitcher";
import { cn } from "@/lib/utils";
import type {
  WarRoomFamiliasData,
  WarRoomFamiliaResumo,
} from "@/lib/actions/war-room-familias";
import type { ProximaReuniaoResumo } from "@/lib/actions/reunioes";
import type { OnboardingResumo } from "@/lib/actions/onboarding";

interface Props {
  data: WarRoomFamiliasData;
  onboardings: OnboardingResumo[];
  proximasReunioes: ProximaReuniaoResumo[];
}

const FASE_LABEL: Record<string, string> = {
  admissao: "Admissão",
  pre_embarque: "Pré-embarque",
  pos_embarque: "Pós-embarque",
  primeiro_semestre: "1º semestre",
  acompanhamento: "Acompanhamento",
  encerrada: "Encerrada",
};

const STATUS_LABEL: Record<string, string> = {
  satisfeita: "Satisfeita",
  atencao: "Atenção",
  crise: "Crise",
};

const STATUS_DOT: Record<string, string> = {
  satisfeita: "bg-sys-green",
  atencao: "bg-sys-orange",
  crise: "bg-sys-red",
};

const TEMP_DOT: Record<string, string> = {
  verde: "bg-sys-green",
  amarelo: "bg-sys-orange",
  vermelho: "bg-sys-red",
};

function HealthBar({ score }: { score: number }) {
  const color =
    score >= 75
      ? "bg-sys-green"
      : score >= 50
        ? "bg-sys-orange"
        : "bg-sys-red";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", color)}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{score}</span>
    </div>
  );
}

function FamiliaRow({
  familia,
  variant,
}: {
  familia: WarRoomFamiliaResumo;
  variant: "critica" | "satisfeita";
}) {
  const Icon = variant === "critica" ? AlertTriangle : Sparkles;
  const iconColor =
    variant === "critica" ? "text-sys-red" : "text-sys-green";
  return (
    <Link
      href={`/familias-pipeline?openExperiencia=${familia.experiencia_id}`}
      className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-secondary/40"
    >
      <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {familia.atleta_nome}
          </p>
          <span
            className={cn(
              "inline-flex h-1.5 w-1.5 rounded-full",
              STATUS_DOT[familia.status],
            )}
            title={STATUS_LABEL[familia.status]}
          />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {FASE_LABEL[familia.fase] ?? familia.fase} ·{" "}
          {familia.head_nome ? `Head ${familia.head_nome}` : "Sem head"}
          {familia.dias_sem_contato != null && familia.dias_sem_contato > 0 && (
            <> · {familia.dias_sem_contato}d sem contato</>
          )}
        </p>
      </div>
      <HealthBar score={familia.health_score} />
      <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-primary" />
    </Link>
  );
}

export function WarRoomFamiliasGerencial({
  data,
  onboardings,
  proximasReunioes,
}: Props) {
  const { kpis } = data;

  const taxaSatisfeitas =
    kpis.total > 0 ? Math.round((kpis.satisfeitas / kpis.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/war-room"
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-3.5" />
        Voltar ao War Room
      </Link>
      <PageHeader
        eyebrow="War Room · Famílias"
        title="Experiência das Famílias"
        description="Visão gerencial de saúde, satisfação e risco da carteira."
        actions={<FamiliasViewSwitcher />}
      />

      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <MetricCard
          title="Total de famílias"
          value={kpis.total}
          subtitle={`${kpis.em_onboarding} em onboarding · ${kpis.onboardings_concluidos} concluídos`}
          icon={Users2}
          variant="cold"
        />
        <MetricCard
          title="Health Score médio"
          value={`${kpis.health_score_medio}`}
          subtitle="Escala 0–100 (composição interna)"
          icon={HeartPulse}
          variant={
            kpis.health_score_medio >= 75
              ? "hot"
              : kpis.health_score_medio >= 50
                ? "warm"
                : "default"
          }
        />
        <MetricCard
          title="Satisfação média"
          value={`${kpis.satisfacao_media.toFixed(1)}/5`}
          subtitle={`${taxaSatisfeitas}% satisfeitas`}
          icon={Sparkles}
          variant="hot"
        />
        <MetricCard
          title="NPS 6 meses"
          value={kpis.nps_score}
          subtitle={`${kpis.nps_promotores} promotores · ${kpis.nps_detratores} detratores`}
          icon={TrendingUp}
          variant={
            kpis.nps_score >= 50
              ? "hot"
              : kpis.nps_score >= 0
                ? "warm"
                : "default"
          }
        />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <MetricCard
          title="Em crise"
          value={kpis.em_crise}
          subtitle="Status crítico ativo"
          icon={Flame}
          variant={kpis.em_crise > 0 ? "warm" : "default"}
        />
        <MetricCard
          title="Em atenção"
          value={kpis.em_atencao}
          subtitle="Necessidade de contato"
          icon={CircleAlert}
          variant={kpis.em_atencao > 0 ? "warm" : "default"}
        />
        <MetricCard
          title="Sem contato >30d"
          value={kpis.sem_contato_critico}
          subtitle="Risco de relacionamento"
          icon={Clock}
          variant={kpis.sem_contato_critico > 0 ? "warm" : "default"}
        />
        <MetricCard
          title="Ansiedade média"
          value={`${kpis.ansiedade_media.toFixed(1)}/5`}
          subtitle="Quanto menor, melhor"
          icon={Activity}
          variant="purple"
        />
      </div>

      {/* Distribuições */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Por fase */}
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">Distribuição por fase</h2>
              <p className="text-xs text-muted-foreground">
                Composição da carteira ativa
              </p>
            </div>
            <PieChartIcon className="h-4 w-4 text-muted-foreground" />
          </div>
          {Object.keys(data.por_fase).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma família ativa
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(data.por_fase)
                .sort((a, b) => b[1] - a[1])
                .map(([fase, count]) => {
                  const pct = kpis.total > 0 ? (count / kpis.total) * 100 : 0;
                  return (
                    <div key={fase} className="flex items-center gap-3">
                      <span className="w-32 text-xs text-muted-foreground">
                        {FASE_LABEL[fase] ?? fase}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-xs font-medium tabular-nums text-foreground">
                        {count}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Por temperatura */}
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">Temperatura</h2>
              <p className="text-xs text-muted-foreground">
                Risco percebido pela equipe
              </p>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["verde", "amarelo", "vermelho"] as const).map((temp) => {
              const count = data.por_temperatura[temp];
              const pct = kpis.total > 0 ? Math.round((count / kpis.total) * 100) : 0;
              return (
                <div
                  key={temp}
                  className="flex flex-col items-center gap-1 rounded-md bg-secondary/40 p-2.5"
                >
                  <span
                    className={cn("h-2 w-2 rounded-full", TEMP_DOT[temp])}
                  />
                  <p className="text-base font-semibold tabular-nums text-foreground">
                    {count}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {temp}
                  </p>
                  <p className="text-xs text-muted-foreground">{pct}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top críticas / Top satisfeitas */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col h-[24rem] rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
                Famílias críticas
              </h2>
              <p className="text-xs text-muted-foreground">
                Menor health score · ação imediata
              </p>
            </div>
            <AlertTriangle className="h-4 w-4 text-sys-red" />
          </div>
          {data.top_criticas.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma família crítica no momento 🎉
              </p>
            </div>
          ) : (
            <ScrollList className="flex flex-col gap-2">
              {data.top_criticas.map((f) => (
                <FamiliaRow
                  key={f.experiencia_id}
                  familia={f}
                  variant="critica"
                />
              ))}
            </ScrollList>
          )}
        </div>

        <div className="flex flex-col h-[24rem] rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
                Candidatas a indicação
              </h2>
              <p className="text-xs text-muted-foreground">
                Maiores health scores entre satisfeitas
              </p>
            </div>
            <Sparkles className="h-4 w-4 text-sys-green" />
          </div>
          {data.top_satisfeitas.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma família elegível ainda
              </p>
            </div>
          ) : (
            <ScrollList className="flex flex-col gap-2">
              {data.top_satisfeitas.map((f) => (
                <FamiliaRow
                  key={f.experiencia_id}
                  familia={f}
                  variant="satisfeita"
                />
              ))}
            </ScrollList>
          )}
        </div>
      </div>

      {/* Ranking Heads */}
      {data.ranking_heads.length > 0 && (
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
                Performance por Head
              </h2>
              <p className="text-xs text-muted-foreground">
                Ranking por satisfação média da carteira
              </p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Head</th>
                  <th className="px-3 py-2 text-right font-medium">Famílias</th>
                  <th className="px-3 py-2 text-right font-medium">Satisfação</th>
                  <th className="px-3 py-2 text-right font-medium">Health</th>
                  <th className="px-3 py-2 text-right font-medium">Em crise</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking_heads.map((h) => (
                  <tr
                    key={h.head_id}
                    className="border-b border-border/40 last:border-0"
                  >
                    <td className="px-3 py-3 text-foreground">{h.nome}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {h.total_familias}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-foreground">
                      {h.satisfacao_media.toFixed(1)}/5
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium tabular-nums",
                          h.health_score_medio >= 75
                            ? "bg-sys-green/15 text-sys-green"
                            : h.health_score_medio >= 50
                              ? "bg-sys-orange/15 text-sys-orange"
                              : "bg-sys-red/15 text-sys-red",
                        )}
                      >
                        {h.health_score_medio}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <span
                        className={cn(
                          "font-semibold",
                          h.em_crise > 0
                            ? "text-sys-red"
                            : "text-muted-foreground",
                        )}
                      >
                        {h.em_crise}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alertas executivos */}
      {data.alertas_executivos.length > 0 && (
        <div className="rounded-lg border border-sys-red/30 bg-sys-red/5 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
                Alertas executivos
              </h2>
              <p className="text-xs text-muted-foreground">
                Itens que demandam decisão do CEO
              </p>
            </div>
            <AlertTriangle className="h-4 w-4 text-sys-red" />
          </div>
          <ul className="flex flex-col gap-2">
            {data.alertas_executivos.map((a, idx) => (
              <li key={`${a.experiencia_id}-${idx}`}>
                <Link
                  href={`/familias-pipeline?openExperiencia=${a.experiencia_id}`}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2 transition-colors hover:border-sys-red/50 hover:bg-sys-red/5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {a.atleta_nome}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {a.descricao}
                    </p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-sys-red" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Próximas reuniões + Onboardings ativos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
                Próximas reuniões
              </h2>
              <p className="text-xs text-muted-foreground">
                Visibilidade executiva da agenda
              </p>
            </div>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </div>
          {proximasReunioes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma reunião agendada
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {proximasReunioes.slice(0, 6).map((r) => {
                const dataFmt = new Date(r.data_hora).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                });
                return (
                  <li key={r.id}>
                    <Link
                      href={`/familias-pipeline?openExperiencia=${r.experiencia_id}`}
                      className="group flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2 transition-colors hover:border-primary/40 hover:bg-secondary/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {r.experiencia?.atleta?.nome_completo ?? r.titulo}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.titulo}
                          {r.assuntos.length > 0 && (
                            <> · {r.assuntos.slice(0, 2).join(", ")}</>
                          )}
                        </p>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {dataFmt}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border/70 bg-card/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
                Onboardings em curso
              </h2>
              <p className="text-xs text-muted-foreground">
                Progresso das famílias recém-admitidas
              </p>
            </div>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          {onboardings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum onboarding ativo
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {onboardings.slice(0, 6).map((o) => (
                <li key={o.instancia_id}>
                  <Link
                    href={`/familias-pipeline?openExperiencia=${o.experiencia_id}`}
                    className="group flex flex-col gap-1.5 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-secondary/40"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-foreground">
                        {o.atleta_nome}
                      </p>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {o.concluidas}/{o.total}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          o.atrasadas > 0 ? "bg-sys-orange" : "bg-primary",
                        )}
                        style={{ width: `${o.percent}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {o.head_nome ? `Head ${o.head_nome}` : "Sem head"}
                      {o.atrasadas > 0 && (
                        <span className="ml-2 text-sys-orange">
                          {o.atrasadas} etapa(s) atrasada(s)
                        </span>
                      )}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
