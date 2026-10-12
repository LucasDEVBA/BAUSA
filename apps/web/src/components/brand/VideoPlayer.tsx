"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useLanguage } from "@/i18n";
import type { VideoKind } from "@/content/types";

export interface PlayableVideo {
  id: string;
  kind: VideoKind;
  title: string;
  /** Segundo inicial (capítulos dos tours). */
  start?: number;
}

interface VideoPlayerContextValue {
  open: (video: PlayableVideo) => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

/** Abre o player único do site. Fora do provider vira no-op (nunca quebra a página). */
export function useVideoPlayer(): VideoPlayerContextValue {
  return useContext(VideoPlayerContext) ?? { open: () => undefined };
}

function embedUrl(video: PlayableVideo): string {
  const params = new URLSearchParams({ autoplay: "1", rel: "0", playsinline: "1", modestbranding: "1" });
  if (video.start) params.set("start", String(video.start));
  // youtube-nocookie: sem cookie de rastreamento até o play
  return `https://www.youtube-nocookie.com/embed/${video.id}?${params.toString()}`;
}

/**
 * Player único (facade): nenhum iframe do YouTube carrega antes do toque.
 * Abre em tela cheia no mobile; vertical para Shorts, 16:9 para vídeos.
 * Foco vai para o botão fechar, Esc fecha, a rolagem da página trava e o foco
 * volta para quem abriu.
 */
export function VideoPlayerProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [current, setCurrent] = useState<PlayableVideo | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const open = useCallback((video: PlayableVideo) => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCurrent(video);
  }, []);
  const close = useCallback(() => setCurrent(null), []);

  useEffect(() => {
    if (!current) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      // Tab fica preso ao botão fechar: o iframe é cross-origin e não recebe foco programático
      if (event.key === "Tab") {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      returnFocusRef.current?.focus();
    };
  }, [current, close]);

  const value = useMemo(() => ({ open }), [open]);
  const vertical = current?.kind === "short";

  return (
    <VideoPlayerContext.Provider value={value}>
      {children}
      {current &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={current.title}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(6,13,36,0.88)] p-3 backdrop-blur-md sm:p-8"
            onClick={close}
          >
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label={t("landing.closeVideo")}
              className="absolute right-[max(12px,env(safe-area-inset-right))] top-[max(12px,env(safe-area-inset-top))] z-[2] grid h-11 w-11 place-items-center rounded-full bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-xl transition-colors hover:bg-white/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <div
              className={
                vertical
                  ? "relative aspect-[9/16] h-[min(86svh,calc((100vw-24px)*16/9))] overflow-hidden rounded-[22px] bg-black shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)]"
                  : "relative aspect-video w-[min(1100px,100%)] overflow-hidden rounded-[18px] bg-black shadow-[0_40px_90px_-30px_rgba(0,0,0,0.8)] sm:rounded-[24px]"
              }
              onClick={(event) => event.stopPropagation()}
            >
              <iframe
                src={embedUrl(current)}
                title={current.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0"
              />
            </div>
          </div>,
          document.body,
        )}
    </VideoPlayerContext.Provider>
  );
}
