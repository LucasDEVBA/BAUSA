"use client";

import VideoChip from "@/components/brand/VideoChip";
import { useLanguage } from "@/i18n";
import { METHOD_COPY, videoSubline, type MethodMomentChipData, type MethodVideoChipData } from "@/content/metodo";
import { pick } from "@/content/types";
import { getVideo } from "@/content/videos";

// O VideoChip corta o rótulo com reticências; em cards estreitos (pilar S no lg, ES) o
// rótulo quebra em duas linhas em vez de virar "Escola famosa ou…"
const WRAP_LABEL = "[&_.truncate]:whitespace-normal [&_.truncate]:leading-[1.25]";

interface MethodVideoChipProps {
  chip: MethodVideoChipData;
  tone?: "light" | "dark";
  className?: string;
}

/** Chip "Assista" de um vídeo do catálogo: título completo e duração vêm de videos.ts. */
export function MethodVideoChip({ chip, tone, className }: MethodVideoChipProps) {
  const { lang } = useLanguage();
  const video = getVideo(chip.videoId);
  if (!video) return null;

  return (
    <VideoChip
      id={video.id}
      kind={video.kind}
      label={pick(chip.label, lang)}
      title={pick(video.title, lang)}
      duration={videoSubline(video.duration, lang)}
      tone={tone}
      className={`${WRAP_LABEL} ${className ?? ""}`}
    />
  );
}

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

interface MethodMomentChipProps {
  moment: MethodMomentChipData;
  tone?: "light" | "dark";
  className?: string;
}

/** Chip que abre o tour no capítulo exato; o player recebe o nome do capítulo como título. */
export function MethodMomentChip({ moment, tone, className }: MethodMomentChipProps) {
  const { lang } = useLanguage();
  const video = getVideo(moment.videoId);
  if (!video) return null;
  const chapter = video.chapters?.find((item) => item.start === moment.start);

  return (
    <VideoChip
      id={video.id}
      kind={video.kind}
      start={moment.start}
      label={pick(moment.label, lang)}
      title={chapter ? pick(chapter.label, lang) : pick(video.title, lang)}
      duration={`${pick(METHOD_COPY.montverdeTour, lang)} · ${formatTimestamp(moment.start)}`}
      tone={tone}
      className={`${WRAP_LABEL} ${className ?? ""}`}
    />
  );
}
