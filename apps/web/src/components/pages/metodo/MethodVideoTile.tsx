"use client";

import Image from "next/image";
import { Play } from "lucide-react";

import { useVideoPlayer } from "@/components/brand/VideoPlayer";
import { youtubeThumb, type VideoKind } from "@/content/types";

interface MethodVideoTileProps {
  id: string;
  kind: VideoKind;
  title: string;
  duration: string;
  meta: string;
  sizes: string;
  className?: string;
}

/**
 * Card 16:9 do player único (mesma facade do VideoCard) com a legenda ABAIXO do pôster:
 * as capas do canal já trazem o título gravado na arte, e o título sobreposto do
 * VideoCard brigava com ele. As capas concentram texto e assinatura no lado esquerdo,
 * então play e duração ficam nos cantos da direita, como no VideoCard.
 */
export default function MethodVideoTile({ id, kind, title, duration, meta, sizes, className = "" }: MethodVideoTileProps) {
  const { open } = useVideoPlayer();

  return (
    <button
      type="button"
      onClick={() => open({ id, kind, title })}
      aria-label={`${title} (${duration})`}
      className={`group block w-full rounded-[22px] text-left text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${className}`}
    >
      <span className="relative block aspect-video overflow-hidden rounded-[18px] bg-[var(--ba-navy-2)] shadow-[0_24px_50px_-24px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.1)] transition-[transform,box-shadow] duration-500 [transition-timing-function:var(--ba-ease)] group-hover:-translate-y-1 group-hover:shadow-[0_34px_60px_-26px_rgba(0,0,0,0.85),0_0_0_1px_rgba(255,255,255,0.18)] group-active:scale-[0.99] sm:rounded-[20px]">
        <Image
          src={youtubeThumb(id, kind)}
          alt=""
          fill
          sizes={sizes}
          className="object-cover transition-transform duration-700 [transition-timing-function:var(--ba-ease)] group-hover:scale-[1.04]"
        />
        <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_70%_at_100%_100%,rgba(10,26,69,0.55),rgba(10,26,69,0)_70%)]" />
        <span aria-hidden="true" className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur-md sm:right-3 sm:top-3">
          {duration}
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-2.5 right-2.5 grid h-11 w-11 place-items-center rounded-full bg-white/[0.2] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_14px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-[transform,background-color] duration-500 [transition-timing-function:var(--ba-ease)] group-hover:scale-110 group-hover:bg-white/[0.3] sm:bottom-3 sm:right-3"
        >
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
      </span>
      <span aria-hidden="true" className="block px-1 pt-3.5">
        <span className="line-clamp-3 font-[family-name:var(--ba-display)] text-[15.5px] font-semibold leading-[1.3] tracking-[-0.015em] sm:text-[16.5px]">{title}</span>
        <span className="mt-1.5 block truncate text-[12.5px] font-medium text-white/70">{meta}</span>
      </span>
    </button>
  );
}
