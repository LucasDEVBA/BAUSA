"use client";

import { ChevronRight, Play, Trophy } from "lucide-react";

import { useVideoPlayer } from "@/components/brand/VideoPlayer";
import FocalImage, { type Focus } from "@/components/pages/historias/FocalImage";
import { PAGE_PATH } from "@/config/routes";
import { getAthlete } from "@/content/athletes";
import { HOME_STORIES_TEXT as TEXT } from "@/content/historias";
import { pick, type AthleteStory } from "@/content/types";
import { getVideo } from "@/content/videos";
import { useLanguage, type Lang } from "@/i18n";
import { Link } from "@/i18n/navigation";

interface StoryItem {
  slug: string;
  /** Nome curto embaixo do círculo, como nos Destaques do Instagram. */
  label: string;
  /** Rosto no pôster (as peças têm texto e o atleta fora do centro). */
  focus: Focus;
}

// Ordem de curadoria: conquista, depoimento, depoimento, conquista... para o trilho alternar o tipo
const STORIES: StoryItem[] = [
  { slug: "andressa-macedo", label: "Andressa", focus: { x: 0.575, y: 0.315, zoom: 2.4 } },
  { slug: "isadora-santiago", label: "Isadora", focus: { x: 0.6, y: 0.325, zoom: 3 } },
  { slug: "liz-valverde", label: "Liz", focus: { x: 0.69, y: 0.45, zoom: 1.75 } },
  { slug: "bernardo-herdy", label: "Bernardo", focus: { x: 0.5, y: 0.25, zoom: 1.9 } },
  { slug: "benjamin-bertolucci", label: "Benjamin", focus: { x: 0.5, y: 0.33, zoom: 2.2 } },
  { slug: "robson-moraes", label: "Robson", focus: { x: 0.47, y: 0.18, zoom: 3 } },
  { slug: "lin-feng", label: "Lin", focus: { x: 0.43, y: 0.14, zoom: 3 } },
];

// Anel em gradiente da marca (azul → bordô), a leitura imediata de "Stories"
const RING = "bg-[conic-gradient(from_210deg,var(--ba-blue-2),var(--ba-blue),var(--ba-wine),var(--ba-wine-2),var(--ba-blue-2))]";
const ITEM =
  "group flex w-[78px] flex-none snap-start flex-col items-center gap-2 rounded-[22px] pb-1 pt-1 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ba-blue-2)] sm:w-[88px]";

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

function StoryRing({ athlete, story, hasVideo }: { athlete: AthleteStory; story: StoryItem; hasVideo: boolean }) {
  const BadgeIcon = hasVideo ? Play : Trophy;
  return (
    <span
      className={`relative block h-[74px] w-[74px] rounded-full p-[2.5px] shadow-[0_10px_24px_-12px_rgba(31,63,163,0.55)] transition-transform duration-500 [transition-timing-function:var(--ba-ease)] group-hover:scale-[1.05] group-active:scale-95 sm:h-[82px] sm:w-[82px] ${RING}`}
    >
      <span className="relative block h-full w-full overflow-hidden rounded-full border-[3px] border-[var(--ba-bg)] bg-[var(--ba-navy-2)]">
        <FocalImage src={athlete.image} alt="" focus={story.focus} frameRatio={1} sizes={`${Math.ceil(82 * (story.focus.zoom ?? 1))}px`} />
      </span>
      <span
        aria-hidden="true"
        className={`absolute -bottom-0.5 -right-0.5 grid h-[26px] w-[26px] place-items-center rounded-full border-[2.5px] border-[var(--ba-bg)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${
          hasVideo ? "bg-[linear-gradient(150deg,#3d61c8,var(--ba-blue))]" : "bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))]"
        }`}
      >
        <BadgeIcon className={`h-3 w-3 ${hasVideo ? "ml-px fill-current" : ""}`} />
      </span>
    </span>
  );
}

function StoryLabel({ children }: { children: string }) {
  return (
    <span className="block max-w-full truncate text-[12.5px] font-semibold leading-tight tracking-[-0.005em] text-[var(--ba-ink)] sm:text-[13px]">
      {children}
    </span>
  );
}

function storyEntry(story: StoryItem, lang: Lang) {
  const athlete = getAthlete(story.slug);
  const video = athlete?.videoId ? getVideo(athlete.videoId) : undefined;
  return athlete ? { story, athlete, video, headline: pick(athlete.headline, lang) } : null;
}

/**
 * Faixa "Destaques" logo abaixo do Hero, no espírito dos Stories do Instagram: círculos com
 * anel em gradiente. Quem tem depoimento abre o player único; conquista sem vídeo (fotos do
 * Instagram) leva ao destaque em /historias. Rolagem horizontal com snap no mobile.
 */
export default function StoriesRail() {
  const { lang } = useLanguage();
  const { open } = useVideoPlayer();
  const entries = STORIES.map((story) => storyEntry(story, lang)).filter((entry) => entry !== null);

  return (
    <section className="relative z-[2] pb-[clamp(8px,2vw,24px)] pt-[clamp(26px,4vw,44px)]" aria-labelledby="destaques-title">
      <div className="ba-wrap">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-10">
          <div className="ba-rv flex items-end justify-between gap-4 lg:w-[240px] lg:flex-none lg:flex-col lg:items-start lg:gap-2">
            <div className="min-w-0">
              <h2 id="destaques-title" className="font-[family-name:var(--ba-display)] text-[19px] font-semibold leading-tight tracking-[-0.025em] text-[var(--ba-navy)] sm:text-[21px]">
                {pick(TEXT.railTitle, lang)}
              </h2>
              <p className="mt-1 text-[13px] leading-snug text-[var(--ba-ink-3)]">{pick(TEXT.railHint, lang)}</p>
            </div>
            <Link
              href={PAGE_PATH.historias}
              className="-mr-3 inline-flex min-h-11 flex-none items-center gap-0.5 whitespace-nowrap rounded-full px-3 text-[13.5px] font-semibold text-[var(--ba-blue)] transition-colors hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-[var(--ba-blue-2)] lg:-ml-3 lg:mr-0"
            >
              {pick(TEXT.seeAll, lang)}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <ul
            role="list"
            className="scrollbar-hide -mx-[var(--ba-gutter)] flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-[var(--ba-gutter)] py-1 [scroll-padding-inline:var(--ba-gutter)] sm:gap-4 lg:mx-0 lg:flex-1 lg:justify-between lg:overflow-visible lg:px-0"
          >
            {entries.map(({ story, athlete, video, headline }, index) => (
              <li key={story.slug} className="ba-rv-scale flex-none snap-start" style={delay(index)}>
                {video ? (
                  <button
                    type="button"
                    className={ITEM}
                    aria-label={`${pick(TEXT.watch, lang)}: ${athlete.name}, ${pick(TEXT.testimonial, lang)} (${video.duration})`}
                    onClick={() => open({ id: video.id, kind: video.kind, title: pick(video.title, lang) })}
                  >
                    <StoryRing athlete={athlete} story={story} hasVideo />
                    <StoryLabel>{story.label}</StoryLabel>
                  </button>
                ) : (
                  <Link
                    href={`${PAGE_PATH.historias}#${athlete.slug}`}
                    className={ITEM}
                    aria-label={`${pick(TEXT.storyOf, lang)} ${athlete.name}: ${headline}`}
                  >
                    <StoryRing athlete={athlete} story={story} hasVideo={false} />
                    <StoryLabel>{story.label}</StoryLabel>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
