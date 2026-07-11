"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
  ListChecks,
  Loader2,
  SkipForward,
  Sparkles,
  Video,
} from "lucide-react";
import {
  getOnboardingByExperiencia,
  type OnboardingEstatisticas,
  type OnboardingEtapaEstado,
  type OnboardingResumo,
} from "@/lib/actions/onboarding";
import type { TemplateAdmin } from "@/lib/actions/onboarding-admin";
import { TemplatesAdmin } from "@/components/onboarding/TemplatesAdmin";
import { cn } from "@/lib/utils";
import {
  MinimalCard,
  MinimalHeader,
  MinimalStat,
} from "@/components/shared/MinimalUI";
import { BrandTabs } from "@/components/ui";

interface ProximaReuniao {
  id: string;
  experiencia_id: string;
  titulo: string;
  data_hora: string;
  link_reuniao: string | null;
  assuntos: string[];
  experiencia: { atleta: { nome_completo: string } | null } | null;
}

interface Props {
  onboardings: OnboardingResumo[];
  proximasReunioes: ProximaReuniao[];
  estatisticas: OnboardingEstatisticas;
  templates: TemplateAdmin[];
}

type AbaId = "acompanhamento" | "modelos";

export function FamiliasOnboardingClient({
  onboardings,
  proximasReunioes,
  estatisticas,
  templates,
}: Props) {
  const [aba, setAba] = useState<AbaId>("acompanhamento");

  const totalAtivos = onboardings.length;
  const totalAtrasos = onboardings.reduce((s, o) => s + o.atrasadas, 0);
  const percentMedio =
    onboardings.length === 0
      ? 0
      : Math.round(
          onboardings.reduce((s, o) => s + o.percent, 0) / onboardings.length,
        );

  return (
    <div className="flex flex-col gap-3">
      <MinimalHeader
        title="Onboarding de Famílias"
        description="Acompanhamento executivo dos onboardings e configuração dos modelos de etapas seguidos pela Head de Sucesso."
      />

      <BrandTabs
        items={[
          { id: "acompanhamento", label: "Acompanhamento", icon: Sparkles },
          { id: "modelos", label: "Modelos", icon: ListChecks },
        ]}
        activeId={aba}
        onSelect={(id) => setAba(id as AbaId)}
        ariaLabel="Seções do onboarding"
      />

      {aba === "modelos" ? (
        <TemplatesAdmin templatesIniciais={templates} />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            <MinimalStat
              label="Onboardings ativos"
              value={totalAtivos}
              tone="blue"
            />
            <MinimalStat label="Progresso médio" value={`${percentMedio}%`} />
            <MinimalStat
              label="Etapas atrasadas"
              value={totalAtrasos}
              tone={totalAtrasos > 0 ? "red" : "default"}
            />
            <MinimalStat
              label="Concluídos (30d)"
              value={estatisticas.concluidos_30d}
              tone="green"
            />
            <MinimalStat
              label="Tempo médio"
              value={
                estatisticas.tempo_medio_dias === null
                  ? "—"
                  : `${estatisticas.tempo_medio_dias}d`
              }
            />
          </div>

          {/* Onboardings em andamento */}
          <MinimalCard title="Onboardings em andamento" icon={Sparkles}>
            {onboardings.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Nenhum onboarding ativo no momento.
              </p>
            ) : (
              <div className="overflow-hidden rounded-md border border-border/60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="w-6 px-2 py-1.5" aria-label="Expandir" />
                      <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Família
                      </th>
                      <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Head
                      </th>
                      <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Progresso
                      </th>
                      <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Próxima etapa
                      </th>
                      <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Início
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {onboardings.map((o, i) => (
                      <OnboardingRow key={o.instancia_id} resumo={o} zebra={i % 2 === 1} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </MinimalCard>

          {/* Reuniões agendadas */}
          <MinimalCard
            title="Reuniões agendadas"
            icon={Video}
            iconColor="text-sys-blue"
          >
            {proximasReunioes.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Nenhuma reunião agendada.
              </p>
            ) : (
              <ul className="space-y-1">
                {proximasReunioes.map((r) => {
                  const data = new Date(r.data_hora);
                  const atleta =
                    r.experiencia?.atleta?.nome_completo ?? "Atleta";
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-2.5 rounded px-1.5 py-1.5 hover:bg-secondary/30"
                    >
                      <div className="flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-md bg-sys-blue/10 text-sys-blue">
                        <span className="text-[8px] font-semibold uppercase tracking-wider">
                          {data.toLocaleDateString("pt-BR", { month: "short" })}
                        </span>
                        <span className="text-[11px] font-bold leading-none">
                          {data.getDate()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {r.titulo}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {atleta} ·{" "}
                          {data.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {r.assuntos.length > 0 && (
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            Pauta: {r.assuntos.slice(0, 3).join(" · ")}
                            {r.assuntos.length > 3 ? "…" : ""}
                          </p>
                        )}
                      </div>
                      {r.link_reuniao && (
                        <a
                          href={r.link_reuniao}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-sys-blue hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Abrir
                        </a>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </MinimalCard>
        </>
      )}
    </div>
  );
}

// ─── Linha expansível: detalhe completo das etapas da família ─
function OnboardingRow({
  resumo,
  zebra,
}: {
  resumo: OnboardingResumo;
  zebra: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [etapas, setEtapas] = useState<OnboardingEtapaEstado[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const atrasada = resumo.atrasadas > 0;

  const toggle = () => {
    const next = !aberto;
    setAberto(next);
    if (next && etapas === null) {
      startTransition(async () => {
        const data = await getOnboardingByExperiencia(resumo.experiencia_id);
        setEtapas(data.etapas);
      });
    }
  };

  return (
    <>
      <tr
        onClick={toggle}
        className={cn(
          "cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-secondary/30",
          zebra && "bg-secondary/10",
        )}
      >
        <td className="px-2 py-2 text-muted-foreground">
          <button
            type="button"
            aria-expanded={aberto}
            aria-label={`${aberto ? "Recolher" : "Expandir"} etapas de ${resumo.atleta_nome}`}
            onClick={(e) => {
              // O <tr> mantém onClick como conveniência de mouse;
              // stopPropagation evita o toggle duplo via teclado/click no botão
              e.stopPropagation();
              toggle();
            }}
            className="flex items-center justify-center rounded p-0.5 hover:bg-accent hover:text-foreground"
          >
            {aberto ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </td>
        <td className="px-3 py-2">
          <p className="truncate text-xs font-medium text-foreground">
            {resumo.atleta_nome}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {resumo.responsavel_nome}
          </p>
        </td>
        <td className="px-3 py-2 text-xs text-foreground">
          {resumo.head_nome ?? "—"}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-20 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full",
                  resumo.percent === 100
                    ? "bg-sys-green"
                    : atrasada
                      ? "bg-sys-red"
                      : "bg-primary",
                )}
                style={{ width: `${resumo.percent}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-muted-foreground">
              {resumo.concluidas}/{resumo.total}
            </span>
            {atrasada && (
              <span className="inline-flex items-center gap-0.5 rounded bg-sys-red/12 px-1 py-px text-[9px] font-semibold text-sys-red">
                <AlertTriangle className="h-2 w-2" />
                {resumo.atrasadas}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          {resumo.proxima_titulo ? (
            <div>
              <p className="max-w-[220px] truncate text-xs text-foreground">
                {resumo.proxima_titulo}
              </p>
              {resumo.proxima_prazo && (
                <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" />
                  {new Date(resumo.proxima_prazo).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </td>
        <td className="px-3 py-2 text-[10px] tabular-nums text-muted-foreground">
          {new Date(resumo.iniciado_at).toLocaleDateString("pt-BR")}
        </td>
      </tr>

      {aberto && (
        <tr className={cn(zebra && "bg-secondary/10")}>
          <td colSpan={6} className="border-b border-border/50 px-4 pb-3 pt-1">
            {isPending || etapas === null ? (
              <div className="flex items-center gap-2 py-3 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Carregando etapas...
              </div>
            ) : etapas.length === 0 ? (
              <p className="py-2 text-[11px] text-muted-foreground">
                Sem etapas nesta instância.
              </p>
            ) : (
              <ul className="space-y-1 pl-6">
                {etapas.map((e) => {
                  const finalizada =
                    e.status === "concluida" || e.status === "pulada";
                  const atrasadaEtapa =
                    !finalizada && new Date(e.prazo) < new Date();
                  const Icon =
                    e.status === "concluida"
                      ? CheckCircle2
                      : e.status === "pulada"
                        ? SkipForward
                        : Circle;
                  const feitos = e.checklist_estado.filter(
                    (c) => c.concluido,
                  ).length;
                  return (
                    <li
                      key={e.id}
                      className="flex items-start gap-2 rounded px-1.5 py-1"
                    >
                      <Icon
                        className={cn(
                          "mt-0.5 h-3.5 w-3.5 shrink-0",
                          e.status === "concluida" && "text-sys-green",
                          e.status === "pulada" && "text-muted-foreground",
                          !finalizada && atrasadaEtapa && "text-sys-red",
                          !finalizada &&
                            !atrasadaEtapa &&
                            (e.status === "em_andamento"
                              ? "text-primary"
                              : "text-muted-foreground"),
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[11px] font-medium text-foreground",
                            finalizada && "line-through opacity-60",
                          )}
                        >
                          {e.ordem}. {e.titulo}
                        </p>
                        <p className="flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground">
                          <span>
                            Prazo{" "}
                            {new Date(e.prazo).toLocaleDateString("pt-BR")}
                          </span>
                          {e.checklist_estado.length > 0 && (
                            <span
                              className={cn(
                                feitos === e.checklist_estado.length
                                  ? "text-sys-green"
                                  : "text-muted-foreground",
                              )}
                            >
                              Checklist {feitos}/{e.checklist_estado.length}
                            </span>
                          )}
                          {atrasadaEtapa && (
                            <span className="font-semibold text-sys-red">
                              Atrasada
                            </span>
                          )}
                          {e.status === "em_andamento" && (
                            <span className="font-semibold text-primary">
                              Em andamento
                            </span>
                          )}
                          {e.observacao && (
                            <span className="italic">{e.observacao}</span>
                          )}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
