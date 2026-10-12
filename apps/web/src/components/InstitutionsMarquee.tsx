"use client";

import type { StaticImageData } from "next/image";

import logoHarvard from "@/assets/academys/logoHavard.png";
import logoStanford from "@/assets/academys/logoStanford.png";
import logoYale from "@/assets/academys/logoYale.png";
import logoDuke from "@/assets/academys/logoDuke.png";
import logoMichigan from "@/assets/academys/logoMichigan.png";
import logoUcla from "@/assets/academys/logoUcla.png";
import logoAndover from "@/assets/academys/logoAndover.png";
import logoHotchkiss from "@/assets/academys/logoHotchkiss.png";
import logoTaft from "@/assets/academys/logoTaft.png";
import logoSpire from "@/assets/academys/logoSpire.png";
import logoImgAcademy from "@/assets/academys/logoIMGAcademy.svg";
import logoMontverde from "@/assets/academys/logoMontverde.png";
import logoUsc from "@/assets/academys/logoUsc.svg";
import logoBaylor from "@/assets/academys/logoBaylor.png";
import { useLanguage } from "@/i18n";

type LogoSize = "wide" | "regular" | "tall" | "xl";

interface Institution {
  name: string;
  logo: StaticImageData;
  // Os arquivos têm margens e proporções muito diferentes; a altura é calibrada por logo
  size: LogoSize;
}

const INSTITUTIONS: Institution[] = [
  { name: "Harvard", logo: logoHarvard, size: "xl" },
  { name: "Stanford", logo: logoStanford, size: "xl" },
  { name: "Yale", logo: logoYale, size: "regular" },
  { name: "Duke", logo: logoDuke, size: "wide" },
  { name: "Michigan", logo: logoMichigan, size: "xl" },
  { name: "UCLA", logo: logoUcla, size: "regular" },
  { name: "USC", logo: logoUsc, size: "tall" },
  { name: "Phillips Andover", logo: logoAndover, size: "xl" },
  { name: "Hotchkiss", logo: logoHotchkiss, size: "tall" },
  { name: "Taft", logo: logoTaft, size: "wide" },
  { name: "Spire Academy", logo: logoSpire, size: "tall" },
  { name: "IMG Academy", logo: logoImgAcademy, size: "tall" },
  { name: "Montverde Academy", logo: logoMontverde, size: "tall" },
  { name: "Baylor", logo: logoBaylor, size: "tall" },
];

const SIZE_CLASS: Record<LogoSize, string> = {
  wide: "h-6 max-w-[120px] sm:h-[30px]",
  regular: "h-8 max-w-[120px] sm:h-10",
  tall: "h-[38px] max-w-[120px] sm:h-[46px]",
  xl: "h-[50px] max-w-[140px] sm:h-[62px]",
};

export default function InstitutionsMarquee() {
  const { t } = useLanguage();

  return (
    <div className="ba-glass flex flex-col items-stretch gap-3 overflow-hidden rounded-3xl py-4 sm:flex-row sm:items-center sm:gap-7 sm:pl-[26px]">
      <p className="m-0 px-[18px] text-center text-[12.5px] font-semibold leading-[1.4] tracking-[0.01em] text-[var(--ba-ink-2)] sm:max-w-[200px] sm:flex-none sm:border-r sm:border-[var(--ba-stroke)] sm:pl-0 sm:pr-[26px] sm:text-left">
        {t("landing.universityCarousel.title1")} {t("landing.universityCarousel.title2")}
      </p>
      <div className="ba-marquee flex-1">
        {/* Lista duplicada: a animação anda -50% e emenda sem salto */}
        <ul className="ba-track !gap-[38px] sm:!gap-[52px]">
          {[...INSTITUTIONS, ...INSTITUTIONS].map((item, index) => {
            const duplicate = index >= INSTITUTIONS.length;
            return (
              <li key={`${item.name}-${index}`} aria-hidden={duplicate || undefined}>
                <img
                  src={item.logo.src}
                  alt={duplicate ? "" : item.name}
                  width={item.logo.width}
                  height={item.logo.height}
                  loading="lazy"
                  className={`${SIZE_CLASS[item.size]} w-auto object-contain opacity-[0.72] [filter:grayscale(1)_contrast(1.1)_brightness(0.55)] transition-[filter,opacity] duration-300 hover:opacity-100 hover:[filter:none]`}
                />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
