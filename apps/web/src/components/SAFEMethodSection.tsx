"use client";

import { memo, useMemo } from "react";
import { Fingerprint, GraduationCap, Trophy, Wallet, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import logoBadgeDark from "@/assets/logo-badge-dark.png";
import { useScrollReveal, revealClass } from "@/hooks/useScrollReveal";
import { useLanguage } from "@/i18n";

const SAFEMethodSection = memo(() => {
  const headerReveal = useScrollReveal();
  const pillarsReveal = useScrollReveal();
  const closingReveal = useScrollReveal();
  const { t } = useLanguage();

  const pillars = useMemo(() => [
    {
      icon: Fingerprint,
      letter: "S",
      title: t("landing.safeMethod.pillars.s.title"),
      description: t("landing.safeMethod.pillars.s.description"),
    },
    {
      icon: GraduationCap,
      letter: "A",
      title: t("landing.safeMethod.pillars.a.title"),
      description: t("landing.safeMethod.pillars.a.description"),
    },
    {
      icon: Wallet,
      letter: "F",
      title: t("landing.safeMethod.pillars.f.title"),
      description: t("landing.safeMethod.pillars.f.description"),
    },
    {
      icon: Trophy,
      letter: "E",
      title: t("landing.safeMethod.pillars.e.title"),
      description: t("landing.safeMethod.pillars.e.description"),
    },
  ], [t]);

  return (
    <section className="py-16 sm:py-24 md:py-32 relative overflow-hidden">
      {/* Light Premium Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/80 to-slate-100" />

      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[hsl(var(--burgundy)/0.03)] to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-[hsl(var(--navy-deep)/0.03)] to-transparent" />
      </div>

      {/* Watermark Logos - Light Premium (+50% size, +70% opacity) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[3%] left-[2%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[-12deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[5%] right-[8%] w-16 sm:w-24 md:w-32 opacity-[0.077] rotate-[18deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[18%] left-[18%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[8deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[25%] right-[15%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[-10deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[40%] left-[5%] w-14 sm:w-20 md:w-28 opacity-[0.077] rotate-[20deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[45%] right-[5%] w-16 sm:w-24 md:w-32 opacity-[0.068] rotate-[-8deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[60%] left-[25%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[-5deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[65%] right-[22%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[12deg]" />
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--navy-deep)/0.06)] border border-[hsl(var(--navy-deep)/0.1)] mb-4 sm:mb-6">
            <span className="text-xs sm:text-sm font-semibold text-[hsl(var(--navy-deep))]">{t("landing.safeMethod.badge")}</span>
          </div>

          <p className="text-slate-500 text-sm sm:text-base mb-3 sm:mb-4">
            {t("landing.safeMethod.subtitle")}
          </p>

          <h2 className="text-[1.85rem] sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 text-[hsl(var(--navy-deep))]">
            {t("landing.safeMethod.heading")}{" "}
            <span className="relative inline-block">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))]">
                S.A.F.E.®
              </span>
              <span className="absolute -bottom-1 sm:-bottom-2 left-0 right-0 h-[2px] sm:h-[3px] bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] rounded-full" />
            </span>
          </h2>

          <p className="text-lg sm:text-xl md:text-2xl text-[hsl(var(--navy-deep))] font-medium mb-3 sm:mb-4">
            {t("landing.safeMethod.criteriaLine")}
          </p>

          <p className="text-[15px] sm:text-lg text-slate-500 max-w-2xl mx-auto">
            {t("landing.safeMethod.desc1")}
            <br className="hidden sm:block" />
            {t("landing.safeMethod.desc2")}
          </p>
        </div>

        {/* Pillars Grid */}
        <div
          ref={pillarsReveal.ref}
          className={`${revealClass(pillarsReveal.isRevealed)} grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 max-w-5xl mx-auto mb-12 sm:mb-16`}
        >
          {pillars.map((pillar) => (
            <div
              key={pillar.letter}
              className="group"
            >
              <div className="relative h-full p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-white border border-slate-200/80 shadow-lg shadow-[hsl(var(--navy-deep)/0.06)] hover:shadow-xl hover:border-slate-300/80 transition-all duration-500 hover:-translate-y-1">
                {/* Letter Badge */}
                <div className="flex items-center gap-3 mb-3 sm:mb-4">
                  <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-gradient-to-br from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] flex items-center justify-center shadow-lg shadow-[hsl(var(--burgundy)/0.3)]">
                    <span className="text-lg sm:text-2xl font-black text-white">{pillar.letter}</span>
                  </div>
                  <pillar.icon className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 group-hover:text-[hsl(var(--burgundy))] transition-colors" />
                </div>

                {/* Content */}
                <h3 className="text-base sm:text-lg font-bold text-[hsl(var(--navy-deep))] mb-2">{pillar.title}</h3>
                <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">{pillar.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Closing Statement */}
        <div
          ref={closingReveal.ref}
          className={`${revealClass(closingReveal.isRevealed)} text-center`}
        >
          <p className="text-slate-600 text-sm sm:text-base md:text-lg max-w-2xl mx-auto mb-8 sm:mb-10">
            {t("landing.safeMethod.closingBefore")}{" "}
            <span className="text-[hsl(var(--navy-deep))] font-medium">{t("landing.safeMethod.closingBold")}</span>
            {t("landing.safeMethod.closingAfter")}
          </p>

          <Link
            href="/forms"
            className="group inline-flex items-center gap-2 sm:gap-3 px-5 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] text-white font-semibold text-sm sm:text-base shadow-xl shadow-[hsl(var(--burgundy)/0.3)] hover:shadow-[hsl(var(--burgundy)/0.5)] transition-all duration-500 hover:-translate-y-0.5"
          >
            <span>{t("landing.safeMethod.cta")}</span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </section>
  );
});

SAFEMethodSection.displayName = "SAFEMethodSection";

export default SAFEMethodSection;
