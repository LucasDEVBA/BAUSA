"use client";

import Image, { type StaticImageData } from "next/image";
import { Play } from "lucide-react";

import { useVideoPlayer } from "@/components/brand/VideoPlayer";
import { youtubeThumb, type VideoKind } from "@/content/types";

type PosterSize = "md" | "lg";

interface TourPosterProps {
  id: string;
  kind: VideoKind;
  title: string;
  duration: string;
  /** Linha sob o título (ex.: "Video in Portuguese" em EN/ES). */
  meta?: string;
  /** Selo no canto superior (ex.: "Novo"); também entra no nome acessível. */
  badge?: string;
  poster?: StaticImageData;
  /** object-position do recorte. */
  position?: string;
  sizes: string;
  priority?: boolean;
  size?: PosterSize;
  className?: string;
}

// Os títulos do canal são longos (RPS, Jacksonville): com 2 linhas a grade inteira terminava em "...",
// e 3 (4 no celular, onde a coluna é estreita) ainda deixam a metade de cima do pôster livre
const SIZE_CLASS: Record<PosterSize, { title: string; ring: string; disc: string; icon: string; pad: string }> = {
  md: {
    title: "line-clamp-4 text-[15px] sm:line-clamp-3 sm:text-[16px]",
    ring: "h-12 w-12",
    disc: "h-9 w-9",
    icon: "h-4 w-4",
    pad: "p-4 sm:p-[18px]",
  },
  lg: {
    title: "line-clamp-3 text-[16px] sm:text-[19px]",
    ring: "h-12 w-12 sm:h-14 sm:w-14",
    disc: "h-9 w-9 sm:h-11 sm:w-11",
    icon: "h-4 w-4 sm:h-5 sm:w-5",
    pad: "p-4 sm:p-6",
  },
};

/**
 * Pôster de tour (facade): o iframe só existe depois do toque, pelo player único.
 * O play fica no canto inferior, ao lado do título, como nos cards de tour da home:
 * centralizado, ele colidia com títulos de 2 ou 3 linhas nos cards estreitos.
 */
export default function TourPoster({
  id,
  kind,
  title,
  duration,
  meta,
  badge,
  poster,
  position,
  sizes,
  priority,
  size = "md",
  className = "",
}: TourPosterProps) {
  const { open } = useVideoPlayer();
  const styles = SIZE_CLASS[size];
  const label = `${badge ? `${badge}: ` : ""}${title} (${duration})${meta ? `. ${meta}` : ""}`;

  return (
    <button
      type="button"
      onClick={() => open({ id, kind, title })}
      aria-label={label}
      className={`group relative block aspect-video w-full overflow-hidden rounded-[22px] bg-[var(--ba-navy-2)] text-left shadow-[var(--ba-shadow-sm)] focus-visible:outline-[2.5px] focus-visible:outline-offset-2 focus-visible:outline-[var(--ba-blue-2)] ${className}`}
    >
      <Image
        src={poster ?? youtubeThumb(id, kind)}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover transition-transform duration-[1200ms] [transition-timing-function:var(--ba-ease)] group-hover:scale-[1.05] motion-reduce:transition-none"
        style={position ? { objectPosition: position } : undefined}
      />
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,15,42,0.42)_0%,rgba(6,15,42,0)_26%,rgba(6,15,42,0.08)_48%,rgba(6,15,42,0.9)_100%)]"
      />

      <span aria-hidden="true" className="absolute inset-x-3 top-3 flex items-start justify-between gap-2 sm:inset-x-4 sm:top-4">
        {badge ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))] px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_20px_-8px_rgba(144,36,52,0.8)] sm:px-3 sm:py-1.5 sm:text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            {badge}
          </span>
        ) : (
          <span />
        )}
        <span className="rounded-full bg-[rgba(6,15,42,0.62)] px-2.5 py-1 text-[11.5px] font-semibold tabular-nums text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
          {duration}
        </span>
      </span>

      <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 flex items-end gap-3 ${styles.pad}`}>
        <span className="min-w-0 flex-1">
          <span
            className={`font-[family-name:var(--ba-display)] font-semibold leading-[1.25] tracking-[-0.015em] text-white [text-shadow:0_1px_12px_rgba(6,15,42,0.45)] ${styles.title}`}
          >
            {title}
          </span>
          {meta && <span className="mt-1 block truncate text-[12px] font-medium text-white/80">{meta}</span>}
        </span>
        <span
          className={`grid flex-none place-items-center rounded-full bg-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_0_0_1px_rgba(255,255,255,0.3)] backdrop-blur-md transition-transform duration-500 [transition-timing-function:var(--ba-ease)] group-hover:scale-110 group-active:scale-95 ${styles.ring}`}
        >
          <span className={`grid place-items-center rounded-full bg-[linear-gradient(180deg,#fff,#e6ecfb)] ${styles.disc}`}>
            <Play className={`ml-0.5 fill-[var(--ba-navy)] text-[var(--ba-navy)] ${styles.icon}`} />
          </span>
        </span>
      </span>
    </button>
  );
}
