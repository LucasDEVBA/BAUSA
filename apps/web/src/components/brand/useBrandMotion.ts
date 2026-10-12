"use client";

import { useEffect } from "react";

const REVEAL_SELECTOR = ".ba-rv, .ba-rv-scale";
const MAX_TILT_DEG = 4;

/**
 * Motor único de movimento da identidade Premium Glass:
 * - revela .ba-rv/.ba-rv-scale ao entrar na tela (inclusive seções lazy, via MutationObserver);
 * - inclina [data-tilt] e desloca camadas [data-depth] de um [data-tilt-stage] com o mouse.
 * Movimento reduzido ou ponteiro de toque = conteúdo estático e visível.
 */
export function useBrandMotion() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const seen = new WeakSet<Element>();
    // data-in (e não className): o React nunca reescreve um atributo que ele não controla
    const reveal = (el: Element) => el.setAttribute("data-in", "");
    let revealObserver: IntersectionObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    const scan = () =>
      document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        if (revealObserver) revealObserver.observe(el);
        else reveal(el);
      });

    // Só mexe no DOM depois do load: as seções lazy já hidrataram e não há aviso de hidratação
    const start = () => {
      if (!reduceMotion && "IntersectionObserver" in window) {
        revealObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              reveal(entry.target);
              revealObserver?.unobserve(entry.target);
            });
          },
          { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
        );
      }
      scan();
      mutationObserver = new MutationObserver(scan);
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    };
    let startTimer: number | undefined;
    const scheduleStart = () => {
      startTimer = window.setTimeout(start, 0);
    };
    if (document.readyState === "complete") scheduleStart();
    else window.addEventListener("load", scheduleStart, { once: true });

    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const tiltEnabled = finePointer && !reduceMotion;

    const handlePointerMove = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const tiltCard = target?.closest<HTMLElement>("[data-tilt]");
      if (tiltCard) {
        const rect = tiltCard.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        tiltCard.style.transform = `perspective(1100px) rotateY(${x * MAX_TILT_DEG}deg) rotateX(${-y * MAX_TILT_DEG}deg) translateY(-4px)`;
      }
      const stage = target?.closest<HTMLElement>("[data-tilt-stage]");
      if (stage) {
        const rect = stage.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        stage.querySelectorAll<HTMLElement>("[data-depth]").forEach((layer) => {
          const depth = Number(layer.dataset.depth);
          layer.style.transform = `translate3d(${x * depth}px, ${y * depth}px, 0)`;
        });
      }
    };
    const handlePointerOut = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      const related = event.relatedTarget as Node | null;
      const tiltCard = target?.closest<HTMLElement>("[data-tilt]");
      if (tiltCard && !tiltCard.contains(related)) tiltCard.style.transform = "";
      const stage = target?.closest<HTMLElement>("[data-tilt-stage]");
      if (stage && !stage.contains(related)) {
        stage.querySelectorAll<HTMLElement>("[data-depth]").forEach((layer) => (layer.style.transform = ""));
      }
    };
    if (tiltEnabled) {
      document.addEventListener("pointermove", handlePointerMove, { passive: true });
      document.addEventListener("pointerout", handlePointerOut, { passive: true });
    }

    return () => {
      window.clearTimeout(startTimer);
      window.removeEventListener("load", scheduleStart);
      revealObserver?.disconnect();
      mutationObserver?.disconnect();
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerout", handlePointerOut);
    };
  }, []);
}
