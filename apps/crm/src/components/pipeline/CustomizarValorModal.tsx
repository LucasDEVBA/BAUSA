"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { BadgeDollarSign, Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { customizarValorDeal } from "@/lib/actions/deals";
import { cn } from "@/lib/utils";

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

interface CustomizarValorModalProps {
  dealId: string;
  athleteName: string;
  valorAtual: number;
  jaCustomizado?: boolean;
  onClose: () => void;
  /** Chamado após salvar (o pai dá router.refresh / reconcilia o board). */
  onSaved?: () => void;
}

export function CustomizarValorModal({
  dealId,
  athleteName,
  valorAtual,
  jaCustomizado,
  onClose,
  onSaved,
}: CustomizarValorModalProps) {
  const router = useRouter();
  const [valor, setValor] = useState(valorAtual);
  const [justificativa, setJustificativa] = useState("");
  const [servicos, setServicos] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  // Esc fecha + trava o scroll (mesmo contrato dos outros modais do Engine)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const delta = valor - valorAtual;
  const semMudanca = delta === 0;
  const faltaJustificativa = !justificativa.trim();
  const valorInvalido = valor <= 0;

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
        toast.success("Valor customizado", {
          description: `${athleteName}: ${fmtBRL(valorAtual)} → ${fmtBRL(valor)}`,
        });
        onSaved?.();
        router.refresh();
        onClose();
      } else {
        toast.error(result.error ?? "Erro ao customizar valor");
      }
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Customizar valor de ${athleteName}`}
          className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
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
          <div className="space-y-4 px-5 py-4">
            {/* Valor atual → novo, com delta */}
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">Valor atual</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {fmtBRL(valorAtual)}
                  {jaCustomizado && (
                    <span className="ml-1.5 text-[9px] font-semibold uppercase text-sys-orange">customizado</span>
                  )}
                </p>
              </div>
              {!semMudanca && (
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
              <div className="mt-1 flex items-center rounded-lg border border-border bg-background focus-within:ring-2 focus-within:ring-ring">
                <span className="pl-3 text-sm font-medium text-muted-foreground">R$</span>
                <input
                  id="novo-valor"
                  type="text"
                  inputMode="numeric"
                  value={valorMascarado}
                  onChange={(e) => setValor(parseDigitos(e.target.value))}
                  className="w-full bg-transparent px-2 py-2.5 text-base font-semibold tabular-nums text-foreground outline-none"
                />
              </div>
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
                rows={2}
                placeholder="Ex.: desconto à vista, TOEFL incluído na negociação…"
                className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-label-tertiary outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="mt-1 text-[10px] text-label-tertiary">
                Fica registrada no histórico (audit) junto com o valor.
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
              disabled={pending || faltaJustificativa || valorInvalido || semMudanca}
              title={
                semMudanca
                  ? "Altere o valor para salvar"
                  : faltaJustificativa
                    ? "Preencha a justificativa"
                    : undefined
              }
              onClick={salvar}
            >
              {pending ? <Loader2 className="animate-spin" /> : <Check />}
              Salvar novo valor
            </Button>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
