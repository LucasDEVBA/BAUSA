import Image from "next/image";
import { Award, Trophy } from "lucide-react";

import andressaAnuncio from "@/assets/instagram/andressa-anuncio-capa.jpg";
import bernardoMediaDay3 from "@/assets/instagram/bernardo-media-day-3.jpg";
import { HISTORIAS_PAGE } from "@/content/historias";
import { pick } from "@/content/types";
import type { Lang } from "@/i18n";
import { keepTogether } from "./keepTogether";

const TEXT = HISTORIAS_PAGE.hero;

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

interface BadgeProps {
  icon: typeof Trophy;
  tone: "wine" | "blue";
  title: string;
  sub: string;
  className: string;
  depth: number;
  d: number;
}

function Badge({ icon: Icon, tone, title, sub, className, depth, d }: BadgeProps) {
  return (
    // Fundo mais denso que o vidro padrão: sobre a camisa amarela do Bernardo o saturate do blur tingia o selo de verde
    <div
      className={`ba-glass ba-rise absolute z-[4] flex items-center gap-2.5 rounded-[18px] !bg-white/[0.86] py-2.5 pl-2.5 pr-3.5 sm:gap-3 sm:rounded-[20px] sm:py-3 sm:pl-3 sm:pr-4 ${className}`}
      style={delay(d)}
      data-depth={depth}
    >
      <span
        className={`grid h-9 w-9 flex-none place-items-center rounded-[11px] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_20px_-8px_rgba(15,35,87,0.6)] sm:h-11 sm:w-11 sm:rounded-[13px] ${
          tone === "wine" ? "bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))]" : "bg-[linear-gradient(140deg,var(--ba-blue-2),var(--ba-blue)_60%,var(--ba-navy))]"
        }`}
      >
        <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <b className="block font-[family-name:var(--ba-display)] text-[13px] font-semibold leading-[1.2] tracking-[-0.015em] text-[var(--ba-navy)] sm:text-[14.5px]">{keepTogether(title)}</b>
        <span className="mt-0.5 block text-[11.5px] font-medium leading-snug text-[var(--ba-ink-3)] sm:text-[12.5px]">{sub}</span>
      </span>
    </div>
  );
}

/**
 * Composição em camadas da abertura de /historias: Bernardo no Media Day da Hoosac (com a
 * bandeira) e Andressa na arte da Seleção, com os dois reconhecimentos de terceiros em vidro.
 * Cada [data-depth] reage ao mouse em profundidade diferente (motor do useBrandMotion).
 */
export default function HistoriasHeroMedia({ lang }: { lang: Lang }) {
  return (
    <div className="relative mx-auto h-[440px] w-full max-w-[560px] [perspective:1400px] sm:h-[560px] lg:h-[min(620px,70svh)] lg:min-h-[520px]" data-tilt-stage>
      <figure
        className="ba-glass absolute inset-[0_0_34px_20%] m-0 overflow-hidden rounded-[28px] p-[7px] shadow-[var(--ba-shadow-lg)] sm:inset-[0_0_44px_22%] sm:rounded-[34px] sm:p-2.5"
        data-depth="6"
      >
        <div className="relative h-full w-full overflow-hidden rounded-[22px] bg-[var(--ba-navy-2)] sm:rounded-[26px]">
          <Image
            src={bernardoMediaDay3}
            alt={pick(TEXT.mainAlt, lang)}
            fill
            priority
            sizes="(max-width: 640px) 80vw, (max-width: 1024px) 440px, 460px"
            className="object-cover object-[50%_18%]"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,35,87,0.18)_0%,rgba(15,35,87,0)_28%),linear-gradient(90deg,rgba(31,63,163,0.14),transparent_45%)]" />
          <figcaption className="absolute right-3 top-3 z-[2] sm:right-4 sm:top-4">
            <span className="ba-glass-dark inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-[7px] text-[11.5px] font-semibold text-white sm:text-[12.5px]">
              <span className="ba-pulse" aria-hidden="true" />
              {pick(TEXT.mainPlace, lang)}
            </span>
          </figcaption>
        </div>
      </figure>

      {/* No mobile a arte da Andressa fica no alto: embaixo, o selo da Copa a cobria pela metade */}
      <div
        className="ba-glass ba-rise-scale ba-float-a absolute left-0 top-[44px] z-[3] aspect-[9/16] w-[34%] rounded-[20px] p-[5px] shadow-[var(--ba-shadow-lg)] sm:bottom-[70px] sm:top-auto sm:w-[32%] sm:rounded-[24px] sm:p-1.5"
        style={delay(2)}
        data-depth="22"
      >
        <div className="relative h-full w-full overflow-hidden rounded-[15px] bg-[var(--ba-navy-2)] sm:rounded-[18px]">
          <Image src={andressaAnuncio} alt={pick(TEXT.floatAlt, lang)} fill sizes="(max-width: 640px) 34vw, 190px" className="object-cover" />
        </div>
      </div>

      <Badge
        icon={Trophy}
        tone="wine"
        title={pick(TEXT.badgeCopaTitle, lang)}
        sub={pick(TEXT.badgeCopaSub, lang)}
        className="bottom-[78px] right-[-4px] max-w-[min(270px,80%)] sm:bottom-auto sm:left-[-4%] sm:right-auto sm:top-[34px] sm:max-w-[330px]"
        depth={30}
        d={4}
      />
      <Badge
        icon={Award}
        tone="blue"
        title={pick(TEXT.badgeSiTitle, lang)}
        sub={pick(TEXT.badgeSiSub, lang)}
        className="bottom-0 right-[-4px] max-w-[min(300px,90%)] sm:right-[-14px]"
        depth={26}
        d={5}
      />
    </div>
  );
}
