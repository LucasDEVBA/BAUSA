"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useScrollReveal, revealClass } from "@/hooks/useScrollReveal";
import { Play, X, Users, ChevronRight } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { useLanguage } from "@/i18n";
import logoWhite from "@/assets/logo-white.png";
import logoSpire from "@/assets/logo-spireAcademy.png";
import logoMontverde from "@/assets/logo-montverdeAcademy.png";
import athleteIsadora from "@/assets/athlete-isadora.jpeg";
import logoBenfica from "@/assets/academys/logoBenficaCard.png";
import benjamin from "@/assets/benjamin.jpeg";
import athleteLiz from "@/assets/athlete-liz.jpeg";

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

interface TestimonialCardProps {
  testimonial: typeof videoTestimonials[0];
  isPlaying: boolean;
  onPlay: () => void;
  onClose: () => void;
}

const TestimonialCard = ({ testimonial, isPlaying, onPlay, onClose }: TestimonialCardProps) => {
  const { t } = useLanguage();

  const handlePlayClick = () => {
    onPlay();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div className="athlete-testimonial-card flex-shrink-0 w-full max-w-[280px] sm:max-w-[320px] md:max-w-[360px] group flex flex-col mx-auto">
      {/* Video Container with Fixed Aspect Ratio */}
      <div className="relative w-full" style={{ aspectRatio: '9/16' }}>
        <div className="absolute inset-0 rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer bg-[hsl(var(--navy-deep))] shadow-2xl border border-white/5">
          {!isPlaying ? (
            <div className="absolute inset-0">
              {/* Thumbnail Image */}
              <img
                src={testimonial.thumbnail.src}
                alt={testimonial.name}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                loading="lazy"
                decoding="async"
              />

              {/* Bottom Gradient Overlay - More Intense */}
              <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-deep)/0.85)] to-transparent" />

              {/* Video Interface Elements Overlay */}
              <div
                className="absolute inset-0 p-3 sm:p-5 pb-[70px] sm:pb-[80px] flex flex-col justify-between cursor-pointer"
                onClick={handlePlayClick}
              >
                {/* Top: REC Indicator */}
                <div className="flex items-center justify-start">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-white tracking-widest uppercase">REC</span>
                  </div>
                </div>

                {/* Bottom Overlay Info (Just Play Indicator for now, Info is in Footer) */}
                <div className="flex justify-end p-0.5 sm:p-1">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] border border-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[hsl(var(--burgundy)/0.4)] transition-all duration-300">
                    <Play className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 text-white fill-current ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Video Progress Bar - Sits just above the footer */}
              <div className="absolute bottom-[66px] sm:bottom-[76px] left-0 right-0 px-3.5 sm:px-4">
                <div className="relative h-1 w-full bg-white/20 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: "45%" }}
                    whileHover={{ width: "100%" }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-[hsl(var(--navy-light))] to-[hsl(var(--burgundy-glow))] rounded-full"
                  />
                </div>
              </div>

              {/* Footer Info Bar - Restored logic with white background */}
              <div className="absolute bottom-0 left-0 right-0 p-3.5 sm:p-4 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  {/* Left: Logo + Athlete Info */}
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                    <img
                      src={logoWhite.src}
                      alt="BSA"
                      className="h-8 sm:h-8 w-auto object-contain flex-shrink-0 brightness-0 opacity-90"
                    />
                    <div className="w-px h-8 sm:h-8 bg-slate-200 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[12px] sm:text-[13px] md:text-sm font-bold text-[hsl(var(--navy-deep))] leading-tight truncate">
                        {testimonial.name}
                      </h3>
                      <p className="text-[10px] sm:text-[10px] md:text-xs text-slate-500 leading-tight">
                        {testimonial.age} {t("landing.testimonials.ageSuffix")}
                      </p>
                    </div>
                  </div>

                  {/* Right: School Logo */}
                  <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-11 md:h-11 rounded-lg bg-white p-1.5 flex items-center justify-center flex-shrink-0 shadow-md border border-slate-200/80">
                    <img
                      src={testimonial.schoolLogo.src}
                      alt={testimonial.school}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-black">
              {/* YouTube Embed */}
              <iframe
                src={`https://www.youtube.com/embed/${testimonial.youtubeId}?autoplay=1&rel=0`}
                title={`${t("landing.testimonials.videoTitle")} ${testimonial.name}`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />

              {/* Close Button */}
              <button
                onClick={handleClose}
                className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center hover:bg-black/90 transition-colors border border-white/10"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white" />
              </button>
            </div>
          )}

          {/* Premium Border Glow on Hover - BLUE */}
          <div className="absolute inset-0 rounded-xl sm:rounded-2xl border border-[hsl(var(--navy-light)/0)] group-hover:border-[hsl(var(--navy-light)/0.5)] transition-colors pointer-events-none" />
        </div>
      </div>
    </div >
  );
};

const CarouselDots = ({ count, active }: { count: number; active: number }) => (
  <div className="flex justify-center gap-2 mt-6 md:hidden">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={`h-1.5 rounded-full transition-all duration-300 ${i === active
          ? "w-6 bg-[hsl(var(--navy-light))]"
          : "w-1.5 bg-white/20"
          }`}
      />
    ))}
  </div>
);

const TestimonialsCarousel = () => {
  const { t } = useLanguage();
  const headerReveal = useScrollReveal();
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHint, setShowHint] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);

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

  const handlePlay = (id: string) => {
    setActiveVideoId(id);
  };

  const handleClose = () => {
    setActiveVideoId(null);
  };

  return (
    <section className="relative py-16 sm:py-24 md:py-32 overflow-hidden touch-pan-y">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-medium))] to-[hsl(var(--navy-deep))]" />
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/4 w-[400px] h-[400px] bg-[hsl(var(--burgundy)/0.08)] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-[hsl(var(--navy-light)/0.1)] rounded-full blur-[100px]" />
      </div>
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <div
          ref={headerReveal.ref}
          className={`${revealClass(headerReveal.isRevealed)} text-center mb-12 sm:mb-16`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-5 sm:mb-6">
            <Users className="w-4 h-4 text-white/80" />
            <span className="text-xs sm:text-sm font-semibold text-white/80 tracking-wide">{t("landing.testimonials.badge")}</span>
          </div>

          <h2 className="text-[1.5rem] sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 sm:mb-6 leading-tight">
            {t("landing.testimonials.title")}{" "}
            <span className="text-gradient-on-dark">{t("landing.brandName")}</span>
          </h2>

          <p className="text-[15px] sm:text-lg text-white/85 max-w-2xl mx-auto leading-relaxed px-2 sm:px-0">
            {t("landing.testimonials.subtitle")}
          </p>
        </div>

        {/* Combined View: Conditional rendering to prevent duplicate audio bug */}
        {isDesktop ? (
          <div className="grid grid-cols-3 gap-6 max-w-5xl mx-auto">
            {videoTestimonials.map((testimonial) => (
              <div key={testimonial.id}>
                <TestimonialCard
                  testimonial={testimonial}
                  isPlaying={activeVideoId === testimonial.id}
                  onPlay={() => handlePlay(testimonial.id)}
                  onClose={handleClose}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="md:hidden">
            <div className="overflow-hidden touch-pan-y" ref={emblaRef}>
              <div className="flex touch-pan-y gap-4">
                {videoTestimonials.map((testimonial) => (
                  <div
                    key={testimonial.id}
                    className="flex-[0_0_280px] sm:flex-[0_0_320px] min-w-0 touch-pan-y"
                  >
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

            {/* Swipe Hint */}
            <AnimatePresence>
              {showHint && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex items-center justify-center gap-1.5 mt-4 text-white/65 text-xs"
                >
                  <span>{t("landing.testimonials.swipeHint")}</span>
                  <motion.div
                    animate={{ x: [0, 6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
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