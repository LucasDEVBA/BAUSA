"use client";

import Image from "next/image";
import { Brain, GraduationCap, MapPin, ShieldCheck } from "lucide-react";

import leandroPhoto from "@/assets/leandro-palestra.jpg";
import leandroHarvard from "@/assets/leandro-harvard.jpg";
import { useLanguage } from "@/i18n";
import BrandCta from "./brand/BrandCta";

const CREDENTIALS = [
  { key: "safe", icon: ShieldCheck },
  { key: "eei", icon: Brain },
  { key: "presence", icon: MapPin },
] as const;

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

const FounderSection = () => {
  const { t } = useLanguage();

  return (
    <section
      id="autoridade"
      className="ba-dark relative isolate overflow-hidden rounded-t-[clamp(28px,4vw,48px)] pb-10 pt-[76px] sm:py-[clamp(90px,10vw,140px)]"
      aria-labelledby="autoridade-title"
    >
      <div aria-hidden="true" className="ba-glow left-[-180px] top-[-140px] h-[620px] w-[620px] animate-[ba-drift1_30s_ease-in-out_infinite_alternate] bg-[rgba(71,107,192,0.55)]" />
      <div aria-hidden="true" className="ba-glow bottom-[-160px] right-[-160px] h-[520px] w-[520px] animate-[ba-drift3_34s_ease-in-out_infinite_alternate] bg-[rgba(144,36,52,0.5)]" />
      <div aria-hidden="true" className="ba-glow right-[30%] top-[10%] h-[380px] w-[380px] animate-[ba-drift2_28s_ease-in-out_infinite_alternate] bg-[rgba(31,63,163,0.45)]" />
      <div aria-hidden="true" className="ba-lines" />

      <div className="ba-wrap relative z-[2] grid items-start gap-[clamp(36px,6vw,96px)] lg:grid-cols-[1fr_1.05fr]">
        {/* Retrato principal + foto em Harvard, em camadas que reagem ao mouse */}
        <div className="relative h-[440px] max-w-[620px] [perspective:1400px] sm:h-[560px] lg:h-[640px]" data-tilt-stage>
          <figure className="ba-glass-dark ba-rv-scale absolute left-0 top-0 m-0 h-[86%] w-[84%] rounded-[26px] p-[7px] sm:h-[88%] sm:w-[78%] sm:rounded-[32px] sm:p-2.5" data-depth="6">
            <div className="relative h-full overflow-hidden rounded-[20px] sm:rounded-3xl">
              <Image
                src={leandroPhoto}
                alt={`Leandro Ribeiro, ${t("landing.founder.founderTitle")}`}
                fill
                sizes="(max-width: 1024px) 84vw, 40vw"
                className="object-cover object-[50%_20%]"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(6,15,42,0.85))]" />
              <figcaption className="absolute bottom-4 left-4 right-auto z-[2] max-w-[56%] sm:bottom-[22px] sm:left-6 sm:right-6 sm:max-w-none">
                <b className="block font-[family-name:var(--ba-display)] text-[19px] font-semibold tracking-[-0.025em] sm:text-2xl">Leandro Ribeiro</b>
                <span className="mt-0.5 block text-[11.5px] font-medium leading-[1.35] text-white/80 sm:text-[13.5px]">{t("landing.founder.founderTitle")}</span>
              </figcaption>
            </div>
          </figure>

          <div className="ba-glass-dark ba-rv-scale ba-float-b absolute bottom-0 right-0 z-[3] aspect-[3/4] w-[40%] rounded-[20px] p-[5px] sm:w-[44%] sm:rounded-[26px] sm:p-[7px]" style={delay(2)} data-depth="22">
            <div className="relative h-full overflow-hidden rounded-[15px] sm:rounded-[20px]">
              <Image src={leandroHarvard} alt="Leandro Ribeiro com treinador da Universidade Harvard" fill sizes="(max-width: 1024px) 40vw, 20vw" className="object-cover object-[50%_30%]" />
            </div>
          </div>

          <div className="ba-glass-dark ba-rv ba-float-a absolute right-0 top-[4%] z-[4] flex items-center gap-2.5 rounded-[15px] py-[9px] pl-[9px] pr-3 sm:right-[8%] sm:top-[6%] sm:rounded-[18px] sm:py-3 sm:pl-3 sm:pr-4" style={delay(3)} data-depth="30">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:h-9 sm:w-9 sm:rounded-xl">
              <GraduationCap className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <div>
              <b className="block whitespace-nowrap text-xs font-semibold leading-[1.2] sm:text-[13.5px]">{t("landing.founder.chipTitle")}</b>
              <small className="text-[11.5px] text-white/[0.72]">{t("landing.founder.chipSub")}</small>
            </div>
          </div>
        </div>

        <div>
          <span className="ba-eyebrow ba-glass-dark ba-rv !text-[#cfdcff]">
            <span className="ba-dot" />
            {t("landing.founder.title1")} {t("landing.founder.title2")}
          </span>
          <h2
            id="autoridade-title"
            className="ba-rv mb-[26px] mt-[22px] font-[family-name:var(--ba-display)] text-[clamp(34px,4.6vw,62px)] font-bold leading-[1.03] tracking-[-0.042em]"
            style={delay(1)}
          >
            {t("landing.founder.lead")} <span className="ba-grad-text-dark">{t("landing.founder.leadBold")}.</span>
          </h2>

          <div className="space-y-4 text-[clamp(15.5px,1.2vw,17.5px)] leading-[1.66] text-[rgba(232,238,255,0.84)]">
            <p className="ba-rv max-w-[560px]" style={delay(2)}>
              <strong className="font-semibold text-white">Leandro Ribeiro</strong> {t("landing.founder.p1")}
            </p>
            <p className="ba-rv max-w-[560px]" style={delay(3)}>
              {t("landing.founder.p2Before")} <strong className="font-semibold text-white">{t("landing.founder.p2Bold1")}</strong>
              {t("landing.founder.p2Mid")} <strong className="font-semibold text-white">{t("landing.founder.p2Bold2")}</strong> {t("landing.founder.p2And")}{" "}
              <strong className="font-semibold text-white">{t("landing.founder.p2Bold3")}</strong>
              {t("landing.founder.p2End")}
            </p>
            <p className="ba-rv max-w-[560px]" style={delay(3)}>
              {t("landing.founder.highlightBoxBefore")}
              <strong className="font-semibold text-white">{t("landing.brandName")}</strong>, {t("landing.founder.highlightBoxAfter")}
            </p>
          </div>

          <ul className="my-8 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
            {CREDENTIALS.map(({ key, icon: Icon }, index) => (
              <li
                key={key}
                className="ba-glass-dark ba-rv flex items-center gap-3.5 rounded-[20px] p-3.5 transition-[transform,background-color] duration-500 hover:-translate-y-1 hover:bg-white/[0.11] sm:block sm:p-4"
                style={delay(3 + index)}
              >
                <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-[linear-gradient(150deg,rgba(255,255,255,0.22),rgba(255,255,255,0.06))] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:mb-3">
                  <Icon className="h-[19px] w-[19px] text-[#dbe5ff]" aria-hidden="true" />
                </span>
                <b className="block font-[family-name:var(--ba-display)] text-[15px] font-semibold leading-[1.25] tracking-[-0.015em]">
                  {t(`landing.founder.credentials.${key}`)}
                </b>
              </li>
            ))}
          </ul>

          <p className="ba-rv border-t border-white/[0.12] pt-[26px] text-[13.5px] font-medium leading-[1.45] text-[rgba(232,238,255,0.78)]" style={delay(4)}>
            {t("landing.founder.recognition1")} {t("landing.founder.recognition2")}
          </p>

          <div className="ba-rv mt-[34px] flex flex-col gap-[18px] sm:flex-row sm:flex-wrap sm:items-center" style={delay(5)}>
            <BrandCta variant="light" source="final" className="w-full sm:w-auto">
              {t("landing.founder.cta")}
            </BrandCta>
            <small className="text-[13px] text-[rgba(232,238,255,0.7)]">{t("landing.founder.ctaNote")}</small>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FounderSection;
