"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { customizarValorDeal } from "@/lib/actions/deals";
import { JUSTIFICATIVA_VALOR_MAX, ROTULO_ORIGEM_VALOR, VALOR_DEAL_MAXIMO } from "@/lib/valor-deal";
import { cn } from "@/lib/utils";
import { type OrigemValorDeal } from "@/types/deal";

/**
 * Modal de customização do valor do deal (pedido do CEO, 2026-09-11 —
 * substitui o editor inline do sheet lateral). Máscara BRL no campo,
 * serviços adicionais clicáveis que somam ao valor, delta visível e
 * justificativa obrigatória (Regra 3 — audit trail no deal).
 */

export const SERVICOS_AVULSOS = [
  { nome: "Preparação TOEFL", valor: 2500 },
  { nome: "Aula particular inglês (3 meses)", valor: 3600 },
  { nome: "Acompanhamento psicológico extra", valor: 1200 },
  { nome: "Tradução juramentada", valor: 800 },
] as const;

const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

/** Máscara BRL em reais inteiros: só dígitos entram; exibe com milhar pt-BR. */
const parseDigitos = (s: string): number => {
  const digitos = s.replace(/\D/g, "");
  return digitos ? Number(digitos) : 0;
};

const SELETOR_FOCAVEIS =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Tab/Shift+Tab circulam só dentro do painel (o board atrás do overlay não
 *  recebe foco — mesmo defeito já corrigido no diálogo de exclusão do card). */
function prenderFoco(e: KeyboardEvent, painel: HTMLElement | null) {
  if (!painel) return;
  const focaveis = Array.from(painel.querySelectorAll<HTMLElement>(SELETOR_FOCAVEIS));
  if (focaveis.length === 0) return;
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  const ativo = document.activeElement;
  const dentro = ativo instanceof Node && painel.contains(ativo);
  if (!dentro || (e.shiftKey && ativo === primeiro) || (!e.shiftKey && ativo === ultimo)) {
    e.preventDefault();
    (e.shiftKey ? ultimo : primeiro).focus();
  }
}

/**
 * Esc fecha SÓ este modal. Ele abre DENTRO do DealDetailModal (Visão
 * Executiva/Comercial), que também fecha no Esc com listener em bolha no
 * window: escutar em CAPTURA e parar a propagação impede que um Esc derrube o
 * detalhe inteiro (mesmo padrão do ConfirmProvider).
 */
function useTecladoDoModal(painelRef: RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key === "Tab") prenderFoco(e, painelRef.current);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [painelRef, onClose]);
}

interface CustomizarValorModalProps {
  dealId: string;
  athleteName: string;
  valorAtual: number;
  jaCustomizado?: boolean;
  /** Origem do valor atual (T3). Ausente = deduz de `jaCustomizado`. */
  origem?: OrigemValorDeal;
  /** Frase que explica de onde veio o valor atual (lib/valor-deal). */
  explicacaoOrigem?: string;
  onClose: () => void;
  /** Chamado após salvar (o pai dá router.refresh / reconcilia o board). */
  onSaved?: () => void;
  /** O servidor recusou porque o deal tem contrato — o pai leva à aba do contrato. */
  onTemContrato?: () => void;
}

export function CustomizarValorModal({
  dealId,
  athleteName,
  valorAtual,
  jaCustomizado,
  origem,
  explicacaoOrigem,
  onClose,
  onSaved,
  onTemContrato,
}: CustomizarValorModalProps) {
  const origemAtual: OrigemValorDeal = origem ?? (jaCustomizado ? "negociado" : "estimado");
  const router = useRouter();
  const [valor, setValor] = useState(valorAtual);
  const [justificativa, setJustificativa] = useState("");
  const [servicos, setServicos] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const painelRef = useRef<HTMLDivElement>(null);

  useTecladoDoModal(painelRef, onClose);

  // Trava o scroll do fundo (mesmo contrato dos outros modais do Engine)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Devolve o foco a quem abriu (valor no card / Visão Executiva) — a11y.
  // Capturado no 1º render: no commit o autoFocus já moveu o foco p/ o "X".
  const [gatilho] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  useEffect(() => () => gatilho?.focus(), [gatilho]);

  const delta = valor - valorAtual;
  // Estimativa pode ser CONFIRMADA sem mudar o número (vira "negociado").
  const confirmandoEstimativa = delta === 0 && origemAtual === "estimado";
  const semMudanca = delta === 0 && !confirmandoEstimativa;
  const faltaJustificativa = !justificativa.trim();
  const valorInvalido = valor <= 0;
  // Mesmo teto do servidor (zod): o erro aparece no campo, não só no toast.
  const valorAcimaDoLimite = valor > VALOR_DEAL_MAXIMO;

  const valorMascarado = useMemo(() => valor.toLocaleString("pt-BR"), [valor]);

  const toggleServico = (nome: string, valorServico: number) => {
    setServicos((prev) => {
      const next = new Set(prev);
      if (next.has(nome)) {
        next.delete(nome);
        setValor((v) => Math.max(0, v - valorServico));
      } else {
        next.add(nome);
        setValor((v) => v + valorServico);
      }
      return next;
    });
  };

  const salvar = () => {
    startTransition(async () => {
      const result = await customizarValorDeal(dealId, valor, justificativa);
      if (result.success) {
        toast.success("Valor negociado salvo", {
          description: `${athleteName}: ${fmtBRL(valorAtual)} → ${fmtBRL(valor)}`,
        });
        onSaved?.();
        router.refresh();
        onClose();
        return;
      }
      toast.error(result.error ?? "Erro ao customizar valor");
      if (result.code === "TEM_CONTRATO") onTemContrato?.();
    });
  };

  const modal = (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        {/* Altura limitada à viewport e corpo rolável: a frase de origem (com a
            justificativa) não pode empurrar Cancelar/Salvar para fora da tela. */}
        <div
          ref={painelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Customizar valor de ${athleteName}`}
          className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/12 text-primary">
                <BadgeDollarSign className="size-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Customizar valor</h2>
                <p className="text-xs text-muted-foreground">{athleteName}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar" autoFocus>
              <X />
            </Button>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
            {/* Valor atual → novo, com delta */}
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Valor atual</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {origemAtual === "estimado" ? "≈ " : ""}
                  {fmtBRL(valorAtual)}
                  <span
                    className={cn(
                      "ml-1.5 text-[9px] font-semibold uppercase",
                      origemAtual === "negociado" ? "text-sys-orange" : "text-muted-foreground",
                    )}
                  >
                    {ROTULO_ORIGEM_VALOR[origemAtual]}
                  </span>
                </p>
                {explicacaoOrigem && (
                  <p
                    className="mt-0.5 line-clamp-3 max-w-[16rem] break-words text-[10px] leading-snug text-muted-foreground"
                    title={explicacaoOrigem}
                  >
                    {explicacaoOrigem}
                  </p>
                )}
              </div>
              {delta !== 0 && (
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                    delta > 0 ? "bg-sys-green/12 text-sys-green" : "bg-bau-burgundy/12 text-bau-burgundy",
                  )}
                >
                  {delta > 0 ? "+" : "−"} {fmtBRL(Math.abs(delta)).replace("R$ ", "R$ ")}
                </span>
              )}
            </div>

            <div>
              <label htmlFor="novo-valor" className="text-[11px] font-medium text-muted-foreground">
                Novo valor
              </label>
              <div
                className={cn(
                  "mt-1 flex items-center rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring",
                  valorAcimaDoLimite ? "border-sys-red" : "border-border",
                )}
              >
                <span className="pl-3 text-sm font-medium text-muted-foreground">R$</span>
                <input
                  id="novo-valor"
                  type="text"
                  inputMode="numeric"
                  value={valorMascarado}
                  onChange={(e) => setValor(parseDigitos(e.target.value))}
                  aria-invalid={valorAcimaDoLimite || undefined}
                  aria-describedby={valorAcimaDoLimite ? "novo-valor-erro" : undefined}
                  className="w-full bg-transparent px-2 py-2.5 text-base font-semibold tabular-nums text-foreground outline-none"
                />
              </div>
              {valorAcimaDoLimite && (
                <p id="novo-valor-erro" role="alert" className="mt-1 text-[11px] text-sys-red">
                  Valor acima do limite ({fmtBRL(VALOR_DEAL_MAXIMO)}) — confira os dígitos.
                </p>
              )}
            </div>

            {/* Serviços adicionais: clicar soma/retira do valor */}
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">
                Serviços adicionais <span className="font-normal text-label-tertiary">— clique para incluir no valor</span>
              </p>
              <div className="mt-1.5 space-y-1.5">
                {SERVICOS_AVULSOS.map((s) => {
                  const ativo = servicos.has(s.nome);
                  return (
                    <button
                      key={s.nome}
                      type="button"
                      onClick={() => toggleServico(s.nome, s.valor)}
                      aria-pressed={ativo}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                        ativo
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background hover:border-primary/30 hover:bg-primary/[0.03]",
                      )}
                    >
                      <span className="flex items-center gap-2 text-xs text-foreground">
                        <span
                          className={cn(
                            "flex size-4 items-center justify-center rounded-full border",
                            ativo ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent",
                          )}
                        >
                          {ativo ? <Check className="size-2.5" /> : <Plus className="size-2.5" />}
                        </span>
                        {s.nome}
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-sys-green">{fmtBRL(s.valor)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="justificativa-valor" className="text-[11px] font-medium text-muted-foreground">
                Justificativa <span className="text-sys-red">*</span>
              </label>
              <textarea
                id="justificativa-valor"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                maxLength={JUSTIFICATIVA_VALOR_MAX}
                aria-describedby="justificativa-valor-ajuda"
                rows={2}
                placeholder="Ex.: desconto à vista, TOEFL incluído na negociação…"
                className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-label-tertiary outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p
                id="justificativa-valor-ajuda"
                className="mt-1 flex justify-between gap-2 text-[10px] text-label-tertiary"
              >
                <span>Fica registrada no histórico (audit) junto com o valor.</span>
                <span className="shrink-0 tabular-nums">
                  {justificativa.length}/{JUSTIFICATIVA_VALOR_MAX}
                </span>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-3.5">
            <Button variant="ghost" size="md" disabled={pending} onClick={onClose}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={pending || faltaJustificativa || valorInvalido || valorAcimaDoLimite || semMudanca}
              title={
                valorAcimaDoLimite
                  ? "Valor acima do limite"
                  : semMudanca
                    ? "Altere o valor para salvar"
                    : faltaJustificativa
                      ? "Preencha a justificativa"
                      : undefined
              }
              onClick={salvar}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              {confirmandoEstimativa ? "Confirmar valor" : "Salvar novo valor"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
