import VideoCard from "@/components/brand/VideoCard";
import VideoChip from "@/components/brand/VideoChip";
import { ATHLETES_WITH_VIDEO } from "@/content/athletes";
import { HISTORIAS_PAGE } from "@/content/historias";
import { pick } from "@/content/types";
import { ATHLETE_MOMENTS, ATHLETE_TESTIMONIALS, getVideo } from "@/content/videos";
import type { Lang } from "@/i18n";
import SectionHeading from "./SectionHeading";
import VideoRail, { VideoRailItem } from "./VideoRail";

const TEXT = HISTORIAS_PAGE.atletas;

/*
 * Pôster do card: o quadro real do Short (YouTube) mostra o atleta falando e não repete o
 * pôster do mural logo acima. Robson e Lin são exceção: a capa deles no YouTube é só o logo.
 */
const LOCAL_POSTER_IDS = new Set(["kzh_jb9rmWI", "VzPQT-vdqbE"]);

const ATHLETE_BY_VIDEO = new Map(ATHLETES_WITH_VIDEO.map((athlete) => [athlete.videoId, athlete]));

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

function timestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Depoimentos de atletas (Shorts 9:16) + os minutos em que atletas da casa aparecem no tour. */
export default function AthleteVideosSection({ lang }: { lang: Lang }) {
  const tour = getVideo(ATHLETE_MOMENTS[0]?.videoId ?? "");

  return (
    <section id="depoimentos-atletas" className="relative scroll-mt-20 py-[clamp(48px,6vw,96px)]" aria-labelledby="depoimentos-atletas-title">
      <div className="ba-wrap">
        <SectionHeading
          id="depoimentos-atletas-title"
          eyebrow={pick(TEXT.eyebrow, lang)}
          titleLead={pick(TEXT.titleLead, lang)}
          titleAccent={pick(TEXT.titleAccent, lang)}
          lead={pick(TEXT.lead, lang)}
        />

        <div className="mt-10 sm:mt-14">
          <VideoRail label={pick(TEXT.railLabel, lang)} swipeHint={pick(TEXT.swipe, lang)} desktopColumns={5}>
            {ATHLETE_TESTIMONIALS.map((video, index) => {
              const athlete = ATHLETE_BY_VIDEO.get(video.id);
              return (
                <VideoRailItem key={video.id}>
                  <div className="ba-rv-scale" style={delay(index)}>
                    <VideoCard
                      id={video.id}
                      kind={video.kind}
                      title={athlete?.name ?? pick(video.title, lang)}
                      meta={athlete?.school}
                      duration={video.duration}
                      poster={LOCAL_POSTER_IDS.has(video.id) ? athlete?.image : undefined}
                      sizes="(max-width: 1024px) 240px, 20vw"
                    />
                  </div>
                </VideoRailItem>
              );
            })}
          </VideoRail>
        </div>

        {tour && ATHLETE_MOMENTS.length > 0 && (
          <div className="ba-glass ba-rv mt-10 flex flex-col gap-4 rounded-[24px] p-4 sm:mt-12 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:rounded-[28px] sm:p-5 sm:pl-7">
            <p className="font-[family-name:var(--ba-display)] text-[16px] font-semibold leading-snug tracking-[-0.02em] text-[var(--ba-navy)] sm:max-w-[320px] sm:text-[18px]">
              {pick(TEXT.momentsTitle, lang)}
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:justify-end">
              {ATHLETE_MOMENTS.map((moment) => {
                const label = moment.speaker ? TEXT.moments[moment.speaker] : undefined;
                return (
                  <VideoChip
                    key={`${moment.videoId}-${moment.start}`}
                    id={moment.videoId}
                    kind={tour.kind}
                    start={moment.start}
                    label={label ? pick(label, lang) : pick(moment.label, lang)}
                    title={pick(tour.title, lang)}
                    duration={`${pick(TEXT.momentAt, lang)} ${timestamp(moment.start)}`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
