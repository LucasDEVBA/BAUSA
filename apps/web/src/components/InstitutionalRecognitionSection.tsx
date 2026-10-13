"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Clock, GraduationCap, MapPin, Play, School } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";

import BrandCta from "@/components/brand/BrandCta";
import { useVideoPlayer } from "@/components/brand/VideoPlayer";
import CoachMoments from "@/components/pages/escolas/CoachMoments";
import { PAGE_PATH } from "@/config/routes";
import {
  ESCOLAS_TEXT,
  HOME_HIGH_SCHOOL_TOURS,
  HOME_MOMENTS_COUNT,
  HOME_UNIVERSITY_TOURS,
  LATEST_TOUR_ID,
  SCHOOL_TOURS,
  fill,
  getTourPoster,
  toursByType,
  type SchoolTour,
} from "@/content/escolas";
import { pick } from "@/content/types";
import { COACH_MOMENTS } from "@/content/videos";
import { useLanguage } from "@/i18n";

const HOME_MOMENTS = COACH_MOMENTS.slice(0, HOME_MOMENTS_COUNT);

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

const arrowButton =
  "ba-glass-dark grid h-11 w-11 place-items-center rounded-full text-white transition-[background-color,opacity,transform] duration-300 hover:-translate-y-0.5 hover:bg-white/[0.16] focus-visible:outline-[2.5px] focus-visible:outline-offset-2 focus-visible:outline-[#b8caf7] disabled:pointer-events-none disabled:opacity-30";

const InstitutionCard = ({ tour }: { tour: SchoolTour }) => {
  const { t, lang } = useLanguage();
  const { open } = useVideoPlayer();
  const { school, video } = tour;
  const isUniversity = school.type === "universidade";
  const isLatest = video.id === LATEST_TOUR_ID;
  const typeLabel = isUniversity ? t("landing.institutionalRecognition.typeUniversity") : t("landing.institutionalRecognition.typePrepSchool");
  const poster = getTourPoster(school.slug);
  const title = pick(video.title, lang);

  return (
    // Vidro sem backdrop-filter: dentro do trilho transformado do embla o desfoque pintava um retângulo
    // claro do tamanho do viewport atrás dos cartões; sobre o navy o efeito visual é o mesmo.
    <article className="group h-full rounded-[24px] border border-white/[0.14] bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_30px_70px_-30px_rgba(0,0,0,0.6)] p-[6px] transition-[transform,background-color] duration-700 [transition-timing-function:var(--ba-ease)] hover:bg-white/[0.1] sm:rounded-[30px] sm:p-2" data-tilt>
      <button
        type="button"
        onClick={() => open({ id: video.id, kind: video.kind, title })}
        aria-label={`${pick(ESCOLAS_TEXT.watchTour, lang)}: ${school.name}, ${school.location} (${video.duration})`}
        className="relative block aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-[19px] text-left focus-visible:outline-[2.5px] focus-visible:outline-offset-[-4px] focus-visible:outline-white sm:rounded-[23px]"
      >
        {poster && (
          <Image
            src={poster.image}
            alt=""
            fill
            sizes="(max-width: 640px) 85vw, (max-width: 768px) 55vw, 560px"
            className="object-cover transition-transform duration-[1200ms] [transition-timing-function:var(--ba-ease)] group-hover:scale-[1.05]"
            style={{ objectPosition: poster.position ?? "center" }}
          />
        )}
        <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,15,42,0.4)_0%,rgba(6,15,42,0)_30%,rgba(6,15,42,0.15)_55%,rgba(6,15,42,0.9)_100%)]" />

        {/* Topo: tipo da instituição + gravação (o tour mais novo troca o REC pelo selo "Novo") */}
        <span aria-hidden="true" className="absolute inset-x-3 top-3 flex items-center justify-between gap-2 sm:inset-x-4 sm:top-4">
          <span
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10.5px] font-bold tracking-[0.12em] text-white sm:text-[11px] ${
              isUniversity
                ? "bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_20px_-8px_rgba(144,36,52,0.8)]"
                : "ba-glass-dark"
            }`}
          >
            {typeLabel}
          </span>
          {isLatest ? (
            <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-[5px] text-[var(--ba-wine)] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.5)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--ba-wine-2)]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{pick(ESCOLAS_TEXT.latestShort, lang)}</span>
            </span>
          ) : (
            <span className="ba-glass-dark flex items-center gap-1.5 rounded-full px-2.5 py-[5px]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff5a6e]" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white">REC</span>
            </span>
          )}
        </span>

        {/* Base: nome, local, duração e play em vidro */}
        <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
          <span className="min-w-0">
            <span className="block truncate font-[family-name:var(--ba-display)] text-[18px] font-semibold leading-tight tracking-[-0.025em] text-white sm:text-[22px] md:text-[24px]">
              {school.name}
            </span>
            <span className="mt-1 flex items-center gap-3 text-[12.5px] text-white/80 sm:text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 flex-none" />
                <span className="truncate">{school.location}</span>
              </span>
              <span className="flex flex-none items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {video.duration}
              </span>
            </span>
          </span>
          <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_0_0_1px_rgba(255,255,255,0.3)] backdrop-blur-md transition-transform duration-500 [transition-timing-function:var(--ba-ease)] group-hover:scale-110 sm:h-14 sm:w-14">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(180deg,#fff,#e6ecfb)] sm:h-10 sm:w-10">
              <Play className="ml-0.5 h-4 w-4 fill-[var(--ba-navy)] text-[var(--ba-navy)]" />
            </span>
          </span>
        </span>
      </button>
    </article>
  );
};

interface InstitutionCarouselProps {
  title: string;
  icon: LucideIcon;
  tours: SchoolTour[];
  /** Total do tipo no acervo (o carrossel mostra uma seleção). */
  total: number;
}

const InstitutionCarousel = ({ title, icon: Icon, tours, total }: InstitutionCarouselProps) => {
  const { t } = useLanguage();
  // Slides a 45% no desktop: 2 cards inteiros + pedaço do próximo visível:
  // o corte é o affordance de que a fileira é um carrossel.
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragThreshold: 20,
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="ba-rv">
      <div className="mb-5 flex items-center gap-3 sm:mb-7 sm:gap-4">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[linear-gradient(150deg,rgba(255,255,255,0.22),rgba(255,255,255,0.06))] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:h-11 sm:w-11 sm:rounded-[14px]">
          <Icon className="h-[19px] w-[19px] text-[#dbe5ff]" aria-hidden="true" />
        </span>
        <h3 className="ba-h3 whitespace-nowrap text-[20px] text-white sm:text-[24px]">{title}</h3>
        <span className="text-xs font-semibold tracking-[0.14em] text-white/[0.62]">{String(total).padStart(2, "0")}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-[linear-gradient(90deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />
        <div className="flex flex-none items-center gap-2">
          <button type="button" onClick={() => emblaApi?.scrollPrev()} disabled={!canPrev} aria-label={t("landing.institutionalRecognition.carouselPrev")} className={arrowButton}>
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          <button type="button" onClick={() => emblaApi?.scrollNext()} disabled={!canNext} aria-label={t("landing.institutionalRecognition.carouselNext")} className={arrowButton}>
            <ChevronRight className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* Respiro no viewport (maior embaixo, onde a sombra cai) para a sombra dos cartões não ser cortada em linha reta */}
      <div className="-mb-20 -mt-5 touch-pan-y overflow-hidden pb-20 pt-5" ref={emblaRef}>
        <div className="flex touch-pan-y gap-4 sm:gap-6">
          {tours.map((tour) => (
            <div key={tour.school.slug} className="min-w-0 flex-[0_0_85%] sm:flex-[0_0_55%] md:flex-[0_0_45%]">
              <InstitutionCard tour={tour} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Teaser dos tours na home: seleção de high schools e universidades (dados de
 * schools.ts/videos.ts), três trechos de treinadores e a porta para /escolas.
 */
const InstitutionalRecognitionSection = () => {
  const { t, lang } = useLanguage();
  const highSchoolTotal = toursByType("high_school").length;
  const universityTotal = toursByType("universidade").length;

  return (
    // Emenda com a Autoridade: sobe sobre o padding inferior dela com um degradê transparente→navy, para os halos
    // dela se dissolverem no navy daqui sem costura; fecha o capítulo escuro com cantos inferiores arredondados.
    <section
      id="instituicoes"
      className="relative isolate -mt-10 overflow-hidden rounded-b-[clamp(28px,4vw,48px)] bg-[linear-gradient(180deg,rgba(10,26,69,0)_0px,var(--ba-navy-2)_40px)] pb-[clamp(80px,10vw,140px)] pt-[clamp(96px,10vw,200px)] text-white sm:-mt-20 sm:bg-[linear-gradient(180deg,rgba(10,26,69,0)_0px,var(--ba-navy-2)_80px)] lg:-mt-[120px] lg:bg-[linear-gradient(180deg,rgba(10,26,69,0)_0px,var(--ba-navy-2)_120px)]"
      aria-labelledby="instituicoes-title"
    >
      <div aria-hidden="true" className="ba-glow left-[38%] top-[220px] h-[520px] w-[520px] bg-[rgba(31,63,163,0.45)]" />
      <div aria-hidden="true" className="ba-glow right-[-200px] top-[200px] h-[440px] w-[440px] bg-[rgba(144,36,52,0.32)]" />
      <div aria-hidden="true" className="ba-glow bottom-[-200px] left-[-160px] h-[560px] w-[560px] bg-[rgba(144,36,52,0.42)]" />
      <div aria-hidden="true" className="ba-glow bottom-[10%] right-[-180px] h-[460px] w-[460px] bg-[rgba(71,107,192,0.4)]" />
      <div aria-hidden="true" className="ba-lines [mask-image:radial-gradient(ellipse_70%_60%_at_20%_30%,#000,transparent_75%)]" />

      <div className="ba-wrap relative z-[2]">
        <div className="mb-[clamp(44px,6vw,80px)] grid items-end gap-6 border-t border-white/[0.1] pt-[clamp(40px,4.5vw,64px)] lg:grid-cols-[1.3fr_1fr] lg:gap-16">
          <div>
            <span className="ba-eyebrow ba-glass-dark ba-rv !text-[#cfdcff]">
              <span className="ba-dot" />
              {t("landing.institutionalRecognition.badge")}
            </span>
            <h2 id="instituicoes-title" className="ba-h2 ba-rv mt-5 text-[clamp(32px,4.6vw,60px)] text-white" style={delay(1)}>
              {t("landing.institutionalRecognition.title1")} <span className="ba-grad-text-dark">{t("landing.institutionalRecognition.title2")}</span>
            </h2>
          </div>
          <p className="ba-rv max-w-[440px] text-[clamp(15.5px,1.25vw,18px)] leading-[1.62] text-[rgba(232,238,255,0.84)] lg:mb-2 lg:border-l lg:border-white/[0.14] lg:pl-8" style={delay(2)}>
            {t("landing.institutionalRecognition.subtitle")}
          </p>
        </div>

        <div className="space-y-[clamp(48px,6vw,80px)]">
          {/* Mesmos rótulos de /escolas: o dicionário dizia "Faculdades" aqui e a página do acervo diz "Universidades" */}
          <InstitutionCarousel title={pick(ESCOLAS_TEXT.groupHighSchools, lang)} icon={School} tours={HOME_HIGH_SCHOOL_TOURS} total={highSchoolTotal} />
          <InstitutionCarousel title={pick(ESCOLAS_TEXT.groupUniversities, lang)} icon={GraduationCap} tours={HOME_UNIVERSITY_TOURS} total={universityTotal} />
        </div>

        <div className="mt-[clamp(56px,7vw,96px)]">
          <div className="ba-rv mb-1 flex items-center gap-3 sm:gap-4">
            <span className="ba-pulse" aria-hidden="true" />
            <h3 className="ba-h3 text-[20px] text-white sm:text-[24px]">{pick(ESCOLAS_TEXT.homeMomentsTitle, lang)}</h3>
            <span aria-hidden="true" className="h-px flex-1 bg-[linear-gradient(90deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />
          </div>
          <div className="ba-rv" style={delay(1)}>
            <CoachMoments moments={HOME_MOMENTS} label={pick(ESCOLAS_TEXT.homeMomentsTitle, lang)} />
          </div>
        </div>

        <div className="ba-rv mt-[clamp(36px,5vw,56px)] flex flex-col items-center gap-4 text-center" style={delay(1)}>
          <BrandCta href={PAGE_PATH.escolas} variant="light">
            {fill(pick(ESCOLAS_TEXT.homeAllTours, lang), { n: SCHOOL_TOURS.length })}
          </BrandCta>
          <p className="text-[13.5px] font-medium text-[rgba(232,238,255,0.8)] sm:text-[14.5px]">
            {fill(pick(ESCOLAS_TEXT.homeAllToursNote, lang), { hs: highSchoolTotal, uni: universityTotal })}
          </p>
        </div>
      </div>
    </section>
  );
};

export default InstitutionalRecognitionSection;
