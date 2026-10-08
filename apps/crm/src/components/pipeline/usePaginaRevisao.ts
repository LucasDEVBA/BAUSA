"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  compararRevisao,
  planejarRecargaRevisao,
  type PaginaRevisao,
  type ResultadoPaginaRevisao,
} from "@/lib/revisao-leads";

interface ItemRevisao {
  id: string;
  meeting_scheduled: boolean | null;
  submitted_at: string;
}

export interface EstadoPaginaRevisao<T> {
  itens: T[];
  total: number;
  temMais: boolean;
  carregandoMais: boolean;
  erro: string | null;
  carregarMais: () => void;
  /** Tira o card na hora (resgate/reprovação) e desconta do total. */
  remover: (id: string) => void;
}

/** Recarga pós-refresh: o trecho que o CEO já tinha aberto no "Mostrar mais". */
interface Recarga<T> {
  offset: number;
  limite: number;
  /** Página nova do servidor: vira o começo da lista quando a recarga voltar. */
  pagina: T[];
}

const ERRO_REDE = "Falha de rede ao carregar mais leads. Tente de novo.";

function unir<T extends ItemRevisao>(base: T[], extra: T[], maisRecentePrimeiro: boolean): T[] {
  const vistos = new Set(base.map((i) => i.id));
  const juntos = [...base, ...extra.filter((i) => !vistos.has(i.id))];
  return juntos.sort((a, b) => compararRevisao(a, b, maisRecentePrimeiro));
}

/**
 * Paginação de uma coluna de revisão (T7): começa na página que o Server
 * Component mandou e carrega as próximas sob demanda ("Mostrar mais").
 *
 * - offset = itens carregados: a lista é SEMPRE um prefixo do recorte do
 *   servidor (removidos saem dos dois lados) — ninguém é pulado.
 * - router.refresh() manda uma página inicial NOVA. Sem nada aberto além
 *   dela, a lista volta a ser essa página. Com "Mostrar mais" aberto, a lista
 *   atual fica na tela (sem encolher, piscar nem perder a rolagem) até o
 *   trecho aberto voltar do servidor numa requisição só; aí a lista é
 *   TROCADA por página nova + trecho (nada de fundir cards antigos — um card
 *   que saiu do recorte por fora ficaria na tela e deslocaria o offset).
 * - O tamanho do trecho vem de `abertos`, não de itens.length: a ação de
 *   coluna gera 2–3 payloads seguidos e o 2º não pode cancelar a recarga.
 * Ajuste de estado durante o render (padrão React p/ "props mudaram") +
 * effect só para a busca.
 */
export function usePaginaRevisao<T extends ItemRevisao>(
  inicial: PaginaRevisao<T>,
  carregar: (offset: number, limite?: number) => Promise<ResultadoPaginaRevisao<T>>,
  maisRecentePrimeiro: boolean,
): EstadoPaginaRevisao<T> {
  const [base, setBase] = useState(inicial);
  const [itens, setItens] = useState<T[]>(inicial.itens);
  const [total, setTotal] = useState(inicial.total);
  const [erro, setErro] = useState<string | null>(inicial.erro);
  const [removidos, setRemovidos] = useState<ReadonlySet<string>>(new Set());
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [recarga, setRecarga] = useState<Recarga<T> | null>(null);
  const [abertos, setAbertos] = useState(inicial.itens.length);

  if (inicial !== base) {
    setBase(inicial);
    setTotal(inicial.total);
    setErro(inicial.erro);
    if (abertos < inicial.itens.length) setAbertos(inicial.itens.length);
    const plano = planejarRecargaRevisao(abertos, inicial.itens.length, inicial.total, inicial.erro !== null);
    if (plano) {
      setRecarga({ ...plano, pagina: inicial.itens });
      // Trava o "Mostrar mais" enquanto a lista na tela ainda é a anterior.
      setCarregandoMais(true);
    } else {
      setItens(inicial.itens.filter((i) => !removidos.has(i.id)));
      // Recarga em curso descartada sem substituta: ninguém mais destrava.
      if (recarga) setCarregandoMais(false);
      setRecarga(null);
    }
  }

  // A action, a lista atual e os removidos são lidos fora do render.
  const carregarRef = useRef(carregar);
  const itensRef = useRef(itens);
  const removidosRef = useRef(removidos);
  useEffect(() => {
    carregarRef.current = carregar;
    itensRef.current = itens;
    removidosRef.current = removidos;
  });

  const aplicar = useCallback(
    (r: ResultadoPaginaRevisao<T>) => {
      if (!r.success) {
        setErro(r.error);
        toast.error(r.error);
        return;
      }
      setErro(null);
      setTotal(r.total);
      // Resgatado agora e ainda devolvido (corrida de 1 clique) não volta.
      const novos = r.itens.filter((i) => !removidosRef.current.has(i.id));
      setItens((atuais) => unir(atuais, novos, maisRecentePrimeiro));
    },
    [maisRecentePrimeiro],
  );

  const aplicarRecarga = useCallback(
    (r: ResultadoPaginaRevisao<T> | null, pagina: T[]) => {
      const fora = removidosRef.current;
      const paginaAtual = pagina.filter((i) => !fora.has(i.id));
      if (!r?.success) {
        // Sem o trecho, a verdade do servidor é só a página nova.
        const mensagem = r ? r.error : ERRO_REDE;
        setItens(paginaAtual);
        setErro(mensagem);
        toast.error(mensagem);
        return;
      }
      setErro(null);
      setTotal(r.total);
      setItens(unir(paginaAtual, r.itens.filter((i) => !fora.has(i.id)), maisRecentePrimeiro));
    },
    [maisRecentePrimeiro],
  );

  // Recarga pós-refresh (fora do corpo síncrono do effect: setTimeout 0).
  // Descartada (outro payload chegou) não destrava: quem a substituiu destrava.
  useEffect(() => {
    if (!recarga) return;
    let ativo = true;
    const t = setTimeout(async () => {
      try {
        const r = await carregarRef.current(recarga.offset, recarga.limite);
        if (ativo) aplicarRecarga(r, recarga.pagina);
      } catch {
        if (ativo) aplicarRecarga(null, recarga.pagina);
      } finally {
        if (ativo) setCarregandoMais(false);
      }
    }, 0);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [recarga, aplicarRecarga]);

  const carregarMais = useCallback(() => {
    if (carregandoMais) return;
    setCarregandoMais(true);
    const offset = itensRef.current.length;
    void (async () => {
      try {
        const r = await carregarRef.current(offset);
        if (r.success) setAbertos((a) => Math.max(a, offset + r.itens.length));
        aplicar(r);
      } catch {
        setErro(ERRO_REDE);
        toast.error(ERRO_REDE);
      } finally {
        setCarregandoMais(false);
      }
    })();
  }, [carregandoMais, aplicar]);

  const remover = useCallback((id: string) => {
    // Só encolhe o trecho aberto se o card estava na tela (a faixa remove
    // cards de páginas não carregadas — o trecho aberto continua igual).
    if (itensRef.current.some((i) => i.id === id)) setAbertos((a) => Math.max(0, a - 1));
    setRemovidos((atual) => new Set(atual).add(id));
    setItens((atuais) => atuais.filter((i) => i.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

  return { itens, total, temMais: itens.length < total, carregandoMais, erro, carregarMais, remover };
}
