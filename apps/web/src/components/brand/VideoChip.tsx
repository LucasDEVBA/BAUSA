"use client";

import { PlayCircle } from "lucide-react";

import type { VideoKind } from "@/content/types";
import { useVideoPlayer } from "./VideoPlayer";

interface VideoChipProps {
  id: string;
  kind?: VideoKind;
  /** Texto do chip, ex.: "Entenda o método em 2 min". */
  label: string;
  /** Título completo do vídeo (vai para o player e o leitor de tela). */
  title: string;
  duration?: string;
  start?: number;
  tone?: "light" | "dark";
  className?: string;
}

/** Pílula de vidro "Assista" que abre um vídeo no player único. */
export default function VideoChip({ id, kind = "video", label, title, duration, start, tone = "light", className = "" }: VideoChipProps) {
  const { open } = useVideoPlayer();
  const dark = tone === "dark";

  return (
    <button
      type="button"
      onClick={() => open({ id, kind, title, start })}
      className={`inline-flex min-h-11 max-w-full items-center gap-2.5 rounded-full py-2 pl-2 pr-4 text-left text-[13.5px] font-semibold transition-[transform,background-color] duration-500 [transition-timing-function:var(--ba-ease)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ba-blue-2)] ${
        dark ? "ba-glass-dark text-white hover:bg-white/[0.14]" : "ba-glass text-[var(--ba-navy)]"
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[linear-gradient(150deg,#3d61c8,var(--ba-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
      >
        <PlayCircle className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {duration && <span className={`block text-[11.5px] font-medium ${dark ? "text-white/70" : "text-[var(--ba-ink-3)]"}`}>{duration}</span>}
      </span>
    </button>
  );
}
