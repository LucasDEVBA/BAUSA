"use client";

import { useRef } from "react";

import shield from "@/assets/brand/crest-shield.png";
import star1 from "@/assets/brand/crest-star-1.png";
import star2 from "@/assets/brand/crest-star-2.png";
import star3 from "@/assets/brand/crest-star-3.png";
import { canAnimate, gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

/**
 * O SELO — a marca sendo CUNHADA, não exibida.
 *
 * A ideia: um brasão não "aparece". Ele é gravado numa chapa e recebe luz
 * rasante quando a placa é inclinada. Toda a coreografia vem daí:
 *
 *  1. O escudo chega comprimido e por baixo, como metal recebendo a prensa —
 *     desce rápido, para seco (sem bounce; prensa não quica).
 *  2. Um impacto sutil sacode a base no instante do golpe.
 *  3. A luz rasante dourada varre a superfície UMA vez, revelando o relevo.
 *  4. As três estrelas são CONQUISTADAS uma a uma, não desenhadas juntas —
 *     é a única parte da marca que fala de mérito acumulado.
 *
 * O brasão foi fatiado em quatro PNGs (escudo + 3 estrelas) justamente para
 * permitir essa coreografia: com a imagem inteira só daria para fazer fade.
 *
 * Sob `prefers-reduced-motion` ou em aba oculta, entrega o selo já cunhado.
 */
export function AnimatedCrest({
  className,
  /** `scrub` prende a cunhagem ao scroll em vez de tocar na entrada. */
  trigger = "load",
}: {
  className?: string;
  trigger?: "load" | "scroll";
}) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        if (!canAnimate()) return;

        const tl = gsap.timeline(
          trigger === "scroll"
            ? { scrollTrigger: { trigger: root.current, start: "top 75%", once: true } }
            : {},
        );

        // 1. A prensa desce. `power4.in` acelera até o impacto — o oposto de
        //    um easing de UI, que desacelera ao chegar.
        tl.from(".crest-shield", {
          yPercent: -18,
          scaleY: 1.14,
          opacity: 0,
          duration: 0.55,
          ease: "power4.in",
          transformOrigin: "50% 100%",
        })
          // 2. O golpe: compressão e retorno, 120ms. É o que dá peso físico.
          .to(".crest-shield", { scaleY: 0.955, duration: 0.06, ease: "none" })
          .to(".crest-shield", { scaleY: 1, duration: 0.5, ease: "elastic.out(1, 0.45)" })
          // O quadro inteiro sente o impacto.
          .from(".crest-frame", { y: -3, duration: 0.4, ease: "elastic.out(1, 0.35)" }, "<")

          // 3. Luz rasante: atravessa uma vez e some. Não repete — brilho em
          //    loop é enfeite de banner, não acabamento de metal.
          .fromTo(
            ".crest-sheen",
            { xPercent: -170, opacity: 0 },
            { xPercent: 170, opacity: 1, duration: 1.15, ease: "power2.inOut" },
            "-=0.35",
          )
          .to(".crest-sheen", { opacity: 0, duration: 0.3 }, "-=0.3")

          // 4. As estrelas são conquistadas: cada uma cai no lugar com um
          //    overshoot mínimo, e só depois de o escudo existir.
          .from(
            ".crest-star",
            {
              opacity: 0,
              yPercent: 55,
              scale: 0.55,
              duration: 0.5,
              ease: "back.out(2.4)",
              stagger: 0.13,
            },
            "-=0.85",
          );
      });

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className={cn("crest-frame relative select-none", className)}>
      <div className="flex items-end justify-center gap-[6%] pb-[3%]">
        {[star1, star2, star3].map((star, i) => (
          <img
            key={i}
            src={star.src}
            alt=""
            aria-hidden="true"
            className="crest-star w-[13%] origin-bottom"
          />
        ))}
      </div>

      {/* `isolate` + overflow contêm a varredura de luz dentro do escudo. */}
      <div className="relative isolate overflow-hidden">
        <img
          src={shield.src}
          alt="Bolsa Atleta USA"
          className="crest-shield w-full origin-bottom"
        />

        {/* Luz rasante. `mix-blend-overlay` faz a luz interagir com o relevo em
            vez de pintar um retângulo por cima. */}
        <span
          aria-hidden="true"
          className="crest-sheen pointer-events-none absolute inset-y-0 left-0 z-10 w-[45%] -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(185,138,46,0.75),rgba(245,242,234,0.95),rgba(185,138,46,0.75),transparent)] opacity-0 mix-blend-overlay"
        />
      </div>
    </div>
  );
}
