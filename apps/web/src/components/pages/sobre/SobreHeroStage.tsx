"use client";

import Image from "next/image";
import { GraduationCap } from "lucide-react";

import leandroPalestra from "@/assets/leandro-palestra.jpg";
import leandroHarvard from "@/assets/leandro-harvard.jpg";
import { useLanguage } from "@/i18n";
import SobreVideoTile from "./SobreVideoTile";

interface FeaturedVideo {
  id: string;
  /** Título completo (player e leitor de tela). */
  title: string;
  /** Título curto do cartão. */
  label: string;
  duration: string;
  poster: string;
}

interface SobreHeroStageProps {
  video: FeaturedVideo;
  videoEyebrow: string;
  palestraAlt: string;
  harvardCaption: string;
  harvardAlt: string;
}

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

/**
 * Mídia do hero de /sobre: retrato da palestra e foto em Harvard em camadas que
 * reagem ao mouse, mais o vídeo do fundador em destaque. No mobile o vídeo sai
 * da colagem e vira um cartão inteiro logo abaixo, legível com o polegar.
 */
export default function SobreHeroStage({ video, videoEyebrow, palestraAlt, harvardCaption, harvardAlt }: SobreHeroStageProps) {
  const { t } = useLanguage();
  const founderTitle = t("landing.founder.founderTitle");

  return (
    <div className="relative mx-auto w-full max-w-[600px] lg:max-w-none" data-tilt-stage>
      <div className="relative h-[clamp(380px,108vw,470px)] sm:h-[540px] lg:h-[clamp(560px,44vw,640px)]">
        <figure className="ba-glass absolute left-0 top-0 m-0 h-full w-[68%] rounded-[28px] p-[7px] sm:rounded-[32px] sm:p-2 lg:h-[84%] lg:w-[64%]" data-depth="6">
          <div className="relative h-full overflow-hidden rounded-[22px] sm:rounded-[25px]">
            <Image
              src={leandroPalestra}
              alt={palestraAlt}
              fill
              preload
              sizes="(max-width: 640px) 66vw, (max-width: 1024px) 400px, 360px"
              className="object-cover object-[50%_18%]"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,transparent_52%,rgba(6,15,42,0.88))]" />
            <figcaption className="absolute bottom-4 left-4 right-4 z-[2] text-white sm:bottom-6 sm:left-6 lg:right-auto lg:max-w-[64%]">
              <b className="block font-[family-name:var(--ba-display)] text-[19px] font-semibold tracking-[-0.025em] sm:text-[23px]">Leandro Ribeiro</b>
              <span className="mt-0.5 block text-[12px] font-medium leading-[1.35] text-white/[0.82] sm:text-[13.5px]">{founderTitle}</span>
            </figcaption>
          </div>
        </figure>

        <div className="absolute right-0 top-[7%] z-[2] w-[44%] lg:top-[3%] lg:w-[40%]" data-depth="20">
          <figure className="ba-glass ba-float-b m-0 aspect-[3/4] rounded-[22px] p-[6px] sm:rounded-[26px] sm:p-[7px]">
            <div className="relative h-full overflow-hidden rounded-[17px] sm:rounded-[20px]">
              {/* eager: a foto está na primeira tela no mobile (390px) e no desktop; lazy a fazia surgir depois do resto */}
              <Image src={leandroHarvard} alt={harvardAlt} fill loading="eager" sizes="(max-width: 640px) 44vw, 240px" className="object-cover object-[50%_32%]" />
            </div>
            {/* Tinta navy por baixo do vidro: a 7% de branco o contraste dependia do trecho da foto atrás da pílula */}
            <figcaption className="ba-glass-dark absolute bottom-3 left-3 rounded-full !bg-[rgba(10,26,69,0.62)] px-3 py-1.5 text-[11.5px] font-semibold text-white sm:bottom-4 sm:left-4 sm:text-[12.5px]">
              {harvardCaption}
            </figcaption>
          </figure>
        </div>

        <div className="absolute bottom-[23%] right-0 z-[3] lg:bottom-auto lg:left-[-5%] lg:right-auto lg:top-[9%]" data-depth="30">
          {/* Vidro mais denso que o padrão: o selo fica sobre a foto escura e, a 58% de branco, o subtítulo caía abaixo de 4,5:1 */}
          <div className="ba-glass ba-float-a ba-rise flex items-center gap-2.5 rounded-[16px] !bg-white/[0.88] py-2 pl-2 pr-3.5 sm:rounded-[18px] sm:py-2.5 sm:pl-2.5 sm:pr-4" style={delay(5)}>
            <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[11px] bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:h-9 sm:w-9 sm:rounded-xl">
              <GraduationCap className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="block">
              <b className="block whitespace-nowrap text-[12.5px] font-semibold leading-[1.2] text-[var(--ba-navy)] sm:text-[13.5px]">{t("landing.founder.chipTitle")}</b>
              <small className="block whitespace-nowrap text-[11.5px] text-[var(--ba-ink-2)]">{t("landing.founder.chipSub")}</small>
            </span>
          </div>
        </div>
      </div>

      {/* mb: a sombra do vidro (até ~66px) precisa caber antes do fim do PageHero, que corta em overflow-hidden */}
      <div className="relative z-[4] mb-7 mt-4 lg:absolute lg:bottom-0 lg:right-0 lg:mb-0 lg:mt-0 lg:w-[57%]" data-depth="12">
        <SobreVideoTile
          id={video.id}
          title={video.title}
          label={video.label}
          eyebrow={videoEyebrow}
          duration={video.duration}
          poster={video.poster}
          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 580px, 340px"
        />
      </div>
    </div>
  );
}
