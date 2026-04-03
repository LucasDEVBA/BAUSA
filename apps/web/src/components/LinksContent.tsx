"use client";

import { motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Instagram, Youtube, ClipboardCheck, Globe } from "lucide-react";
import { useLanguage } from "@/i18n";
import logoWhite from "@/assets/logo-white.png";
import logoWatermark from "@/assets/logo-watermark.png";
import leandroPhoto from "@/assets/leandro-founder-card.jpg";
import soccerFieldBg from "@/assets/soccer-field-bg.jpg";
import LanguageSelector from "@/components/LanguageSelector";

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function LinksContent() {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[100dvh] flex flex-col items-center px-4 py-8 overflow-hidden font-sans">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-medium))] to-[hsl(var(--navy-deep))]" />
      <div className="absolute inset-0 bg-black/10" />

      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[hsl(var(--burgundy)/0.04)] rounded-full blur-[200px]" />
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[3%] left-[2%] w-14 sm:w-20 md:w-28 opacity-[0.035] rotate-[-10deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[5%] right-[8%] w-16 sm:w-24 md:w-32 opacity-[0.042] rotate-[15deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[18%] left-[15%] w-12 sm:w-20 md:w-24 opacity-[0.025] rotate-[8deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[25%] right-[12%] w-14 sm:w-20 md:w-28 opacity-[0.035] rotate-[-12deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[40%] left-[5%] w-14 sm:w-20 md:w-28 opacity-[0.042] rotate-[20deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[45%] right-[5%] w-16 sm:w-24 md:w-32 opacity-[0.035] rotate-[-8deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[60%] left-[20%] w-12 sm:w-20 md:w-24 opacity-[0.025] rotate-[-5deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[65%] right-[18%] w-14 sm:w-20 md:w-28 opacity-[0.035] rotate-[12deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[20%] left-[8%] w-14 sm:w-20 md:w-28 opacity-[0.042] rotate-[15deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[15%] right-[10%] w-16 sm:w-24 md:w-32 opacity-[0.035] rotate-[-10deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[5%] left-[40%] w-12 sm:w-20 md:w-24 opacity-[0.025] rotate-[5deg]" />
      </div>

      <div className="absolute inset-0 opacity-[0.02]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="absolute top-5 right-5 z-20">
        <div className="bg-white/5 backdrop-blur-md rounded-full px-2 py-1 border border-white/10 hover:bg-white/10 transition-colors duration-300">
          <LanguageSelector variant="dark" size="lg" />
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-md w-full mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <img src={logoWhite.src} alt="Bolsa Atleta USA" className="w-40 sm:w-48 h-auto opacity-100 drop-shadow-2xl" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-8 w-full max-w-[340px] md:max-w-[400px]"
        >
          <h1 className="text-white text-[13px] md:text-sm font-bold tracking-[0.14em] mb-3 uppercase opacity-90 drop-shadow-lg">
            {t("links.brand")}
          </h1>
          <p className="text-white/70 text-[13px] md:text-sm font-medium leading-relaxed mx-auto mb-4 antialiased">
            {t("links.subtitle")}
          </p>
          <div className="flex flex-col items-center gap-2 mx-auto">
            <span className="inline-block rounded-full px-4 py-1.5 bg-[hsl(var(--burgundy)/0.1)] border border-[hsl(var(--burgundy)/0.2)] text-[hsl(var(--burgundy-glow))] text-[10px] sm:text-[11px] font-bold tracking-wider uppercase backdrop-blur-sm whitespace-nowrap">
              {t("links.limitedSpots")}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex items-center justify-center gap-4 mb-10"
        >
          <a href="https://instagram.com/bolsaatletausa" target="_blank" rel="noopener noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-white/[0.03] border border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20 hover:scale-105 transition-all duration-300" aria-label="Instagram">
            <Instagram className="w-5 h-5" />
          </a>
          <a href="https://tiktok.com/@bolsaatletausa" target="_blank" rel="noopener noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-white/[0.03] border border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20 hover:scale-105 transition-all duration-300" aria-label="TikTok">
            <TikTokIcon className="w-5 h-5" />
          </a>
          <a href="https://youtube.com/@bolsaatletausa" target="_blank" rel="noopener noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-white/[0.03] border border-white/10 text-white/50 hover:text-white hover:bg-white/10 hover:border-white/20 hover:scale-105 transition-all duration-300" aria-label="YouTube">
            <Youtube className="w-5 h-5" />
          </a>
          <div className="w-px h-5 bg-white/10" />
          <Link href="/" className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.05] border border-white/10 hover:bg-white/10 hover:border-white/20 hover:scale-105 text-white/90 text-xs font-semibold uppercase tracking-wider transition-all duration-300">
            <Globe className="w-4 h-4" />
            <span>{t("links.officialSite")}</span>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-5 w-full max-w-[400px] md:max-w-[440px] px-2 sm:px-0"
        >
          <Link href="/forms" className="group relative overflow-hidden rounded-2xl min-h-[150px] bg-[#020617] border border-white/10 transition-all duration-500 hover:scale-[1.01] hover:border-[hsl(var(--burgundy)/0.4)] shadow-2xl block">
            <div className="flex h-full relative">
              <div className="relative z-10 w-[65%] p-4 sm:p-5 flex flex-col justify-center gap-1.5">
                <div className="flex items-center gap-2 mb-0.5">
                  <div className="w-0.5 h-6 bg-[hsl(var(--burgundy))]" />
                  <span className="text-[9px] font-bold text-white/60 tracking-[0.2em] uppercase">{t("links.card1.label")}</span>
                </div>
                <h3 className="font-bold text-white text-lg sm:text-lg leading-[1.05] uppercase tracking-wide">
                  {t("links.card1.title1")}<br />
                  <span className="text-[hsl(var(--burgundy-glow))]">{t("links.card1.title2")}</span>
                </h3>
                <p className="text-white/50 text-[10px] leading-snug mt-1 max-w-[180px]">{t("links.card1.description")}</p>
                <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-white/90 uppercase tracking-widest group-hover:gap-3 transition-all duration-300">
                  {t("links.card1.cta")}
                  <ArrowRight className="w-3 h-3 text-[hsl(var(--burgundy-glow))]" />
                </div>
              </div>
              <div className="absolute top-0 right-0 h-full w-[40%]">
                <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/20 to-transparent z-10" />
                <img src={leandroPhoto.src} alt="Leandro Ribeiro" className="w-full h-full object-cover object-[center_20%] opacity-80 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700 grayscale-[20%]" />
              </div>
            </div>
          </Link>

          <Link href="/forms" className="group relative overflow-hidden rounded-xl bg-[hsl(var(--navy-deep))] border border-white/5 transition-all duration-500 hover:scale-[1.01] hover:border-white/10 shadow-2xl">
            <div className="relative h-40 sm:h-44 md:h-48">
              <img src={soccerFieldBg.src} alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 grayscale-[30%] transition-transform duration-700 group-hover:scale-105 group-hover:grayscale-0" />
              <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-deep)/0.85)] to-[hsl(var(--navy-deep)/0.40)]" />
              <div className="relative h-full p-5 sm:p-6 flex flex-col justify-center">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 backdrop-blur-md group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-300 shadow-xl">
                    <ClipboardCheck className="w-5 h-5 md:w-6 md:h-6 text-white/90" />
                  </div>
                  <div className="flex-1 pr-4">
                    <h3 className="font-bold text-white text-base sm:text-lg md:text-xl leading-tight mb-1 drop-shadow-md">{t("links.card2.title")}</h3>
                    <p className="text-white/70 text-xs md:text-sm mt-1 leading-relaxed font-light drop-shadow">{t("links.card2.description")}</p>
                  </div>
                  <div className="flex justify-end flex-shrink-0">
                    <span className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/80 group-hover:bg-white group-hover:border-white group-hover:text-[#0a1128] transition-all duration-300">
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          <a href="https://wa.me/+12233508213" target="_blank" rel="noopener noreferrer" className="group relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/5 backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.06] hover:border-white/10 hover:scale-[1.01] shadow-lg">
            <div className="relative p-5 sm:p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-10 h-10 md:w-12 md:h-12 flex items-center justify-center flex-shrink-0">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 border border-emerald-400/30 flex items-center justify-center shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)] text-white">
                    <WhatsAppIcon className="w-5 h-5 drop-shadow-md" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white/90 text-[13px] sm:text-sm md:text-base leading-tight uppercase tracking-wide">{t("links.card3.title")}</h3>
                  <p className="text-white/40 text-[11px] sm:text-xs md:text-[13px] mt-1 font-light tracking-wide">{t("links.card3.description")}</p>
                </div>
              </div>
              <div className="flex justify-end flex-shrink-0 ml-2">
                <span className="text-emerald-400 text-[10px] md:text-xs font-bold uppercase tracking-widest border-b border-emerald-500/30 pb-0.5 group-hover:text-emerald-300 group-hover:border-emerald-400 transition-all duration-300 whitespace-nowrap">{t("links.card3.cta")}</span>
              </div>
            </div>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-12 pt-6 border-t border-white/5 w-full text-center"
        >
          <p className="text-[10px] md:text-xs text-white/20 tracking-[0.2em] uppercase font-medium">{t("links.copyright")}</p>
        </motion.div>
      </div>
    </section>
  );
}
