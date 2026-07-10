"use client";

import { Sparkles, Video, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import type { OnboardingResumo } from "@/lib/actions/onboarding";
import { cn } from "@/lib/utils";
import {
  MinimalCard,
  MinimalHeader,
  MinimalStat,
} from "@/components/shared/MinimalUI";

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
}

export function FamiliasOnboardingClient({
  onboardings,
  proximasReunioes,
}: Props) {
  const totalAtivos = onboardings.length;
  const totalAtrasos = onboardings.reduce((s, o) => s + o.atrasadas, 0);
  const percentMedio =
    onboardings.length === 0
      ? 0
      : Math.round(
          onboardings.reduce((s, o) => s + o.percent, 0) / onboardings.length,
        );
  const concluidos = onboardings.filter((o) => o.percent === 100).length;

  return (
    <div className="flex flex-col gap-3">
      <MinimalHeader
        title="Onboarding de Famílias"
        description="Acompanhamento executivo dos onboardings em andamento e reuniões agendadas pela Head de Sucesso."
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MinimalStat
          label="Onboardings ativos"
          value={totalAtivos}
          tone="blue"
        />
        <MinimalStat
          label="Progresso médio"
          value={`${percentMedio}%`}
        />
        <MinimalStat
          label="Etapas atrasadas"
          value={totalAtrasos}
          tone={totalAtrasos > 0 ? "red" : "default"}
        />
        <MinimalStat
          label="Concluídos"
          value={concluidos}
          tone="green"
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
                {onboardings.map((o, i) => {
                  const atrasada = o.atrasadas > 0;
                  return (
                    <tr
                      key={o.instancia_id}
                      className={cn(
                        "border-b border-border/50 transition-colors last:border-0 hover:bg-secondary/30",
                        i % 2 === 1 && "bg-secondary/10",
                      )}
                    >
                      <td className="px-3 py-2">
                        <a
                          href={`/familias-crm?familia=${o.experiencia_id}`}
                          className="block"
                        >
                          <p className="truncate text-xs font-medium text-foreground">
                            {o.atleta_nome}
                          </p>
                          <p className="truncate text-[10px] text-muted-foreground">
                            {o.responsavel_nome}
                          </p>
                        </a>
                      </td>
                      <td className="px-3 py-2 text-xs text-foreground">
                        {o.head_nome ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1 w-20 overflow-hidden rounded-full bg-secondary">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                o.percent === 100
                                  ? "bg-sys-green"
                                  : atrasada
                                    ? "bg-sys-red"
                                    : "bg-primary",
                              )}
                              style={{ width: `${o.percent}%` }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {o.concluidas}/{o.total}
                          </span>
                          {atrasada && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-sys-red/12 px-1 py-px text-[9px] font-semibold text-sys-red">
                              <AlertTriangle className="h-2 w-2" />
                              {o.atrasadas}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {o.proxima_titulo ? (
                          <div>
                            <p className="max-w-[220px] truncate text-xs text-foreground">
                              {o.proxima_titulo}
                            </p>
                            {o.proxima_prazo && (
                              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(o.proxima_prazo).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[10px] tabular-nums text-muted-foreground">
                        {new Date(o.iniciado_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
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
              const atleta = r.experiencia?.atleta?.nome_completo ?? "Atleta";
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
    </div>
  );
}
