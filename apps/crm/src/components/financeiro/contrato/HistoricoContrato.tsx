"use client";

import { History } from "lucide-react";

import type { ContratoEventoRow, TipoEventoContrato } from "@/types/contrato";

const TITULO: Record<TipoEventoContrato, string> = {
  contrato_criado: "Contrato criado",
  sinal_registrado: "Sinal registrado",
  plano_escolhido: "Plano escolhido",
  condicoes_editadas: "Contrato editado",
  parcela_editada: "Parcela editada",
  parcela_baixada: "Baixa registrada",
  parcela_estornada: "Baixa estornada",
  sinal_removido: "Sinal removido",
  contrato_quitado: "Contrato quitado",
  contrato_descartado: "Contrato descartado",
};

// Fuso FIXO: /contratos/[id] renderiza no servidor (UTC) e hidrata no
// navegador (BRT) — sem timeZone o horário diferia e o React refazia a árvore.
const DATA_HORA_BRT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** Linha do tempo legível (contrato_eventos): quem, quando, o quê e por quê. */
export function HistoricoContrato({ eventos }: { eventos: ContratoEventoRow[] }) {
  if (eventos.length === 0) return null;
  return (
    <section aria-labelledby="ctr-hist" className="rounded-xl border border-border/70 bg-card/60 p-3 sm:p-4">
      <h3 id="ctr-hist" className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <History aria-hidden className="size-4 text-muted-foreground" />Histórico
      </h3>
      <ol className="space-y-2">
        {eventos.map((e) => (
          <li key={e.id} className="border-l-2 border-border pl-3">
            <p className="text-xs font-medium text-foreground">{TITULO[e.tipo] ?? e.tipo}</p>
            <p className="text-[11px] text-muted-foreground">
              <time dateTime={e.created_at}>{DATA_HORA_BRT.format(new Date(e.created_at))}</time>
              {" · "}{e.autorNome ?? "sistema"}
            </p>
            {e.justificativa && <p className="mt-0.5 text-[11px] text-foreground/80">“{e.justificativa}”</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
