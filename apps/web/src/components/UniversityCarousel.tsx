"use client";

import { ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import AutoScroll from "embla-carousel-auto-scroll";
import logoBadgeDark from "@/assets/logo-badge-dark.png";
import { useLanguage } from "@/i18n";

// Local logo imports
import logoDme from "@/assets/academys/logoDME.png";
import logoHoosac from "@/assets/academys/logoHoosac.svg";
import logoImgAcademy from "@/assets/academys/logoIMGAcademy.svg";
import logoKiski from "@/assets/academys/logoKiski.png";
import logoWesttown from "@/assets/academys/logoWesttown.webp";
import logoHotchkiss from "@/assets/academys/logoHotchkiss.png";
import logoAndover from "@/assets/academys/logoAndover.png";
import logoSanDomenico from "@/assets/academys/logoSanDomenico.png";
import logoBenficaRa from "@/assets/academys/logoBenfica.png";
import logoStanford from "@/assets/academys/logoStanford.png";
import logoDuke from "@/assets/academys/logoDuke.png";
import logoUcla from "@/assets/academys/logoUcla.png";
import logoHarvard from "@/assets/academys/logoHavard.png";
import logoYale from "@/assets/academys/logoYale.png";
import logoPrinceton from "@/assets/academys/logoPrinceton.png";
import logoMichigan from "@/assets/academys/logoMichigan.png";
import logoColumbia from "@/assets/academys/logoColumbia.png";
import logoJhu from "@/assets/academys/logoHopkins.png";
import logoUchicago from "@/assets/academys/logoChicago.webp";
import logoNyu from "@/assets/academys/logoNyu.png";
import logoLoomis from "@/assets/academys/logoLoomis.png";
import logoMiami from "@/assets/academys/logoMiami.png";
import logoSanDiego from "@/assets/academys/logoSanDiego.png";
import logoThomasMore from "@/assets/academys/logoThomasMore.png";
import logoUsc from "@/assets/academys/logoUsc.svg";
import logoVermontAcademy from "@/assets/academys/logoVermontAcademy.png";
import logoTaft from "@/assets/academys/logoTaft.png";
import logoSpire from "@/assets/academys/logoSpire.png";
import logoMontverde from "@/assets/academys/logoMontverde.png";
import logoHyde from "@/assets/academys/logoHyde.jpg";
import logoWebb from "@/assets/academys/logoWebb.png";
import logoUMass from "@/assets/academys/logoUMass.png";
import logoCombineGoats from "@/assets/academys/logoCombineGoats.png";
import logoDarrowSchool from "@/assets/academys/logoDarrowSchool.png";
import logoBaylor from "@/assets/academys/logoBaylor.png";


const universities = [
  { name: "Taft", logo: logoTaft },
  { name: "Spire", logo: logoSpire },
  { name: "Montverde", logo: logoMontverde },
  { name: "IMG Academy", logo: logoImgAcademy },
  { name: "Stanford", logo: logoStanford },
  { name: "Duke", logo: logoDuke },
  { name: "UCLA", logo: logoUcla },
  { name: "Harvard", logo: logoHarvard },
  { name: "Yale", logo: logoYale },
  { name: "Princeton", logo: logoPrinceton },
  { name: "Michigan", logo: logoMichigan },
  { name: "Columbia", logo: logoColumbia },
  { name: "Johns Hopkins", logo: logoJhu },
  { name: "UChicago", logo: logoUchicago },
  { name: "DME Academy", logo: logoDme },
  { name: "Hoosac School", logo: logoHoosac },
  { name: "Kiski School", logo: logoKiski },
  { name: "San Domenico", logo: logoSanDomenico },
  { name: "Westtown", logo: logoWesttown },
  { name: "Hotchkiss", logo: logoHotchkiss },
  { name: "Andover", logo: logoAndover },
  { name: "Benfica", logo: logoBenficaRa },
  { name: "NYU", logo: logoNyu },
  { name: "Loomis Chaffee", logo: logoLoomis },
  { name: "University of Miami", logo: logoMiami },
  { name: "UC San Diego", logo: logoSanDiego },
  { name: "St. Thomas More", logo: logoThomasMore },
  { name: "USC", logo: logoUsc },
  { name: "Vermont Academy", logo: logoVermontAcademy },
  { name: "Hyde School", logo: logoHyde },
  { name: "Webb School", logo: logoWebb },
  { name: "UMass", logo: logoUMass },
  { name: "Combine Goats", logo: logoCombineGoats },
  { name: "Darrow School", logo: logoDarrowSchool },
  { name: "Baylor School", logo: logoBaylor },
];

const UniversityCarousel = () => {
  const { t } = useLanguage();
  const [emblaRef] = useEmblaCarousel(
    {
      loop: true,
      align: "start",
      dragFree: true,
    },
    [
      AutoScroll({
        speed: 1,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      })
    ]
  );

  return (
    <section className="py-12 sm:py-16 overflow-hidden relative">
      {/* Light Premium Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50/80 to-slate-100" />

      {/* Subtle Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-[hsl(var(--burgundy)/0.03)] to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-[hsl(var(--navy-deep)/0.03)] to-transparent" />
      </div>

      {/* Watermark Logos - Light Premium (+50% size, +70% opacity) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <img src={logoBadgeDark.src} alt="" className="absolute top-[5%] left-[2%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[-10deg]" />
        <img src={logoBadgeDark.src} alt="" className="absolute top-[8%] right-[8%] w-16 sm:w-24 md:w-32 opacity-[0.077] rotate-[15deg]" />
        <img src={logoBadgeDark.src} alt="" className="absolute top-[30%] left-[15%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[8deg]" />
        <img src={logoBadgeDark.src} alt="" className="absolute top-[35%] right-[12%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[-12deg]" />
        <img src={logoBadgeDark.src} alt="" className="absolute top-[55%] left-[5%] w-14 sm:w-20 md:w-28 opacity-[0.077] rotate-[18deg]" />
        <img src={logoBadgeDark.src} alt="" className="absolute top-[60%] right-[5%] w-16 sm:w-24 md:w-32 opacity-[0.068] rotate-[-8deg]" />
        <img src={logoBadgeDark.src} alt="" className="absolute bottom-[20%] left-[25%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[-5deg]" />
        <img src={logoBadgeDark.src} alt="" className="absolute bottom-[15%] right-[22%] w-14 sm:w-20 md:w-28 opacity-[0.068] rotate-[10deg]" />
        <img src={logoBadgeDark.src} alt="" className="absolute bottom-[5%] left-[45%] w-12 sm:w-20 md:w-24 opacity-[0.06] rotate-[5deg]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 mb-8 sm:mb-10 relative z-10">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--burgundy)/0.08)] border border-[hsl(var(--burgundy)/0.12)] mb-4 sm:mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--burgundy))]" />
            <span className="text-xs sm:text-sm font-semibold text-[hsl(var(--burgundy))]">{t("landing.universityCarousel.badge")}</span>
          </div>
          <h2 className="text-lg sm:text-3xl md:text-4xl font-bold mt-3 sm:mt-4 px-2 text-[hsl(var(--navy-deep))]">
            {t("landing.universityCarousel.title1")}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(var(--burgundy))] to-[hsl(var(--burgundy-glow))]">{t("landing.universityCarousel.title2")}</span>
          </h2>
        </div>
      </div>

      {/* Mobile Swipe Hint */}
      <p className="flex items-center justify-center gap-1 text-xs text-slate-400 mb-3 sm:hidden animate-pulse relative z-10">
        <span>{t("landing.universityCarousel.swipeHint")}</span>
        <ChevronRight className="w-3 h-3" />
      </p>

      {/* Embla Carousel Container */}
      <div className="relative z-10">
        {/* Gradient Masks */}
        <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-32 bg-gradient-to-r from-white to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-32 bg-gradient-to-l from-white to-transparent z-10" />

        {/* Carousel */}
        <div className="overflow-hidden cursor-grab active:cursor-grabbing" ref={emblaRef}>
          <div className="flex">
            {/* Duplicate universities for seamless infinite loop */}
            {[...universities, ...universities, ...universities].map((uni, index) => (
              <div
                key={`${uni.name}-${index}`}
                className="flex-shrink-0 w-28 sm:w-48 h-20 sm:h-32 mx-4 sm:mx-8 flex items-center justify-center group"
              >
                <div className="flex items-center justify-center w-24 h-16 sm:w-40 sm:h-24 px-2">
                  <img
                    src={uni.logo.src}
                    alt={uni.name}
                    className="max-h-full max-w-full w-auto h-auto object-contain opacity-70 group-hover:opacity-100 transition-opacity duration-300"
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default UniversityCarousel;