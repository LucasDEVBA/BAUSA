"use client";

import { memo, useState, useEffect, useCallback, useMemo } from "react";
import { GraduationCap, Eye, TrendingUp, Building2, ChevronRight } from "lucide-react";
import logoBadgeDark from "@/assets/logo-badge-dark.png";
import { useScrollReveal, revealClass } from "@/hooks/useScrollReveal";
import useEmblaCarousel from "embla-carousel-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n";

// Cor ativa do dot reflete a cor do card correspondente
const dotActiveColors = [
  "bg-[hsl(var(--navy-deep))]",    // Card 0 — Navy
  "bg-[hsl(var(--burgundy))]",     // Card 1 — Burgundy
  "bg-[hsl(var(--navy-deep))]",    // Card 2 — Navy
  "bg-[hsl(var(--burgundy))]",     // Card 3 — Burgundy
];

const CarouselDots = ({ count, active }: { count: number; active: number }) => (
  <div className="flex justify-center gap-2 mt-5 md:hidden">
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className={`h-1.5 rounded-full transition-all duration-300 ${i === active
          ? `w-6 ${dotActiveColors[i]}`
          : "w-1.5 bg-slate-300"
          }`}
      />
    ))}
  </div>
);

// Variantes de estilo por card — mobile only (alternância Navy / Burgundy)
const mobileCardVariants = [
  {
    // Card 0: Navy — identidade original
    gradient: "from-[hsl(var(--navy-deep))] to-[hsl(var(--navy-medium))]",
    iconBg: "bg-white/10 group-hover:bg-white/15",
    dot: "from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))]",
    subtitleBorder: "border-[hsl(var(--burgundy-bright))]",
  },
  {
    // Card 1: Burgundy — variante vermelha (Efeito Espelhado Suave)
    gradient: "from-[hsl(var(--burgundy))] via-[hsl(var(--burgundy-glow))] to-[hsl(var(--burgundy))]",
    iconBg: "bg-white/15 group-hover:bg-white/20",
    dot: "from-white to-white/80",
    subtitleBorder: "border-white/60",
  },
  {
    // Card 2: Navy — volta ao azul
    gradient: "from-[hsl(var(--navy-deep))] to-[hsl(var(--navy-medium))]",
    iconBg: "bg-white/10 group-hover:bg-white/15",
    dot: "from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))]",
    subtitleBorder: "border-[hsl(var(--burgundy-bright))]",
  },
  {
    // Card 3: Burgundy — alterna de volta ao vinho (Efeito Espelhado Suave)
    gradient: "from-[hsl(var(--burgundy))] via-[hsl(var(--burgundy-glow))] to-[hsl(var(--burgundy))]",
    iconBg: "bg-white/15 group-hover:bg-white/20",
    dot: "from-white to-white/80",
    subtitleBorder: "border-white/60",
  },
] as const;

const WhyHighSchoolSection = memo(() => {
  const { t } = useLanguage();
  const headerReveal = useScrollReveal();
  const contentReveal = useScrollReveal();
  const gridReveal = useScrollReveal();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHint, setShowHint] = useState(true);

  const highlights = useMemo(() => [
    {
      icon: GraduationCap,
      title: t("landing.whyHighSchool.highlights.academic.title"),
      topics: [
        t("landing.whyHighSchool.highlights.academic.topic0"),
        t("landing.whyHighSchool.highlights.academic.topic1"),
        t("landing.whyHighSchool.highlights.academic.topic2"),
      ],
    },
    {
      icon: TrendingUp,
      title: t("landing.whyHighSchool.highlights.athletic.title"),
      topics: [
        t("landing.whyHighSchool.highlights.athletic.topic0"),
        t("landing.whyHighSchool.highlights.athletic.topic1"),
        t("landing.whyHighSchool.highlights.athletic.topic2"),
      ],
    },
    {
      icon: Building2,
      title: t("landing.whyHighSchool.highlights.adaptation.title"),
      topics: [
        t("landing.whyHighSchool.highlights.adaptation.topic0"),
        t("landing.whyHighSchool.highlights.adaptation.topic1"),
        t("landing.whyHighSchool.highlights.adaptation.topic2"),
      ],
    },
    {
      icon: Eye,
      title: t("landing.whyHighSchool.highlights.visibility.title"),
      subtitle: t("landing.whyHighSchool.highlights.visibility.subtitle"),
      topics: [
        t("landing.whyHighSchool.highlights.visibility.topic0"),
        t("landing.whyHighSchool.highlights.visibility.topic1"),
      ],
    },
  ], [t]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    loop: false,
    skipSnaps: false,
    // dragFree: momentum/inércia — scroll mais fluído no mobile
    dragFree: true,
    dragThreshold: 10,
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

  return (
    <section className="relative py-16 sm:py-24 md:py-32 overflow-hidden">
      {/* Premium Light Background with Accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />

      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[hsl(var(--burgundy)/0.03)] to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-[hsl(var(--navy-deep)/0.03)] to-transparent" />
      </div>

      {/* Watermark Logos - Light Premium (+50% size, +70% opacity) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[3%] left-[2%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[-10deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[5%] right-[8%] w-16 sm:w-24 md:w-32 opacity-[0.077] rotate-[15deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[18%] left-[18%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[8deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[25%] right-[15%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[-12deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[40%] left-[5%] w-14 sm:w-20 md:w-28 opacity-[0.077] rotate-[20deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[45%] right-[5%] w-16 sm:w-24 md:w-32 opacity-[0.068] rotate-[-8deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[60%] left-[25%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[-5deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[65%] right-[22%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[10deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute bottom-[20%] left-[8%] w-14 sm:w-20 md:w-28 opacity-[0.077] rotate-[15deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute bottom-[15%] right-[10%] w-16 sm:w-24 md:w-32 opacity-[0.068] rotate-[-12deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute bottom-[5%] left-[45%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[5deg]" />
      </div>

      {/* Subtle Pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--navy-deep)) 1px, transparent 0)`,
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header */}
        <div
          ref={headerReveal.ref}
          className={`${revealClass(headerReveal.isRevealed)} text-center mb-12 sm:mb-16`}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--navy-deep)/0.06)] border border-[hsl(var(--navy-deep)/0.1)] mb-5 sm:mb-6">
            <GraduationCap className="w-4 h-4 text-[hsl(var(--navy-deep))]" />
            <span className="text-xs sm:text-sm font-semibold text-[hsl(var(--navy-deep))] tracking-wide">{t("landing.whyHighSchool.badge")}</span>
          </div>

          <p className="text-[hsl(var(--burgundy))] text-sm sm:text-base font-medium mb-3">
            {t("landing.whyHighSchool.tagline")}
          </p>

          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[hsl(var(--navy-deep))] mb-4 sm:mb-6 leading-tight">
            {t("landing.whyHighSchool.title1")}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))]">
              {t("landing.whyHighSchool.title2")}
            </span>
          </h2>

          <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            {t("landing.whyHighSchool.subtitle")}
          </p>
        </div>

        {/* Main Content Card */}
        <div
          ref={contentReveal.ref}
          className={`${revealClass(contentReveal.isRevealed)} max-w-4xl mx-auto mb-12 sm:mb-16`}
        >
          <div className="relative p-6 sm:p-10 md:p-12 rounded-2xl sm:rounded-3xl bg-white border border-slate-200/80 shadow-xl shadow-[hsl(var(--navy-deep)/0.06)]">
            {/* Top Accent */}
            <div className="absolute top-0 left-8 right-8 h-1 bg-gradient-to-r from-transparent via-[hsl(var(--burgundy))] to-transparent rounded-b-full" />

            <div className="space-y-5 sm:space-y-6">
              <p className="text-[15px] sm:text-lg md:text-xl text-[hsl(var(--navy-deep))] leading-relaxed">
                {t("landing.whyHighSchool.p1Before")}<span className="font-semibold text-[hsl(var(--burgundy))]">{t("landing.eeiName")}</span>{" "}{t("landing.whyHighSchool.p1After")}
              </p>

              <p className="text-[15px] sm:text-lg text-slate-600 leading-relaxed">
                {t("landing.whyHighSchool.p2Before")} <span className="text-[hsl(var(--navy-deep))] font-medium">{t("landing.whyHighSchool.p2Bold")}</span>{" "}{t("landing.whyHighSchool.p2After")}
              </p>
            </div>
          </div>
        </div>

        {/* Desktop: Grid 4 colunas — visão completa dos 4 pilares */}
        <div
          ref={gridReveal.ref}
          className={`${revealClass(gridReveal.isRevealed)} hidden md:grid md:grid-cols-4 gap-5 max-w-6xl mx-auto`}
        >
          {highlights.map((item) => (
            <div key={item.title} className="group">
              <div className="h-full p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[hsl(var(--navy-deep))] to-[hsl(var(--navy-medium))] border border-white/10 hover:shadow-xl hover:shadow-[hsl(var(--navy-deep)/0.2)] transition-all duration-500 hover:-translate-y-1">
                {/* Icon + Title — horizontal compacto para 4 colunas */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0 group-hover:bg-white/15 transition-colors">
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-[15px] font-bold text-white leading-snug pt-0.5">{item.title}</h3>
                </div>

                {"subtitle" in item && item.subtitle && (
                  <p className="text-[13px] text-white/90 font-medium mb-3 leading-relaxed border-l-2 border-[hsl(var(--burgundy))] pl-3">
                    {item.subtitle}
                  </p>
                )}

                <ul className="space-y-1.5">
                  {item.topics.map((topic, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] mt-1.5 flex-shrink-0" />
                      <span className="text-[13px] text-white/70 leading-relaxed">{topic}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile: Carousel com Peek + Cores alternadas */}
        <div className="md:hidden -mx-4 px-4">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-3">
              {highlights.map((item, index) => {
                const style = mobileCardVariants[index];
                return (
                  <div
                    key={item.title}
                    className="group min-w-0 flex-[0_0_85%] first:pl-0 last:pr-4"
                  >
                    <div className={`h-full p-5 rounded-2xl bg-gradient-to-br ${style.gradient} border border-white/10 shadow-xl`}>
                      {/* Icon + Title horizontal no mobile */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-11 h-11 rounded-xl ${style.iconBg} flex items-center justify-center flex-shrink-0 transition-colors`}>
                          <item.icon className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-[15px] font-bold text-white flex-1 leading-snug">{item.title}</h3>
                      </div>

                      {"subtitle" in item && item.subtitle && (
                        <p className={`text-[13px] text-white/90 font-medium mb-4 leading-relaxed border-l-2 ${style.subtitleBorder} pl-3`}>
                          {item.subtitle}
                        </p>
                      )}

                      <ul className="space-y-2">
                        {item.topics.map((topic, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${style.dot} mt-[5px] flex-shrink-0`} />
                            <span className="text-[13px] text-white/80 leading-relaxed">{topic}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <CarouselDots count={highlights.length} active={selectedIndex} />

          {/* Swipe Hint */}
          <AnimatePresence>
            {showHint && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center justify-center gap-1.5 mt-3 text-slate-400 text-xs"
              >
                <span>{t("landing.whyHighSchool.swipeHint")}</span>
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
      </div>
    </section>
  );
});

WhyHighSchoolSection.displayName = "WhyHighSchoolSection";

export default WhyHighSchoolSection;
