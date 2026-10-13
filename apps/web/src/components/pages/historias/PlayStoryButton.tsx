"use client";

import type { ReactNode } from "react";

import { useVideoPlayer } from "@/components/brand/VideoPlayer";
import type { VideoKind } from "@/content/types";

interface PlayStoryButtonProps {
  id: string;
  kind: VideoKind;
  /** Título que vai para o player (iframe e diálogo). */
  title: string;
  start?: number;
  /** Nome acessível: precisa conter o texto visível do botão. */
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}

/** Ilha client mínima: botão de qualquer formato que abre um vídeo no player único. */
export default function PlayStoryButton({ id, kind, title, start, ariaLabel, className = "", children }: PlayStoryButtonProps) {
  const { open } = useVideoPlayer();

  return (
    <button type="button" aria-label={ariaLabel} className={className} onClick={() => open({ id, kind, title, start })}>
      {children}
    </button>
  );
}
