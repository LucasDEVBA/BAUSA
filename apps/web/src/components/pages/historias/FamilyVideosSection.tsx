import { ArrowUpRight, Youtube } from "lucide-react";

import MeshBackground from "@/components/brand/MeshBackground";
import { FAMILY_STORIES, HISTORIAS_PAGE, YOUTUBE_CHANNEL_URL } from "@/content/historias";
import { pick } from "@/content/types";
import { FAMILY_TESTIMONIALS } from "@/content/videos";
import type { Lang } from "@/i18n";
import FamilyStoryCard from "./FamilyStoryCard";
import SectionHeading from "./SectionHeading";
import VideoRail, { VideoRailItem } from "./VideoRail";

const TEXT = HISTORIAS_PAGE.familias;
const NEW_TAB = HISTORIAS_PAGE.conquistas.newTab;

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

/*
 * As seis famílias no mesmo trilho, com o mesmo peso: o depoimento 16:9 (Comperlingo) entra
 * como card vertical recortado no centro, em vez de um bloco "em destaque" com faixas borradas.
 */
export default function FamilyVideosSection({ lang }: { lang: Lang }) {
  return (
    <section id="familias" className="relative isolate scroll-mt-20 overflow-clip pb-[clamp(88px,11vw,150px)] pt-[clamp(48px,6vw,96px)]" aria-labelledby="familias-title">
      <MeshBackground blobs={["b2", "b3"]} className="[mask-image:linear-gradient(180deg,transparent,#000_20%)] [&_.ba-b2]:!top-[20%] [&_.ba-b3]:!left-[8vw] [&_.ba-b3]:!top-[55%] [&_.ba-b3]:!opacity-30" />

      <div className="ba-wrap relative z-[2]">
        <SectionHeading
          id="familias-title"
          eyebrow={pick(TEXT.eyebrow, lang)}
          titleLead={pick(TEXT.titleLead, lang)}
          titleAccent={pick(TEXT.titleAccent, lang)}
          lead={pick(TEXT.lead, lang)}
        />

        <div className="mt-10 sm:mt-14">
          <VideoRail label={pick(TEXT.railLabel, lang)} swipeHint={pick(HISTORIAS_PAGE.atletas.swipe, lang)} desktopColumns={6}>
            {FAMILY_TESTIMONIALS.map((video, index) => {
              const story = FAMILY_STORIES[video.id];
              return (
                <VideoRailItem key={video.id}>
                  <div className="ba-rv-scale" style={delay(index)}>
                    <FamilyStoryCard
                      id={video.id}
                      kind={video.kind}
                      videoTitle={pick(video.title, lang)}
                      family={story ? pick(story.family, lang) : pick(video.title, lang)}
                      relation={story ? pick(story.relation, lang) : undefined}
                      duration={video.duration}
                    />
                  </div>
                </VideoRailItem>
              );
            })}
          </VideoRail>
        </div>

        <div className="ba-rv mt-8 flex justify-center sm:mt-10">
          <a
            href={YOUTUBE_CHANNEL_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${pick(TEXT.channel, lang)} (${pick(NEW_TAB, lang)})`}
            className="ba-glass inline-flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-4 text-[14px] font-semibold text-[var(--ba-navy)] transition-transform duration-500 [transition-timing-function:var(--ba-ease)] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ba-blue-2)]"
          >
            <span aria-hidden="true" className="grid h-8 w-8 flex-none place-items-center rounded-full bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <Youtube className="h-4 w-4" />
            </span>
            {pick(TEXT.channel, lang)}
            <ArrowUpRight className="h-4 w-4 flex-none text-[var(--ba-ink-3)]" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
