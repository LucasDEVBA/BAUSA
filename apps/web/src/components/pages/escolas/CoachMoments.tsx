"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

import { useVideoPlayer } from "@/components/brand/VideoPlayer";
import { ESCOLAS_TEXT, fill, formatTimestamp, getMomentPoster, getTourPoster } from "@/content/escolas";
import { getSchool } from "@/content/schools";
import { pick } from "@/content/types";
import { getVideo, type VideoMoment } from "@/content/videos";
import { useLanguage } from "@/i18n";

import SchoolMark from "./SchoolMark";

/** Fecha a frase com ponto só quando ela ainda não termina em pontuação (o nome acessível não fica com "."."). */
function sentence(text: string): string {
  return /[.!?]["”]?$/.test(text) ? text : `${text}.`;
}

const arrowButton =
  "grid h-11 w-11 place-items-center rounded-full border border-white/[0.16] bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] transition-[background-color,opacity,transform] duration-300 hover:-translate-y-0.5 hover:bg-white/[0.16] focus-visible:outline-[2.5px] focus-visible:outline-offset-2 focus-visible:outline-[#b8caf7] disabled:pointer-events-none disabled:opacity-30";

function MomentCard({ moment }: { moment: VideoMoment }) {
  const { lang } = useLanguage();
  const { open } = useVideoPlayer();
  const video = getVideo(moment.videoId);
  const school = moment.school ? getSchool(moment.school) : undefined;
  if (!video || !school) return null;

  const label = pick(moment.label, lang);
  const time = formatTimestamp(moment.start);
  const role = moment.role ? pick(moment.role, lang) : undefined;
  const who = moment.speaker ? `${moment.speaker}${role ? `, ${role}` : ""}` : pick(ESCOLAS_TEXT.momentsFromTour, lang);
  // Capítulo que já é citação ("Você veio estudar…") vira pull quote, com aspas tipográficas; os demais são o assunto do trecho
  const isQuote = label.startsWith('"');
  const displayLabel = isQuote ? `“${label.replace(/^"|"$/g, "")}”` : label;
  const poster = getMomentPoster(moment.videoId, moment.start) ?? getTourPoster(school.slug);

  return (
    <button
      type="button"
      onClick={() => open({ id: video.id, kind: video.kind, title: `${pick(video.title, lang)} (${time})`, start: moment.start })}
      aria-label={fill(pick(ESCOLAS_TEXT.momentAria, lang), { label: sentence(label), who: sentence(who), school: school.name, time })}
      // Sem backdrop-filter: dentro do trilho rolável o desfoque recompõe a cada quadro
      className="group relative flex h-[268px] w-[min(80vw,316px)] flex-none flex-col overflow-hidden rounded-[24px] border border-white/[0.14] bg-[#13265e] p-[18px] text-left text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_30px_60px_-30px_rgba(0,0,0,0.7)] transition-[transform,border-color] duration-500 [transition-timing-function:var(--ba-ease)] hover:-translate-y-1 hover:border-white/[0.28] focus-visible:outline-[2.5px] focus-visible:outline-offset-2 focus-visible:outline-[#b8caf7] sm:w-[320px] sm:p-5"
    >
      {poster && (
        <Image
          src={poster.image}
          alt=""
          fill
          // Card de 316x268 com object-cover: a foto 16:9 precisa de ~480px de largura para cobrir a altura
          sizes="480px"
          className="object-cover opacity-75 transition-transform duration-[1200ms] [transition-timing-function:var(--ba-ease)] group-hover:scale-[1.06]"
          style={{ objectPosition: poster.position ?? "center" }}
        />
      )}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,69,0.55)_0%,rgba(10,26,69,0.12)_30%,rgba(10,26,69,0.82)_58%,rgba(8,20,56,0.97)_100%)]"
      />

      <span aria-hidden="true" className="relative flex items-start justify-between gap-3">
        <SchoolMark school={school} size="sm" />
        <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-[rgba(8,20,56,0.55)] px-2.5 py-1.5 text-[12px] font-semibold tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_0_0_1px_rgba(255,255,255,0.18)] transition-colors duration-300 group-hover:bg-white group-hover:text-[var(--ba-navy)]">
          <Play className="h-3 w-3 fill-current" />
          {time}
        </span>
      </span>

      <span aria-hidden="true" className="relative mt-auto block">
        {isQuote ? (
          <span className="ba-serif block text-[25px] leading-[1.12] text-white">{displayLabel}</span>
        ) : (
          <span className="line-clamp-3 font-[family-name:var(--ba-display)] text-[19px] font-semibold leading-[1.22] tracking-[-0.022em]">
            {label}
          </span>
        )}
        {/* O papel já traz a escola ("Head coach…, University of Miami"); sem orador, a escola assina */}
        <span className="mt-3.5 block border-t border-white/[0.14] pt-3 text-[12.5px] leading-[1.38]">
          <b className="block font-semibold text-white">{moment.speaker ?? school.name}</b>
          <span className="line-clamp-2 text-white/[0.74]">{role ?? pick(ESCOLAS_TEXT.momentsFromTour, lang)}</span>
        </span>
      </span>
    </button>
  );
}

interface CoachMomentsProps {
  moments: VideoMoment[];
  /** Rótulo do trilho para leitor de tela. */
  label: string;
}

/**
 * Trilho "Ouça quem decide": rolagem nativa com snap (o dedo manda no mobile) e setas
 * só quando há o que rolar. Não usa embla: são poucos cards e nada de loop.
 */
export default function CoachMoments({ moments, label }: CoachMomentsProps) {
  const { lang } = useLanguage();
  const trackRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateArrows();
    track.addEventListener("scroll", updateArrows, { passive: true });
    const observer = new ResizeObserver(updateArrows);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", updateArrows);
      observer.disconnect();
    };
  }, [updateArrows]);

  const scrollByPage = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * track.clientWidth * 0.85, behavior: reduceMotion ? "auto" : "smooth" });
  };

  const hasOverflow = canPrev || canNext;

  return (
    <div className="relative">
      {hasOverflow && (
        // z-index: o -my-8 do trilho (respiro da sombra) sobe sobre a base das setas e roubava o clique
        <div className="relative z-[1] mb-5 hidden justify-end gap-2 sm:flex">
          <button type="button" onClick={() => scrollByPage(-1)} disabled={!canPrev} aria-label={pick(ESCOLAS_TEXT.railPrev, lang)} className={arrowButton}>
            <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => scrollByPage(1)} disabled={!canNext} aria-label={pick(ESCOLAS_TEXT.railNext, lang)} className={arrowButton}>
            <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      )}
      {/* Sangra até a borda direita da tela (o corte do último card indica que rola); o snap alinha ao gutter */}
      <ul
        ref={trackRef}
        aria-label={label}
        className="-my-8 -ml-[var(--ba-gutter)] mr-[calc((100%-100vw)/2)] flex snap-x snap-mandatory scroll-px-[var(--ba-gutter)] gap-3 overflow-x-auto px-[var(--ba-gutter)] py-8 [scrollbar-width:none] sm:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {moments.map((moment) => (
          <li key={`${moment.videoId}-${moment.start}`} className="flex snap-start">
            <MomentCard moment={moment} />
          </li>
        ))}
      </ul>
    </div>
  );
}
