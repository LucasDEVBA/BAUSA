import type { StaticImageData } from "next/image";
import { ArrowUpRight, Clapperboard, Instagram, Play } from "lucide-react";

import bernardoMediaDay1 from "@/assets/instagram/bernardo-media-day-1.jpg";
import MeshBackground from "@/components/brand/MeshBackground";
import { ATHLETES, getAthleteTour } from "@/content/athletes";
import { HISTORIAS_PAGE } from "@/content/historias";
import { pick, type AthleteStory } from "@/content/types";
import { getVideo } from "@/content/videos";
import type { Lang } from "@/i18n";
import FocalImage, { type Focus } from "./FocalImage";
import { keepTogether } from "./keepTogether";
import MuralCtaCard from "./MuralCtaCard";
import PlayStoryButton from "./PlayStoryButton";
import SectionHeading from "./SectionHeading";

const TEXT = HISTORIAS_PAGE.mural;
const NEW_TAB = HISTORIAS_PAGE.conquistas.newTab;
const INSTAGRAM = HISTORIAS_PAGE.conquistas.instagram;

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

/** 1442 → "24:02", no formato dos capítulos do catálogo (o mesmo dos chips do tour). */
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** Recorte 4:5 de cada pôster, centrado no rosto (as artes têm texto e o atleta fora do centro). */
const FOCUS: Record<string, Focus> = {
  "isadora-santiago": { x: 0.62, y: 0.36, zoom: 1.2 },
  "andressa-macedo": { x: 0.64, y: 0.34, zoom: 1.35 },
  "sara-pedot": { x: 0.31, y: 0.56, zoom: 1.75 },
  "liz-valverde": { x: 0.62, y: 0.47, zoom: 1.15 },
  "bernardo-herdy": { x: 0.5, y: 0.4 },
  "benjamin-bertolucci": { x: 0.5, y: 0.4, zoom: 1.05 },
  "robson-moraes": { x: 0.5, y: 0.3, zoom: 1.2 },
  "lin-feng": { x: 0.46, y: 0.3, zoom: 1.2 },
  "helena-gennaro": { x: 0.5, y: 0.36 },
  "matheus-belcuo": { x: 0.56, y: 0.36, zoom: 1.1 },
  "julia-dinis": { x: 0.52, y: 0.42, zoom: 1.15 },
};

/*
 * A arte da Sports Illustrated já é o destaque da seção de conquistas logo acima; no mural o
 * Bernardo aparece com a foto do Media Day para a página não repetir a mesma imagem.
 */
const IMAGE_OVERRIDE: Record<string, { image: StaticImageData; alt: Record<Lang, string> }> = {
  "bernardo-herdy": {
    image: bernardoMediaDay1,
    alt: {
      pt: "Bernardo Herdy de uniforme de goleiro, com a bola no ombro, no painel da Hoosac School",
      en: "Bernardo Herdy in his goalkeeper kit, ball on his shoulder, in front of the Hoosac School backdrop",
      es: "Bernardo Herdy con el uniforme de portero y el balón al hombro, frente al panel de Hoosac School",
    },
  },
};

const ACTION =
  "flex min-h-11 w-full items-center gap-2 whitespace-nowrap px-1 text-left text-[12px] font-semibold transition-opacity duration-300 hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ba-blue-2)] sm:text-[13px]";
const ACTION_ICON = "grid h-6 w-6 flex-none place-items-center rounded-full text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:h-7 sm:w-7";

function AthleteActions({ athlete, lang }: { athlete: AthleteStory; lang: Lang }) {
  const video = athlete.videoId ? getVideo(athlete.videoId) : undefined;
  const tour = getAthleteTour(athlete.slug);
  if (!video && !tour && !athlete.instagram) return null;

  const testimonialLabel = pick(TEXT.testimonial, lang);
  const tourLabel = pick(TEXT.tour, lang);
  const instagramLabel = pick(INSTAGRAM, lang);

  return (
    <div className="mt-auto divide-y divide-[var(--ba-stroke)] border-t border-[var(--ba-stroke)] pt-1">
      {video && (
        <PlayStoryButton
          id={video.id}
          kind={video.kind}
          title={pick(video.title, lang)}
          ariaLabel={`${testimonialLabel}: ${athlete.name} (${video.duration})`}
          className={`${ACTION} text-[var(--ba-blue)]`}
        >
          <span aria-hidden="true" className={`${ACTION_ICON} bg-[linear-gradient(150deg,#3d61c8,var(--ba-blue))]`}>
            <Play className="ml-px h-3 w-3 fill-current" />
          </span>
          {testimonialLabel}
          <span className="ml-auto font-medium text-[var(--ba-ink-3)]">{video.duration}</span>
        </PlayStoryButton>
      )}
      {tour && (
        <PlayStoryButton
          id={tour.video.id}
          kind={tour.video.kind}
          title={pick(tour.video.title, lang)}
          start={tour.start}
          // Dois atletas da mesma escola tinham o mesmo nome acessível, e só um abre no minuto do atleta
          ariaLabel={`${tourLabel}: ${tour.school.name}, ${athlete.name}${tour.start ? ` (${pick(TEXT.tourFrom, lang)} ${clock(tour.start)})` : ""}`}
          className={`${ACTION} text-[var(--ba-navy)]`}
        >
          <span aria-hidden="true" className={`${ACTION_ICON} bg-[linear-gradient(140deg,var(--ba-blue-2),var(--ba-navy))]`}>
            <Clapperboard className="h-3 w-3" />
          </span>
          {tourLabel}
          {/* Só a partir de lg: em duas e três colunas "Tour de la escuela" + minuto estoura o card (ES) */}
          {tour.start ? <span className="ml-auto hidden font-medium text-[var(--ba-ink-3)] lg:inline">{clock(tour.start)}</span> : null}
        </PlayStoryButton>
      )}
      {athlete.instagram && (
        <a
          href={athlete.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${instagramLabel}: ${athlete.name} (${pick(NEW_TAB, lang)})`}
          className={`${ACTION} text-[var(--ba-wine)]`}
        >
          <span aria-hidden="true" className={`${ACTION_ICON} bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))]`}>
            <Instagram className="h-3 w-3" />
          </span>
          {instagramLabel}
          <ArrowUpRight className="ml-auto hidden h-3.5 w-3.5 flex-none text-[var(--ba-ink-3)] sm:block" aria-hidden="true" />
        </a>
      )}
    </div>
  );
}

function AthleteCard({ athlete, lang, index }: { athlete: AthleteStory; lang: Lang; index: number }) {
  const override = IMAGE_OVERRIDE[athlete.slug];
  const image = override?.image ?? athlete.image;
  const alt = override ? override.alt[lang] : pick(athlete.imageAlt, lang);

  return (
    <article
      className="ba-rv-scale flex h-full flex-col rounded-[22px] border border-white/80 bg-white/70 p-[5px] shadow-[inset_0_1px_0_#fff,inset_0_-1px_0_rgba(31,63,163,0.06),var(--ba-shadow)] sm:rounded-[28px] sm:p-[7px]"
      style={delay(index % 4)}
      aria-labelledby={`atleta-${athlete.slug}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] bg-[var(--ba-navy-2)] sm:rounded-[22px]">
        <FocalImage
          src={image}
          alt={alt}
          focus={FOCUS[athlete.slug] ?? { x: 0.5, y: 0.35 }}
          frameRatio={1.25}
          sizes="(max-width: 640px) 80vw, (max-width: 1024px) 50vw, 440px"
        />
        <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,69,0)_30%,rgba(6,15,42,0.55)_52%,rgba(6,15,42,0.9)_74%,rgba(6,15,42,0.97)_100%)]" />
        {athlete.position && (
          <span className="absolute left-2 top-2 rounded-full bg-[rgba(10,26,69,0.78)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] sm:left-3 sm:top-3 sm:text-[10.5px]">
            {pick(athlete.position, lang)}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-4">
          <h3 id={`atleta-${athlete.slug}`} className="font-[family-name:var(--ba-display)] text-[15px] font-semibold leading-[1.15] tracking-[-0.02em] sm:text-[18px]">
            {athlete.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-[11.5px] font-medium leading-snug text-white/80 sm:text-[12.5px]">{keepTogether(athlete.school)}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-1.5 pb-0.5 pt-3 sm:px-2.5 sm:pt-4">
        <p className="text-[12.5px] leading-[1.45] text-[var(--ba-ink-2)] sm:text-[14px]">{keepTogether(pick(athlete.headline, lang))}</p>
        <AthleteActions athlete={athlete} lang={lang} />
      </div>
    </article>
  );
}

/** Mural de atletas: todos do catálogo, sem página individual (menores de idade). */
export default function AthleteWall({ lang }: { lang: Lang }) {
  return (
    <section id="atletas" className="relative isolate scroll-mt-20 overflow-clip pb-[clamp(40px,5vw,72px)] pt-[clamp(80px,10vw,140px)]" aria-labelledby="atletas-title">
      <MeshBackground
        blobs={["b1", "b3", "b4"]}
        className="[mask-image:linear-gradient(180deg,transparent,#000_10%,#000_80%,transparent)] [&_.ba-b1]:!top-[2%] [&_.ba-b3]:!left-[60vw] [&_.ba-b3]:!top-[40%] [&_.ba-b3]:!opacity-30"
      />

      <div className="ba-wrap relative z-[2]">
        <SectionHeading
          id="atletas-title"
          eyebrow={pick(TEXT.eyebrow, lang)}
          titleLead={pick(TEXT.titleLead, lang)}
          titleAccent={pick(TEXT.titleAccent, lang)}
          lead={pick(TEXT.lead, lang)}
        />

        <ul className="mt-10 grid grid-cols-2 gap-2.5 sm:mt-14 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {ATHLETES.map((athlete, index) => (
            <li key={athlete.slug}>
              <AthleteCard athlete={athlete} lang={lang} index={index} />
            </li>
          ))}
          <li className="ba-rv-scale" style={delay(3)}>
            <MuralCtaCard title={pick(TEXT.ctaTitle, lang)} action={pick(TEXT.ctaAction, lang)} />
          </li>
        </ul>
      </div>
    </section>
  );
}
