"use client";

import { Compass, GraduationCap } from "lucide-react";

import { useLanguage } from "@/i18n";
import { METHOD_HERO } from "@/content/metodo";
import { pick } from "@/content/types";

const PILLARS = ["s", "a", "f", "e"] as const;

// Os quatro pilares no anel do meio (raio de 34%), em sentido horário a partir do topo: S, A, F, E
const TILE_POSITION: Record<(typeof PILLARS)[number], string> = {
  s: "left-1/2 top-[16%]",
  a: "left-[84%] top-1/2",
  f: "left-1/2 top-[84%]",
  e: "left-[16%] top-1/2",
};

const panelBackground =
  "[background:radial-gradient(120%_90%_at_100%_0%,rgba(71,107,192,0.78)_0%,rgba(71,107,192,0)_55%),radial-gradient(90%_80%_at_0%_110%,rgba(144,36,52,0.72)_0%,rgba(144,36,52,0)_60%),linear-gradient(160deg,#13296b,var(--ba-navy-2))]";

/**
 * Instrumento do método: os quatro pilares orbitando o atleta e a família, num painel
 * navy com anéis e uma varredura de luz. Cada letra é atalho para o pilar no bento logo
 * abaixo. Sem foto de propósito: os retratos do fundador já abrem a página Sobre.
 */
export default function MethodHeroVisual() {
  const { t, lang } = useLanguage();
  const pillarTitle = (key: (typeof PILLARS)[number]) => t(`landing.safeMethod.pillars.${key}.title`);

  return (
    <div className="relative mx-auto w-full max-w-[400px] pb-5 pt-5 sm:max-w-[500px] lg:max-w-[540px]" data-tilt-stage>
      <div aria-hidden="true" className="ba-glow left-[6%] top-[10%] h-[82%] w-[88%] bg-[rgba(71,107,192,0.38)]" />

      <div
        className={`relative aspect-square overflow-hidden rounded-[32px] text-white shadow-[var(--ba-shadow-lg),inset_0_1px_0_rgba(255,255,255,0.2)] sm:rounded-[40px] ${panelBackground}`}
        data-tilt
      >
        <div aria-hidden="true" className="ba-lines" />

        <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 400 400" fill="none">
          <defs>
            <linearGradient id="ba-method-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
              <stop offset="1" stopColor="#f0b1bb" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          <circle cx="200" cy="200" r="186" stroke="#fff" strokeOpacity="0.07" />
          <circle cx="200" cy="200" r="136" stroke="url(#ba-method-ring)" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="96" stroke="#fff" strokeOpacity="0.16" strokeDasharray="3 7" />
        </svg>

        {/* Varredura de luz no anel dos pilares: o "radar" que dá vida ao instrumento */}
        <span
          aria-hidden="true"
          className="absolute inset-[10%] animate-[spin_16s_linear_infinite] rounded-full [background:conic-gradient(from_0deg,transparent_0_70%,rgba(169,192,242,0.5)_86%,rgba(255,255,255,0.75)_90%,transparent_91%)] [mask-image:radial-gradient(circle_closest-side,transparent_80%,#000_84%,#000_86%,transparent_90%)]"
        />

        <div className="absolute left-1/2 top-1/2 grid aspect-square w-[40%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ba-glass-dark">
          <span aria-hidden="true" className="absolute inset-[-14%] rounded-full bg-[radial-gradient(circle,rgba(169,192,242,0.28),rgba(169,192,242,0)_70%)]" />
          <span className="relative text-center">
            <span className="block font-[family-name:var(--ba-display)] text-[clamp(22px,6.4vw,34px)] font-bold leading-none tracking-[-0.04em]">
              S.A.F.E.<sup className="ml-0.5 align-super text-[0.42em] font-semibold">®</sup>
            </span>
            <span className="ba-serif mt-1.5 block text-[clamp(15px,3.8vw,19px)] leading-none text-white/80">{pick(METHOD_HERO.visualCenter, lang)}</span>
          </span>
        </div>

        <nav aria-label={pick(METHOD_HERO.visualNav, lang)}>
          <ul role="list">
            {PILLARS.map((key, index) => (
              <li key={key} className={`absolute -translate-x-1/2 -translate-y-1/2 ${TILE_POSITION[key]}`}>
                <a
                  href={`#pilar-${key}`}
                  aria-label={`${key.toUpperCase()}: ${pillarTitle(key)}`}
                  className="group relative block rounded-[18px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  <span
                    className={`grid h-[50px] w-[50px] place-items-center rounded-[16px] font-[family-name:var(--ba-display)] text-[24px] font-extrabold tracking-[-0.04em] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_0_0_1px_rgba(255,255,255,0.22),0_14px_28px_-12px_rgba(0,0,0,0.6)] backdrop-blur-[14px] transition-transform duration-500 [transition-timing-function:var(--ba-ease)] group-hover:-translate-y-1 sm:h-[60px] sm:w-[60px] sm:rounded-[18px] sm:text-[28px] ${
                      key === "f" ? "bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))]" : "bg-white/[0.14]"
                    }`}
                  >
                    {key.toUpperCase()}
                  </span>
                  {/* A letra fica exatamente no anel; o nome pendura para dentro do círculo (em cima, no F) */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-white/85 sm:text-[12.5px] ${
                      key === "f" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
                    }`}
                  >
                    <span className="mr-1 text-white/50">0{index + 1}</span>
                    {pillarTitle(key)}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Etiquetas de vidro claro sobre a borda do painel: camadas e profundidade */}
      {/* No mobile só a etiqueta de baixo: a de cima disputaria espaço com o "S" */}
      <div className="absolute -left-4 top-8 hidden sm:block" data-depth="22" aria-hidden="true">
        <span className="ba-glass ba-float-a inline-flex items-center gap-2.5 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-4 text-[12.5px] font-semibold text-[var(--ba-navy)] sm:text-[13px]">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(150deg,#4a6dd0,var(--ba-blue))] text-white">
            <Compass className="h-4 w-4" />
          </span>
          {pick(METHOD_HERO.visualCaption, lang)}
        </span>
      </div>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 sm:-right-4 sm:bottom-10 sm:left-auto sm:translate-x-0" data-depth="14" aria-hidden="true">
        <span className="ba-glass ba-float-b inline-flex items-center gap-2.5 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-4 text-[12.5px] font-semibold text-[var(--ba-navy)] sm:text-[13px]">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))] text-white">
            <GraduationCap className="h-4 w-4" />
          </span>
          {pick(METHOD_HERO.visualBadge, lang)}
        </span>
      </div>
    </div>
  );
}
