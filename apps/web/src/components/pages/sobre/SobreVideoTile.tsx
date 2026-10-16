"use client";

import Image, { type StaticImageData } from "next/image";
import { Play } from "lucide-react";

import { useVideoPlayer } from "@/components/brand/VideoPlayer";
import { youtubeThumb } from "@/content/types";

interface SobreVideoTileProps {
  id: string;
  /** Título completo (player e leitor de tela). */
  title: string;
  /** Título exibido abaixo do pôster (pode ser mais curto que o do vídeo). */
  label: string;
  /** Linha acima do título, já com a duração (ex.: "Assista · 3:28"). */
  eyebrow: string;
  duration: string;
  /** Sem pôster próprio usa a capa oficial do YouTube (16:9). */
  poster?: string | StaticImageData;
  sizes: string;
  /** Pôster prioritário: só quando o cartão nasce acima da dobra. */
  preload?: boolean;
  /** "corner" tira o play do centro quando a capa tem texto queimado no meio. */
  playPosition?: "center" | "corner";
  className?: string;
}

/**
 * Cartão de vídeo com o título FORA do pôster. As capas dos institucionais já
 * trazem tipografia queimada; título sobreposto brigaria com ela. Mesmo player
 * único do site (facade: nenhum iframe antes do toque).
 */
export default function SobreVideoTile({ id, title, label, eyebrow, duration, poster, sizes, preload, playPosition = "center", className = "" }: SobreVideoTileProps) {
  const { open } = useVideoPlayer();
  const corner = playPosition === "corner";

  return (
    <button
      type="button"
      onClick={() => open({ id, kind: "video", title })}
      aria-label={`${title} (${duration})`}
      className={`ba-glass group flex h-full w-full flex-col rounded-[26px] !bg-white/[0.72] p-2 text-left transition-[transform,box-shadow] duration-500 [transition-timing-function:var(--ba-ease)] hover:-translate-y-1 hover:shadow-[var(--ba-shadow-lg)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ba-blue-2)] active:scale-[0.99] ${className}`}
    >
      <span className="relative block aspect-video w-full overflow-hidden rounded-[19px] bg-[var(--ba-navy-2)]">
        <Image
          src={poster ?? youtubeThumb(id, "video")}
          alt=""
          fill
          sizes={sizes}
          preload={preload}
          className="object-cover transition-transform duration-700 [transition-timing-function:var(--ba-ease)] group-hover:scale-[1.04]"
        />
        {!corner && <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(10,26,69,0.28),rgba(10,26,69,0))]" />}
        <span
          aria-hidden="true"
          className={`absolute grid place-items-center rounded-full text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_14px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-transform duration-500 group-hover:scale-110 ${
            corner ? "bottom-3 right-3 h-11 w-11 bg-[rgba(10,26,69,0.55)]" : "left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 bg-white/[0.22]"
          }`}
        >
          <Play className={`ml-0.5 fill-current ${corner ? "h-[18px] w-[18px]" : "h-6 w-6"}`} />
        </span>
      </span>
      <span aria-hidden="true" className="block px-3 pb-2.5 pt-3 sm:px-3.5">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ba-wine)]">
          <span className="h-1.5 w-1.5 flex-none rounded-full bg-[var(--ba-wine-2)]" />
          {eyebrow}
        </span>
        <span className="mt-1.5 block font-[family-name:var(--ba-display)] text-[16.5px] font-semibold leading-[1.25] tracking-[-0.02em] text-[var(--ba-navy)] sm:text-[17.5px]">
          {label}
        </span>
      </span>
    </button>
  );
}
