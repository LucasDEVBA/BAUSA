"use client";

import { useRef } from "react";

import type { Institution } from "@/data/institutions";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

import { Eyebrow } from "./Eyebrow";

/**
 * Faixa de logos institucionais (BAU-02 §2.5), movida por GSAP.
 *
 * O detalhe autoral: a faixa REAGE À VELOCIDADE DO SCROLL. Parada, corre lenta
 * e institucional (ciclo de ~60s). Quando a família rola a página, ela acelera
 * e inverte o sentido junto com o scroll, depois desacelera de volta ao ritmo
 * base. Dá a sensação de um arquivo vivo sendo percorrido — impossível com
 * marquee de CSS puro, que ignora o scroll.
 *
 * `gsap.matchMedia` cuida do `prefers-reduced-motion`: lá a faixa fica parada
 * e vira uma lista estática, e o GSAP reverte tudo sozinho.
 *
 * A cópia da lista existe só para fechar o loop e leva `aria-hidden` — sem
 * isso um leitor de tela anuncia cada instituição duas vezes.
 */
export function LogoWall({
  label,
  institutions,
  /** Sentido base da faixa. Alternar entre faixas cria o contraponto visual. */
  direction = 1,
}: {
  label: string;
  institutions: readonly Institution[];
  direction?: 1 | -1;
}) {
  const root = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLUListElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const el = track.current;
        if (!el) return;

        // Metade da largura = uma volta completa (a lista está duplicada).
        const loop = () => -(el.scrollWidth / 2);

        const tween = gsap.fromTo(
          el,
          { x: direction === 1 ? 0 : loop() },
          {
            x: direction === 1 ? loop() : 0,
            duration: 60,
            ease: "none",
            repeat: -1,
          },
        );

        // Scroll acelera e inverte; o timeScale volta a 1 por conta própria.
        const st = ScrollTrigger.create({
          trigger: root.current,
          start: "top bottom",
          end: "bottom top",
          onUpdate: (self) => {
            const boost = gsap.utils.clamp(-6, 6, self.getVelocity() / 260);
            gsap.to(tween, {
              timeScale: boost === 0 ? 1 : boost * direction,
              duration: 0.4,
              overwrite: true,
            });
            gsap.to(tween, { timeScale: 1, duration: 1.4, delay: 0.35, overwrite: false });
          },
        });

        return () => {
          st.kill();
          tween.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="group/wall">
      <Eyebrow className="bau-container mb-8">{label}</Eyebrow>

      <div className="relative overflow-hidden">
        {/* Esfumaçado nas bordas: os logos entram e saem em vez de serem cortados. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-bau-navy-deep to-transparent sm:w-32"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-bau-navy-deep to-transparent sm:w-32"
        />

        <ul ref={track} className="flex w-max items-center gap-14 pr-14">
          {institutions.map((institution) => (
            <LogoItem key={institution.name} institution={institution} />
          ))}
          {institutions.map((institution) => (
            <LogoItem key={`dup-${institution.name}`} institution={institution} duplicate />
          ))}
        </ul>
      </div>
    </div>
  );
}

function LogoItem({
  institution,
  duplicate = false,
}: {
  institution: Institution;
  duplicate?: boolean;
}) {
  return (
    <li aria-hidden={duplicate || undefined} className="group/logo relative shrink-0">
      {/*
        PLACA IVORY, e não o filtro monocromático do guia.

        O conjunto de logos é heterogêneo: wordmarks (Taft, DME, Hoosac) ficam
        excelentes invertidos, mas brasões e selos (Stanford, Yale, Princeton)
        dependem de contraste INTERNO — `brightness-0 invert` os transforma em
        silhuetas sólidas ilegíveis. Como este wall existe para provar
        credibilidade, legibilidade vence a uniformidade cromática.

        A placa resolve os dois: fundo claro uniforme, cada instituição
        reconhecível, e a fileira lê como uma parede de brasões — que é
        exatamente a imagem institucional que a seção quer evocar.
      */}
      <span
        className={cn(
          "flex h-20 w-40 items-center justify-center rounded-[var(--radius-bau)] px-5 lg:h-24 lg:w-48",
          "bg-bau-ivory/90 transition duration-300 group-hover/logo:bg-bau-ivory",
          // Filete gold no topo da placa, acendendo no hover.
          "border-t border-transparent group-hover/logo:border-bau-gold",
        )}
      >
        <img
          src={institution.logo.src}
          alt={duplicate ? "" : institution.name}
          loading="lazy"
          decoding="async"
          /*
            `brightness(.35)` é o que torna a placa universal. O conjunto tem
            logos de arte ESCURA (Yale, Taft) e de arte BRANCA (Stanford,
            Princeton): sem filtro, os brancos sumiriam no fundo claro. Reduzir
            o brilho força ambos para escuro sobre a placa, preservando os vazios
            transparentes — então o desenho interno dos brasões continua legível.
            No hover o filtro sai e a cor original aparece.
          */
          className="max-h-12 w-auto max-w-full object-contain transition duration-300 [filter:grayscale(1)_brightness(.35)_contrast(1.35)] group-hover/logo:[filter:none] lg:max-h-14"
        />
      </span>
    </li>
  );
}
