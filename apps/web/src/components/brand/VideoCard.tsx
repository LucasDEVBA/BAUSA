"use client";

import Image from "next/image";
import type { StaticImageData } from "next/image";
import { Play } from "lucide-react";

import { youtubeThumb, type VideoKind } from "@/content/types";
import { useVideoPlayer } from "./VideoPlayer";

interface VideoCardProps {
  id: string;
  kind: VideoKind;
  title: string;
  duration?: string;
  /** Linha secundária (escola, pessoa, categoria). */
  meta?: string;
  start?: number;
  /** Pôster local (ex.: foto do Instagram); sem ele usa o pôster do YouTube. */
  poster?: StaticImageData;
  sizes?: string;
  className?: string;
  /** Prioriza o pôster (só no primeiro card acima da dobra). */
  priority?: boolean;
}

/**
 * Card de vídeo com facade: pôster + botão de play em vidro. O iframe só
 * carrega no toque, pelo player único (VideoPlayerProvider). É um <button>
 * de verdade: teclado e leitor de tela recebem "Assistir: <título>".
 */
export default function VideoCard({ id, kind, title, duration, meta, start, poster, sizes, className = "", priority }: VideoCardProps) {
  const { open } = useVideoPlayer();
  const vertical = kind === "short";

  return (
    <button
      type="button"
      onClick={() => open({ id, kind, title, start })}
      aria-label={`${title}${duration ? ` (${duration})` : ""}`}
      className={`group relative block w-full overflow-hidden rounded-[22px] bg-[var(--ba-navy-2)] text-left shadow-[var(--ba-shadow)] transition-[transform,box-shadow] duration-500 [transition-timing-function:var(--ba-ease)] hover:-translate-y-1 hover:shadow-[var(--ba-shadow-lg)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ba-blue-2)] active:scale-[0.99] ${
        vertical ? "aspect-[9/16]" : "aspect-video"
      } ${className}`}
    >
      <Image
        src={poster ?? youtubeThumb(id, kind)}
        alt=""
        fill
        sizes={sizes ?? (vertical ? "(max-width: 640px) 70vw, 280px" : "(max-width: 640px) 92vw, 33vw")}
        priority={priority}
        className="object-cover transition-transform duration-700 [transition-timing-function:var(--ba-ease)] group-hover:scale-[1.04]"
      />
      <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,69,0)_40%,rgba(10,26,69,0.86)_100%)]" />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/[0.18] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_14px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-transform duration-500 group-hover:scale-110"
      >
        <Play className="ml-0.5 h-6 w-6 fill-current" />
      </span>
      {duration && (
        <span aria-hidden="true" className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur-md">
          {duration}
        </span>
      )}
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
        <span className="line-clamp-2 font-[family-name:var(--ba-display)] text-[15px] font-semibold leading-[1.25] tracking-[-0.015em] sm:text-[16.5px]">
          {title}
        </span>
        {meta && <span className="mt-1 block truncate text-[12.5px] font-medium text-white/75">{meta}</span>}
      </span>
    </button>
  );
}
