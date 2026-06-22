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
  Flame,
} from "lucide-react";
import {
  getAcompanhamentoByAtleta,
  type AcompanhamentoHeadData,
} from "@/lib/actions/acompanhamento";
import { cn } from "@/lib/utils";
import { MinimalCard, MinimalStat } from "@/components/shared/MinimalUI";

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

const STATUS_PILL: Record<string, string> = {
  satisfeita: "bg-sys-green/12 text-sys-green",
  atencao: "bg-sys-orange/12 text-sys-orange",
  crise: "bg-sys-red/12 text-sys-red",
};

const TEMP_PILL: Record<string, string> = {
  verde: "bg-sys-green/12 text-sys-green",
  amarelo: "bg-sys-orange/12 text-sys-orange",
  vermelho: "bg-sys-red/12 text-sys-red",
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
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || !data.has_experiencia) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <HeartPulse className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-xs font-medium text-foreground">
          Acompanhamento ainda não iniciado
        </p>
        <p className="max-w-md text-[11px] text-muted-foreground">
          A família entra em acompanhamento da Head de Sucesso ao chegar em
          Admission Process.
        </p>
      </div>
    );
  }

  const exp = data.experiencia!;
  const healthTone =
    exp.health_score >= 75
      ? "green"
      : exp.health_score >= 50
        ? "orange"
        : "red";

  return (
    <div className="flex flex-col gap-3">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MinimalStat
          label="Health Score"
          value={`${exp.health_score}/100`}
          tone={healthTone}
          hint={FASE_LABEL[exp.fase] ?? exp.fase}
        />
        <MinimalStat label="Satisfação" value={`${exp.satisfacao}/5`} />
        <MinimalStat label="Ansiedade" value={`${exp.ansiedade}/5`} />
        <MinimalStat
          label="Sem contato"
          value={
            exp.dias_sem_contato == null ? "—" : `${exp.dias_sem_contato}d`
          }
          tone={(exp.dias_sem_contato ?? 0) > 15 ? "orange" : "default"}
        />
      </div>

      {/* Status + temperatura inline */}
      <MinimalCard
        title="Estado da família"
        icon={HeartPulse}
        action={
          <div className="flex items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-px text-[9px] font-semibold",
                STATUS_PILL[exp.status],
              )}
            >
              {exp.status === "crise" && <Flame className="h-2.5 w-2.5" />}
              {exp.status === "atencao" && (
                <CircleAlert className="h-2.5 w-2.5" />
              )}
              {exp.status === "satisfeita" && (
                <Sparkles className="h-2.5 w-2.5" />
              )}
              {exp.status}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded px-1.5 py-px text-[9px] font-semibold",
                TEMP_PILL[exp.temperatura],
              )}
            >
              {exp.temperatura}
            </span>
          </div>
        }
      >
        <div className="space-y-2 text-xs">
          {exp.head_nome && (
            <p className="text-[11px] text-muted-foreground">
              Head responsável:{" "}
              <span className="text-foreground">{exp.head_nome}</span>
            </p>
          )}
          {exp.descricao_problema && (
            <div>
              <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/80">
                Problema
              </p>
              <p className="mt-0.5 text-xs text-foreground/90">
                {exp.descricao_problema}
              </p>
            </div>
          )}
          {exp.acao_em_andamento && (
            <div>
              <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground/80">
                Ação em andamento
              </p>
              <p className="mt-0.5 text-xs text-foreground/90">
                {exp.acao_em_andamento}
              </p>
            </div>
          )}
          {exp.status === "crise" && (
            <div
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-[10px]",
                exp.psicologa_acionada
                  ? "bg-sys-green/10 text-sys-green"
                  : "bg-sys-red/10 text-sys-red",
              )}
            >
              <Shield className="h-3 w-3" />
              {exp.psicologa_acionada
                ? "Psicóloga acionada"
                : "Psicóloga NÃO acionada"}
            </div>
          )}
        </div>
      </MinimalCard>

      {/* Onboarding */}
      {data.onboarding && data.onboarding.instancia && (
        <MinimalCard
          title="Onboarding"
          icon={Activity}
          action={
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {data.onboarding.progresso.concluidas ?? 0}/
              {data.onboarding.progresso.total ?? 0} ·{" "}
              {data.onboarding.progresso.percent ?? 0}%
            </span>
          }
        >
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-secondary">
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
          <ul className="space-y-1">
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
                  className="flex items-start gap-2 rounded px-1.5 py-1 hover:bg-secondary/30"
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-3 w-3 shrink-0",
                      ETAPA_COLOR[e.status],
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-xs leading-tight",
                        e.status === "concluida"
                          ? "text-muted-foreground line-through"
                          : "text-foreground",
                      )}
                    >
                      {e.ordem}. {e.titulo}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Prazo:{" "}
                      {new Date(e.prazo).toLocaleDateString("pt-BR")}
                      {atrasada && (
                        <span className="ml-1 text-sys-orange">atrasada</span>
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </MinimalCard>
      )}

      {/* Reuniões */}
      <MinimalCard
        title="Reuniões"
        icon={Video}
        action={
          data.proxima_reuniao && (
            <span className="inline-flex items-center gap-1 text-[10px] text-primary">
              <CalendarClock className="h-2.5 w-2.5" />
              {new Date(data.proxima_reuniao.data_hora).toLocaleString(
                "pt-BR",
                {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              )}
            </span>
          )
        }
      >
        {data.reunioes.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">
            Nenhuma reunião registrada.
          </p>
        ) : (
          <ul className="space-y-1">
            {data.reunioes.slice(0, 5).map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-2 rounded px-1.5 py-1 hover:bg-secondary/30"
              >
                <Video
                  className={cn(
                    "mt-0.5 h-3 w-3 shrink-0",
                    r.status === "realizada"
                      ? "text-sys-green"
                      : r.status === "cancelada"
                        ? "text-sys-red"
                        : "text-sys-blue",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-foreground">
                      {r.titulo}
                    </p>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {new Date(r.data_hora).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  {r.assuntos.length > 0 && (
                    <p className="truncate text-[10px] text-muted-foreground">
                      {r.assuntos.join(", ")}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </MinimalCard>

      {/* Contatos recentes */}
      <MinimalCard title="Últimos contatos" icon={MessageCircle}>
        {data.contatos_recentes.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">
            Nenhum contato registrado.
          </p>
        ) : (
          <ul className="space-y-1">
            {data.contatos_recentes.slice(0, 5).map((c) => (
              <li
                key={c.id}
                className="rounded px-1.5 py-1 hover:bg-secondary/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                    {c.tipo}
                  </p>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {new Date(c.quando).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-foreground/90">
                  {c.descricao}
                </p>
              </li>
            ))}
          </ul>
        )}
      </MinimalCard>

      {/* Alertas executivos */}
      {(exp.status === "crise" ||
        (exp.dias_sem_contato ?? 0) > 30 ||
        (data.onboarding?.progresso.atrasadas ?? 0) > 0) && (
        <MinimalCard
          title="Pontos de atenção CEO"
          icon={AlertTriangle}
          iconColor="text-sys-red"
        >
          <ul className="space-y-0.5">
            {exp.status === "crise" && (
              <li className="flex items-center gap-1.5 text-xs text-foreground/90">
                <span className="h-1 w-1 rounded-full bg-sys-red" />
                Família em crise — health {exp.health_score}
              </li>
            )}
            {(exp.dias_sem_contato ?? 0) > 30 && (
              <li className="flex items-center gap-1.5 text-xs text-foreground/90">
                <span className="h-1 w-1 rounded-full bg-sys-red" />
                {exp.dias_sem_contato}d sem contato
              </li>
            )}
            {(data.onboarding?.progresso.atrasadas ?? 0) > 0 && (
              <li className="flex items-center gap-1.5 text-xs text-foreground/90">
                <span className="h-1 w-1 rounded-full bg-sys-orange" />
                {data.onboarding!.progresso.atrasadas} etapa(s) atrasada(s)
              </li>
            )}
            {exp.status === "crise" && !exp.psicologa_acionada && (
              <li className="flex items-center gap-1.5 text-xs text-foreground/90">
                <span className="h-1 w-1 rounded-full bg-sys-red" />
                Psicóloga não acionada
              </li>
            )}
          </ul>
        </MinimalCard>
      )}
    </div>
  );
}
