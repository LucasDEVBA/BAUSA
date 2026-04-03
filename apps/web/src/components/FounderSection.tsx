"use client";

import { useMemo } from "react";
import { Award, Brain, Shield, ArrowRight, Globe } from "lucide-react";
import leandroPhoto from "@/assets/leandro-ribeiro.jpg";
import logoBadgeDark from "@/assets/logo-badge-dark.png";
import { Link } from "@/i18n/navigation";
import { useScrollReveal, revealClass } from "@/hooks/useScrollReveal";
import { useLanguage } from "@/i18n";

const FounderSection = () => {
  const { t } = useLanguage();
  const headerReveal = useScrollReveal();
  const photoReveal = useScrollReveal();
  const contentReveal = useScrollReveal();

  // Qualitative badges - on desktop: positioned over the photo; on mobile: below image
  const credentials = useMemo(() => [
    { icon: Shield, label: t("landing.founder.credentials.safe") },
    { icon: Brain, label: t("landing.founder.credentials.eei") },
    { icon: Globe, label: t("landing.founder.credentials.presence") },
  ], [t]);

  return (
    <section className="py-16 sm:py-24 md:py-32 relative">
      {/* Premium Light Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/80 to-slate-100" />

      {/* Subtle Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[hsl(var(--burgundy)/0.03)] to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-[hsl(var(--navy-deep)/0.03)] to-transparent" />
      </div>

      {/* Watermark Logos - Light Premium (+50% size, +70% opacity) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[3%] left-[2%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[-12deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[6%] right-[8%] w-16 sm:w-24 md:w-32 opacity-[0.077] rotate-[18deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[20%] left-[18%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[8deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[28%] right-[15%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[-10deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[45%] left-[5%] w-14 sm:w-20 md:w-28 opacity-[0.077] rotate-[22deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[50%] right-[5%] w-16 sm:w-24 md:w-32 opacity-[0.068] rotate-[-8deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[65%] left-[25%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[-5deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute top-[70%] right-[22%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[12deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute bottom-[15%] left-[8%] w-14 sm:w-20 md:w-28 opacity-[0.077] rotate-[15deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute bottom-[10%] right-[12%] w-16 sm:w-24 md:w-32 opacity-[0.068] rotate-[-12deg]" />
        <img src={logoBadgeDark.src} alt="" loading="lazy" className="absolute bottom-[5%] left-[45%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[5deg]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-6xl mx-auto">

          {/* Section Header - Decorative Badge Only */}
          <div
            ref={headerReveal.ref}
            className={`${revealClass(headerReveal.isRevealed)} text-center mb-12 sm:mb-16`}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[hsl(var(--burgundy)/0.08)] border border-[hsl(var(--burgundy)/0.12)] mb-4 sm:mb-5">
              <Shield className="w-3.5 h-3.5 text-[hsl(var(--burgundy))]" />
              <span className="text-[11px] sm:text-xs font-semibold text-[hsl(var(--burgundy))] tracking-wider uppercase">{t("landing.founder.badge")}</span>
            </div>

            <h2 className="text-[1.5rem] sm:text-3xl md:text-4xl lg:text-5xl font-bold text-[hsl(var(--navy-deep))] leading-tight">
              {t("landing.founder.title1")}{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))]">
                {t("landing.founder.title2")}
              </span>
            </h2>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">

            {/* Photo Column - With badges on desktop */}
            <div
              ref={photoReveal.ref}
              className={`${revealClass(photoReveal.isRevealed, "left")} lg:col-span-2`}
            >
              {/* Photo with Name */}
              <div className="relative max-w-[280px] sm:max-w-xs mx-auto lg:max-w-none lg:ml-auto">
                {/* Decorative Frame */}
                <div className="absolute -inset-3 border border-[hsl(var(--burgundy)/0.1)] rounded-2xl" />

                <div className="relative rounded-xl shadow-xl shadow-[hsl(var(--navy-deep)/0.12)]">
                  <img
                    src={leandroPhoto.src}
                    alt={`Leandro Ribeiro - ${t("landing.founder.founderTitle")}`}
                    className="w-full aspect-[3/4] object-cover object-top rounded-xl"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--navy-deep)/0.9)] via-[hsl(var(--navy-deep)/0.2)] to-transparent rounded-xl" />

                  {/* Name Badge on Photo */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-white/95 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-slate-200/80 shadow-lg">
                      <h3 className="text-base sm:text-lg font-bold text-[hsl(var(--navy-deep))]">Leandro Ribeiro</h3>
                      <p className="text-[hsl(var(--burgundy))] font-medium text-xs sm:text-sm">{t("landing.founder.founderTitle")}</p>
                    </div>
                  </div>

                  {/* Desktop Only: Badges on the LEFT side of the photo */}
                  <div className="hidden lg:flex absolute top-8 left-0 -translate-x-1/2 flex-col gap-3 z-20">
                    {credentials.map((cred, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 border border-slate-100 shadow-xl whitespace-nowrap"
                      >
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] flex items-center justify-center shadow-md shadow-[hsl(var(--burgundy)/0.3)]">
                          <cred.icon className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-base font-bold text-[hsl(var(--navy-deep))]">{cred.label.split(' ')[0]}</span>
                          <span className="text-xs text-[hsl(var(--burgundy))]">{cred.label.split(' ').slice(1).join(' ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mobile Only: Credentials Badges — 2 curtos em cima + EEI® centralizado abaixo */}
              <div className="mt-6 max-w-[300px] sm:max-w-xs mx-auto lg:hidden">

                {/* Linha 1: Método S.A.F.E.® + Presença nos EUA — curtos, cabem lado a lado */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[credentials[0], credentials[2]].map((cred) => (
                    <div
                      key={cred.label}
                      className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-slate-200/80 shadow-sm"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[hsl(var(--burgundy)/0.08)] flex items-center justify-center flex-shrink-0">
                        <cred.icon className="w-3.5 h-3.5 text-[hsl(var(--burgundy))]" />
                      </div>
                      <span className="text-[11px] font-medium text-[hsl(var(--navy-deep))] leading-tight">{cred.label}</span>
                    </div>
                  ))}
                </div>

                {/* Linha 2: Educação Esportiva Inteligente — centralizado e sem quebra de linha */}
                <div className="flex justify-center mt-2.5">
                  {[credentials[1]].map((cred) => (
                    <div
                      key={cred.label}
                      className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 border border-slate-200/80 shadow-sm"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[hsl(var(--burgundy)/0.08)] flex items-center justify-center flex-shrink-0">
                        <cred.icon className="w-3.5 h-3.5 text-[hsl(var(--burgundy))]" />
                      </div>
                      <span className="text-[11px] font-medium text-[hsl(var(--navy-deep))] whitespace-nowrap">{cred.label}</span>
                    </div>
                  ))}
                </div>

              </div>
            </div>

            {/* Content Column */}
            <div
              ref={contentReveal.ref}
              className={`${revealClass(contentReveal.isRevealed, "right")} lg:col-span-3 space-y-5 sm:space-y-6`}
            >
              {/* Lead */}
              <p className="text-sm sm:text-base text-slate-500">
                {t("landing.founder.lead")} <span className="text-[hsl(var(--navy-deep))] font-medium">{t("landing.founder.leadBold")}</span>.
              </p>

              {/* Main Content - Scannable */}
              <div className="space-y-4 text-[15px] sm:text-base text-slate-600 leading-relaxed">
                <p>
                  <span className="text-[hsl(var(--navy-deep))] font-semibold">Leandro Ribeiro</span>{" "}{t("landing.founder.p1")}
                </p>

                <p>
                  {t("landing.founder.p2Before")}{" "}<span className="text-[hsl(var(--navy-deep))] font-medium">{t("landing.founder.p2Bold1")}</span>{t("landing.founder.p2Mid")}{" "}<span className="text-[hsl(var(--navy-deep))] font-medium">{t("landing.founder.p2Bold2")}</span>{" "}{t("landing.founder.p2And")}{" "}<span className="text-[hsl(var(--navy-deep))] font-medium">{t("landing.founder.p2Bold3")}</span>{t("landing.founder.p2End")}
                </p>
              </div>

              {/* Highlight Box */}
              <div className="relative p-4 sm:p-5 rounded-xl bg-gradient-to-r from-[hsl(var(--navy-deep)/0.04)] to-[hsl(var(--burgundy)/0.04)] border border-[hsl(var(--navy-deep)/0.08)]">
                <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed">
                  {t("landing.founder.highlightBoxBefore")}<span className="text-[hsl(var(--burgundy))] font-semibold">{t("landing.brandName")}</span>, {t("landing.founder.highlightBoxAfter")}
                </p>
              </div>

              {/* Recognition Badge */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] flex items-center justify-center shadow-md">
                  <Award className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[hsl(var(--navy-deep))] font-medium text-sm">{t("landing.founder.recognition1")}</p>
                  <p className="text-[hsl(var(--burgundy))] font-semibold text-sm">{t("landing.founder.recognition2")}</p>
                </div>
              </div>

              {/* CTA - Subtle Blue Navy */}
              <div
                className="pt-4"
              >
                <Link
                  href="/forms"
                  className="group inline-flex items-center gap-2.5 px-5 sm:px-6 py-3.5 rounded-xl bg-gradient-to-r from-[hsl(var(--navy-deep))] to-[hsl(var(--navy-medium))] hover:from-[hsl(var(--navy-medium))] hover:to-[hsl(var(--navy-deep))] text-white font-semibold text-sm sm:text-[15px] shadow-lg shadow-[hsl(var(--navy-deep)/0.25)] hover:shadow-xl hover:shadow-[hsl(var(--navy-deep)/0.3)] transition-all duration-300"
                >
                  <span>{t("landing.founder.cta")}</span>
                  <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FounderSection;
