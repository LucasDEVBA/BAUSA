"use client";

import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import logoWhite from "@/assets/logo-white.png";
import logoWatermark from "@/assets/logo-watermark.png";
import { Link } from "@/i18n/navigation";
import { useLanguage } from "@/i18n";
import { trackCtaClick } from "@/lib/tracking/events";

// URL estática (public/) para permitir preload declarativo no index.html
const HERO_IMAGE_URL = "/hero-campus.jpg";

const HeroSection = memo(() => {
  // Respeita prefers-reduced-motion — desativa animações infinitas em dispositivos
  // que solicitam menos movimento (melhora TBT no mobile e acessibilidade)
  const shouldReduceMotion = useReducedMotion();
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[100dvh] flex flex-col justify-center overflow-hidden">
      {/* 
        BACKGROUND STRATEGY: Static with Institutional Depth
        - Performance-first: No video/heavy animations on mobile
        - Authority: Layered gradients create depth without distraction
        - Legibility: Dark overlays ensure text contrast
      */}
      
      {/* Base Layer: Campus Image */}
      <div className="absolute inset-0">
        <img
          src={HERO_IMAGE_URL}
          alt={t("landing.hero.imgAlt")}
          className="w-full h-full object-cover scale-105"
          fetchPriority="high"
          decoding="async"
          width={1920}
          height={1080}
        />
      </div>
      
      {/* Institutional Depth Layers */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-deep)/0.85)] to-[hsl(var(--navy-deep)/0.95)]" />
      <div className="absolute inset-0 bg-gradient-to-tr from-[hsl(var(--navy-deep)/0.9)] via-transparent to-[hsl(var(--burgundy)/0.15)]" />
      
      {/* Subtle Ambient Glow - Very slow, elegant */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={shouldReduceMotion ? { opacity: 0.05 } : { opacity: [0.03, 0.08, 0.03] }}
          transition={shouldReduceMotion ? {} : { duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-1/4 -right-1/4 w-[80vw] h-[80vw] max-w-[800px] max-h-[800px] rounded-full bg-[hsl(var(--burgundy)/0.2)] blur-[120px]"
        />
        <motion.div
          animate={shouldReduceMotion ? { opacity: 0.04 } : { opacity: [0.02, 0.06, 0.02] }}
          transition={shouldReduceMotion ? {} : { duration: 18, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          className="absolute -bottom-1/4 -left-1/4 w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-[hsl(var(--bau-blue-2)/0.15)] blur-[100px]"
        />
      </div>

      {/* Watermark Logos - Dark Premium Hero (+50% size, +30% opacity) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-[1]">
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[5%] left-[2%] w-14 sm:w-20 md:w-28 opacity-[0.052] rotate-[-12deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[8%] right-[8%] w-16 sm:w-24 md:w-32 opacity-[0.065] rotate-[15deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[22%] left-[15%] w-12 sm:w-20 md:w-24 opacity-[0.046] rotate-[8deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[28%] right-[20%] w-14 sm:w-20 md:w-28 opacity-[0.052] rotate-[-8deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[45%] left-[5%] w-14 sm:w-20 md:w-28 opacity-[0.059] rotate-[20deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[50%] right-[5%] w-16 sm:w-24 md:w-32 opacity-[0.065] rotate-[-15deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[65%] left-[25%] w-12 sm:w-20 md:w-24 opacity-[0.046] rotate-[-5deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[70%] right-[15%] w-14 sm:w-20 md:w-28 opacity-[0.052] rotate-[10deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[15%] left-[8%] w-14 sm:w-20 md:w-28 opacity-[0.059] rotate-[25deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[10%] right-[25%] w-12 sm:w-20 md:w-24 opacity-[0.052] rotate-[-10deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[5%] left-[50%] w-14 sm:w-20 md:w-28 opacity-[0.046] rotate-[5deg]" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            
            {/* Brand Identity - "Quem somos" before "O que fazemos" - LOGO AUMENTADA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-8 sm:mb-10"
            >
              <img 
                src={logoWhite.src} 
                alt="Bolsa Atleta USA" 
                className="h-[108px] sm:h-[96px] lg:h-[104px] w-auto mx-auto sm:mx-0 opacity-90"
              />
            </motion.div>

            {/* Main Headline - Institutional Typography */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-center sm:text-left"
            >
              <span className="block text-[1.75rem] leading-[1.2] sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white mb-2 sm:mb-3">
                {t("landing.hero.headline1")}
              </span>
              <span className="relative inline-block">
                <span className="text-[1.75rem] leading-[1.2] sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-gradient-on-dark">
                  {t("landing.hero.headline2")}
                </span>
                <motion.span
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
                  className="absolute -bottom-1 sm:-bottom-2 left-0 right-0 h-[2px] sm:h-[3px] bg-gradient-to-r from-transparent via-[hsl(var(--burgundy-bright))] to-transparent origin-center"
                />
              </span>
            </motion.h1>

            {/* Authority Indicator — abaixo do título, acima do sub-headline */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.38 }}
              className="mt-5 sm:mt-6 flex justify-center sm:justify-start"
            >
              <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/[0.05] backdrop-blur-sm border border-white/[0.1]">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--burgundy-bright))]" />
                <span className="text-[11px] sm:text-xs tracking-wide text-white/75 uppercase">
                  {t("landing.hero.activeTracking")}
                </span>
              </div>
            </motion.div>

            {/* Sub-headline - Clear hierarchy, generous spacing */}
            <motion.p
              initial={{ opacity: 0, y: 25 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.52 }}
              className="mt-5 sm:mt-6 text-[15px] leading-[1.7] sm:text-lg md:text-xl lg:text-[1.35rem] text-white/90 max-w-2xl text-center sm:text-left"
            >
              {t("landing.hero.sub1")}
              <span className="hidden sm:inline"><br /></span>{" "}
              {t("landing.hero.sub2")}
              <span className="hidden sm:inline"><br /></span>{" "}
              <span className="text-white/75">{t("landing.hero.sub3")}</span>
            </motion.p>

            {/* CTA - Institutional, not startup */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.72 }}
              className="mt-10 sm:mt-12 flex justify-center sm:justify-start"
            >
              <Link
                href="/forms"
                onClick={() => trackCtaClick("hero")}
                className="group relative inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 sm:py-5 rounded-xl font-medium text-[15px] sm:text-base overflow-hidden min-h-[56px] transition-all duration-500"
              >
                {/* Button Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                
                {/* Button Content */}
                <span className="relative z-10 text-white">{t("landing.hero.cta")}</span>
                <ArrowRight className="relative z-10 w-4 h-4 sm:w-5 sm:h-5 text-white/80 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>

            {/* Scroll Anchor — micro-conversão para usuários ainda avaliando */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.4 }}
              className="mt-10 sm:mt-12 flex justify-center sm:justify-start"
            >
              <a
                href="#o-que-e"
                className="inline-flex flex-col items-center sm:items-start gap-1.5 text-white/40 hover:text-white/70 transition-colors"
              >
                <span className="text-[10px] sm:text-[11px] tracking-widest uppercase">{t("landing.hero.learnMore")}</span>
                <motion.div
                  animate={shouldReduceMotion ? {} : { y: [0, 5, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </a>
            </motion.div>

          </div>
        </div>
      </div>

      {/* Bottom Gradient - Seamless transition to next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 sm:h-48 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />
    </section>
  );
});

HeroSection.displayName = "HeroSection";

export default HeroSection;
