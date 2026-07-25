"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Registro único dos plugins GSAP.
 *
 * Importar este módulo em qualquer Client Component garante o registro; nunca
 * chamar `gsap.*` ou `ScrollTrigger.*` durante o SSR (este arquivo é "use
 * client" justamente por isso).
 */
gsap.registerPlugin(useGSAP, ScrollTrigger);

/** Ease da marca — a mesma curva do `--bau-ease` no CSS. */
export const BAU_EASE = "power3.out";

/**
 * Duração base. O guia pede "cerimônia, não espetáculo": movimentos longos o
 * bastante para serem percebidos como intenção, curtos o bastante para não
 * atrasar a leitura.
 */
export const BAU_DURATION = 0.9;

/**
 * Só anima quando há alguém olhando.
 *
 * O GSAP roda sobre `requestAnimationFrame`, que o navegador CONGELA em aba
 * oculta (diferente de transições CSS, que seguem correndo). Como as entradas
 * são `gsap.from()`, o estado inicial — invisível — é aplicado na hora e o
 * tween nunca avança: quem abre o site numa aba de fundo encontraria a página
 * em branco ao voltar.
 *
 * Nesse caso pulamos a entrada e servimos a composição já montada. Não há
 * perda: uma cerimônia de 1s executada para quem chega 30 segundos depois
 * pareceria atraso, não elegância.
 */
export function canAnimate(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "visible";
}

export { gsap, ScrollTrigger, useGSAP };
