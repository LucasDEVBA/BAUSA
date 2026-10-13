"use client";

import Image, { type StaticImageData } from "next/image";
import { Play } from "lucide-react";

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
import logoMiami from "@/assets/academys/logoMiami.png";
import { useVideoPlayer } from "@/components/brand/VideoPlayer";
import { ESCOLAS_TEXT, fill, getSchoolTour } from "@/content/escolas";
import { pick } from "@/content/types";
import { useLanguage } from "@/i18n";

type LogoSize = "wide" | "regular" | "tall" | "xl";

interface Institution {
  name: string;
  logo: StaticImageData;
  // Os arquivos têm margens e proporções muito diferentes; a altura é calibrada por logo
  size: LogoSize;
  /** Slug em schools.ts: com tour no canal, o logo vira atalho para o vídeo. */
  tour?: string;
}

const INSTITUTIONS: Institution[] = [
  { name: "Harvard", logo: logoHarvard, size: "xl", tour: "harvard" },
  { name: "Stanford", logo: logoStanford, size: "xl" },
  { name: "Montverde Academy", logo: logoMontverde, size: "tall", tour: "montverde" },
  { name: "Yale", logo: logoYale, size: "regular" },
  { name: "Duke", logo: logoDuke, size: "wide" },
  { name: "Hotchkiss", logo: logoHotchkiss, size: "tall", tour: "hotchkiss" },
  { name: "Michigan", logo: logoMichigan, size: "xl" },
  { name: "UCLA", logo: logoUcla, size: "regular" },
  { name: "IMG Academy", logo: logoImgAcademy, size: "tall", tour: "img-academy" },
  { name: "USC", logo: logoUsc, size: "tall" },
  { name: "Phillips Andover", logo: logoAndover, size: "xl" },
  { name: "University of Miami", logo: logoMiami, size: "xl", tour: "miami" },
  { name: "Taft", logo: logoTaft, size: "wide", tour: "taft" },
  { name: "Spire Academy", logo: logoSpire, size: "tall" },
  { name: "Baylor", logo: logoBaylor, size: "tall" },
];

const SIZE_CLASS: Record<LogoSize, string> = {
  wide: "h-6 max-w-[120px] sm:h-[30px]",
  regular: "h-8 max-w-[120px] sm:h-10",
  tall: "h-[38px] max-w-[120px] sm:h-[46px]",
  xl: "h-[50px] max-w-[140px] sm:h-[62px]",
};

// Maior caixa de cada tamanho (a do sm) vira o sizes do next/image. Sem isso o navegador
// baixava o PNG original (o de Harvard tem 3840px, o de Andover 526 KB) para 62px de altura
const SIZE_BOX: Record<LogoSize, { height: number; maxWidth: number }> = {
  wide: { height: 30, maxWidth: 120 },
  regular: { height: 40, maxWidth: 120 },
  tall: { height: 46, maxWidth: 120 },
  xl: { height: 62, maxWidth: 140 },
};

function logoSizes(item: Institution): string {
  const box = SIZE_BOX[item.size];
  return `${Math.min(box.maxWidth, Math.ceil((box.height * item.logo.width) / item.logo.height))}px`;
}

const LOGO_TONE =
  "w-auto object-contain opacity-[0.72] [filter:grayscale(1)_contrast(1.1)_brightness(0.55)] transition-[filter,opacity] duration-300";

interface LogoProps {
  item: Institution;
  duplicate: boolean;
}

function MarqueeLogo({ item, duplicate }: LogoProps) {
  const { lang } = useLanguage();
  const { open } = useVideoPlayer();
  const tour = item.tour ? getSchoolTour(item.tour) : undefined;

  const image = (
    <Image
      src={item.logo}
      alt={duplicate || tour ? "" : item.name}
      sizes={logoSizes(item)}
      className={`${SIZE_CLASS[item.size]} ${LOGO_TONE} ${tour ? "group-hover:opacity-100 group-hover:[filter:none] group-focus-visible:opacity-100 group-focus-visible:[filter:none]" : "hover:opacity-100 hover:[filter:none]"}`}
    />
  );

  if (!tour) return image;

  const label = fill(pick(ESCOLAS_TEXT.marqueeWatch, lang), { name: tour.school.name });
  return (
    <button
      type="button"
      onClick={() => open({ id: tour.video.id, kind: tour.video.kind, title: pick(tour.video.title, lang) })}
      aria-label={label}
      title={label}
      // A cópia do loop é só visual: fora da ordem de tabulação, senão o teclado passa duas vezes por cada logo
      tabIndex={duplicate ? -1 : undefined}
      className="group relative grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ba-blue-2)]"
    >
      {image}
      <span
        aria-hidden="true"
        className="absolute -right-2.5 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full bg-[linear-gradient(150deg,#3d61c8,var(--ba-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_-3px_rgba(31,63,163,0.7)] transition-transform duration-300 group-hover:scale-110"
      >
        <Play className="ml-px h-2.5 w-2.5 fill-current" />
      </span>
    </button>
  );
}

/**
 * Faixa de logos do Hero. Os logos com tour no canal (selo de play) abrem o vídeo no
 * player único; os demais são só marca. A faixa para no hover e quando um logo recebe
 * foco, para ninguém tentar clicar num alvo em movimento.
 */
export default function InstitutionsMarquee() {
  const { t } = useLanguage();

  return (
    <div className="ba-glass flex flex-col items-stretch gap-3 overflow-hidden rounded-3xl py-4 sm:flex-row sm:items-center sm:gap-7 sm:pl-[26px]">
      <p className="m-0 px-[18px] text-center text-[12.5px] font-semibold leading-[1.4] tracking-[0.01em] text-[var(--ba-ink-2)] sm:max-w-[200px] sm:flex-none sm:border-r sm:border-[var(--ba-stroke)] sm:pl-0 sm:pr-[26px] sm:text-left">
        {t("landing.universityCarousel.title1")} {t("landing.universityCarousel.title2")}
      </p>
      {/* Movimento reduzido: o CSS da marca para a animação; a faixa vira rolagem manual para nenhum logo ficar inalcançável */}
      <div className="ba-marquee flex-1 py-1.5 motion-reduce:overflow-x-auto [&:focus-within_.ba-track]:[animation-play-state:paused]">
        {/* Lista duplicada: a animação anda -50% e emenda sem salto */}
        <ul className="ba-track !gap-[34px] sm:!gap-[48px]">
          {[...INSTITUTIONS, ...INSTITUTIONS].map((item, index) => {
            const duplicate = index >= INSTITUTIONS.length;
            return (
              <li key={`${item.name}-${index}`} aria-hidden={duplicate || undefined} className="flex-none">
                <MarqueeLogo item={item} duplicate={duplicate} />
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
