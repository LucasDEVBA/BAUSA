import { Languages } from "lucide-react";

import MeshBackground from "@/components/brand/MeshBackground";
import VideoCard from "@/components/brand/VideoCard";
import type { Lang } from "@/i18n";
import { SOBRE_HERO, SOBRE_VIDEOS, SOBRE_WHY, VIDEO_LANGUAGE_NOTE, withLanguageTag } from "@/content/sobre";
import { pick, type YoutubeVideo } from "@/content/types";
import { getVideo } from "@/content/videos";
import SobreVideoTile from "./SobreVideoTile";

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

interface SobreWhyProps {
  lang: Lang;
}

/** "Por que criamos": o filme institucional em destaque, o manifesto e os três vídeos curtos da origem. */
export default function SobreWhy({ lang }: SobreWhyProps) {
  const film = getVideo(SOBRE_VIDEOS.film);
  const shorts = SOBRE_VIDEOS.why.map((id) => getVideo(id)).filter((video): video is YoutubeVideo => video !== undefined);
  const languageNote = pick(VIDEO_LANGUAGE_NOTE, lang);
  const watch = pick(SOBRE_HERO.videoEyebrow, lang);

  return (
    <section className="relative isolate overflow-x-clip py-[clamp(72px,9vw,128px)]" aria-labelledby="por-que-title">
      <MeshBackground blobs={["b1", "b3"]} className="[&_.ba-b1]:!opacity-50 [&_.ba-b3]:!opacity-35 [mask-image:linear-gradient(180deg,transparent,#000_16%,#000_84%,transparent)]" />

      <div className="ba-wrap relative z-[2]">
        <header className="mx-auto max-w-[820px] text-center">
          <span className="ba-eyebrow ba-glass ba-rv">
            <span className="ba-dot" />
            {pick(SOBRE_WHY.eyebrow, lang)}
          </span>
          <h2 id="por-que-title" className="ba-h2 ba-rv mt-6 text-balance text-[var(--ba-navy)]" style={delay(1)}>
            {pick(SOBRE_WHY.title, lang)}
          </h2>
          <p className="ba-lead ba-rv mx-auto mt-6 max-w-[680px]" style={delay(2)}>
            {pick(SOBRE_WHY.lead, lang)}
          </p>
          {lang !== "pt" && (
            <p className="ba-rv mt-5 inline-flex items-center gap-2 rounded-full bg-white/70 px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--ba-ink-2)] shadow-[var(--ba-shadow-sm)]" style={delay(3)}>
              <Languages className="h-4 w-4 text-[var(--ba-blue)]" aria-hidden="true" />
              {languageNote}
            </p>
          )}
        </header>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:mt-14 lg:grid-cols-12 lg:gap-5">
          {film && (
            <div className="ba-rv-scale lg:col-span-8" style={delay(1)}>
              <div className="ba-glass rounded-[30px] p-2 sm:rounded-[34px] sm:p-2.5">
                <VideoCard
                  id={film.id}
                  kind={film.kind}
                  title={pick(film.title, lang)}
                  duration={film.duration}
                  sizes="(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 820px"
                  className="!rounded-[23px] sm:!rounded-[26px]"
                />
              </div>
            </div>
          )}

          {/* div (e não aside): é o fecho da seção, não conteúdo complementar; aside dentro do main vira landmark solto */}
          <div className="ba-rv relative isolate flex flex-col justify-between overflow-hidden rounded-[30px] p-7 text-white shadow-[0_40px_90px_-34px_rgba(144,36,52,0.6),inset_0_1px_0_rgba(255,255,255,0.25)] [background:linear-gradient(140deg,var(--ba-wine)_0%,#6d2350_38%,#2a3c9c_76%,var(--ba-blue)_100%)] sm:rounded-[34px] sm:p-9 lg:col-span-4" style={delay(2)}>
            <span aria-hidden="true" className="pointer-events-none absolute inset-[-60%] -z-[1] animate-[spin_22s_linear_infinite] [background:conic-gradient(from_0deg,transparent_0_70%,rgba(255,255,255,0.14)_80%,transparent_90%)]" />
            <div aria-hidden="true" className="ba-lines -z-[1] opacity-70" />
            <p className="m-0 font-[family-name:var(--ba-display)] text-[clamp(30px,3.2vw,44px)] font-bold leading-[1.02] tracking-[-0.045em]">
              {pick(SOBRE_WHY.manifestoLead, lang)}
              <span className="ba-serif mt-1 block text-[1.06em] font-normal leading-[1.05] text-white/95">{pick(SOBRE_WHY.manifestoAccent, lang)}</span>
            </p>
            <p className="m-0 mt-8 text-[15px] leading-[1.6] text-white/[0.86] sm:text-[16px]">{pick(SOBRE_WHY.manifestoNote, lang)}</p>
          </div>
        </div>

        {/* Mobile: trilho com rolagem lateral (o próximo cartão aparece pela borda); sm+: grade de 3.
            A revelação fica no trilho inteiro: cartões fora da tela na horizontal nunca cruzariam o observer.
            O pb cobre a sombra inteira do vidro (24px + 60px de blur): menos que isso, a rolagem a corta
            numa linha reta. O -mb devolve o espaço para o ritmo da seção não mudar. */}
        <ul className="ba-rv -mx-[var(--ba-gutter)] mt-4 flex snap-x snap-mandatory scroll-px-[var(--ba-gutter)] -mb-[72px] gap-3 overflow-x-auto px-[var(--ba-gutter)] pb-[88px] pt-1 sm:mb-0 sm:pt-0 [scrollbar-width:none] sm:mx-0 sm:mt-5 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {shorts.map((video) => (
            <li key={video.id} className="w-[80%] flex-none snap-start sm:w-auto">
              <SobreVideoTile
                id={video.id}
                title={pick(video.title, lang)}
                label={pick(video.title, lang)}
                eyebrow={`${watch} · ${video.duration}`}
                duration={withLanguageTag(video.duration, lang)}
                sizes="(max-width: 640px) 80vw, (max-width: 1280px) 31vw, 400px"
                playPosition="corner"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
