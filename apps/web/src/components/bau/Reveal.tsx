"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

// useLayoutEffect avisa no SSR; no cliente ele roda antes da pintura, que é o
// que impede o flash de "conteúdo visível → escondido → animando".
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type RevealState = "idle" | "hidden" | "shown";

/**
 * Primitiva única de entrada em cena: fade + rise de 16px, 500ms, ease-out,
 * uma vez só (BAU-02 §2.6 — "cerimônia, não espetáculo").
 *
 * É o ÚNICO lugar do design system que decide o que acontece sob
 * `prefers-reduced-motion`: lá o conteúdo nasce visível e nada se move.
 * Nenhum outro componente de `bau/` implementa scroll-trigger próprio.
 *
 * O HTML servido nasce VISÍVEL (`idle`) e só é escondido depois que o JS
 * assume — sem isso, uma falha de hidratação deixaria a página em branco.
 */
interface RevealProps {
  children: ReactNode;
  /** Atraso em ms. Use para escalonar irmãos (0, 80, 160…). */
  delay?: number;
  as?: ElementType;
  className?: string;
}

export function Reveal({ children, delay = 0, as: Tag = "div", className }: RevealProps) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<RevealState>("idle");

  useIsomorphicLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setState("shown");
      return;
    }
    setState("hidden");
  }, []);

  useEffect(() => {
    if (state !== "hidden") return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setState("shown");
        observer.disconnect();
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [state]);

  const hidden = state === "hidden";

  return (
    <Tag
      ref={ref}
      className={cn("motion-safe:transition-[opacity,transform] motion-safe:duration-500", className)}
      style={{
        opacity: hidden ? 0 : 1,
        transform: hidden ? "translateY(16px)" : "none",
        transitionDelay: `${delay}ms`,
        transitionTimingFunction: "var(--bau-ease)",
      }}
    >
      {children}
    </Tag>
  );
}
