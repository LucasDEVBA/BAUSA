"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { VideoKind } from "@/content/types";
import MethodVideoTile from "./MethodVideoTile";

export interface RailVideo {
  id: string;
  kind: VideoKind;
  title: string;
  duration: string;
  meta: string;
}

interface MethodVideoRailProps {
  eyebrow: string;
  titleBefore: string;
  titleAccent: string;
  lead: string;
  /** "Vídeos em português" fora do PT; vazio no PT. */
  languageNote: string;
  railLabel: string;
  prevLabel: string;
  nextLabel: string;
  videos: RailVideo[];
}

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

// Mesmo recuo do .ba-wrap (máx. 1320px + gutter), calculado para um trilho de largura total
const RAIL_INSET =
  "px-[max(var(--ba-gutter),calc((100%-1320px)/2+var(--ba-gutter)))] [scroll-padding-inline:max(var(--ba-gutter),calc((100%-1320px)/2+var(--ba-gutter)))]";

const arrowButton =
  "ba-glass-dark grid h-11 w-11 place-items-center rounded-full text-white transition-[opacity,transform,background-color] duration-300 hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 disabled:pointer-events-none disabled:opacity-35";

/**
 * Trilha "Assista" em palco escuro (sensação de sala de cinema entre seções claras):
 * cards 16:9 com scroll-snap sangrando até a borda no mobile, setas no desktop e uma
 * barra de progresso no lugar de 14 bolinhas. Nenhum iframe antes do toque.
 */
export default function MethodVideoRail({ eyebrow, titleBefore, titleAccent, lead, languageNote, railLabel, prevLabel, nextLabel, videos }: MethodVideoRailProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Um cálculo por quadro: o scroll dispara dezenas de eventos por segundo durante o swipe
  const measure = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const track = trackRef.current;
      if (!track) return;
      const max = track.scrollWidth - track.clientWidth;
      setProgress(max > 0 ? track.scrollLeft / max : 1);
      setAtStart(track.scrollLeft <= 4);
      setAtEnd(track.scrollLeft >= max - 4);
    });
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [measure]);

  // A barra de progresso re-renderiza a seção a cada quadro de rolagem; os cards não precisam
  const tiles = useMemo(
    () =>
      videos.map((video) => (
        <li key={video.id} className="w-[min(82vw,340px)] flex-none snap-start sm:w-[360px] lg:w-[392px]">
          <MethodVideoTile id={video.id} kind={video.kind} title={video.title} duration={video.duration} meta={video.meta} sizes="(max-width: 640px) 82vw, 392px" />
        </li>
      )),
    [videos],
  );

  const scrollByPage = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <section className="ba-dark relative isolate overflow-hidden py-[clamp(72px,9vw,128px)]" aria-labelledby="assista-title">
      <div aria-hidden="true" className="ba-glow left-[-180px] top-[-160px] h-[560px] w-[560px] animate-[ba-drift1_30s_ease-in-out_infinite_alternate] bg-[rgba(71,107,192,0.5)]" />
      <div aria-hidden="true" className="ba-glow bottom-[-200px] right-[-160px] h-[520px] w-[520px] animate-[ba-drift3_34s_ease-in-out_infinite_alternate] bg-[rgba(144,36,52,0.45)]" />
      <div aria-hidden="true" className="ba-lines" />

      <div className="ba-wrap relative z-[2]">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="max-w-[720px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="ba-eyebrow ba-glass-dark ba-rv !text-[#cfdcff]" style={delay(0)}>
                <span className="ba-dot" />
                {eyebrow}
              </span>
              {languageNote && (
                <span className="ba-rv whitespace-nowrap rounded-full bg-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-white/80 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]" style={delay(1)}>
                  {languageNote}
                </span>
              )}
            </div>
            <h2 id="assista-title" className="ba-rv mt-6 font-[family-name:var(--ba-display)] text-[clamp(34px,5vw,64px)] font-bold leading-[1.04] tracking-[-0.04em]" style={delay(1)}>
              {titleBefore} <span className="ba-serif ba-grad-text-dark text-[1.12em]">{titleAccent}</span>
            </h2>
            <p className="ba-rv mb-0 mt-5 max-w-[600px] text-[clamp(16px,1.35vw,18.5px)] leading-[1.62] text-[rgba(232,238,255,0.8)]" style={delay(2)}>
              {lead}
            </p>
          </div>
          <div className="ba-rv hidden gap-2.5 sm:flex" style={delay(3)}>
            <button type="button" className={arrowButton} onClick={() => scrollByPage(-1)} disabled={atStart} aria-label={prevLabel}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" className={arrowButton} onClick={() => scrollByPage(1)} disabled={atEnd} aria-label={nextLabel}>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </header>
      </div>

      {/* Trilho com scroll-snap sangrando até as bordas da TELA (também no desktop, além do
          ba-wrap); o recuo lateral alinha o 1º card com o texto. O padding vertical deixa a sombra respirar.
          A revelação é do trilho inteiro: card a card, os de fora só apareceriam no meio do swipe. */}
      <div
        ref={trackRef}
        style={delay(3)}
        onScroll={measure}
        role="region"
        aria-label={railLabel}
        tabIndex={0}
        className={`ba-rv scrollbar-hide relative z-[2] mt-[clamp(32px,4vw,52px)] flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-8 pt-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/60 sm:gap-5 ${RAIL_INSET}`}
      >
        <ul className="flex gap-3 sm:gap-5" role="list">
          {tiles}
        </ul>
      </div>

      <div className="ba-wrap relative z-[2]">
        <div className="mx-auto mt-1 h-[3px] w-[min(240px,60%)] overflow-hidden rounded-full bg-white/[0.12]" aria-hidden="true">
          <div
            className="h-full origin-left rounded-full bg-[linear-gradient(90deg,#b8caf7,#f0b1bb)] transition-transform duration-300 [transition-timing-function:var(--ba-ease)]"
            style={{ transform: `scaleX(${Math.max(0.12, progress)})` }}
          />
        </div>
      </div>
    </section>
  );
}
