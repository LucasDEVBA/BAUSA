import type { KeyboardEvent } from "react";

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tab / Shift+Tab ciclam DENTRO do diálogo. `aria-modal` só avisa o leitor de
 * tela; sem isto o foco do teclado escapa para a página por trás do sheet
 * (WCAG 2.4.3). Mesmo comportamento do ConfirmDialog do design system.
 */
export function prenderTabNoDialogo(e: KeyboardEvent<HTMLElement>): void {
  if (e.key !== "Tab") return;
  const dialogo = e.currentTarget;
  const focaveis = Array.from(dialogo.querySelectorAll<HTMLElement>(FOCAVEIS)).filter(
    (el) => el.getClientRects().length > 0,
  );
  if (focaveis.length === 0) return;
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  const ativo = document.activeElement;
  if (e.shiftKey && (ativo === primeiro || !dialogo.contains(ativo))) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && ativo === ultimo) {
    e.preventDefault();
    primeiro.focus();
  }
}

/**
 * Trava a rolagem do fundo. O scroller do dashboard é o <main>, não o <body>
 * (mesmo alvo do ConfirmProvider). Devolve a função que restaura.
 */
export function travarRolagemDoFundo(): () => void {
  const scroller = document.querySelector("main") ?? document.body;
  const anterior = scroller.style.overflow;
  scroller.style.overflow = "hidden";
  return () => {
    scroller.style.overflow = anterior;
  };
}
