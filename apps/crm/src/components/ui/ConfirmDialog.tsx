"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "./Button";

/**
 * ConfirmDialog — confirmação no padrão do design system v2 (substitui o
 * `window.confirm` nativo). API imperativa via `useConfirm()`:
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Excluir?", tone: "danger" }))) return;
 *
 * O `<ConfirmProvider>` é montado UMA vez no layout do dashboard e renderiza o
 * diálogo acima de tudo (z-[100], acima de modais como o MensagemDiretaComposer
 * em z-[70]). O Esc é interceptado por um listener de CAPTURA persistente do
 * provider — registrado no mount do layout, portanto ANTES de qualquer modal
 * filho — que dá `stopImmediatePropagation` quando aberto, impedindo o modal
 * por baixo de fechar junto.
 */

export type ConfirmTone = "default" | "danger";

export interface ConfirmOptions {
  /** Pergunta curta (obrigatória) — vira o título e o rótulo acessível. */
  title: string;
  /** Detalhe/consequência da ação (opcional). */
  description?: string;
  /** Rótulo do botão de ação. Default: "Confirmar". */
  confirmLabel?: string;
  /** Rótulo do botão de cancelar. Default: "Cancelar". */
  cancelLabel?: string;
  /** `danger` = ação destrutiva (botão vermelho + foco inicial em Cancelar). */
  tone?: ConfirmTone;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Hook imperativo — retorna `Promise<boolean>` (true = confirmado). */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm precisa estar dentro de <ConfirmProvider>.");
  }
  return ctx;
}

interface PendingState {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingState | null>(null);
  // Espelho para o listener de Esc ler o estado atual sem virar dependência.
  const pendingRef = useRef<PendingState | null>(null);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const settle = useCallback((value: boolean) => {
    setPending((prev) => {
      prev?.resolve(value);
      return null;
    });
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending((prev) => {
        // Não empilha: um confirm novo resolve o anterior como cancelado.
        prev?.resolve(false);
        return { options, resolve };
      });
    });
  }, []);

  // Esc-first: captura no window, registrada no mount do provider (layout),
  // portanto antes de qualquer modal filho. `stopImmediatePropagation` garante
  // que só o confirm reaja ao Esc — o modal por baixo não fecha junto.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!pendingRef.current || e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      settle(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [settle]);

  // Trava a rolagem do fundo enquanto aberto. O scroller do dashboard é o
  // <main> (não o <body>), então miramos ele — espelha o BuilderScreen no
  // elemento certo. No-op se não houver <main> (ex.: fora do layout).
  useEffect(() => {
    if (!pending) return;
    const scroller = document.querySelector("main");
    if (!scroller) return;
    const anterior = scroller.style.overflow;
    scroller.style.overflow = "hidden";
    return () => {
      scroller.style.overflow = anterior;
    };
  }, [pending]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending ? (
        <ConfirmDialogView
          options={pending.options}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

interface ConfirmDialogViewProps {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialogView({ options, onConfirm, onCancel }: ConfirmDialogViewProps) {
  const {
    title,
    description,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    tone = "default",
  } = options;

  const titleId = useId();
  const descId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const isDanger = tone === "danger";

  // Foca a ação primária (default) ou a mais segura (danger → Cancelar) ao
  // abrir; devolve o foco ao elemento anterior ao fechar (a11y).
  useEffect(() => {
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initial = isDanger ? cancelRef.current : confirmRef.current;
    initial?.focus();
    return () => {
      const el = restoreFocusRef.current;
      if (el && el.isConnected) el.focus();
    };
  }, [isDanger]);

  // Focus trap: Tab cicla entre os dois botões; foco perdido volta pro diálogo.
  const handleTrap = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const first = cancelRef.current;
    const last = confirmRef.current;
    if (!first || !last) return;
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    } else if (active !== first && active !== last) {
      e.preventDefault();
      first.focus();
    }
  };

  const Icon = isDanger ? AlertTriangle : HelpCircle;

  return (
    <>
      {/* Backdrop visual (dim). z acima do MensagemDiretaComposer (z-[70]). */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px] animate-overlay-in"
        aria-hidden
      />
      {/* O container z-[110] cobre o viewport e é quem recebe o clique — o
          dismiss-por-clique-fora vive AQUI (o backdrop irmão por baixo nunca
          recebe o evento). O card interno faz stopPropagation. */}
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descId : undefined}
          onKeyDown={handleTrap}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-dialog-in"
        >
          <div className="flex gap-3 px-5 pb-4 pt-5">
            <span
              aria-hidden
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                isDanger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 space-y-1 pt-0.5">
              <h2 id={titleId} className="text-sm font-semibold text-foreground">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="text-xs leading-relaxed text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-5 py-3">
            <Button ref={cancelRef} type="button" variant="ghost" size="sm" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              ref={confirmRef}
              type="button"
              variant={isDanger ? "destructive" : "primary"}
              size="sm"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
