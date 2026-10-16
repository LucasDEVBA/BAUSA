import { Check, ListVideo, MapPin } from "lucide-react";

import { ESCOLAS_TEXT, LATEST_TOUR_ID, fill, getTourPoster, type SchoolTour } from "@/content/escolas";
import { pick } from "@/content/types";
import type { Lang } from "@/i18n";

import SchoolMark from "./SchoolMark";
import TourPoster from "./TourPoster";

/** A partir de qual largura o card ocupa duas colunas com vídeo e texto lado a lado. */
export type TourCardWide = "sm" | "lg";

interface TourCardProps {
  tour: SchoolTour;
  lang: Lang;
  /** Posição na grade, para escalonar a revelação por coluna. */
  index: number;
  wide?: TourCardWide;
}

// Classes literais por breakpoint: o Tailwind só gera o que encontra escrito no código
// O vídeo do card largo ocupa a altura toda da fileira (sem faixa vazia acima e abaixo do 16:9). Com
// object-cover numa caixa quase quadrada, a imagem precisa de ~altura x 16/9 de largura: daí o sizes maior
// que a coluna, senão o navegador baixa um arquivo estreito e amplia (pôster borrado)
const WIDE_LAYOUT: Record<TourCardWide, { card: string; media: string; video: string; body: string; sizes: string }> = {
  sm: {
    card: "sm:flex-row sm:items-stretch",
    media: "sm:w-[54%] sm:flex-none",
    video: "sm:!aspect-auto sm:h-full sm:min-h-[260px]",
    body: "sm:justify-center sm:px-6 sm:py-5 lg:px-8",
    sizes: "(max-width: 640px) 94vw, (max-width: 1024px) 66vw, 820px",
  },
  lg: {
    card: "lg:flex-row lg:items-stretch",
    media: "lg:w-[54%] lg:flex-none",
    video: "lg:!aspect-auto lg:h-full lg:min-h-[260px]",
    body: "lg:justify-center lg:px-8 lg:py-5",
    sizes: "(max-width: 640px) 94vw, (max-width: 1024px) 46vw, 820px",
  },
};

/**
 * Card de uma escola: tour 16:9, placa com logo, liga, local e os fatos do vídeo.
 * O card largo (duas colunas) põe vídeo e texto lado a lado e fecha a última fileira da grade.
 */
export default function TourCard({ tour, lang, index, wide }: TourCardProps) {
  const { school, video } = tour;
  const isLatest = video.id === LATEST_TOUR_ID;
  const layout = wide ? WIDE_LAYOUT[wide] : undefined;
  const poster = getTourPoster(school.slug);

  return (
    <article
      // Sem backdrop-filter: 18 camadas de desfoque na grade custam caro em Android de entrada, e o fundo aqui é liso
      className={`ba-glass ba-rv flex h-full flex-col rounded-[28px] !bg-white/[0.78] p-1.5 [-webkit-backdrop-filter:none] [backdrop-filter:none] ${layout?.card ?? ""}`}
      style={{ "--d": index % 3 } as React.CSSProperties}
      aria-labelledby={`tour-${school.slug}`}
    >
      <div className={layout?.media ?? ""}>
        <TourPoster
          id={video.id}
          kind={video.kind}
          title={pick(video.title, lang)}
          duration={video.duration}
          meta={pick(ESCOLAS_TEXT.videoLanguage, lang) || undefined}
          badge={isLatest ? pick(ESCOLAS_TEXT.latestShort, lang) : undefined}
          poster={poster?.image}
          position={poster?.position}
          sizes={layout?.sizes ?? "(max-width: 640px) 94vw, (max-width: 1024px) 46vw, 410px"}
          className={layout?.video ?? ""}
        />
      </div>

      <div className={`flex flex-1 flex-col px-3 pb-4 pt-4 sm:px-3.5 ${layout?.body ?? ""}`}>
        {/* Zoom de 200% (<300px): a placa de 92px deixava ~20px para o nome, uma letra por linha */}
        <div className="flex items-center gap-3.5 max-[299px]:flex-wrap">
          <SchoolMark school={school} />
          <div className="min-w-0">
            <h4 id={`tour-${school.slug}`} className="ba-h3 text-balance text-[18px] text-[var(--ba-navy)] sm:text-[19px]">
              {school.name}
            </h4>
            <p className="mt-1 flex items-center gap-1 text-[13px] font-medium text-[var(--ba-ink-3)]">
              <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              {school.location}
            </p>
          </div>
        </div>

        {(school.league || video.chapters) && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {school.league && (
              <span className="rounded-full bg-[rgba(31,63,163,0.07)] px-2.5 py-1 text-[11.5px] font-semibold tracking-[0.02em] text-[var(--ba-blue)]">
                {school.league}
              </span>
            )}
            {video.chapters && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(144,36,52,0.07)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ba-wine)]">
                <ListVideo className="h-3.5 w-3.5" aria-hidden="true" />
                {fill(pick(ESCOLAS_TEXT.chaptersCount, lang), { n: video.chapters.length })}
              </span>
            )}
          </div>
        )}

        <ul className="mt-3.5 space-y-2 border-t border-[var(--ba-stroke)] pt-3.5">
          {school.facts.map((fact) => (
            <li key={fact.pt} className="flex gap-2.5 text-[14px] leading-[1.42] text-[var(--ba-ink-2)]">
              <span aria-hidden="true" className="mt-[3px] grid h-4 w-4 flex-none place-items-center rounded-full bg-[linear-gradient(150deg,#3d61c8,var(--ba-blue))] text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              {pick(fact, lang)}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
