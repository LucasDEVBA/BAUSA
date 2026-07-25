"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { RecFrame } from "./RecFrame";

/**
 * Card de prova em vídeo — thumbnail estático que só troca por um `<iframe>`
 * depois do clique (facade pattern).
 *
 * Isso importa: a home tem 9 depoimentos. Nove iframes do YouTube montados de
 * saída custariam ~4MB e várias centenas de ms de main thread. A facade
 * carrega zero até o usuário querer assistir.
 *
 * Usa `youtube-nocookie.com` — não planta cookie de rastreio antes do consentimento.
 *
 * O convite ao play é o próprio REC pulsando, não um botão genérico gigante
 * (BAU-02 §2.7).
 */
interface VideoCardProps {
  youtubeId: string;
  thumbnail: string;
  /** Nome de quem fala — vira o rótulo acessível do botão. */
  name: string;
  /** Linha de contexto, ex.: "16 anos · Montverde Academy". */
  context?: string;
  /** Legenda documental do frame REC, ex.: "MONTVERDE · FL · 2026". */
  timestamp?: string;
  /** Texto do botão para leitores de tela, ex.: "Assistir ao depoimento de". */
  playLabel: string;
  className?: string;
}

export function VideoCard({
  youtubeId,
  thumbnail,
  name,
  context,
  timestamp,
  playLabel,
  className,
}: VideoCardProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <figure className={cn("group", className)}>
      <RecFrame timestamp={timestamp} className="aspect-[9/16] overflow-hidden bg-bau-navy">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
            title={`${playLabel} ${name}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="absolute inset-0 h-full w-full cursor-pointer"
          >
            <span className="sr-only">{`${playLabel} ${name}`}</span>
            <img
              src={thumbnail}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
            {/* Véu navy: mantém o texto legível e unifica a gradação fria do site. */}
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-bau-navy-deep via-bau-navy-deep/20 to-transparent"
            />
          </button>
        )}
      </RecFrame>

      <figcaption className="mt-5">
        <p className="bau-display text-[1.25rem] text-bau-ivory">{name}</p>
        {context ? <p className="bau-mono mt-2 text-[11px] text-bau-stone">{context}</p> : null}
      </figcaption>
    </figure>
  );
}
