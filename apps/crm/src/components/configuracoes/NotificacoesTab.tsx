"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Bell, Loader2, Mail, MessageCircle, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card } from "@/components/ui";
import { salvarConfigNotificacoes } from "@/lib/actions/notificacoes-canais";
import {
  EVENTOS,
  type ConfigNotificacoes,
  type MatrizCanais,
  type Severidades,
} from "@/lib/notificacoes-eventos";
import { cn } from "@/lib/utils";

const CANAIS = [
  { id: "inapp" as const, label: "No sistema", icone: Bell, ajuda: "Sino do topo" },
  { id: "email" as const, label: "E-mail", icone: Mail, ajuda: "Destinatários de alerta" },
  { id: "whatsapp" as const, label: "WhatsApp", icone: MessageCircle, ajuda: "Número do CEO" },
];

const TOM_BADGE = {
  acao: { tone: "brand" as const, label: "Ação sua" },
  critico: { tone: "red" as const, label: "Crítico" },
  atencao: { tone: "orange" as const, label: "Atenção" },
  ok: { tone: "green" as const, label: "Informativo" },
};

export function NotificacoesTab({ inicial }: { inicial: ConfigNotificacoes }) {
  const [canais, setCanais] = useState<MatrizCanais>(inicial.canais);
  const [severidades, setSeveridades] = useState<Severidades>(inicial.severidades);
  const [base, setBase] = useState(inicial);
  const [salvando, startSalvar] = useTransition();

  const mudou = useMemo(
    () =>
      JSON.stringify(canais) !== JSON.stringify(base.canais) ||
      JSON.stringify(severidades) !== JSON.stringify(base.severidades),
    [canais, severidades, base],
  );

  const criticoSemCanal =
    canais.monitor_critico &&
    !canais.monitor_critico.inapp &&
    !canais.monitor_critico.email &&
    !canais.monitor_critico.whatsapp;

  const alternar = (eventoId: string, canal: "inapp" | "email" | "whatsapp") =>
    setCanais((a) => ({
      ...a,
      [eventoId]: { ...a[eventoId], [canal]: !a[eventoId]?.[canal] },
    }));

  const salvar = () => {
    startSalvar(async () => {
      try {
        const r = await salvarConfigNotificacoes({ canais, severidades });
        if (r.success) {
          toast.success("Notificações atualizadas");
          setBase({ ...base, canais, severidades });
        } else {
          toast.error(r.error);
        }
      } catch {
        toast.error("Falha de conexão ao salvar.");
      }
    });
  };

  return (
    <div className="space-y-5">
      <Card>
        <div className="mb-4 flex items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bell aria-hidden className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Onde cada aviso chega</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              Alerta que você para de ler não protege nada. Deixe no WhatsApp só o que exige
              ação no mesmo dia; o resto fica no sistema, para quando você quiser olhar.
            </p>
          </div>
        </div>

        {/* Cabeçalho da matriz — some no mobile, onde vira lista */}
        <div className="hidden border-b border-border pb-2 sm:grid sm:grid-cols-[1fr_repeat(3,5.5rem)] sm:gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-label-tertiary">
            Evento
          </span>
          {CANAIS.map((c) => (
            <span
              key={c.id}
              className="text-center text-[11px] font-semibold uppercase tracking-wide text-label-tertiary"
              title={c.ajuda}
            >
              {c.label}
            </span>
          ))}
        </div>

        <ul className="divide-y divide-border">
          {EVENTOS.map((e) => (
            <li
              key={e.id}
              className="py-3 sm:grid sm:grid-cols-[1fr_repeat(3,5.5rem)] sm:items-center sm:gap-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{e.titulo}</span>
                  <Badge tone={TOM_BADGE[e.tom].tone} size="sm">
                    {TOM_BADGE[e.tom].label}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-label-tertiary">
                  {e.descricao}
                </p>
              </div>

              <div className="mt-2 flex gap-2 sm:contents">
                {CANAIS.map((c) => {
                  const ligado = Boolean(canais[e.id]?.[c.id]);
                  const Icone = c.icone;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      role="switch"
                      aria-checked={ligado}
                      aria-label={`${e.titulo} — ${c.label}`}
                      onClick={() => alternar(e.id, c.id)}
                      className={cn(
                        "flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors sm:px-0",
                        ligado
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-secondary/50 text-label-tertiary hover:text-foreground",
                      )}
                    >
                      <Icone aria-hidden className="size-3.5" />
                      <span className="sm:hidden">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
          {criticoSemCanal && (
            <p className="mr-auto flex items-center gap-1.5 text-[11px] font-medium text-sys-red">
              <AlertTriangle aria-hidden className="size-3.5 shrink-0" />
              Sem nenhum canal em “Algo parou”, uma parada do funil não avisaria ninguém.
            </p>
          )}
          {mudou && !criticoSemCanal && (
            <p className="mr-auto text-[11px] text-label-tertiary">Alterações não salvas</p>
          )}
          <Button
            variant="ghost"
            size="sm"
            disabled={!mudou || salvando}
            onClick={() => {
              setCanais(base.canais);
              setSeveridades(base.severidades);
            }}
          >
            <RotateCcw />
            Reverter
          </Button>
          <Button size="sm" disabled={!mudou || salvando || Boolean(criticoSemCanal)} onClick={salvar}>
            {salvando ? <Loader2 className="animate-spin" /> : <Save />}
            Salvar
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-foreground">O que conta como crítico</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          Cada verificação do monitor entra em um dos dois grupos acima. Mover um item para
          “Atenção” faz ele parar de usar os canais do grupo crítico.
        </p>
        <ul className="mt-3 divide-y divide-border">
          {base.checksConhecidos.map((chave) => {
            const critico = severidades[chave] === "critico";
            return (
              <li key={chave} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                  {chave}
                </span>
                <div className="flex shrink-0 gap-1">
                  {(["critico", "atencao"] as const).map((nivel) => (
                    <button
                      key={nivel}
                      type="button"
                      onClick={() => setSeveridades((a) => ({ ...a, [chave]: nivel }))}
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                        (nivel === "critico") === critico
                          ? nivel === "critico"
                            ? "bg-sys-red/12 text-sys-red"
                            : "bg-sys-orange/12 text-sys-orange"
                          : "bg-secondary text-label-tertiary hover:text-foreground",
                      )}
                    >
                      {nivel === "critico" ? "Crítico" : "Atenção"}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
