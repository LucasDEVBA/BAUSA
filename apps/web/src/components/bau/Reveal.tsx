"use client";

import { useRef, type ElementType, type ReactNode } from "react";

import { BAU_EASE, canAnimate, gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/**
 * Primitiva única de entrada em cena — agora sobre GSAP + ScrollTrigger.
 *
 * É o ÚNICO lugar do design system que decide o que acontece sob
 * `prefers-reduced-motion`: via `gsap.matchMedia()`, que reverte sozinho tudo
 * que foi criado quando a query deixa de casar.
 *
 * O HTML servido nasce VISÍVEL — o `gsap.from()` só esconde depois que o JS
 * assume. Sem isso, uma falha de hidratação deixaria a página em branco, e o
 * conteúdo não seria indexável.
 */
interface RevealProps {
  children: ReactNode;
  /** Atraso em segundos. Use para escalonar irmãos (0, 0.08, 0.16…). */
  delay?: number;
  as?: ElementType;
  className?: string;
  /** Direção da entrada. `up` é o padrão do guia (rise de 16px). */
  from?: "up" | "left" | "right";
}

const OFFSET = { up: { y: 16 }, left: { x: -24 }, right: { x: 24 } } as const;

export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className,
  from = "up",
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!canAnimate()) return;

        gsap.from(ref.current, {
          opacity: 0,
          ...OFFSET[from],
          duration: 0.7,
          delay,
          ease: BAU_EASE,
          scrollTrigger: {
            trigger: ref.current,
            start: "top 88%",
            once: true,
          },
        });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

/**
 * Revelação tipográfica com máscara — o gesto de assinatura do site.
 *
 * Cada linha sobe de trás de uma borda invisível, como tipo saindo de um
 * cilindro de impressão. É reservado a H1 e às frases monumentais: usado em
 * texto corrido viraria espetáculo, que é justamente o que o guia proíbe.
 */
export function MaskedLines({
  lines,
  className,
  lineClassName,
  as: Tag = "h1",
  delay = 0,
}: {
  lines: string[];
  className?: string;
  lineClassName?: string;
  as?: ElementType;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!canAnimate()) return;

        gsap.from(gsap.utils.toArray<HTMLElement>(".bau-line-inner"), {
          yPercent: 115,
          duration: 1.1,
          delay,
          ease: "power4.out",
          stagger: 0.12,
          scrollTrigger: { trigger: ref.current, start: "top 90%", once: true },
        });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={className}>
      {lines.map((line, i) => (
        // overflow-hidden é a máscara; o filho é quem se move.
        <span key={`${line}-${i}`} className={cn("block overflow-hidden", lineClassName)}>
          <span className="bau-line-inner block">{line}</span>
        </span>
      ))}
    </Tag>
  );
}
