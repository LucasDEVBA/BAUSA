"use client";

import { useRef } from "react";

import { canAnimate, gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

import { Eyebrow } from "./Eyebrow";

/**
 * O número como IMAGEM, não como conteúdo.
 *
 * Aqui o dado abandona o container de 1240px e sangra as duas bordas da
 * viewport — é cortado pela tela, não emoldurado por ela. A diferença é de
 * natureza: dentro do grid, "96%" é mais um item da página; sangrando, vira
 * a superfície sobre a qual a página acontece.
 *
 * É também a quebra deliberada de ritmo da narrativa: depois de seis seções
 * obedecendo ao mesmo grid, uma que o ignora por completo.
 *
 * O número desliza contra o scroll (parallax invertido), então nunca se lê
 * duas vezes no mesmo enquadramento.
 */
export function MonumentalStat({
  value,
  eyebrow,
  children,
  className,
}: {
  value: string;
  eyebrow?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!canAnimate()) return;

        // Contra-movimento: o número anda menos que a página, como um letreiro
        // muito atrás da janela.
        gsap.fromTo(
          ".stat-figure",
          { xPercent: -4 },
          {
            xPercent: 4,
            ease: "none",
            scrollTrigger: {
              trigger: root.current,
              start: "top bottom",
              end: "bottom top",
              scrub: 1.2,
            },
          },
        );

        gsap.from(".stat-body", {
          opacity: 0,
          y: 20,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 70%", once: true },
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className={cn("relative", className)}>
      {eyebrow ? (
        <div className="bau-container">
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
      ) : null}

      {/*
        O corte é o ponto. `w-screen` + margem negativa escapam do container;
        o `overflow-hidden` do <Section> faz o recorte. As laterais do número
        ficam FORA da tela de propósito — quem olha completa a forma.
      */}
      <div
        aria-hidden="true"
        className="stat-figure pointer-events-none relative left-1/2 mt-6 w-screen -translate-x-1/2 select-none text-center"
      >
        <span className="bau-display block whitespace-nowrap text-[38vw] leading-[0.78] tracking-[-0.03em] text-bau-ivory">
          {value}
        </span>
      </div>

      {/* O número é decorativo; o dado real fica aqui, legível e acessível. */}
      {children ? (
        <div className="bau-container">
          <p className="stat-body bau-prose -mt-[3vw] ml-auto text-[17px] text-bau-stone lg:w-1/2">
            <span className="sr-only">{value} </span>
            {children}
          </p>
        </div>
      ) : null}
    </div>
  );
}
