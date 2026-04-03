"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useScrollReveal, revealClass } from "@/hooks/useScrollReveal";
import { Play, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n";
import paiBento from "@/assets/PAI-BENTO.jpeg";
import maeIsadora from "@/assets/MAE-ISADORA.jpeg";
import priscilaMoraes from "@/assets/PRISCILA-MORAES.jpeg";
import logoBadgeDark from "@/assets/logo-badge-dark.png";
import GabrielMachado from "@/assets/GABRIEL-MACHADO.jpeg";
import comperlingo from "@/assets/Comperlingo.jpeg";
import paiLizValverde from "@/assets/paiLizValverde.jpg";

const parentTestimonials = [
  {
    familyName: "Família Valverde",
    thumbnail: paiLizValverde,
    youtubeId: "wJUf_efdc8s",
  },
  {
    familyName: "Família Mello",
    thumbnail: paiBento,
    youtubeId: "1WDFoyA5p8U",
  },
  {
    familyName: "Família Santiago",
    thumbnail: maeIsadora,
    youtubeId: "enS5ZAGRJ0g",
  },
  {
    familyName: "Família Moraes",
    thumbnail: priscilaMoraes,
    youtubeId: "KFkoxh4nTHU",
  },
  {
    familyName: "Família Machado",
    thumbnail: GabrielMachado,
    youtubeId: "8RtvPgeZ8yI",
  },
  {
    familyName: "Família Comperlingo",
    thumbnail: comperlingo,
    youtubeId: "lXzJkGgZkTw",
  },
];

interface ParentVideoCardProps {
  testimonial: typeof parentTestimonials[0];
  isPlaying: boolean;
  onPlay: () => void;
  onClose: () => void;
}

const ParentVideoCard = ({ testimonial, isPlaying, onPlay, onClose }: ParentVideoCardProps) => {
  const { t } = useLanguage();

  const handlePlayClick = () => {
    onPlay();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div className="parent-testimonial-card flex-shrink-0 w-[200px] sm:w-[260px] md:w-[320px] group">
      {/* Video Container */}
      <div className="relative aspect-[9/16] rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer bg-[hsl(var(--navy-medium))] shadow-xl">
        {!isPlaying ? (
          <div className="absolute inset-0">
            {/* Thumbnail Image */}
            <img
              src={testimonial.thumbnail.src}
              alt={testimonial.familyName}
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />

            {/* Bottom Gradient Overlay */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />

            {/* Video Interface Elements */}
            <div className="absolute inset-0 p-3 sm:p-5 flex flex-col justify-between" onClick={handlePlayClick}>
              {/* Top: REC / Status Indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-bold text-white tracking-widest uppercase">REC</span>
                </div>
              </div>

              {/* Bottom: Info + Progress */}
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div className="flex-1">
                    <h4 className="font-bold text-white text-sm sm:text-lg mb-0.5">
                      {testimonial.familyName}
                    </h4>
                  </div>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] border border-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[hsl(var(--burgundy)/0.4)] transition-all duration-300">
                    <Play className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 text-white fill-current ml-0.5" />
                  </div>
                </div>

                {/* Video Progress Bar */}
                <div className="relative h-1 w-full bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: "30%" }}
                    whileHover={{ width: "100%" }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[hsl(var(--navy-light))] to-[hsl(var(--burgundy-glow))] rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0">
            {/* YouTube Embed */}
            <iframe
              src={`https://www.youtube.com/embed/${testimonial.youtubeId}?autoplay=1&rel=0`}
              title={`${t("landing.testimonials.videoTitle")} ${testimonial.familyName}`}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </button>
          </div>
        )}

        {/* Premium Border Glow on Hover */}
        <div className="absolute inset-0 rounded-xl sm:rounded-2xl border border-[hsl(var(--burgundy)/0)] group-hover:border-[hsl(var(--burgundy)/0.5)] transition-colors pointer-events-none" />
      </div>
    </div>
  );
};

const ParentTestimonialsSection = () => {
  const { t } = useLanguage();
  const headerReveal = useScrollReveal();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);

  const rafRef = useRef<number>(0);

  const checkScrollability = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        setCanScrollLeft(scrollLeft > 0);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
        // Calcula índice do card ativo com base na posição do scroll
        const cardW = window.innerWidth < 640 ? 200 + 12 : 320 + 24;
        const computed = Math.round(scrollLeft / cardW);
        setActiveCardIndex(Math.min(Math.max(computed, 0), parentTestimonials.length - 1));
      }
      rafRef.current = 0;
    });
  }, []);

  useEffect(() => {
    checkScrollability();
    window.addEventListener('resize', checkScrollability);
    return () => {
      window.removeEventListener('resize', checkScrollability);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [checkScrollability]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const cardWidth = window.innerWidth < 640 ? 200 + 12 : 320 + 24;
      const scrollAmount = direction === 'left' ? -cardWidth : cardWidth;
      scrollContainerRef.current.scrollBy({
        left: scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section className="py-16 sm:py-24 md:py-32 overflow-hidden relative">
      {/* Light Background for contrast with dark sections */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-100" />

      {/* Subtle accent */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-to-tr from-[hsl(var(--burgundy)/0.03)] to-transparent" />
      </div>

      {/* Watermark Logos - Light Premium (+50% size, +70% opacity) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[3%] left-[2%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[-10deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[5%] right-[8%] w-16 sm:w-24 md:w-32 opacity-[0.077] rotate-[15deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[20%] left-[18%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[8deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[28%] right-[15%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[-12deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[45%] left-[5%] w-14 sm:w-20 md:w-28 opacity-[0.077] rotate-[18deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[50%] right-[5%] w-16 sm:w-24 md:w-32 opacity-[0.068] rotate-[-8deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[65%] left-[25%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[-5deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[70%] right-[22%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[10deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute bottom-[15%] left-[8%] w-14 sm:w-20 md:w-28 opacity-[0.077] rotate-[12deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute bottom-[10%] right-[12%] w-16 sm:w-24 md:w-32 opacity-[0.068] rotate-[-12deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute bottom-[5%] left-[45%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[5deg]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 mb-8 sm:mb-12 relative z-10">
        <div
          ref={headerReveal.ref}
          className={`${revealClass(headerReveal.isRevealed)} text-center max-w-3xl mx-auto`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--navy-deep)/0.06)] border border-[hsl(var(--navy-deep)/0.1)] mb-4 sm:mb-6">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[hsl(var(--burgundy))]" />
            <span className="text-xs sm:text-sm font-semibold text-[hsl(var(--navy-deep))]">{t("landing.parentTestimonials.badge")}</span>
          </div>
          <h2 className="text-[1.5rem] sm:text-3xl md:text-4xl font-bold mt-4 sm:mt-4 mb-3 sm:mb-4 text-[hsl(var(--navy-deep))] leading-tight">
            {t("landing.parentTestimonials.title1")}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))]">{t("landing.parentTestimonials.title2")}</span>
            .
          </h2>
          <p className="text-sm sm:text-base text-slate-600 px-2">
            {t("landing.parentTestimonials.subtitle")}
          </p>
        </div>
      </div>

      {/* Mobile Swipe Hint */}
      <p className="flex items-center justify-center gap-1 text-xs text-slate-400 mb-3 sm:hidden animate-pulse relative z-10">
        <span>{t("landing.parentTestimonials.swipeHint")}</span>
        <ChevronRight className="w-3 h-3" />
      </p>

      {/* Video Cards Container */}
      <div className="relative px-2 sm:px-4 z-10">
        {/* Gradient Masks */}
        <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 sm:w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        {/* Left Navigation Arrow */}
        <motion.button
          animate={{ opacity: canScrollLeft ? 1 : 0.3 }}
          whileHover={{ scale: canScrollLeft ? 1.1 : 1 }}
          whileTap={{ scale: canScrollLeft ? 0.95 : 1 }}
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
          className="absolute left-1 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200/50 hidden sm:flex items-center justify-center transition-all hover:bg-white hover:border-[hsl(var(--burgundy)/0.5)] disabled:cursor-not-allowed shadow-md"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[hsl(var(--navy-deep))]" />
        </motion.button>

        {/* Right Navigation Arrow */}
        <motion.button
          animate={{ opacity: canScrollRight ? 1 : 0.3 }}
          whileHover={{ scale: canScrollRight ? 1.1 : 1 }}
          whileTap={{ scale: canScrollRight ? 0.95 : 1 }}
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
          className="absolute right-1 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200/50 hidden sm:flex items-center justify-center transition-all hover:bg-white hover:border-[hsl(var(--burgundy)/0.5)] disabled:cursor-not-allowed shadow-md"
        >
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-[hsl(var(--navy-deep))]" />
        </motion.button>

        {/* Scrollable Track */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScrollability}
          className="flex gap-3 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory justify-start scroll-smooth touch-pan-x px-4 sm:px-8 scroll-px-4 sm:scroll-px-8"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
        >
          {parentTestimonials.map((testimonial, index) => (
            <div
              key={`${testimonial.familyName}-${index}`}
              className="snap-center"
            >
              <ParentVideoCard
                testimonial={testimonial}
                isPlaying={activeVideoIndex === index}
                onPlay={() => setActiveVideoIndex(index)}
                onClose={() => setActiveVideoIndex(null)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scroll Indicator Dots — reflete card ativo */}
      <div className="flex justify-center mt-4 sm:mt-6 gap-1.5 sm:gap-2 relative z-10">
        {parentTestimonials.map((_, index) => (
          <div
            key={index}
            className={`rounded-full transition-all duration-300 h-1.5 sm:h-2 ${index === activeCardIndex
              ? 'w-4 sm:w-5 bg-[hsl(var(--burgundy))]'
              : 'w-1.5 sm:w-2 bg-slate-300'
              }`}
          />
        ))}
      </div>
    </section>
  );
};

export default ParentTestimonialsSection;