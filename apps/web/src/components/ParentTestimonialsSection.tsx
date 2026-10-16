"use client";

import Image, { type StaticImageData } from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";

import { useLanguage } from "@/i18n";
import paiBento from "@/assets/PAI-BENTO.jpeg";
import maeIsadora from "@/assets/MAE-ISADORA.jpeg";
import priscilaMoraes from "@/assets/PRISCILA-MORAES.jpeg";
import GabrielMachado from "@/assets/GABRIEL-MACHADO.jpeg";
import comperlingo from "@/assets/Comperlingo.jpeg";
import paiLizValverde from "@/assets/paiLizValverde.jpg";
import FocalImage, { type Focus } from "@/components/pages/historias/FocalImage";
import { PAGE_PATH } from "@/config/routes";
import { FAMILY_STORIES, HOME_STORIES_TEXT, type FamilyStory } from "@/content/historias";
import { pick, type YoutubeVideo } from "@/content/types";
import { FAMILY_TESTIMONIALS } from "@/content/videos";
import BrandCta from "./brand/BrandCta";
import MeshBackground from "./brand/MeshBackground";
import { useVideoPlayer } from "./brand/VideoPlayer";

// Artes "Experiência da família" publicadas com cada vídeo: pôster local, sem depender do YouTube
const POSTERS: Record<string, StaticImageData> = {
  wJUf_efdc8s: paiLizValverde,
  "1WDFoyA5p8U": paiBento,
  enS5ZAGRJ0g: maeIsadora,
  KFkoxh4nTHU: priscilaMoraes,
  "8RtvPgeZ8yI": GabrielMachado,
  lXzJkGgZkTw: comperlingo,
};

// Rosto de cada arte no selo de avatares: o topo das artes é o título "Experiência da família"
const AVATAR_FOCUS: Record<string, Focus> = {
  enS5ZAGRJ0g: { x: 0.46, y: 0.52, zoom: 2 },
  wJUf_efdc8s: { x: 0.52, y: 0.42, zoom: 2.3 },
  "1WDFoyA5p8U": { x: 0.58, y: 0.52, zoom: 1.7 },
  "8RtvPgeZ8yI": { x: 0.5, y: 0.36, zoom: 2.3 },
  KFkoxh4nTHU: { x: 0.45, y: 0.5, zoom: 1.6 },
  lXzJkGgZkTw: { x: 0.45, y: 0.5, zoom: 2 },
};
const DEFAULT_AVATAR_FOCUS: Focus = { x: 0.5, y: 0.5, zoom: 2 };
const AVATAR_SIZE = 40;

interface ParentTestimonial {
  video: YoutubeVideo;
  story: FamilyStory;
  thumbnail: StaticImageData;
}

const parentTestimonials: ParentTestimonial[] = FAMILY_TESTIMONIALS.flatMap((video) => {
  const story = FAMILY_STORIES[video.id];
  const thumbnail = POSTERS[video.id];
  return story && thumbnail ? [{ video, story, thumbnail }] : [];
});

// Mosaico em 3 colunas desencontradas (a do meio desce): ritmo de mural, não de grade.
const MOSAIC_COLUMNS = [
  { indexes: [0, 3], offset: "" },
  { indexes: [1, 4], offset: "translate-y-16" },
  { indexes: [2, 5], offset: "-translate-y-6" },
];

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

const arrowButton =
  "ba-glass grid h-11 w-11 place-items-center rounded-full text-[var(--ba-navy)] transition-[transform,opacity,background-color] duration-300 hover:-translate-y-0.5 hover:bg-white/90 focus-visible:outline-[2.5px] focus-visible:outline-offset-2 focus-visible:outline-[var(--ba-blue-2)] disabled:pointer-events-none disabled:opacity-35";

interface ParentVideoCardProps {
  testimonial: ParentTestimonial;
  className?: string;
}

// Moldura translúcida sem backdrop-filter: no trilho rolável o desfoque pintava um retângulo atrás dos cartões.
const ParentVideoCard = ({ testimonial, className = "" }: ParentVideoCardProps) => {
  const { t, lang } = useLanguage();
  const { open } = useVideoPlayer();
  const { video, story, thumbnail } = testimonial;
  const familyName = pick(story.family, lang);
  const videoLabel = `${t("landing.testimonials.videoTitle")}: ${familyName}, ${pick(story.relation, lang)} (${video.duration})`;
  // kind do catálogo: o depoimento 16:9 (Comperlingo) abre no player horizontal, sem faixas pretas
  const play = () => open({ id: video.id, kind: video.kind, title: pick(video.title, lang) });

  return (
    <div className={`parent-testimonial-card group rounded-[26px] border border-white/80 bg-white/70 shadow-[inset_0_1px_0_#fff,inset_0_-1px_0_rgba(31,63,163,0.06),var(--ba-shadow)] p-[6px] transition-shadow duration-700 [transition-timing-function:var(--ba-ease)] hover:shadow-[var(--ba-shadow-lg)] sm:rounded-[28px] sm:p-[7px] ${className}`} data-tilt>
      <div className="relative aspect-[9/16] overflow-hidden rounded-[21px] bg-[var(--ba-navy-2)] sm:rounded-[22px]">
        <button type="button" onClick={play} aria-label={videoLabel} className="absolute inset-0 block h-full w-full cursor-pointer text-left focus-visible:outline-[2.5px] focus-visible:outline-offset-[-4px] focus-visible:outline-white">
          <Image
            src={thumbnail}
            alt=""
            fill
            sizes="(max-width: 1024px) 240px, 300px"
            className="object-cover transition-transform duration-[1200ms] [transition-timing-function:var(--ba-ease)] group-hover:scale-[1.05]"
          />
          {/* Base mais fechada: as artes têm "+BAU+ +FAMÍLIA+ +SONHO+" no rodapé, que vazava por baixo do nome */}
          <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,69,0.25)_0%,rgba(10,26,69,0)_22%,rgba(10,26,69,0)_50%,rgba(6,15,42,0.78)_78%,rgba(6,15,42,0.97)_100%)]" />

          <span className="ba-glass-dark absolute left-3 top-3 flex items-center gap-1.5 rounded-full !bg-[rgba(10,26,69,0.55)] px-2.5 py-[5px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff5a6e]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white">REC</span>
          </span>

          <span className="absolute inset-x-0 bottom-0 block p-4 sm:p-5">
            <span aria-hidden="true" className="ba-serif block text-[54px] leading-[0.55] text-white/55">
              “
            </span>
            <span className="mt-2 flex items-end justify-between gap-3">
              <span className="min-w-0 font-[family-name:var(--ba-display)] text-[16px] font-semibold leading-[1.15] tracking-[-0.02em] text-white sm:text-[18px]">
                {familyName}
              </span>
              <span aria-hidden="true" className="grid h-11 w-11 flex-none place-items-center rounded-full bg-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_0_0_1px_rgba(255,255,255,0.3)] backdrop-blur-md transition-transform duration-500 [transition-timing-function:var(--ba-ease)] group-hover:scale-110 sm:h-12 sm:w-12">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(180deg,#fff,#e6ecfb)] sm:h-9 sm:w-9">
                  <Play className="ml-0.5 h-3.5 w-3.5 fill-[var(--ba-navy)] text-[var(--ba-navy)]" />
                </span>
              </span>
            </span>
            <span className="relative mt-3.5 block h-[3px] w-full overflow-hidden rounded-full bg-white/20">
              <motion.span
                initial={{ width: "30%" }}
                whileHover={{ width: "100%" }}
                transition={{ duration: 0.5 }}
                className="absolute inset-y-0 left-0 block rounded-full bg-[linear-gradient(90deg,#b8caf7,#f0b1bb)]"
              />
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

const ParentTestimonialsSection = () => {
  const { t, lang } = useLanguage();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  const rafRef = useRef<number>(0);

  // Mosaico e trilho nunca coexistem no DOM (o trilho mede os próprios cartões); null até montar
  // para a hidratação não reaproveitar o DOM do outro ramo.
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Passo = largura real do cartão + gap, medido no DOM (o cartão muda de tamanho por breakpoint).
  const getCardStep = useCallback(() => {
    const track = scrollContainerRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return 1;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return first.offsetWidth + gap;
  }, []);

  const checkScrollability = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        const computed = Math.round(scrollLeft / getCardStep());
        setActiveCardIndex(Math.min(Math.max(computed, 0), parentTestimonials.length - 1));
      }
      rafRef.current = 0;
    });
  }, [getCardStep]);

  useEffect(() => {
    checkScrollability();
    window.addEventListener("resize", checkScrollability);
    return () => {
      window.removeEventListener("resize", checkScrollability);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [checkScrollability, isDesktop]);

  const scroll = (direction: "left" | "right") => {
    const step = getCardStep();
    scrollContainerRef.current?.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" });
  };

  const cardProps = (index: number) => ({ testimonial: parentTestimonials[index] });

  // overflow-clip (não hidden): hidden vira contêiner de rolagem e desliga o sticky do cabeçalho.
  return (
    <section className="relative isolate overflow-clip py-[clamp(80px,10vw,140px)]" aria-labelledby="familias-title">
      {/* Topo esmaecido: os cantos arredondados da seção escura acima revelam o fundo da página sem a malha */}
      <MeshBackground blobs={["b1", "b2", "b3"]} grid className="[mask-image:linear-gradient(180deg,transparent,#000_12%)] [&_.ba-b1]:!top-[-10vw] [&_.ba-b3]:!left-[55vw] [&_.ba-b3]:!top-[50%] [&_.ba-b3]:!opacity-35" />

      <div className="ba-wrap relative z-[2] grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)] lg:gap-[clamp(40px,5vw,88px)]">
        {/* Cabeçalho fixo à esquerda enquanto o mural rola no desktop */}
        <div className="lg:sticky lg:top-32 lg:self-start lg:pt-10">
          <span className="ba-eyebrow ba-glass ba-rv">
            <span className="ba-dot" />
            {t("landing.parentTestimonials.badge")}
          </span>
          <h2 id="familias-title" className="ba-h2 ba-rv mt-5 text-[clamp(32px,4.4vw,58px)] text-[var(--ba-navy)]" style={delay(1)}>
            {t("landing.parentTestimonials.title1")} <span className="ba-serif text-[1.08em] text-[var(--ba-wine)]">{t("landing.parentTestimonials.title2")}</span>.
          </h2>
          <p className="ba-lead ba-rv mt-5 max-w-[420px]" style={delay(2)}>
            {t("landing.parentTestimonials.subtitle")}
          </p>

          {/* Selo das famílias: rostos sobrepostos, atalho visual para o mural */}
          <div className="ba-glass ba-rv mt-8 inline-flex items-center gap-4 rounded-full py-2 pl-2 pr-5" style={delay(3)} aria-hidden="true">
            <div className="flex -space-x-3">
              {parentTestimonials.slice(0, 4).map((item) => {
                const focus = AVATAR_FOCUS[item.video.id] ?? DEFAULT_AVATAR_FOCUS;
                return (
                  <span key={item.video.id} className="relative h-10 w-10 overflow-hidden rounded-full bg-[var(--ba-navy-2)] shadow-[0_0_0_2.5px_#fff,0_6px_14px_-6px_rgba(15,35,87,0.5)]">
                    <FocalImage src={item.thumbnail} alt="" focus={focus} frameRatio={1} sizes={`${Math.ceil(AVATAR_SIZE * (focus.zoom ?? 1))}px`} />
                  </span>
                );
              })}
            </div>
            <span className="font-[family-name:var(--ba-display)] text-[22px] font-bold tracking-[-0.03em] text-[var(--ba-navy)]">+{parentTestimonials.length}</span>
          </div>

          <div className="ba-rv mt-6 hidden lg:block" style={delay(4)}>
            <BrandCta href={PAGE_PATH.historias} variant="ghost">
              {pick(HOME_STORIES_TEXT.seeAllStories, lang)}
              <ArrowRight aria-hidden="true" />
            </BrandCta>
          </div>
        </div>

        {isDesktop === null ? (
          <div className="min-h-[520px]" aria-hidden="true" />
        ) : isDesktop ? (
          <div key="mosaic" className="grid grid-cols-3 gap-5 pb-16 xl:gap-6">
            {MOSAIC_COLUMNS.map((column, columnIndex) => (
              <div key={columnIndex} className={`flex flex-col gap-5 xl:gap-6 ${column.offset}`}>
                {column.indexes.map((index, row) => (
                  <div key={parentTestimonials[index].video.id} className="ba-rv-scale" style={delay(columnIndex + row * 2)}>
                    <ParentVideoCard {...cardProps(index)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div key="track" className="min-w-0">
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="flex items-center gap-1 text-xs font-medium text-[var(--ba-ink-3)] sm:hidden">
                <span>{t("landing.parentTestimonials.swipeHint")}</span>
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </p>
              <div className="ml-auto hidden items-center gap-2 sm:flex">
                <button type="button" onClick={() => scroll("left")} disabled={!canScrollLeft} aria-label={t("landing.institutionalRecognition.carouselPrev")} className={arrowButton}>
                  <ChevronLeft className="h-[18px] w-[18px]" />
                </button>
                <button type="button" onClick={() => scroll("right")} disabled={!canScrollRight} aria-label={t("landing.institutionalRecognition.carouselNext")} className={arrowButton}>
                  <ChevronRight className="h-[18px] w-[18px]" />
                </button>
              </div>
            </div>

            {/* Trilho com scroll-snap sangrando até a borda da tela */}
            <div
              ref={scrollContainerRef}
              onScroll={checkScrollability}
              className="scrollbar-hide -mx-[var(--ba-gutter)] -mb-16 -mt-6 flex snap-x snap-mandatory touch-pan-x gap-3 overflow-x-auto scroll-smooth px-[var(--ba-gutter)] pb-16 pt-6 [scroll-padding-inline:var(--ba-gutter)] sm:gap-5"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {parentTestimonials.map((testimonial, index) => (
                <div key={testimonial.video.id} className="w-[min(62vw,240px)] flex-none snap-start sm:w-[260px]">
                  <ParentVideoCard {...cardProps(index)} />
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-center gap-1.5 sm:gap-2" aria-hidden="true">
              {parentTestimonials.map((testimonial, index) => (
                <div
                  key={testimonial.video.id}
                  className={`h-1.5 rounded-full transition-all duration-300 ${index === activeCardIndex ? "w-5 bg-[var(--ba-wine)]" : "w-1.5 bg-[rgba(31,63,163,0.22)]"}`}
                />
              ))}
            </div>

            <div className="mt-9 flex justify-center">
              <BrandCta href={PAGE_PATH.historias} variant="ghost">
                {pick(HOME_STORIES_TEXT.seeAllStories, lang)}
                <ArrowRight aria-hidden="true" />
              </BrandCta>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ParentTestimonialsSection;
