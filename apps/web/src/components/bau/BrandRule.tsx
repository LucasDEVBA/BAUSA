"use client";

import { useRef } from "react";

import { canAnimate, gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/**
 * Régua de marca — o detalhe exclusivo que carrega a paleta inteira.
 *
 * Um filete de 1px que percorre burgundy → gold → blue e se DESENHA da
 * esquerda para a direita quando entra em cena. É onde as três cores de
 * assinatura aparecem juntas sem violar a regra de proporção (70/20/7/3):
 * ocupa área desprezível, mas dá o acorde cromático completo.
 *
 * Usada para separar movimentos da narrativa dentro de uma página.
 */
export function BrandRule({
  className,
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!canAnimate()) return;

        gsap.from(ref.current, {
          scaleX: 0,
          duration: 1.4,
          delay,
          ease: "power3.inOut",
          scrollTrigger: { trigger: ref.current, start: "top 92%", once: true },
        });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn(
        "h-px w-full origin-left",
        "bg-[linear-gradient(90deg,var(--color-bau-red)_0%,var(--color-bau-gold)_38%,var(--color-bau-blue)_74%,transparent_100%)]",
        className,
      )}
    />
  );
}

/**
 * Moldura de canto em gold — cantos em L nas quatro pontas de um bloco.
 *
 * É o eco do frame REC aplicado a conteúdo que não é vídeo: dá o mesmo gesto
 * de "enquadramento documental" a tabelas e blocos de destaque, sem o ponto
 * vermelho (que continua exclusivo de gravação).
 */
export function CornerBrackets({ tone = "gold" }: { tone?: "gold" | "blue" }) {
  const color = tone === "gold" ? "border-bau-gold/50" : "border-bau-blue/60";

  return (
    <>
      <span aria-hidden="true" className={cn("absolute left-0 top-0 h-4 w-4 border-l border-t", color)} />
      <span aria-hidden="true" className={cn("absolute right-0 top-0 h-4 w-4 border-r border-t", color)} />
      <span aria-hidden="true" className={cn("absolute bottom-0 left-0 h-4 w-4 border-b border-l", color)} />
      <span aria-hidden="true" className={cn("absolute bottom-0 right-0 h-4 w-4 border-b border-r", color)} />
    </>
  );
}
