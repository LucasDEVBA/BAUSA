"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { compararRevisao, type PaginaRevisao, type ResultadoPaginaRevisao } from "@/lib/revisao-leads";

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
interface Recarga {
  offset: number;
  limite: number;
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
 * - router.refresh() manda uma página inicial NOVA: a lista volta a ser essa
 *   página (nada de fundir cards antigos — um card que saiu do recorte por
 *   fora, ex. "Enviar p/ fila" na faixa, outra aba, Agenda, ficaria na tela
 *   E deslocaria o offset, pulando 1 card no próximo "Mostrar mais") e o
 *   trecho que já estava aberto é RECARREGADO do servidor numa requisição só
 *   (o CEO não perde o "Mostrar mais"). Ajuste de estado durante o render
 *   (padrão React p/ "props mudaram") + effect só para a busca.
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
  const [recarga, setRecarga] = useState<Recarga | null>(null);

  if (inicial !== base) {
    const carregadosAntes = itens.length;
    setBase(inicial);
    setItens(inicial.itens.filter((i) => !removidos.has(i.id)));
    setTotal(inicial.total);
    setErro(inicial.erro);
    const faltam = Math.min(carregadosAntes, inicial.total) - inicial.itens.length;
    setRecarga(faltam > 0 && inicial.erro === null ? { offset: inicial.itens.length, limite: faltam } : null);
  }

  // A action, o tamanho atual e os removidos são lidos fora do render.
  const carregarRef = useRef(carregar);
  const offsetRef = useRef(itens.length);
  const removidosRef = useRef(removidos);
  useEffect(() => {
    carregarRef.current = carregar;
    offsetRef.current = itens.length;
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

  // Recarga pós-refresh (fora do corpo síncrono do effect: setTimeout 0).
  useEffect(() => {
    if (!recarga) return;
    let ativo = true;
    const t = setTimeout(async () => {
      setCarregandoMais(true);
      try {
        const r = await carregarRef.current(recarga.offset, recarga.limite);
        if (ativo) aplicar(r);
      } catch {
        if (ativo) {
          setErro(ERRO_REDE);
          toast.error(ERRO_REDE);
        }
      } finally {
        // Sempre (mesmo descartada): nunca deixar o "Mostrar mais" travado.
        setCarregandoMais(false);
      }
    }, 0);
    return () => {
      ativo = false;
      clearTimeout(t);
    };
  }, [recarga, aplicar]);

  const carregarMais = useCallback(() => {
    if (carregandoMais) return;
    setCarregandoMais(true);
    void (async () => {
      try {
        aplicar(await carregarRef.current(offsetRef.current));
      } catch {
        setErro(ERRO_REDE);
        toast.error(ERRO_REDE);
      } finally {
        setCarregandoMais(false);
      }
    })();
  }, [carregandoMais, aplicar]);

  const remover = useCallback((id: string) => {
    setRemovidos((atual) => new Set(atual).add(id));
    setItens((atuais) => atuais.filter((i) => i.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }, []);

  return { itens, total, temMais: itens.length < total, carregandoMais, erro, carregarMais, remover };
}
