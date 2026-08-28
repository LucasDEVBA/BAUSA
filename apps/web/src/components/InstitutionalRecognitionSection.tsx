"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useScrollReveal, revealClass } from "@/hooks/useScrollReveal";
import { Play, X, Building2, MapPin } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/i18n";
import leandroHarvard from "@/assets/leandro-harvard.jpg";
import thumbTaft from "@/assets/thumb-Taft.jpg";
import thumbBenfica from "@/assets/thumb-benfica.jpg";
import thumbImgAcademy from "@/assets/thumb-imgAcademy.jpg";
import thumbMiami from "@/assets/thumb-miami.jpg";
import thumbFlorida from "@/assets/thumb-florida.jpg";
import logoWatermark from "@/assets/logo-watermark.png";
import type { StaticImageData } from "next/image";

interface Institution {
  id: string;
  name: string;
  location: string;
  type: "university" | "prep-school";
  photo: StaticImageData;
  /** Compensa o crop 16:9 nas fotos verticais (mantém rostos no quadro) */
  imagePosition?: string;
  youtubeId: string;
}

// 3 escolas (prep-school) + 3 faculdades (university), nesta ordem no grid.
const institutions: Institution[] = [
  {
    id: "benfica",
    name: "Benfica Residential Academy",
    location: "Saint Leo, FL",
    type: "prep-school",
    photo: thumbBenfica,
    youtubeId: "Byr7E1W8JSk",
  },
  {
    id: "img-academy",
    name: "IMG Academy",
    location: "Bradenton, FL",
    type: "prep-school",
    photo: thumbImgAcademy,
    youtubeId: "zlJ3WUHY_BI",
  },
  {
    id: "taft",
    name: "The Taft School",
    location: "Watertown, CT",
    type: "prep-school",
    photo: thumbTaft,
    imagePosition: "50% 35%",
    youtubeId: "ZPXd4GKYvQ8",
  },
  {
    id: "miami",
    name: "University of Miami",
    location: "Coral Gables, FL",
    type: "university",
    photo: thumbMiami,
    youtubeId: "gvcUVL0j_eQ",
  },
  {
    id: "florida",
    name: "University of Florida",
    location: "Gainesville, FL",
    type: "university",
    photo: thumbFlorida,
    youtubeId: "gpT0gG8nK6U",
  },
  {
    id: "harvard",
    name: "Harvard University",
    location: "Cambridge, MA",
    type: "university",
    photo: leandroHarvard,
    imagePosition: "50% 30%",
    youtubeId: "qlSNBAQQPUs", // Placeholder video
  },
];

const InstitutionalRecognitionSection = () => {
  const { t } = useLanguage();
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const headerReveal = useScrollReveal();
  const cardsReveal = useScrollReveal();
  const bottomReveal = useScrollReveal();

  return (
    <section className="relative py-16 sm:py-24 md:py-32 overflow-hidden">
      {/* Dark Premium Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--navy-deep))] via-[hsl(var(--navy-medium))] to-[hsl(var(--navy-deep))]" />

      {/* Radial Glow */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[hsl(var(--burgundy)/0.08)] rounded-full blur-[150px]" />
      </div>

      {/* Watermark Logos */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[8%] left-[5%] w-20 sm:w-28 md:w-36 opacity-[0.03] rotate-[-15deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute top-[12%] right-[8%] w-16 sm:w-24 md:w-32 opacity-[0.025] rotate-[20deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[15%] left-[10%] w-20 sm:w-24 md:w-32 opacity-[0.025] rotate-[25deg]" />
        <img src={logoWatermark.src} alt="" loading="lazy" className="absolute bottom-[10%] right-[12%] w-20 sm:w-28 md:w-36 opacity-[0.03] rotate-[-10deg]" />
      </div>

      {/* Subtle Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
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
            <Building2 className="w-4 h-4 text-white/80" />
            <span className="text-xs sm:text-sm font-semibold text-white/80 tracking-wide">{t("landing.institutionalRecognition.badge")}</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6 leading-tight">
            {t("landing.institutionalRecognition.title1")}{" "}
            <span className="text-gradient-on-dark">
              {t("landing.institutionalRecognition.title2")}
            </span>
          </h2>

          <p className="text-base sm:text-lg text-white/85 max-w-2xl mx-auto leading-relaxed">
            {t("landing.institutionalRecognition.subtitle")}
          </p>
        </div>

        {/* Institution Cards Grid */}
        <div
          ref={cardsReveal.ref}
          className={`${revealClass(cardsReveal.isRevealed)} grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto`}
        >
          {institutions.map((institution, index) => (
            <div
              key={institution.id}
              className="group"
            >
              <div className="relative h-full rounded-2xl sm:rounded-3xl overflow-hidden bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] hover:bg-white/[0.06] hover:border-white/[0.15] transition-all duration-500 hover:-translate-y-1">
                {/* Image Container */}
                <div className="relative aspect-video overflow-hidden">
                  <img
                    src={institution.photo.src}
                    alt={`${t("landing.institutionalRecognition.photoAltPrefix")} ${institution.name}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    style={{ objectPosition: institution.imagePosition ?? "center" }}
                    loading="lazy"
                    decoding="async"
                  />

                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--navy-deep)/0.95)] via-[hsl(var(--navy-deep)/0.4)] to-transparent" />

                  {/* Video Interface Elements Overlay */}
                  <div
                    className="absolute inset-0 cursor-pointer flex flex-col justify-between p-4"
                    onClick={() => setActiveVideo(institution.id)}
                  >
                    {/* Top Right: REC Indicator */}
                    <div className="flex justify-end">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-md border border-white/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-white tracking-widest uppercase">REC</span>
                      </div>
                    </div>

                    {/* Bottom: Progress + Play Button Integration */}
                    <div className="space-y-3">
                      <div className="flex items-end justify-between">
                        <div className="flex-1 min-w-0 pr-4">
                          <h3 className="text-lg sm:text-xl font-bold text-white mb-0.5 leading-tight truncate">
                            {institution.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-white/80">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="text-xs sm:text-sm">{institution.location}</span>
                          </div>
                        </div>
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))] border border-white/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-[hsl(var(--burgundy)/0.4)] transition-all duration-300 shadow-xl">
                          <Play className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 text-white fill-current ml-0.5" />
                        </div>
                      </div>

                      {/* Video Progress Bar */}
                      <div className="relative h-0.5 w-full bg-white/20 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: "65%" }}
                          whileHover={{ width: "100%" }}
                          transition={{ duration: 0.5 }}
                          className="absolute inset-y-0 left-0 bg-white/80 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Institution Type Badge */}
                  <div className="absolute top-4 left-4">
                    <div className={`px-3 py-1.5 rounded-full backdrop-blur-md ${institution.type === 'university'
                      ? 'bg-[hsl(var(--burgundy)/0.9)] text-white'
                      : 'bg-white/20 text-white'
                      }`}>
                      <span className="text-[10px] sm:text-xs font-semibold">
                        {institution.type === 'university' ? t("landing.institutionalRecognition.typeUniversity") : t("landing.institutionalRecognition.typePrepSchool")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                {/* <div className="p-4 sm:p-5 bg-white/[0.02] border-t border-white/[0.05]">
                  <p className="text-sm text-white/70">{institution.description}</p>
                </div> */}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <div
          ref={bottomReveal.ref}
          className={`${revealClass(bottomReveal.isRevealed)} text-center mt-10 sm:mt-14`}
        >
          <p className="text-white/70 text-sm sm:text-base">
            {t("landing.institutionalRecognition.bottomNote")}
          </p>
        </div>
      </div>

      {/* Video Modal */}
      <AnimatePresence>
        {activeVideo && (
          <motion.div
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
            onClick={() => setActiveVideo(null)}
          >
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* YouTube Embed */}
              <iframe
                src={`https://www.youtube.com/embed/${institutions.find(i => i.id === activeVideo)?.youtubeId}?autoplay=1&rel=0`}
                title="Video Tour"
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />

              {/* Close button */}
              <button
                onClick={() => setActiveVideo(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default InstitutionalRecognitionSection;
