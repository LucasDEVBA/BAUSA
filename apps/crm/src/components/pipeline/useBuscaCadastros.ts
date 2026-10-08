"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { buscarCadastrosPipeline, type CadastroEncontrado } from "@/lib/actions/leads-busca";
import { BUSCA_DEBOUNCE_MS, BUSCA_PIPELINE_MIN, normalizarTermoBusca } from "@/lib/revisao-leads";

export type EstadoBuscaCadastros =
  | { status: "inativa" }
  | { status: "carregando"; termo: string }
  | { status: "ok"; termo: string; itens: CadastroEncontrado[]; total: number }
  | { status: "erro"; termo: string; erro: string };

/**
 * Busca de apoio no SERVIDOR (T13): ≥3 caracteres úteis, debounce de 300 ms.
 * Server actions não aceitam AbortSignal — a resposta velha é DESCARTADA por
 * número de requisição (efeito equivalente ao AbortController: só a última
 * busca pinta a tela). Desabilitada para quem não é CEO/CTO.
 */
export function useBuscaCadastros(termo: string, habilitada: boolean) {
  const [estado, setEstado] = useState<EstadoBuscaCadastros>({ status: "inativa" });
  const [rodada, setRodada] = useState(0);
  const requisicao = useRef(0);
  const termoUtil = normalizarTermoBusca(termo);
  const ativa = habilitada && termoUtil.replace(/[^a-z0-9]/g, "").length >= BUSCA_PIPELINE_MIN;

  useEffect(() => {
    const minha = ++requisicao.current;
    if (!ativa) {
      // Limpa no próximo tick (sem setState síncrono no corpo do effect).
      const t = setTimeout(() => {
        if (minha === requisicao.current) setEstado({ status: "inativa" });
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(async () => {
      setEstado({ status: "carregando", termo: termoUtil });
      try {
        const r = await buscarCadastrosPipeline(termoUtil);
        if (minha !== requisicao.current) return;
        setEstado(
          r.success
            ? { status: "ok", termo: termoUtil, itens: r.itens, total: r.total }
            : { status: "erro", termo: termoUtil, erro: r.error },
        );
      } catch {
        if (minha !== requisicao.current) return;
        setEstado({ status: "erro", termo: termoUtil, erro: "Falha de rede ao buscar cadastros." });
      }
    }, BUSCA_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [ativa, termoUtil, rodada]);

  /** Refaz a busca (após enviar p/ fila, aprovar etc.). */
  const recarregar = useCallback(() => setRodada((n) => n + 1), []);

  return { estado, recarregar };
}
