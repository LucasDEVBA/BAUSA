import { CircleCheck, MapPin } from "lucide-react";

import leandroHarvard from "@/assets/leandro-harvard.jpg";
import BrandCta from "@/components/brand/BrandCta";
import VideoCard from "@/components/brand/VideoCard";
import { PAGE_PATH } from "@/config/routes";
import type { Lang } from "@/i18n";
import { SOBRE_HARVARD, SOBRE_VIDEOS } from "@/content/sobre";
import { getSchool } from "@/content/schools";
import { pick } from "@/content/types";
import { getVideo } from "@/content/videos";

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

interface SobreHarvardProps {
  lang: Lang;
  /** "Reconhecido por diretores, escolas e treinadores universitários." (texto do site). */
  recognition: string;
}

/** "Dentro de Harvard": o tour como prova de acesso direto a quem decide. */
export default function SobreHarvard({ lang, recognition }: SobreHarvardProps) {
  const video = getVideo(SOBRE_VIDEOS.harvard);
  const school = getSchool("harvard");
  if (!video || !school) return null;

  return (
    <section className="ba-dark relative isolate overflow-hidden rounded-[clamp(28px,4vw,48px)] py-[clamp(72px,9vw,128px)]" aria-labelledby="harvard-title">
      <div aria-hidden="true" className="ba-glow left-[-200px] top-[-160px] h-[560px] w-[560px] animate-[ba-drift1_30s_ease-in-out_infinite_alternate] bg-[rgba(144,36,52,0.5)]" />
      <div aria-hidden="true" className="ba-glow bottom-[-200px] right-[-160px] h-[600px] w-[600px] animate-[ba-drift3_34s_ease-in-out_infinite_alternate] bg-[rgba(71,107,192,0.5)]" />
      <div aria-hidden="true" className="ba-lines" />

      <div className="ba-wrap relative z-[2] grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-x-[clamp(40px,5vw,80px)] lg:gap-y-7">
        {/* Mobile: texto, vídeo e depois os detalhes; desktop: texto e detalhes à esquerda, vídeo à direita.
            No desktop o cartão fica 5:4: a foto é retrato e o 16:9 deixava um vazio sob o vídeo. */}
        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:self-end">
          <span className="ba-eyebrow ba-glass-dark ba-rv !text-[#cfdcff]">
            <span className="ba-dot" />
            {pick(SOBRE_HARVARD.eyebrow, lang)}
          </span>
          <h2 id="harvard-title" className="ba-rv mt-6 font-[family-name:var(--ba-display)] text-[clamp(40px,5vw,68px)] font-bold leading-[1.02] tracking-[-0.045em]" style={delay(1)}>
            {pick(SOBRE_HARVARD.titleLead, lang)} <span className="ba-serif ba-grad-text-dark text-[1.1em] font-normal">Harvard.</span>
          </h2>
          <p className="ba-rv mt-6 max-w-[540px] text-[clamp(15.5px,1.2vw,17.5px)] leading-[1.66] text-[rgba(232,238,255,0.84)]" style={delay(2)}>
            {pick(SOBRE_HARVARD.lead, lang)}
          </p>
        </div>

        <div className="ba-rv-scale lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1" style={delay(2)}>
          <div className="ba-glass-dark rounded-[30px] p-2 sm:rounded-[34px] sm:p-2.5" data-tilt>
            <VideoCard
              id={video.id}
              kind={video.kind}
              title={pick(video.title, lang)}
              duration={video.duration}
              meta={`${school.name} · ${school.location}`}
              poster={leandroHarvard}
              sizes="(max-width: 640px) 92vw, (max-width: 1024px) 90vw, 720px"
              className="!aspect-[4/5] !rounded-[23px] sm:!aspect-video sm:!rounded-[26px] lg:!aspect-[5/4] [&_img]:object-[50%_30%]"
            />
          </div>
        </div>

        <div className="lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:self-start">
          <ul className="m-0 grid gap-2.5 p-0" role="list">
            {school.facts.map((fact, index) => (
              <li key={fact.pt} className="ba-glass-dark ba-rv flex items-center gap-3 rounded-[18px] px-4 py-3.5 text-[15px] font-medium leading-[1.4]" style={delay(3 + index)}>
                <CircleCheck className="h-5 w-5 flex-none text-[#b8caf7]" aria-hidden="true" />
                {pick(fact, lang)}
              </li>
            ))}
          </ul>

          <div className="ba-rv mt-6 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold text-white/[0.82]" style={delay(5)}>
            {school.league && <span className="rounded-full border border-white/[0.16] px-3 py-1.5">{school.league}</span>}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.16] px-3 py-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {school.location}
            </span>
          </div>

          <div className="ba-rv mt-8 flex flex-col gap-4 border-t border-white/[0.12] pt-7 sm:flex-row sm:items-center sm:justify-between lg:flex-col lg:items-start" style={delay(6)}>
            <p className="m-0 max-w-[340px] text-[13.5px] font-medium leading-[1.45] text-[rgba(232,238,255,0.76)]">{recognition}</p>
            <BrandCta variant="light" href={PAGE_PATH.escolas} className="w-full sm:w-auto">
              {pick(SOBRE_HARVARD.allTours, lang)}
            </BrandCta>
          </div>
        </div>
      </div>
    </section>
  );
}
