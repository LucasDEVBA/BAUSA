"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Play, X, ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";

import { useLanguage } from "@/i18n";
import logoSpire from "@/assets/logo-spireAcademy.png";
import logoMontverde from "@/assets/logo-montverdeAcademy.png";
import athleteIsadora from "@/assets/athlete-isadora.jpeg";
import logoBenfica from "@/assets/academys/logoBenficaCard.png";
import benjamin from "@/assets/benjamin.jpeg";
import athleteLiz from "@/assets/athlete-liz.jpeg";
import MeshBackground from "./brand/MeshBackground";

const videoTestimonials = [
  {
    id: "isadora",
    name: "Isadora Santiago",
    age: 16,
    school: "Montverde Academy",
    schoolLogo: logoMontverde,
    thumbnail: athleteIsadora,
    youtubeId: "P9QiMRW4dII",
  },
  {
    id: "Benjamin",
    name: "Benjamin Bertolucci",
    age: 15,
    school: "Spire Academy",
    schoolLogo: logoSpire,
    thumbnail: benjamin,
    youtubeId: "7iso2Aj0PuQ",
  },
  {
    id: "liz",
    name: "Liz Valverde",
    age: 15,
    school: "Benfica Residential Academy",
    schoolLogo: logoBenfica,
    thumbnail: athleteLiz,
    youtubeId: "arIURGPP828",
  },
];

// Vitrine em leque no desktop: as laterais inclinam e o centro sobe, como pôsteres numa parede.
const DESKTOP_POSE = ["lg:-rotate-[2.5deg] lg:translate-y-6", "lg:-translate-y-4", "lg:rotate-[2.5deg] lg:translate-y-6"];

// Sem chave de tradução para o botão de fechar: rótulo acessível local nos 3 idiomas.

// Moldura de vidro sem backdrop-filter: dentro do trilho transformado do carrossel o desfoque pinta um
// retângulo claro do tamanho do viewport; a moldura translúcida dá o mesmo vidro sem o artefato.
const FRAME = "border border-white/80 bg-white/70 shadow-[inset_0_1px_0_#fff,inset_0_-1px_0_rgba(31,63,163,0.06),var(--ba-shadow)]";

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

interface TestimonialCardProps {
  testimonial: (typeof videoTestimonials)[0];
  isPlaying: boolean;
  onPlay: () => void;
  onClose: () => void;
}

const TestimonialCard = ({ testimonial, isPlaying, onPlay, onClose }: TestimonialCardProps) => {
  const { t } = useLanguage();
  const videoLabel = `${t("landing.testimonials.videoTitle")} ${testimonial.name}`;

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div className={`athlete-testimonial-card group mx-auto flex w-full max-w-[280px] flex-col rounded-[28px] p-[7px] transition-[transform,box-shadow] duration-700 [transition-timing-function:var(--ba-ease)] hover:shadow-[var(--ba-shadow-lg)] sm:max-w-[320px] md:max-w-[330px] sm:rounded-[32px] sm:p-2 ${FRAME}`} data-tilt>
      <div className="relative w-full overflow-hidden rounded-[22px] bg-[var(--ba-navy-2)] sm:rounded-[25px]" style={{ aspectRatio: "9/16" }}>
        {!isPlaying ? (
          <button type="button" onClick={onPlay} aria-label={videoLabel} className="absolute inset-0 block h-full w-full cursor-pointer text-left focus-visible:outline-[2.5px] focus-visible:outline-offset-[-4px] focus-visible:outline-white">
            <Image
              src={testimonial.thumbnail}
              alt={testimonial.name}
              fill
              sizes="(max-width: 768px) 280px, 360px"
              className="object-cover transition-transform duration-[1200ms] [transition-timing-function:var(--ba-ease)] group-hover:scale-[1.05]"
            />
            <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,69,0.35)_0%,rgba(10,26,69,0)_26%,rgba(10,26,69,0)_48%,rgba(6,15,42,0.88)_100%)]" />

            {/* Topo: gravação + escola */}
            <span className="absolute inset-x-3 top-3 flex items-center justify-between gap-2 sm:inset-x-4 sm:top-4">
              <span className="ba-glass-dark flex items-center gap-1.5 rounded-full px-2.5 py-[5px]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff5a6e]" />
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white">REC</span>
              </span>
              <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-white/95 p-1.5 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.9)] sm:h-12 sm:w-12">
                <Image src={testimonial.schoolLogo} alt={testimonial.school} className="h-full w-full object-contain" sizes="48px" />
              </span>
            </span>

            {/* Play em vidro */}
            <span aria-hidden="true" className="absolute left-1/2 top-1/2 grid h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_0_0_1px_rgba(255,255,255,0.3),0_20px_44px_-14px_rgba(0,0,0,0.55)] backdrop-blur-md transition-transform duration-500 [transition-timing-function:var(--ba-ease)] group-hover:scale-110">
              <span className="grid h-[50px] w-[50px] place-items-center rounded-full bg-[linear-gradient(180deg,#fff,#e6ecfb)] shadow-[0_6px_16px_-6px_rgba(10,26,69,0.6)]">
                <Play className="ml-0.5 h-5 w-5 fill-[var(--ba-navy)] text-[var(--ba-navy)]" />
              </span>
            </span>

            {/* Rodapé em vidro escuro: atleta + progresso */}
            <span className="ba-glass-dark absolute inset-x-2.5 bottom-2.5 block rounded-[18px] px-4 pb-3.5 pt-3 sm:inset-x-3 sm:bottom-3 sm:rounded-[20px]">
              <span className="flex items-end justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-[family-name:var(--ba-display)] text-[16px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[17px]">
                    {testimonial.name}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-white/75">
                    {testimonial.age} {t("landing.testimonials.ageSuffix")} · {testimonial.school}
                  </span>
                </span>
              </span>
              <span className="relative mt-3 block h-[3px] w-full overflow-hidden rounded-full bg-white/20">
                <motion.span
                  initial={{ width: "42%" }}
                  whileHover={{ width: "100%" }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-y-0 left-0 block rounded-full bg-[linear-gradient(90deg,#b8caf7,#f0b1bb)]"
                />
              </span>
            </span>
          </button>
        ) : (
          <div className="absolute inset-0 bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${testimonial.youtubeId}?autoplay=1&rel=0`}
              title={videoLabel}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            <button
              type="button"
              onClick={handleClose}
              aria-label={t("landing.closeVideo")}
              className="ba-glass-dark absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:outline-[2.5px] focus-visible:outline-white"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const CarouselDots = ({ count, active }: { count: number; active: number }) => (
  <div className="mt-6 flex justify-center gap-2 md:hidden" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? "w-6 bg-[var(--ba-blue)]" : "w-1.5 bg-[rgba(31,63,163,0.22)]"}`}
      />
    ))}
  </div>
);

const TestimonialsCarousel = () => {
  const { t } = useLanguage();
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHint, setShowHint] = useState(true);
  // null até montar: o layout depende do viewport, e decidir isso só no cliente evita que a hidratação
  // reaproveite o DOM do outro ramo (o embla chegou a se prender no elemento errado assim).
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    loop: false,
    skipSnaps: false,
    dragFree: false,
    dragThreshold: 20,
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    emblaApi.on("pointerDown", () => setShowHint(false));
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  const handlePlay = (id: string) => setActiveVideoId(id);
  const handleClose = () => setActiveVideoId(null);

  return (
    <section
      id="depoimentos"
      className="relative isolate touch-pan-y scroll-mt-24 overflow-hidden py-[clamp(80px,10vw,140px)]"
      aria-labelledby="depoimentos-title"
    >
      <MeshBackground blobs={["b2", "b3"]} className="[&_.ba-b2]:!top-[10%] [&_.ba-b3]:!left-[30vw] [&_.ba-b3]:!top-[45%] [&_.ba-b3]:!opacity-30" />

      <div className="ba-wrap relative z-[2]">
        {/* Cabeçalho dividido: título à esquerda, manifesto à direita */}
        <div className="mb-12 grid items-end gap-6 sm:mb-16 lg:grid-cols-[1.35fr_1fr] lg:gap-16">
          <div>
            <span className="ba-eyebrow ba-glass ba-rv">
              <span className="ba-dot" />
              {t("landing.testimonials.badge")}
            </span>
            <h2 id="depoimentos-title" className="ba-h2 ba-rv mt-5 text-[clamp(32px,4.6vw,60px)] text-[var(--ba-navy)]" style={delay(1)}>
              {t("landing.testimonials.title")} <span className="ba-grad-text">{t("landing.brandName")}</span>
            </h2>
          </div>
          <p className="ba-lead ba-rv max-w-[460px] lg:mb-2 lg:border-l lg:border-[var(--ba-stroke)] lg:pl-8" style={delay(2)}>
            {t("landing.testimonials.subtitle")}
          </p>
        </div>

        {/* Renderização condicional evita dois players tocando o mesmo áudio */}
        {isDesktop === null ? (
          <div className="min-h-[560px] md:min-h-[640px]" aria-hidden="true" />
        ) : isDesktop ? (
          <div key="desktop" className="relative mx-auto grid max-w-[1120px] grid-cols-3 gap-5 lg:gap-8 lg:pb-6">
            <div aria-hidden="true" className="ba-glow left-1/2 top-1/2 h-[420px] w-[70%] -translate-x-1/2 -translate-y-1/2 bg-[rgba(71,107,192,0.28)]" />
            {videoTestimonials.map((testimonial, index) => (
              <div key={testimonial.id} className="ba-rv-scale relative z-[1]" style={delay(index + 1)}>
                <div className={`transition-transform duration-700 [transition-timing-function:var(--ba-ease)] ${DESKTOP_POSE[index]}`}>
                  <TestimonialCard
                    testimonial={testimonial}
                    isPlaying={activeVideoId === testimonial.id}
                    onPlay={() => handlePlay(testimonial.id)}
                    onClose={handleClose}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div key="mobile" className="md:hidden">
            <div className="-mx-[var(--ba-gutter)] -mb-16 -mt-6 touch-pan-y overflow-hidden pb-16 pt-6" ref={emblaRef}>
              <div className="flex touch-pan-y gap-4">
                {videoTestimonials.map((testimonial) => (
                  <div key={testimonial.id} className="min-w-0 flex-[0_0_280px] touch-pan-y sm:flex-[0_0_320px]">
                    <TestimonialCard
                      testimonial={testimonial}
                      isPlaying={activeVideoId === testimonial.id}
                      onPlay={() => handlePlay(testimonial.id)}
                      onClose={handleClose}
                    />
                  </div>
                ))}
              </div>
            </div>

            <CarouselDots count={videoTestimonials.length} active={selectedIndex} />

            <AnimatePresence>
              {showHint && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--ba-ink-3)]"
                >
                  <span>{t("landing.testimonials.swipeHint")}</span>
                  <motion.div animate={{ x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
};

export default TestimonialsCarousel;
