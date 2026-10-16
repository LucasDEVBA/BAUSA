import Image from "next/image";
import { Play } from "lucide-react";

import { youtubeThumb, type VideoKind } from "@/content/types";
import PlayStoryButton from "./PlayStoryButton";

// Pôster 16:9 recortado no centro de um card 9:16: a imagem renderizada tem ~3,2x a largura do card
const WIDE_POSTER_SIZES = "(max-width: 1024px) 760px, 52vw";

interface FamilyStoryCardProps {
  id: string;
  kind: VideoKind;
  /** Título que vai para o player (iframe e diálogo). */
  videoTitle: string;
  family: string;
  relation?: string;
  duration: string;
}

/**
 * Card 9:16 do depoimento de família. Mesmo visual do VideoCard, com duas diferenças que o
 * trilho precisa: quem fala quebra em duas linhas em vez de cortar ("Gabriel, pai do João
 * Gabriel") e o formato do card é independente do player. O vídeo da família Comperlingo é
 * 16:9 com a gravação vertical no centro: o card mostra esse centro e o player abre horizontal.
 */
export default function FamilyStoryCard({ id, kind, videoTitle, family, relation, duration }: FamilyStoryCardProps) {
  const label = `${family}${relation ? `, ${relation}` : ""} (${duration})`;

  return (
    <PlayStoryButton
      id={id}
      kind={kind}
      title={videoTitle}
      ariaLabel={label}
      className="group relative block aspect-[9/16] w-full overflow-hidden rounded-[22px] bg-[var(--ba-navy-2)] text-left shadow-[var(--ba-shadow)] transition-[transform,box-shadow] duration-500 [transition-timing-function:var(--ba-ease)] hover:-translate-y-1 hover:shadow-[var(--ba-shadow-lg)] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--ba-blue-2)] active:scale-[0.99]"
    >
      <Image
        src={youtubeThumb(id, kind)}
        alt=""
        fill
        sizes={kind === "short" ? "(max-width: 1024px) 240px, 16vw" : WIDE_POSTER_SIZES}
        className="object-cover transition-transform duration-700 [transition-timing-function:var(--ba-ease)] group-hover:scale-[1.04]"
      />
      <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,69,0)_40%,rgba(10,26,69,0.88)_100%)]" />
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/[0.18] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_14px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-transform duration-500 group-hover:scale-110"
      >
        <Play className="ml-0.5 h-6 w-6 fill-current" />
      </span>
      <span aria-hidden="true" className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur-md">
        {duration}
      </span>
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 p-4 text-white lg:p-3.5 xl:p-4">
        <span className="line-clamp-2 block font-[family-name:var(--ba-display)] text-[15px] font-semibold leading-[1.25] tracking-[-0.015em] xl:text-[16px]">
          {family}
        </span>
        {relation && <span className="mt-1 line-clamp-2 block text-[12.5px] font-medium leading-snug text-white/80 lg:text-[12px] xl:text-[12.5px]">{relation}</span>}
      </span>
    </PlayStoryButton>
  );
}
