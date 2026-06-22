"use client";

import { useEffect, useState } from "react";
import {
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Activity,
  MessageCircle,
  Video,
  Loader2,
  Shield,
  CircleAlert,
  CheckCheck,
  XCircle,
  CalendarClock,
} from "lucide-react";
import {
  getAcompanhamentoByAtleta,
  type AcompanhamentoHeadData,
} from "@/lib/actions/acompanhamento";
import { cn } from "@/lib/utils";

interface Props {
  atletaId?: string;
}

const FASE_LABEL: Record<string, string> = {
  admissao: "Admissão",
  pre_embarque: "Pré-embarque",
  pos_embarque: "Pós-embarque",
  primeiro_semestre: "1º semestre",
  acompanhamento: "Acompanhamento",
  encerrada: "Encerrada",
};

const STATUS_BADGE: Record<string, string> = {
  satisfeita: "bg-sys-green/15 text-sys-green border-sys-green/30",
  atencao: "bg-sys-orange/15 text-sys-orange border-sys-orange/30",
  crise: "bg-sys-red/15 text-sys-red border-sys-red/30",
};

const TEMP_BADGE: Record<string, string> = {
  verde: "bg-sys-green/15 text-sys-green border-sys-green/30",
  amarelo: "bg-sys-orange/15 text-sys-orange border-sys-orange/30",
  vermelho: "bg-sys-red/15 text-sys-red border-sys-red/30",
};

const ETAPA_ICON: Record<string, typeof CheckCircle2> = {
  pendente: Clock,
  em_andamento: Activity,
  concluida: CheckCheck,
  pulada: XCircle,
};

const ETAPA_COLOR: Record<string, string> = {
  pendente: "text-muted-foreground",
  em_andamento: "text-sys-blue",
  concluida: "text-sys-green",
  pulada: "text-muted-foreground line-through",
};

function MetricMini({
  label,
  value,
  className,
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", className)}>
        {value}
      </p>
    </div>
  );
}

export function AcompanhamentoHeadPanel({ atletaId }: Props) {
  const [data, setData] = useState<AcompanhamentoHeadData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!atletaId) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getAcompanhamentoByAtleta(atletaId)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [atletaId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !data.has_experiencia) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <HeartPulse className="h-10 w-10 text-muted-foreground/40" />
        <h3 className="text-sm font-medium text-foreground">
          Acompanhamento ainda não iniciado
        </h3>
        <p className="max-w-md text-xs text-muted-foreground">
          A família entra em acompanhamento da Head de Sucesso assim que o deal
          chega à etapa <strong>Admission Process</strong>. Por enquanto, esta
          jornada ainda está sendo gerida pelo time comercial.
        </p>
      </div>
    );
  }

  const exp = data.experiencia!;
  const healthColor =
    exp.health_score >= 75
      ? "text-sys-green"
      : exp.health_score >= 50
        ? "text-sys-orange"
        : "text-sys-red";

  return (
    <div className="space-y-3">
      {/* Cabeçalho de saúde */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full bg-secondary",
                healthColor,
              )}
            >
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Saúde do acompanhamento
              </p>
              <p className={cn("text-xl font-semibold tabular-nums", healthColor)}>
                {exp.health_score}
                <span className="text-sm text-muted-foreground">/100</span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {FASE_LABEL[exp.fase] ?? exp.fase}
                {exp.head_nome ? ` · Head ${exp.head_nome}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                STATUS_BADGE[exp.status],
              )}
            >
              {exp.status === "crise" && <Flame />}
              {exp.status === "atencao" && <CircleAlert className="h-3 w-3" />}
              {exp.status === "satisfeita" && (
                <Sparkles className="h-3 w-3" />
              )}
              {exp.status}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                TEMP_BADGE[exp.temperatura],
              )}
            >
              temperatura {exp.temperatura}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <MetricMini
            label="Ansiedade"
            value={`${exp.ansiedade}/5`}
            className="text-foreground"
          />
          <MetricMini
            label="Satisfação"
            value={`${exp.satisfacao}/5`}
            className="text-foreground"
          />
          <MetricMini
            label="Risco percebido"
            value={`${exp.risco_percebido}/5`}
            className="text-foreground"
          />
          <MetricMini
            label="Sem contato"
            value={
              exp.dias_sem_contato == null
                ? "—"
                : `${exp.dias_sem_contato}d`
            }
            className={
              (exp.dias_sem_contato ?? 0) > 15
                ? "text-sys-orange"
                : "text-foreground"
            }
          />
        </div>

        {(exp.descricao_problema || exp.acao_em_andamento) && (
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            {exp.descricao_problema && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Problema relatado
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {exp.descricao_problema}
                </p>
              </div>
            )}
            {exp.acao_em_andamento && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Ação em andamento
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {exp.acao_em_andamento}
                </p>
              </div>
            )}
          </div>
        )}

        {exp.status === "crise" && (
          <div
            className={cn(
              "mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
              exp.psicologa_acionada
                ? "border-sys-green/30 bg-sys-green/10 text-sys-green"
                : "border-sys-red/30 bg-sys-red/10 text-sys-red",
            )}
          >
            <Shield className="h-3.5 w-3.5" />
            {exp.psicologa_acionada
              ? "Psicóloga já acionada"
              : "Psicóloga ainda NÃO acionada — atenção CEO"}
          </div>
        )}
      </div>

      {/* Onboarding em curso */}
      {data.onboarding && data.onboarding.instancia && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Onboarding em curso
              </h3>
              <p className="text-xs text-muted-foreground">
                {data.onboarding.progresso.concluidas ?? 0}/
                {data.onboarding.progresso.total ?? 0} etapas concluídas
                {(data.onboarding.progresso.atrasadas ?? 0) > 0 && (
                  <span className="ml-1 text-sys-orange">
                    · {data.onboarding.progresso.atrasadas} atrasada(s)
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <span className="text-base font-semibold tabular-nums text-foreground">
                {data.onboarding.progresso.percent ?? 0}%
              </span>
            </div>
          </div>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full",
                (data.onboarding.progresso.atrasadas ?? 0) > 0
                  ? "bg-sys-orange"
                  : "bg-primary",
              )}
              style={{ width: `${data.onboarding.progresso.percent ?? 0}%` }}
            />
          </div>
          <ul className="space-y-2">
            {data.onboarding.etapas.map((e) => {
              const Icon = ETAPA_ICON[e.status] ?? Clock;
              const atrasada =
                e.status !== "concluida" &&
                e.status !== "pulada" &&
                // eslint-disable-next-line react-hooks/purity
                new Date(e.prazo).getTime() < Date.now();
              return (
                <li
                  key={e.id}
                  className="flex items-start gap-2.5 rounded-md border border-border/40 bg-background/40 px-2.5 py-2"
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      ETAPA_COLOR[e.status] ?? "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        e.status === "concluida"
                          ? "text-muted-foreground line-through"
                          : "text-foreground",
                      )}
                    >
                      {e.ordem}. {e.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Prazo:{" "}
                      {new Date(e.prazo).toLocaleDateString("pt-BR")}
                      {atrasada && (
                        <span className="ml-2 font-medium text-sys-orange">
                          atrasada
                        </span>
                      )}
                      {e.observacao && (
                        <span className="ml-2 italic">· {e.observacao}</span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Próxima reunião + reuniões recentes */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Reuniões</h3>
          {data.proxima_reuniao && (
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              <CalendarClock className="h-3 w-3" />
              {new Date(data.proxima_reuniao.data_hora).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        {data.reunioes.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nenhuma reunião registrada.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.reunioes.slice(0, 5).map((r) => {
              // eslint-disable-next-line react-hooks/purity
              const isFuture = new Date(r.data_hora).getTime() > Date.now();
              return (
                <li
                  key={r.id}
                  className="flex items-start gap-3 rounded-md border border-border/40 bg-background/40 px-3 py-2"
                >
                  <Video
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      r.status === "realizada"
                        ? "text-sys-green"
                        : r.status === "cancelada"
                          ? "text-sys-red"
                          : "text-sys-blue",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {r.titulo}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.data_hora).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    {r.assuntos.length > 0 && (
                      <p className="truncate text-xs text-muted-foreground">
                        Assuntos: {r.assuntos.join(", ")}
                      </p>
                    )}
                    {r.notas_realizacao && (
                      <p className="mt-1 line-clamp-2 text-xs text-foreground/80">
                        {r.notas_realizacao}
                      </p>
                    )}
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {r.status}
                      {isFuture && r.status === "agendada" && " · futura"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Contatos recentes */}
      <div className="rounded-xl border border-border bg-card p-3">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          Últimos contatos da família
        </h3>
        {data.contatos_recentes.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Nenhum contato registrado.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.contatos_recentes.slice(0, 5).map((c) => (
              <li
                key={c.id}
                className="flex items-start gap-3 rounded-md border border-border/40 bg-background/40 px-3 py-2"
              >
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-sys-blue" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-foreground">
                      {c.tipo}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.quando).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-3 text-sm text-foreground/90">
                    {c.descricao}
                  </p>
                  {c.autor_nome && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      por {c.autor_nome}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Alertas */}
      {(exp.status === "crise" ||
        (exp.dias_sem_contato ?? 0) > 30 ||
        (data.onboarding?.progresso.atrasadas ?? 0) > 0) && (
        <div className="rounded-xl border border-sys-red/30 bg-sys-red/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-sys-red" />
            <h3 className="text-sm font-semibold text-foreground">
              Pontos de atenção CEO
            </h3>
          </div>
          <ul className="space-y-1 text-xs text-foreground/90">
            {exp.status === "crise" && (
              <li>· Família em crise — health score {exp.health_score}</li>
            )}
            {(exp.dias_sem_contato ?? 0) > 30 && (
              <li>
                · {exp.dias_sem_contato}d sem contato — risco de relacionamento
              </li>
            )}
            {(data.onboarding?.progresso.atrasadas ?? 0) > 0 && (
              <li>
                · {data.onboarding!.progresso.atrasadas} etapa(s) de onboarding
                atrasada(s)
              </li>
            )}
            {exp.status === "crise" && !exp.psicologa_acionada && (
              <li>· Psicóloga não acionada apesar do status crise</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Ícone Flame inline (não existe importado pra status crise)
function Flame() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}
