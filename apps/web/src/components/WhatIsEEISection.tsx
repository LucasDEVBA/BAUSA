"use client";

import { memo } from "react";
import { Lightbulb, Target, Compass, ArrowRight } from "lucide-react";
import logoFullColor from "@/assets/logo-full-color.jpg";
import logoWatermark from "@/assets/logo-watermark.png";
import { useScrollReveal, revealClass } from "@/hooks/useScrollReveal";
import { useLanguage } from "@/i18n";

const WhatIsEEISection = memo(() => {
  const logoReveal = useScrollReveal();
  const textReveal = useScrollReveal();
  const contentReveal = useScrollReveal();
  const { t } = useLanguage();

  return (
    <section id="o-que-e" className="relative py-16 sm:py-24 md:py-32 overflow-hidden">
      {/* Dark Premium Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-medium))] to-[hsl(var(--navy-deep))]" />

      {/* Radial Glow */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[hsl(var(--burgundy)/0.08)] rounded-full blur-[200px]" />
      </div>

      {/* Watermark Logos - Dark Premium (+50% size, +30% opacity) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[3%] left-[2%] w-14 sm:w-20 md:w-28 opacity-[0.065] rotate-[-12deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[6%] right-[8%] w-16 sm:w-24 md:w-32 opacity-[0.072] rotate-[18deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[18%] left-[20%] w-12 sm:w-20 md:w-24 opacity-[0.052] rotate-[8deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[25%] right-[15%] w-14 sm:w-20 md:w-28 opacity-[0.059] rotate-[-10deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[40%] left-[5%] w-14 sm:w-20 md:w-28 opacity-[0.065] rotate-[15deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[45%] right-[5%] w-16 sm:w-24 md:w-32 opacity-[0.072] rotate-[-8deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[60%] left-[25%] w-12 sm:w-20 md:w-24 opacity-[0.052] rotate-[-5deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[65%] right-[22%] w-14 sm:w-20 md:w-28 opacity-[0.065] rotate-[12deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[20%] left-[8%] w-14 sm:w-20 md:w-28 opacity-[0.072] rotate-[22deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[15%] right-[10%] w-16 sm:w-24 md:w-32 opacity-[0.078] rotate-[-12deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[5%] left-[45%] w-12 sm:w-20 md:w-24 opacity-[0.052] rotate-[5deg]" />
      </div>

      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Logo + Header - Asymmetric Layout */}
        <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-10 md:gap-12 lg:gap-16 mb-12 sm:mb-16">
          {/* Logo Side */}
          <div
            ref={logoReveal.ref}
            className={`${revealClass(logoReveal.isRevealed, "left")} flex-shrink-0 relative`}
          >
            {/* Decorative Frame Behind Logo */}
            <div className="absolute -inset-3 sm:-inset-5 border-2 border-white/10 rounded-2xl sm:rounded-3xl -rotate-3" />
            <div className="absolute -inset-3 sm:-inset-5 border-2 border-[hsl(var(--burgundy)/0.3)] rounded-2xl sm:rounded-3xl rotate-2" />

            <div className="relative bg-white/10 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-10 border border-white/20 shadow-xl">
              <img
                src={logoFullColor.src}
                alt="Bolsa Atleta USA"
                className="w-28 sm:w-40 md:w-52 h-auto"
              />
            </div>
          </div>

          {/* Text Side */}
          <div
            ref={textReveal.ref}
            className={`${revealClass(textReveal.isRevealed, "right")} text-center md:text-left flex-1`}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-4 sm:mb-6">
              <Lightbulb className="w-3.5 h-3.5 text-[hsl(var(--burgundy-glow))]" />
              <span className="text-xs sm:text-sm font-semibold text-white/80">{t("landing.whatIsEEI.badge")}</span>
            </div>

            <h2 className="text-[1.65rem] sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 leading-tight">
              {t("landing.whatIsEEI.title1")}{" "}
              <span className="block text-gradient-on-dark">
                {t("landing.whatIsEEI.title2")}
              </span>
            </h2>
          </div>
        </div>

        {/* Main Content */}
        <div
          ref={contentReveal.ref}
          className={`${revealClass(contentReveal.isRevealed)} max-w-4xl mx-auto`}
        >
          <div className="relative p-6 sm:p-10 md:p-12 rounded-2xl sm:rounded-3xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.08]">
            {/* Accent Line */}
            <div className="absolute top-0 left-6 right-6 sm:left-10 sm:right-10 h-1 bg-gradient-to-r from-[hsl(var(--burgundy))] via-[hsl(var(--burgundy-glow))] to-[hsl(var(--burgundy))] rounded-b-full" />

            <div className="space-y-6 sm:space-y-8">
              <p className="text-[15px] sm:text-lg md:text-xl text-white leading-relaxed">
                {t("landing.whatIsEEI.p1Before")}<span className="font-semibold text-[hsl(var(--burgundy-glow))]">{t("landing.eeiName")}</span>{" "}
                {t("landing.whatIsEEI.p1After")}
              </p>

              <p className="text-[15px] sm:text-lg md:text-xl text-white/85 leading-relaxed">
                {t("landing.whatIsEEI.p2Before")} <span className="text-white font-medium">{t("landing.whatIsEEI.p2Bold")}</span>{t("landing.whatIsEEI.p2After")}
              </p>
            </div>

            {/* Visual Indicators */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-white/[0.08]">
              <div className="text-center">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg shadow-[hsl(var(--burgundy)/0.3)]">
                  <Target className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-white">{t("landing.whatIsEEI.criteria")}</span>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg shadow-[hsl(var(--burgundy)/0.3)]">
                  <Compass className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-white">{t("landing.whatIsEEI.guidance")}</span>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] flex items-center justify-center mx-auto mb-2 sm:mb-3 shadow-lg shadow-[hsl(var(--burgundy)/0.3)]">
                  <ArrowRight className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-white">{t("landing.whatIsEEI.vision")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

WhatIsEEISection.displayName = "WhatIsEEISection";

export default WhatIsEEISection;
