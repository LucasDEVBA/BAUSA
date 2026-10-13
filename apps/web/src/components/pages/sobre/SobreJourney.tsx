import Image from "next/image";
import { ClipboardCheck, GraduationCap, PlaneTakeoff, Quote, Sparkles, Users, type LucideIcon } from "lucide-react";

import leandroRibeiro from "@/assets/leandro-ribeiro.jpg";
import MeshBackground from "@/components/brand/MeshBackground";
import type { Lang } from "@/i18n";
import { SOBRE_JOURNEY, SOBRE_JOURNEY_HEADER, SOBRE_QUOTE, SOBRE_STATS, type JourneyIcon } from "@/content/sobre";
import { pick } from "@/content/types";

const ICONS: Record<JourneyIcon, LucideIcon> = {
  departure: PlaneTakeoff,
  scholar: GraduationCap,
  admissions: ClipboardCheck,
  spark: Sparkles,
  team: Users,
};

// Cada marco ganha um tom da paleta: azul (formação), bordô (virada), navy (hoje)
const NODE_TONE: Record<JourneyIcon, string> = {
  departure: "bg-[linear-gradient(150deg,#4a6dd0,var(--ba-blue)_60%,#172f7d)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_24px_-10px_rgba(31,63,163,0.7)]",
  scholar: "bg-[linear-gradient(150deg,#4a6dd0,var(--ba-blue)_60%,#172f7d)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_24px_-10px_rgba(31,63,163,0.7)]",
  admissions: "bg-[linear-gradient(150deg,#2b3f7d,var(--ba-navy)_60%,#081333)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_12px_24px_-10px_rgba(15,35,87,0.7)]",
  spark: "bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine)_60%,#5e1621)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_24px_-10px_rgba(144,36,52,0.7)]",
  team: "bg-[linear-gradient(150deg,#2b3f7d,var(--ba-navy)_60%,#081333)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_12px_24px_-10px_rgba(15,35,87,0.7)]",
};

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

interface SobreJourneyProps {
  lang: Lang;
}

/** Trajetória do fundador: números publicados, linha do tempo e a frase que resume o porquê. */
export default function SobreJourney({ lang }: SobreJourneyProps) {
  return (
    <section id="trajetoria" className="relative isolate scroll-mt-20 overflow-x-clip py-[clamp(72px,9vw,128px)]" aria-labelledby="trajetoria-title">
      <MeshBackground blobs={["b2", "b4"]} className="[&_.ba-b2]:!opacity-35 [&_.ba-b4]:!opacity-60 [mask-image:linear-gradient(180deg,transparent,#000_16%,#000_84%,transparent)]" />

      <div className="ba-wrap relative z-[2]">
        <header className="max-w-[780px]">
          <span className="ba-eyebrow ba-glass ba-rv">
            <span className="ba-dot" />
            {pick(SOBRE_JOURNEY_HEADER.eyebrow, lang)}
          </span>
          <h2 id="trajetoria-title" className="ba-h2 ba-rv mt-6 text-[var(--ba-navy)]" style={delay(1)}>
            {pick(SOBRE_JOURNEY_HEADER.titleLead, lang)}{" "}
            <span className="ba-serif ba-grad-text whitespace-nowrap text-[1.1em]">{pick(SOBRE_JOURNEY_HEADER.titleAccent, lang)}</span>
          </h2>
          <p className="ba-lead ba-rv mt-6 max-w-[640px]" style={delay(2)}>
            {pick(SOBRE_JOURNEY_HEADER.lead, lang)}
          </p>
        </header>

        {/* Ficha técnica: só números que o próprio fundador publicou */}
        <dl className="ba-glass ba-rv mt-10 grid grid-cols-1 divide-y divide-[var(--ba-stroke)] rounded-[26px] !bg-white/[0.66] px-5 sm:mt-14 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:rounded-[30px] sm:px-0" style={delay(3)}>
          {SOBRE_STATS.map((stat) => (
            <div key={stat.value} className="flex flex-row-reverse items-center justify-end gap-4 py-4 sm:flex-col-reverse sm:items-start sm:justify-start sm:gap-2 sm:px-8 sm:py-8">
              <dt className="text-[14px] font-medium leading-[1.4] text-[var(--ba-ink-2)] sm:text-[15.5px]">{pick(stat.label, lang)}</dt>
              <dd className="ba-grad-text m-0 w-[112px] flex-none font-[family-name:var(--ba-display)] text-[38px] font-bold leading-none tracking-[-0.05em] sm:w-auto sm:text-[clamp(52px,5.4vw,80px)]">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-12 grid grid-cols-1 gap-10 sm:mt-16 lg:grid-cols-12 lg:gap-[clamp(40px,5vw,80px)]">
          <div className="relative order-1 lg:order-2 lg:col-span-7">
            <span aria-hidden="true" className="absolute bottom-8 left-[23px] top-8 w-[2px] rounded-full bg-[linear-gradient(180deg,rgba(71,107,192,0.55),rgba(31,63,163,0.35)_55%,rgba(144,36,52,0.45))] sm:left-[27px]" />
            <ol className="relative m-0 list-none p-0">
              {SOBRE_JOURNEY.map((step, index) => {
                const Icon = ICONS[step.icon];
                const turningPoint = step.icon === "spark";
                return (
                  <li key={step.icon} className="ba-rv relative grid grid-cols-[48px_minmax(0,1fr)] gap-3.5 pb-4 last:pb-0 sm:grid-cols-[56px_minmax(0,1fr)] sm:gap-5 sm:pb-5" style={delay(index)}>
                    <span className={`relative z-[1] mt-4 grid h-12 w-12 place-items-center rounded-[16px] text-white sm:h-14 sm:w-14 sm:rounded-[18px] ${NODE_TONE[step.icon]}`}>
                      <Icon className="h-[21px] w-[21px] sm:h-6 sm:w-6" aria-hidden="true" />
                    </span>
                    <div
                      className={
                        turningPoint
                          ? "relative overflow-hidden rounded-[24px] p-5 text-white shadow-[0_30px_70px_-30px_rgba(144,36,52,0.65),inset_0_1px_0_rgba(255,255,255,0.25)] [background:linear-gradient(125deg,var(--ba-wine)_0%,#6d2350_40%,#2a3c9c_80%,var(--ba-blue)_100%)] sm:rounded-[28px] sm:p-7"
                          : "ba-glass rounded-[24px] !bg-white/[0.7] p-5 sm:rounded-[28px] sm:p-7"
                      }
                    >
                      {turningPoint && <div aria-hidden="true" className="ba-lines opacity-60" />}
                      <p className={`relative m-0 text-[11.5px] font-semibold uppercase tracking-[0.14em] ${turningPoint ? "text-[#f6d3d9]" : "text-[var(--ba-blue)]"}`}>
                        {pick(step.kicker, lang)}
                      </p>
                      <h3 className={`ba-h3 relative mt-2 text-[19px] sm:text-[23px] ${turningPoint ? "text-white" : "text-[var(--ba-navy)]"}`}>{pick(step.title, lang)}</h3>
                      <p className={`relative mt-2.5 text-[15px] leading-[1.62] sm:text-[16px] ${turningPoint ? "text-white/[0.88]" : "text-[var(--ba-ink-2)]"}`}>
                        {pick(step.text, lang)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* A citação é a figura (blockquote + autoria); o retrato é o fundo dela. No tablet o retrato não ocupa a largura toda. */}
          <div className="ba-rv-scale order-2 lg:order-1 lg:col-span-5">
            <div className="relative mx-auto overflow-hidden rounded-[28px] shadow-[var(--ba-shadow-lg)] sm:max-w-[520px] sm:rounded-[32px] lg:sticky lg:top-28 lg:max-w-none">
              <div className="relative aspect-[4/5]">
                <Image
                  src={leandroRibeiro}
                  alt={pick(SOBRE_QUOTE.portraitAlt, lang)}
                  fill
                  sizes="(max-width: 640px) 92vw, (max-width: 1024px) 520px, 480px"
                  className="object-cover object-[50%_18%]"
                />
                <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,69,0)_30%,rgba(10,26,69,0.55)_58%,rgba(8,20,56,0.94))]" />
              </div>
              <figure className="absolute inset-x-0 bottom-0 m-0 p-6 text-white sm:p-8">
                <Quote className="mb-3 h-6 w-6 text-[#f0b1bb]" aria-hidden="true" />
                <blockquote className="m-0">
                  <p className="m-0 font-[family-name:var(--ba-display)] text-[clamp(19px,2vw,25px)] font-medium leading-[1.32] tracking-[-0.02em]">
                    {pick(SOBRE_QUOTE.text, lang)}
                  </p>
                </blockquote>
                <figcaption className="mt-4 text-[13px] font-semibold text-white/[0.78]">Leandro Ribeiro</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
