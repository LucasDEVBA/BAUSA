"use client";

import { MapPin, Play } from "lucide-react";

import { useVideoPlayer } from "@/components/brand/VideoPlayer";
import { ESCOLAS_TEXT, FEATURED_TOUR, LATEST_TOUR_ID, fill, formatTimestamp, getSchoolTour, getTourPoster } from "@/content/escolas";
import { pick } from "@/content/types";
import { useLanguage } from "@/i18n";

import SchoolMark from "./SchoolMark";
import TourPoster from "./TourPoster";

/**
 * Tour em destaque na abertura de /escolas: vídeo grande + capítulos que abrem o player
 * no segundo exato. Cada capítulo é um botão de verdade (toque ≥ 52px de altura).
 */
export default function FeaturedTour() {
  const { lang } = useLanguage();
  const { open } = useVideoPlayer();
  const tour = getSchoolTour(FEATURED_TOUR.slug);
  if (!tour) return null;

  const { school, video } = tour;
  const title = pick(video.title, lang);
  const isLatest = video.id === LATEST_TOUR_ID;
  const poster = getTourPoster(school.slug);

  return (
    <article className="ba-glass rounded-[30px] p-1.5 sm:rounded-[34px] sm:p-2" aria-labelledby="featured-tour-name">
      <TourPoster
        id={video.id}
        kind={video.kind}
        title={title}
        duration={video.duration}
        meta={pick(ESCOLAS_TEXT.videoLanguage, lang) || undefined}
        badge={isLatest ? pick(ESCOLAS_TEXT.latestBadge, lang) : undefined}
        poster={poster?.image}
        position={poster?.position}
        sizes="(max-width: 1024px) 94vw, 620px"
        priority
        size="lg"
        className="!rounded-[24px] sm:!rounded-[27px]"
      />

      <div className="px-2.5 pb-2.5 pt-4 sm:px-4 sm:pb-4 sm:pt-5">
        <div className="flex items-center gap-3.5">
          <SchoolMark school={school} />
          <div className="min-w-0">
            <h2 id="featured-tour-name" className="ba-h3 text-[19px] text-[var(--ba-navy)] sm:text-[21px]">
              {school.name}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-medium text-[var(--ba-ink-3)]">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
                {school.location}
              </span>
              {video.chapters && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{fill(pick(ESCOLAS_TEXT.chaptersCount, lang), { n: video.chapters.length })}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="mt-5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[var(--ba-blue)]">{pick(ESCOLAS_TEXT.chaptersLabel, lang)}</p>
        <ul className="mt-2 grid gap-0.5">
          {FEATURED_TOUR.chapters.map((chapter) => {
            const time = formatTimestamp(chapter.start);
            const label = pick(chapter.label, lang);
            return (
              <li key={chapter.start}>
                <button
                  type="button"
                  onClick={() => open({ id: video.id, kind: video.kind, title: `${title} (${time})`, start: chapter.start })}
                  aria-label={fill(pick(ESCOLAS_TEXT.chapterAria, lang), { time, label })}
                  className="group flex min-h-12 w-full items-center gap-3 rounded-[16px] px-2 py-1.5 text-left transition-colors duration-300 hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ba-blue-2)] active:bg-white"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex h-8 min-w-[66px] flex-none items-center justify-center gap-1.5 rounded-full bg-[rgba(31,63,163,0.08)] text-[12.5px] font-semibold tabular-nums text-[var(--ba-blue)] transition-colors duration-300 group-hover:bg-[var(--ba-blue)] group-hover:text-white"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    {time}
                  </span>
                  <span aria-hidden="true" className="line-clamp-2 text-[14px] font-medium leading-[1.3] text-[var(--ba-ink)]">
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}
