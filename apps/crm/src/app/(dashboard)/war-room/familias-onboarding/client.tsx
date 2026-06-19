"use client";

import { Sparkles, Video, AlertTriangle, Clock, ExternalLink } from "lucide-react";
import type { OnboardingResumo } from "@/lib/actions/onboarding";
import { cn } from "@/lib/utils";

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

export function FamiliasOnboardingClient({ onboardings, proximasReunioes }: Props) {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-title-2 text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Onboarding de Famílias
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acompanhamento executivo dos onboardings em andamento e reuniões
          agendadas pela Head de Sucesso.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Onboardings ativos
          </p>
          <p className="mt-1 text-2xl font-bold text-primary">{totalAtivos}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Progresso médio
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {percentMedio}
            <span className="text-xs text-muted-foreground">%</span>
          </p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-sys-red">
            Etapas atrasadas
          </p>
          <p className="mt-1 text-2xl font-bold text-sys-red">{totalAtrasos}</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-sys-green">
            Concluídos
          </p>
          <p className="mt-1 text-2xl font-bold text-sys-green">{concluidos}</p>
        </div>
      </div>

      {/* Onboardings em andamento */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Onboardings em andamento
        </h2>
        {onboardings.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum onboarding ativo no momento.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-xs">
              <thead className="bg-secondary border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Família
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Head
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Progresso
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Próxima etapa
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                    Iniciado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {onboardings.map((o) => {
                  const atrasada = o.atrasadas > 0;
                  return (
                    <tr
                      key={o.instancia_id}
                      className="hover:bg-accent transition-colors"
                    >
                      <td className="px-4 py-3">
                        <a
                          href={`/familias-crm?familia=${o.experiencia_id}`}
                          className="block"
                        >
                          <p className="font-semibold text-foreground">
                            {o.atleta_nome}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {o.responsavel_nome}
                          </p>
                        </a>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {o.head_nome ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-fill-4 overflow-hidden">
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
                          <span className="text-[10px] font-semibold text-foreground">
                            {o.concluidas}/{o.total}
                          </span>
                          {atrasada && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sys-red/15 text-sys-red">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              {o.atrasadas}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {o.proxima_titulo ? (
                          <div>
                            <p className="text-foreground truncate max-w-[200px]">
                              {o.proxima_titulo}
                            </p>
                            {o.proxima_prazo && (
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(o.proxima_prazo).toLocaleDateString(
                                  "pt-BR",
                                )}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(o.iniciado_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Reuniões agendadas */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
          <Video className="h-4 w-4 text-sys-blue" />
          Reuniões agendadas
        </h2>
        {proximasReunioes.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma reunião agendada.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {proximasReunioes.map((r) => {
              const data = new Date(r.data_hora);
              const atleta = r.experiencia?.atleta?.nome_completo ?? "Atleta";
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-sys-blue/10 text-sys-blue shrink-0">
                    <span className="text-[9px] font-semibold uppercase">
                      {data.toLocaleDateString("pt-BR", { month: "short" })}
                    </span>
                    <span className="text-sm font-bold leading-none">
                      {data.getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {r.titulo}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {atleta} ·{" "}
                      {data.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {r.assuntos.length > 0 && (
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        Pauta: {r.assuntos.slice(0, 3).join(" · ")}
                        {r.assuntos.length > 3 ? "..." : ""}
                      </p>
                    )}
                  </div>
                  {r.link_reuniao && (
                    <a
                      href={r.link_reuniao}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[11px] font-semibold text-sys-blue hover:underline shrink-0"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Abrir
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
