"use client";

import { memo } from "react";
import Image, { type StaticImageData } from "next/image";

import athleteJulia from "@/assets/athlete-julia.png";
import athleteMatheus from "@/assets/athlete-matheus.png";
import athleteHelena from "@/assets/athlete-helena.png";
import { useLanguage } from "@/i18n";
import type { CtaSource } from "@/lib/tracking/events";
import BrandCta from "./brand/BrandCta";

const CAMPUS_IMAGE_URL = "/hero-campus.jpg";

interface FloatingPortrait {
  src: StaticImageData;
  position: string;
  depth: number;
  float: "ba-float-a" | "ba-float-b";
  d: number;
}

// Retratos reais orbitando o painel: só em telas largas, onde há margem para eles sem cobrir o texto
const PORTRAITS: FloatingPortrait[] = [
  { src: athleteJulia, position: "left-[2%] top-[14%] w-[150px] rotate-[-6deg]", depth: 18, float: "ba-float-a", d: 2 },
  { src: athleteMatheus, position: "right-[3%] top-[6%] w-[132px] rotate-[5deg]", depth: 26, float: "ba-float-b", d: 3 },
  { src: athleteHelena, position: "right-[1%] bottom-[2%] w-[118px] rotate-[-3deg]", depth: 12, float: "ba-float-a", d: 4 },
];

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

interface FinalCTAProps {
  /** Origem do clique (cta_source); cada página de conteúdo informa a sua. */
  source?: CtaSource;
}

const FinalCTA = memo(({ source = "final" }: FinalCTAProps) => {
  const { t } = useLanguage();

  return (
    <section
      className="ba-dark relative isolate overflow-hidden rounded-t-[clamp(28px,4vw,48px)] pb-[clamp(64px,8vw,112px)] pt-[clamp(80px,10vw,140px)]"
      aria-labelledby="final-cta-title"
    >
      {/* O campus do hero volta aqui, tingido de navy: a página termina onde a jornada começou */}
      <div aria-hidden="true" className="absolute inset-0 -z-[1]">
        <Image src={CAMPUS_IMAGE_URL} alt="" fill sizes="100vw" className="object-cover object-[50%_40%] opacity-[0.32]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,69,0.78)_0%,rgba(10,26,69,0.88)_55%,var(--ba-navy-2)_100%)]" />
      </div>
      <div aria-hidden="true" className="ba-glow left-[-160px] top-[-120px] h-[420px] w-[420px] sm:h-[560px] sm:w-[560px] animate-[ba-drift1_30s_ease-in-out_infinite_alternate] bg-[rgba(71,107,192,0.5)]" />
      <div aria-hidden="true" className="ba-glow bottom-[8%] right-[-200px] h-[340px] w-[340px] opacity-70 sm:right-[-140px] sm:h-[520px] sm:w-[520px] sm:opacity-100 animate-[ba-drift3_34s_ease-in-out_infinite_alternate] bg-[rgba(144,36,52,0.5)]" />
      <div aria-hidden="true" className="ba-lines" />
      {/* Funde o fim da seção no navy do rodapé: sem isso o halo bordô termina num corte reto */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[clamp(120px,16vw,240px)] bg-[linear-gradient(180deg,transparent,var(--ba-navy-2))]" />

      <div className="ba-wrap relative z-[2]" data-tilt-stage>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden xl:block">
          {PORTRAITS.map(({ src, position, depth, float, d }) => (
            <div key={src.src} className={`absolute ${position}`} data-depth={depth}>
              <div className={`ba-glass-dark ba-rv-scale ${float} aspect-[3/4] rounded-[22px] p-[6px]`} style={delay(d)}>
                <div className="relative h-full overflow-hidden rounded-[17px]">
                  <Image src={src} alt="" fill sizes="150px" className="object-cover object-[50%_25%]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="ba-glass-dark ba-rv-scale relative mx-auto max-w-[920px] overflow-hidden rounded-[28px] px-5 py-12 text-center sm:rounded-[36px] sm:px-[clamp(32px,6vw,88px)] sm:py-[clamp(56px,7vw,92px)]">
          {/* Luz especular no topo do painel: reforça a leitura de vidro sobre o escuro */}
          <div aria-hidden="true" className="absolute inset-x-[12%] top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.7),transparent)]" />
          <div aria-hidden="true" className="ba-glow left-1/2 top-[-140px] h-[280px] w-[520px] -translate-x-1/2 bg-[rgba(169,192,242,0.22)]" />

          <span
            className="ba-eyebrow ba-glass-dark ba-rv relative !text-[#cfdcff] max-sm:!px-3 max-sm:!text-[10.5px] max-sm:!tracking-[0.1em]"
            style={delay(1)}
          >
            <span className="ba-dot" />
            {t("landing.finalCTA.badge")}
          </span>

          <h2
            id="final-cta-title"
            className="ba-rv relative mx-auto mb-9 mt-6 max-w-[760px] text-balance font-[family-name:var(--ba-display)] text-[clamp(36px,6.2vw,80px)] font-bold leading-[1.02] tracking-[-0.045em] sm:mb-11 sm:mt-8"
            style={delay(2)}
          >
            {t("landing.finalCTA.title1")}{" "}
            <span className="ba-serif ba-grad-text-dark text-[1.12em] leading-[0.9]">{t("landing.finalCTA.title2")}</span>.
          </h2>

          <div className="ba-rv relative flex flex-col items-center gap-5" style={delay(3)}>
            <div className="relative">
              <div aria-hidden="true" className="ba-glow inset-[-18px] bg-[rgba(169,192,242,0.35)] blur-[34px]" />
              <BrandCta
                variant="light"
                source={source}
                className="relative min-h-[60px] px-8 text-[16px] sm:min-h-[64px] sm:px-10 sm:text-[17px]"
              >
                {t("landing.finalCTA.cta")}
              </BrandCta>
            </div>

            <p className="max-w-[440px] text-balance text-[13.5px] font-medium leading-[1.5] text-[rgba(232,238,255,0.8)]">
              <span className="ba-pulse mr-2.5 inline-block align-[1px]" aria-hidden="true" />
              {t("landing.finalCTA.note")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
});

FinalCTA.displayName = "FinalCTA";

export default FinalCTA;
