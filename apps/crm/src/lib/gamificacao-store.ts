"use client";

import { create } from "zustand";

import type { ResultadoGamificacao } from "@/lib/gamificacao";

/**
 * Fila de celebrações de gamificação (client-side).
 *
 * Os call sites das server actions chamam `celebrar(res.gamificacao, rótulo)`
 * após o sucesso; o componente global <Celebracoes/> (montado no layout do
 * dashboard) consome a fila e renderiza toast de +XP, overlay de level-up e
 * card de conquista. `celebrar` aceita null/undefined e vira no-op — o motor
 * é fail-open e o retorno pode não existir.
 */
export interface Celebracao {
  id: number;
  resultado: ResultadoGamificacao;
  /** Rótulo da ação para o toast de +XP (ex.: "Lead aprovado"). */
  rotulo: string;
}

interface GamificacaoState {
  fila: Celebracao[];
  celebrar: (resultado: ResultadoGamificacao | null | undefined, rotulo?: string) => void;
  concluir: (id: number) => void;
}

let proximoId = 0;

export const useGamificacaoStore = create<GamificacaoState>((set) => ({
  fila: [],
  celebrar: (resultado, rotulo) => {
    if (!resultado) return;
    proximoId += 1;
    const nova: Celebracao = {
      id: proximoId,
      resultado,
      rotulo: rotulo ?? "Ação registrada",
    };
    set((s) => ({ fila: [...s.fila, nova] }));
  },
  concluir: (id) => set((s) => ({ fila: s.fila.filter((c) => c.id !== id) })),
}));

/** Atalho imperativo para call sites (dentro de transitions/handlers). */
export function celebrar(
  resultado: ResultadoGamificacao | null | undefined,
  rotulo?: string,
): void {
  useGamificacaoStore.getState().celebrar(resultado, rotulo);
}
