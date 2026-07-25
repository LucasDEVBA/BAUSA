"use client";

import { useRef } from "react";

import { AnimatedCrest, ArrowLink, CtaPrimary } from "@/components/bau";
import { BAU_EASE, canAnimate, gsap, useGSAP } from "@/lib/gsap";

/**
 * Hero da home — o único do site com fotografia, e a única sequência
 * orquestrada (BAU-02 §2.6): eyebrow → H1 linha a linha → sub → CTA.
 *
 * Três gestos autorais aqui:
 *  1. As linhas do H1 sobem de trás de uma máscara, como tipo saindo de um
 *     cilindro de impressão.
 *  2. A foto do campus faz um zoom-out lentíssimo (7s) na entrada e ganha
 *     parallax no scroll — a arquitetura "assenta" enquanto o texto chega.
 *  3. Um filete gold cresce sob o eyebrow, ancorando a composição.
 *
 * Tudo dentro de `gsap.matchMedia`: em `prefers-reduced-motion` nada se move e
 * o GSAP reverte sozinho.
 */
export function HomeHero({
  eyebrow,
  titleLines,
  sub,
  ctaLabel,
  secondaryCta,
  secondaryHref,
  imageAlt,
}: {
  eyebrow: string;
  /** H1 quebrado em linhas para a revelação mascarada. */
  titleLines: string[];
  sub: string;
  ctaLabel: string;
  secondaryCta: string;
  secondaryHref: string;
  imageAlt: string;
}) {
  const root = useRef<HTMLElement>(null);
  const image = useRef<HTMLImageElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!canAnimate()) return;

        const tl = gsap.timeline({ defaults: { ease: BAU_EASE } });

        tl.from(image.current, { scale: 1.12, duration: 7, ease: "power2.out" }, 0)
          .from(".bau-hero-eyebrow", { opacity: 0, y: 12, duration: 0.8 }, 0.1)
          .from(".bau-hero-dash", { scaleX: 0, duration: 0.9, ease: "power3.inOut" }, 0.15)
          .from(
            ".bau-hero-line",
            { yPercent: 115, duration: 1.2, ease: "power4.out", stagger: 0.12 },
            0.25,
          )
          .from(".bau-hero-sub", { opacity: 0, y: 16, duration: 0.9 }, 0.7)
          .from(".bau-hero-cta", { opacity: 0, y: 16, duration: 0.9 }, 0.9);

        // Parallax: a imagem sobe menos que a página, dando profundidade.
        gsap.to(image.current, {
          yPercent: 14,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden pt-[var(--bau-header-h)]"
    >
      {/* Preload do LCP. Fica AQUI, não no layout raiz: lá ele baixava ~333 KB
          com prioridade alta em toda rota, inclusive /forms e /acesso. */}
      <link rel="preload" as="image" href="/hero-campus.jpg" fetchPriority="high" />

      <img
        ref={image}
        src="/hero-campus.jpg"
        alt={imageAlt}
        fetchPriority="high"
        decoding="async"
        width={1920}
        height={1080}
        className="absolute inset-0 h-[115%] w-full object-cover"
      />

      {/* Véu navy a 70% (BAU-02 Parte 3) — garante AA do ivory sobre a foto sem
          apagar a arquitetura do campus, que é o que comunica autoridade. */}
      <div aria-hidden="true" className="absolute inset-0 bg-bau-navy-deep/70" />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-bau-navy-deep via-bau-navy-deep/25 to-transparent"
      />
      {/* Sopro burgundy no canto — a marca tingindo a luz, não um "glow" de app. */}
      <div
        aria-hidden="true"
        className="absolute -right-1/4 top-0 h-[60vh] w-[60vw] rounded-full bg-bau-red/10 blur-[140px]"
      />

      <div className="bau-container relative z-10 py-24">
        {/* O selo é cunhado ANTES do título — a marca se apresenta, depois fala. */}
        <AnimatedCrest className="mb-10 w-[92px] lg:w-[112px]" />

        <div className="max-w-4xl">
          <p className="bau-mono bau-hero-eyebrow flex items-center gap-3 text-[12px] leading-none text-bau-stone">
            <span aria-hidden="true" className="bau-hero-dash h-px w-6 origin-left bg-bau-gold" />
            {eyebrow}
          </p>

          <h1 className="bau-display mt-8 text-[2.75rem] sm:text-[4rem] lg:text-[5.5rem]">
            {titleLines.map((line, i) => (
              <span key={`${line}-${i}`} className="block overflow-hidden pb-[0.06em]">
                <span className="bau-hero-line block">{line}</span>
              </span>
            ))}
          </h1>

          <p className="bau-prose bau-hero-sub mt-8 text-[17px] text-bau-stone sm:text-[19px]">
            {sub}
          </p>

          <div className="bau-hero-cta mt-12 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
            <CtaPrimary source="hero" label={ctaLabel} />
            <ArrowLink href={secondaryHref}>{secondaryCta}</ArrowLink>
          </div>
        </div>
      </div>
    </section>
  );
}
