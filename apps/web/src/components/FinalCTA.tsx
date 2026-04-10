"use client";

import { memo } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import logoWatermark from "@/assets/logo-watermark.png";
import { useLanguage } from "@/i18n";
import { trackCtaClick } from "@/lib/tracking/events";

const FinalCTA = memo(() => {
  const { t } = useLanguage();

  return (
    <section className="py-16 sm:py-28 md:py-36 relative overflow-hidden">
      {/* Premium Dark Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-medium))] to-[hsl(var(--navy-deep))]" />

      {/* Radial Glow */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[hsl(var(--burgundy)/0.12)] rounded-full blur-[200px]" />
      </div>

      {/* Watermark Logos - Dark Premium (+50% size, +30% opacity) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[5%] left-[3%] w-14 sm:w-20 md:w-28 opacity-[0.065] rotate-[-10deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[8%] right-[8%] w-16 sm:w-24 md:w-32 opacity-[0.072] rotate-[15deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[25%] left-[15%] w-12 sm:w-20 md:w-24 opacity-[0.052] rotate-[8deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[30%] right-[12%] w-14 sm:w-20 md:w-28 opacity-[0.065] rotate-[-12deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[50%] left-[5%] w-14 sm:w-20 md:w-28 opacity-[0.072] rotate-[20deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[55%] right-[5%] w-16 sm:w-24 md:w-32 opacity-[0.078] rotate-[-8deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[30%] left-[25%] w-12 sm:w-20 md:w-24 opacity-[0.052] rotate-[-5deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[25%] right-[20%] w-14 sm:w-20 md:w-28 opacity-[0.065] rotate-[10deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[10%] left-[8%] w-14 sm:w-20 md:w-28 opacity-[0.072] rotate-[15deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[5%] right-[35%] w-12 sm:w-20 md:w-24 opacity-[0.052] rotate-[-10deg]" />
      </div>

      {/* Subtle Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Premium Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-8 sm:mb-10">
            <Sparkles className="w-4 h-4 text-[hsl(var(--burgundy-glow))]" />
            <span className="text-xs sm:text-sm font-medium text-white/80">{t("landing.finalCTA.badge")}</span>
          </div>

          {/* Main Headline */}
          <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-10 sm:mb-14">
            {t("landing.finalCTA.title1")}{" "}
            <span className="text-gradient-on-dark">
              {t("landing.finalCTA.title2")}
            </span>
            .
          </h2>

          {/* Main CTA Button */}
          <div>
            <Link
              href="/forms"
              onClick={() => trackCtaClick("final")}
              className="group relative inline-flex items-center gap-3 sm:gap-4 px-8 sm:px-12 md:px-16 py-4 sm:py-5 md:py-6 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] text-white font-bold text-base sm:text-lg md:text-xl shadow-2xl hover:shadow-[0_0_60px_hsl(var(--burgundy)/0.5)] transition-all duration-500 hover:-translate-y-1"
            >
              <span>{t("landing.finalCTA.cta")}</span>
              <ArrowRight className="w-5 h-5 sm:w-6 sm:h-6 group-hover:translate-x-2 transition-transform" />

              {/* Glow Effect */}
              <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] blur-xl opacity-40 group-hover:opacity-60 transition-opacity -z-10" />
            </Link>
          </div>

          {/* Subtle bottom note */}
          <p className="mt-6 sm:mt-8 text-white/50 text-xs">
            {t("landing.finalCTA.note")}
          </p>
        </div>
      </div>
    </section>
  );
});

FinalCTA.displayName = "FinalCTA";

export default FinalCTA;
