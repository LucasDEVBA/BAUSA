"use client";

import { useState } from "react";
import { ChevronDown, Hourglass, LinkIcon, MessageCircleQuestion, UserX } from "lucide-react";

import { Badge, Card } from "@/components/ui";
import type { ConversaEstadoItem, EstadosConversa } from "@/lib/conversas-queries";
import { cn } from "@/lib/utils";

/**
 * Estados acionáveis das conversas — a "caixa de trabalho" do CEO.
 *
 * Cada card é um balde clicável; abrir mostra QUEM está nele, mais antigo
 * primeiro. Os três primeiros são mutuamente exclusivos; o do link corta
 * transversal (a conversa pode estar em qualquer estado e ainda dever um
 * agendamento).
 */

const BALDES = [
  {
    id: "aguardandoVoce" as const,
    titulo: "Aguardando VOCÊ",
    descricao: "O lead falou por último e ninguém respondeu.",
    icone: MessageCircleQuestion,
    tom: "red" as const,
  },
  {
    id: "primeiroContatoSemResposta" as const,
    titulo: "1º contato sem resposta",
    descricao: "O lead puxou papo e nunca respondemos — nem uma vez.",
    icone: UserX,
    tom: "red" as const,
  },
  {
    id: "aguardandoLead" as const,
    titulo: "Aguardando o lead",
    descricao: "Você respondeu por último; o lead ainda não voltou.",
    icone: Hourglass,
    tom: "blue" as const,
  },
  {
    id: "linkRespondeuNaoAgendou" as const,
    titulo: "Link enviado · não agendou",
    descricao: "Recebeu o link de agendamento, respondeu depois dele, mas a reunião não apareceu.",
    icone: LinkIcon,
    tom: "orange" as const,
  },
];

const TOM = {
  red: { texto: "text-sys-red", fundo: "bg-sys-red/10" },
  orange: { texto: "text-sys-orange", fundo: "bg-sys-orange/10" },
  blue: { texto: "text-sys-blue", fundo: "bg-sys-blue/10" },
};

const CLASSIF_TONE: Record<string, "red" | "orange" | "blue"> = {
  QUENTE: "red",
  MORNO: "orange",
  FRIO: "blue",
};

function fmtPhone(p: string) {
  const d = p.replace(/\D/g, "");
  return d.length >= 10 ? `…${d.slice(-8)}` : p;
}

export function EstadosSection({ estados }: { estados: EstadosConversa }) {
  const [aberto, setAberto] = useState<keyof EstadosConversa | null>(null);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-foreground">Estados das conversas</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Quem está esperando o quê, agora — mais antigo primeiro.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {BALDES.map((b) => {
          const lista = estados[b.id];
          const ativo = aberto === b.id;
          const Icone = b.icone;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setAberto(ativo ? null : b.id)}
              aria-expanded={ativo}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                ativo ? "border-primary/40 bg-primary/5" : "border-border hover:bg-accent",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("flex size-7 items-center justify-center rounded-lg", TOM[b.tom].fundo, TOM[b.tom].texto)}>
                  <Icone aria-hidden className="size-3.5" />
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn("size-3.5 text-label-tertiary transition-transform", ativo && "rotate-180")}
                />
              </div>
              <p className={cn("mt-2 text-xl font-semibold tabular-nums", lista.length > 0 ? TOM[b.tom].texto : "text-foreground")}>
                {lista.length}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-foreground">{b.titulo}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-label-tertiary">{b.descricao}</p>
            </button>
          );
        })}
      </div>

      {aberto && <ListaBalde itens={estados[aberto]} />}
    </Card>
  );
}

function ListaBalde({ itens }: { itens: ConversaEstadoItem[] }) {
  if (itens.length === 0) {
    return (
      <p className="mt-3 rounded-lg border border-border bg-secondary/40 px-3 py-4 text-center text-xs text-label-tertiary">
        Ninguém neste estado agora.
      </p>
    );
  }
  return (
    <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
      {itens.map((i) => (
        <li key={i.phone} className="flex items-center gap-3 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {i.nome ?? fmtPhone(i.phone)}
            {i.nome === null && (
              <span className="ml-1.5 text-[10px] font-normal text-label-tertiary">
                (sem lead vinculado)
              </span>
            )}
          </span>
          {i.classificacao && (
            <Badge tone={CLASSIF_TONE[i.classificacao] ?? "blue"} size="sm">
              {i.classificacao}
            </Badge>
          )}
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
            {i.diasNoEstado === 0 ? "hoje" : `há ${i.diasNoEstado}d`}
          </span>
        </li>
      ))}
    </ul>
  );
}
