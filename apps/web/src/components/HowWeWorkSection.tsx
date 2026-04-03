"use client";

import { memo } from "react";
import { Compass, Users, Shield, Clock, Target, Heart } from "lucide-react";
import logoWatermark from "@/assets/logo-watermark.png";
import logoBadgeDark from "@/assets/logo-badge-dark.png";
import { useScrollReveal, revealClass } from "@/hooks/useScrollReveal";
import { useLanguage } from "@/i18n";

const HowWeWorkSection = memo(() => {
  const { t } = useLanguage();
  const headerReveal = useScrollReveal();
  const highlightReveal = useScrollReveal();
  const card1Reveal = useScrollReveal();
  const card2Reveal = useScrollReveal();

  return (
    <section className="relative py-16 sm:py-24 md:py-32 overflow-hidden">
      {/* Premium Dark Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-medium))] to-[hsl(var(--navy-deep))]" />

      {/* Radial Glow */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[hsl(var(--burgundy)/0.06)] rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[hsl(var(--navy-light)/0.1)] rounded-full blur-[120px]" />
      </div>

      {/* Watermark Logos */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[5%] left-[8%] w-20 sm:w-28 opacity-[0.025] rotate-[-12deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[15%] right-[5%] w-24 sm:w-32 opacity-[0.03] rotate-[18deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[20%] left-[3%] w-16 sm:w-24 opacity-[0.02] rotate-[8deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[10%] right-[10%] w-20 sm:w-28 opacity-[0.025] rotate-[-15deg]" />
      </div>

      {/* Subtle Grid */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div
          ref={headerReveal.ref}
          className={`${revealClass(headerReveal.isRevealed)} text-center mb-12 sm:mb-16`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-5 sm:mb-6">
            <Compass className="w-4 h-4 text-white/80" />
            <span className="text-xs sm:text-sm font-semibold text-white/80 tracking-wide">{t("landing.howWeWork.badge")}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 leading-tight">
            {t("landing.howWeWork.title")}
          </h2>

          <p className="text-base sm:text-lg text-white/85 max-w-3xl mx-auto leading-relaxed">
            {t("landing.howWeWork.subtitle1")}
            <br className="hidden sm:block" />
            {t("landing.howWeWork.subtitle2")}{" "}<span className="text-white font-medium">{t("landing.howWeWork.methodName")}</span>{t("landing.howWeWork.subtitle3")}
          </p>
        </div>

        {/* Highlight Statement — pill fora do overflow-hidden para não ser cortada */}
        <div
          ref={highlightReveal.ref}
          className={`${revealClass(highlightReveal.isRevealed, "scale")} relative max-w-2xl mx-auto mb-12 sm:mb-16 pt-5`}
        >
          {/* Pill posicionada no wrapper — sem risco de clipping */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full bg-[hsl(var(--burgundy))] text-white text-xs font-bold tracking-widest shadow-lg shadow-[hsl(var(--burgundy)/0.35)]">
            {t("landing.howWeWork.philosophy.pill")}
          </div>

          <div className="relative p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-white via-white to-[hsl(354_75%_97%)] border border-slate-200/60 shadow-2xl shadow-[hsl(var(--navy-deep)/0.28)] overflow-hidden">
            {/* Accent stripe topo */}
            <div className="absolute top-0 left-8 right-8 h-[3px] bg-gradient-to-r from-transparent via-[hsl(var(--burgundy))] to-transparent rounded-b-full" />

            {/* Marcas d'água — cantos opostos */}
            <img src={logoBadgeDark.src} alt="" loading="lazy"
              className="absolute -bottom-2 -right-2 w-16 sm:w-20 opacity-[0.06] rotate-[14deg] pointer-events-none select-none" />
            <img src={logoBadgeDark.src} alt="" loading="lazy"
              className="absolute top-2 left-2 w-10 sm:w-14 opacity-[0.04] rotate-[-10deg] pointer-events-none select-none" />

            <p className="relative text-center text-lg sm:text-xl md:text-2xl font-semibold text-[hsl(var(--navy-deep))] mt-1 tracking-tight">
              {t("landing.howWeWork.philosophy.line1")}<br />
              <span className="text-[hsl(var(--burgundy))] font-bold">{t("landing.howWeWork.philosophy.line2")}</span>
            </p>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto">

          {/* Card 1: Para quem é — glass dark premium + watermarks */}
          <div
            ref={card1Reveal.ref}
            className={`${revealClass(card1Reveal.isRevealed, "left")} group`}
          >
            <div className="relative h-full p-6 sm:p-8 rounded-2xl bg-white/[0.06] backdrop-blur-sm border border-white/[0.12] hover:bg-white/[0.09] hover:border-white/[0.18] transition-all duration-500 overflow-hidden">

              {/* Watermarks brancos — card escuro */}
              <img src={logoWatermark.src} alt="" loading="lazy"
                className="absolute -bottom-3 -right-2 w-20 sm:w-24 opacity-[0.04] rotate-[12deg] pointer-events-none select-none" />
              <img src={logoWatermark.src} alt="" loading="lazy"
                className="absolute top-3 right-3 w-10 sm:w-12 opacity-[0.025] rotate-[-8deg] pointer-events-none select-none" />

              {/* Icon Header */}
              <div className="flex items-center gap-3 mb-4 sm:mb-5">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] flex items-center justify-center shadow-lg shadow-[hsl(var(--burgundy)/0.3)]">
                  <Heart className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </div>
                <div>
                  <span className="text-[hsl(var(--burgundy-bright))] text-xs font-semibold tracking-wider">{t("landing.howWeWork.card1.tagline")}</span>
                  <h3 className="text-lg sm:text-xl font-bold text-white">{t("landing.howWeWork.card1.title")}</h3>
                </div>
              </div>

              <p className="text-white/80 text-sm sm:text-base leading-relaxed">
                {t("landing.howWeWork.card1.bodyBefore")} <span className="text-white font-medium">{t("landing.howWeWork.card1.bodyBold")}</span>{t("landing.howWeWork.card1.bodyAfter")}
              </p>

              {/* Visual Accent */}
              <div className="mt-5 pt-5 border-t border-white/[0.1] flex items-center gap-3">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                    <Users className="w-4 h-4 text-white/70" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                    <Target className="w-4 h-4 text-white/70" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-white/70" />
                  </div>
                </div>
                <span className="text-white/70 text-xs sm:text-sm">{t("landing.howWeWork.card1.footer")}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Atuação Seletiva — premium quase-branco + 3 watermarks */}
          <div
            ref={card2Reveal.ref}
            className={`${revealClass(card2Reveal.isRevealed, "right")} group`}
          >
            <div className="relative h-full p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-white via-white to-[hsl(354_70%_96%)] border border-[hsl(var(--burgundy)/0.22)] shadow-xl shadow-[hsl(var(--burgundy)/0.14)] hover:shadow-2xl hover:shadow-[hsl(var(--burgundy)/0.2)] hover:-translate-y-0.5 transition-all duration-500 overflow-hidden">

              {/* Accent stripe topo — burgundy */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[hsl(var(--burgundy))] via-[hsl(var(--burgundy-glow))] to-[hsl(var(--burgundy))] rounded-t-2xl" />

              {/* Marcas d'água — 3 pontos de profundidade */}
              <img src={logoBadgeDark.src} alt="" loading="lazy"
                className="absolute -bottom-2 -right-2 w-20 sm:w-24 opacity-[0.065] rotate-[10deg] pointer-events-none select-none" />
              <img src={logoBadgeDark.src} alt="" loading="lazy"
                className="absolute top-2 left-2 w-12 sm:w-16 opacity-[0.04] rotate-[-15deg] pointer-events-none select-none" />
              <img src={logoBadgeDark.src} alt="" loading="lazy"
                className="absolute bottom-8 left-5 w-9 sm:w-11 opacity-[0.028] rotate-[6deg] pointer-events-none select-none" />

              {/* Icon Header */}
              <div className="flex items-center gap-3 mb-4 sm:mb-5 mt-1">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[hsl(var(--burgundy)/0.08)] border border-[hsl(var(--burgundy)/0.2)] flex items-center justify-center">
                  <Shield className="w-6 h-6 sm:w-7 sm:h-7 text-[hsl(var(--burgundy))]" />
                </div>
                <div>
                  <span className="text-[hsl(var(--burgundy))] text-xs font-semibold tracking-wider">{t("landing.howWeWork.card2.tagline")}</span>
                  <h3 className="text-lg sm:text-xl font-bold text-[hsl(var(--navy-deep))]">{t("landing.howWeWork.card2.title")}</h3>
                </div>
              </div>

              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                {t("landing.howWeWork.card2.bodyBefore")} <span className="text-[hsl(var(--navy-deep))] font-medium">{t("landing.howWeWork.card2.bodyBold")}</span>{t("landing.howWeWork.card2.bodyAfter")}
              </p>

              {/* Visual Stats */}
              <div className="mt-5 pt-5 border-t border-[hsl(var(--burgundy)/0.12)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[hsl(var(--burgundy))]" />
                  <span className="text-slate-500 text-xs sm:text-sm">{t("landing.howWeWork.card2.footerLabel")}</span>
                </div>
                <div className="px-3 py-1 rounded-full bg-[hsl(var(--burgundy)/0.08)] border border-[hsl(var(--burgundy)/0.2)]">
                  <span className="text-[hsl(var(--burgundy))] text-xs font-semibold">{t("landing.howWeWork.card2.footerBadge")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

HowWeWorkSection.displayName = "HowWeWorkSection";

export default HowWeWorkSection;
