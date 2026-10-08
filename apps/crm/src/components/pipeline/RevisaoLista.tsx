"use client";

import { useRef, type ReactNode, type RefObject } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, Loader2 } from "lucide-react";

import { VIRTUALIZAR_ACIMA } from "@/lib/revisao-leads";
import { cn } from "@/lib/utils";

/** Altura média de um card de revisão (medida real corrige via measureElement). */
const ALTURA_ESTIMADA_CARD = 104;
const GAP_CARDS = 6;
const OVERSCAN = 8;

interface RevisaoListaProps<T extends { id: string }> {
  itens: T[];
  renderItem: (item: T) => ReactNode;
  /** Rótulo acessível da lista (ex.: "Leads frios para revisão"). */
  rotulo: string;
  vazio: ReactNode;
  /** Paginação ("Mostrar mais") — omitida quando tudo já foi carregado. */
  maisRestantes: number;
  carregandoMais: boolean;
  onCarregarMais: () => void;
  /** Classes do botão "Mostrar mais" no tom da coluna. */
  tomBotao: string;
}

/**
 * Lista de uma coluna de revisão (Frios/Incompletos/Aguardando aprovação):
 * até VIRTUALIZAR_ACIMA cards renderiza direto; acima disso virtualiza
 * (@tanstack/react-virtual, altura dinâmica medida). O contêiner de rolagem
 * é SEMPRE o mesmo elemento — cruzar o limiar não perde a posição do scroll.
 */
export function RevisaoLista<T extends { id: string }>({
  itens,
  renderItem,
  rotulo,
  vazio,
  maisRestantes,
  carregandoMais,
  onCarregarMais,
  tomBotao,
}: RevisaoListaProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtual = itens.length > VIRTUALIZAR_ACIMA;

  return (
    <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto p-1.5">
      {itens.length === 0 ? (
        vazio
      ) : virtual ? (
        <ListaVirtual itens={itens} renderItem={renderItem} rotulo={rotulo} scrollRef={scrollRef} />
      ) : (
        <ul aria-label={rotulo} className="flex flex-col gap-1.5">
          {itens.map((item) => (
            <li key={item.id}>{renderItem(item)}</li>
          ))}
        </ul>
      )}
      {maisRestantes > 0 && (
        <button
          type="button"
          onClick={onCarregarMais}
          disabled={carregandoMais}
          className={cn(
            "mt-1.5 inline-flex w-full shrink-0 items-center justify-center gap-1 rounded-md border border-dashed px-2 py-1.5 text-[10px] font-semibold transition-colors disabled:opacity-60",
            tomBotao,
          )}
        >
          {carregandoMais ? (
            <Loader2 aria-hidden className="size-3 animate-spin" />
          ) : (
            <ChevronDown aria-hidden className="size-3" />
          )}
          {carregandoMais ? "Carregando…" : `Mostrar mais (${maisRestantes} restantes)`}
        </button>
      )}
    </div>
  );
}

function ListaVirtual<T extends { id: string }>({
  itens,
  renderItem,
  rotulo,
  scrollRef,
}: {
  itens: T[];
  renderItem: (item: T) => ReactNode;
  rotulo: string;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer devolve funções não memoizáveis (uso oficial da TanStack); o componente só renderiza a lista
  const virtualizer = useVirtualizer({
    count: itens.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ALTURA_ESTIMADA_CARD,
    gap: GAP_CARDS,
    overscan: OVERSCAN,
    getItemKey: (index) => itens[index]?.id ?? index,
  });

  return (
    <ul aria-label={rotulo} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((linha) => {
        const item = itens[linha.index];
        if (!item) return null;
        return (
          <li
            key={linha.key}
            data-index={linha.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${linha.start}px)` }}
          >
            {renderItem(item)}
          </li>
        );
      })}
    </ul>
  );
}
