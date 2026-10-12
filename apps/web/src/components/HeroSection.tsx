"use client";

import { memo } from "react";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";

import athleteHelena from "@/assets/athlete-helena.png";
import athleteMatheus from "@/assets/athlete-matheus.png";
import athleteJulia from "@/assets/athlete-julia.png";
import athleteRobson from "@/assets/athlete-robson.jpeg";
import benjamin from "@/assets/benjamin.jpeg";
import { useLanguage } from "@/i18n";
import BrandCta from "./brand/BrandCta";
import MeshBackground from "./brand/MeshBackground";
import InstitutionsMarquee from "./InstitutionsMarquee";

// URL estática (public/) para casar com o preload declarado no layout
const HERO_IMAGE_URL = "/hero-campus.jpg";
const TRUST_AVATARS = [athleteMatheus, athleteJulia, benjamin, athleteRobson];
const SAFE_LETTERS = ["S", "A", "F", "E"] as const;

// "Inteligente®" → o ® fica pequeno e alinhado ao topo, sem pesar no título
function splitRegistered(text: string) {
  const [word, rest] = text.split("®");
  return { word, hasMark: rest !== undefined };
}

const HeroSection = memo(() => {
  const { t } = useLanguage();
  const headline2 = splitRegistered(t("landing.hero.headline2"));

  return (
    <section className="relative isolate flex min-h-[100svh] flex-col pb-5 pt-[88px] sm:pb-7 lg:pt-[116px]" aria-labelledby="hero-title">
      <MeshBackground grid />

      <div className="ba-wrap relative z-[2] grid flex-1 items-center gap-[34px] lg:grid-cols-[1.02fr_1fr] lg:gap-[clamp(28px,4vw,64px)]">
        <div className="max-w-[680px] lg:max-w-[620px]">
          <span className="ba-eyebrow ba-glass ba-rv !text-[11px] sm:!text-[12.5px]" style={{ "--d": 0 } as React.CSSProperties}>
            <span className="ba-dot" />
            {t("landing.hero.eyebrow")}
          </span>

          <h1
            id="hero-title"
            className="ba-display ba-rv my-[18px] text-[clamp(40px,11.4vw,50px)] text-[var(--ba-navy)] sm:my-[22px] sm:text-[clamp(46px,6.1vw,92px)]"
            style={{ "--d": 1 } as React.CSSProperties}
          >
            {t("landing.hero.headline1")}{" "}
            <span className="block pb-[0.08em]">
              <span className="ba-serif ba-grad-text text-[1.06em] tracking-[-0.02em]">{headline2.word}</span>
              {headline2.hasMark && (
                <span className="ba-grad-text ml-[0.08em] align-[1.9em] font-[family-name:var(--ba-display)] text-[0.32em] font-semibold not-italic">
                  ®
                </span>
              )}
            </span>
          </h1>

          <p className="ba-lead ba-rv max-w-[520px] !text-[15.5px] sm:!text-[clamp(16px,1.35vw,18.5px)]" style={{ "--d": 2 } as React.CSSProperties}>
            {t("landing.hero.sub1")} {t("landing.hero.sub2")} {t("landing.hero.sub3")}
          </p>

          <div className="ba-rv mt-[22px] flex flex-col gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-3" style={{ "--d": 3 } as React.CSSProperties}>
            <BrandCta source="hero">{t("landing.hero.cta")}</BrandCta>
            <BrandCta href="#metodo" variant="ghost">
              {t("landing.hero.secondaryCta")}
            </BrandCta>
          </div>

          <div className="ba-rv mt-[30px] hidden items-center gap-3.5 text-[13.5px] text-[var(--ba-ink-3)] sm:flex" style={{ "--d": 4 } as React.CSSProperties}>
            <div className="flex" aria-hidden="true">
              {TRUST_AVATARS.map((avatar, index) => (
                <Image
                  key={avatar.src}
                  src={avatar}
                  alt=""
                  width={36}
                  height={36}
                  sizes="36px"
                  className={`h-9 w-9 rounded-full border-[2.5px] border-white object-cover object-top shadow-[var(--ba-shadow-sm)] ${index > 0 ? "-ml-2.5" : ""}`}
                />
              ))}
            </div>
            <span>
              {t("landing.hero.trustBefore")} <strong className="font-semibold text-[var(--ba-navy)]">{t("landing.hero.trustBold")}</strong>{" "}
              {t("landing.hero.trustAfter")}
            </span>
          </div>
        </div>

        {/* Composição em camadas: cada [data-depth] reage ao mouse em profundidades diferentes */}
        <div className="relative h-[430px] [perspective:1400px] sm:h-[560px] lg:h-[min(640px,72svh)] lg:min-h-[520px]" data-tilt-stage>
          <figure
            className="ba-glass ba-rv-scale absolute inset-[0_0_40px_28px] m-0 overflow-hidden rounded-[28px] p-[7px] shadow-[var(--ba-shadow-lg)] sm:inset-[0_0_54px_46px] sm:rounded-[34px] sm:p-2.5"
            style={{ "--d": 1 } as React.CSSProperties}
            data-depth="6"
          >
            <div className="relative h-full w-full overflow-hidden rounded-[22px] sm:rounded-[26px]">
              <img
                src={HERO_IMAGE_URL}
                alt={t("landing.hero.imgAlt")}
                width={1920}
                height={1088}
                fetchPriority="high"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,35,87,0)_45%,rgba(10,26,69,0.72)_100%),linear-gradient(90deg,rgba(31,63,163,0.18),transparent_40%)]" />
              <figcaption className="absolute right-3.5 top-3.5 z-[2] sm:bottom-[92px] sm:right-[22px] sm:top-auto">
                <span className="ba-glass-dark inline-flex items-center gap-2 whitespace-nowrap rounded-full px-2.5 py-[7px] text-[11px] font-semibold text-white sm:px-3 sm:py-2 sm:text-[12.5px]">
                  <span className="ba-pulse" />
                  {t("landing.hero.chip")}
                </span>
              </figcaption>
            </div>
          </figure>

          <div
            className="ba-glass ba-rv-scale ba-float-b absolute -right-3.5 -top-7 z-[1] hidden aspect-[9/16] w-[clamp(110px,10vw,140px)] rounded-[22px] p-1.5 shadow-[var(--ba-shadow-lg)] sm:block"
            style={{ "--d": 3 } as React.CSSProperties}
            data-depth="18"
          >
            <Image src={athleteMatheus} alt="Matheus Belcuo, atleta Bolsa Atleta USA" sizes="140px" className="h-full w-full rounded-[17px] object-cover" />
          </div>

          <div
            className="ba-glass ba-rv-scale ba-float-a absolute bottom-0 left-0 z-[3] aspect-[9/16] w-[112px] rounded-[18px] p-[5px] shadow-[var(--ba-shadow-lg)] sm:w-[clamp(150px,15vw,206px)] sm:rounded-[22px] sm:p-1.5"
            style={{ "--d": 2 } as React.CSSProperties}
            data-depth="22"
          >
            <Image src={athleteHelena} alt="Helena Gennaro, atleta Bolsa Atleta USA" sizes="(max-width: 640px) 112px, 206px" className="h-full w-full rounded-[14px] object-cover sm:rounded-[17px]" />
          </div>

          <div
            className="ba-glass ba-rv absolute bottom-[62px] right-[-4px] z-[4] flex max-w-[214px] items-center gap-2.5 rounded-2xl px-[13px] py-[11px] sm:bottom-2 sm:right-[-18px] sm:max-w-[290px] sm:gap-3.5 sm:rounded-[20px] sm:px-[18px] sm:py-4"
            style={{ "--d": 4 } as React.CSSProperties}
            data-depth="30"
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-[linear-gradient(140deg,var(--ba-blue-2),var(--ba-blue)_60%,var(--ba-navy))] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_20px_-8px_rgba(31,63,163,0.7)] sm:h-[46px] sm:w-[46px] sm:rounded-[14px]">
              <ShieldCheck className="h-[18px] w-[18px] text-white sm:h-[22px] sm:w-[22px]" aria-hidden="true" />
            </span>
            <div>
              <b className="block font-[family-name:var(--ba-display)] text-[13px] font-semibold leading-[1.25] tracking-[-0.015em] text-[var(--ba-navy)] sm:text-[15px]">
                {t("landing.hero.activeTracking")}
              </b>
              <span className="mt-0.5 block text-[11.5px] text-[var(--ba-ink-3)] sm:text-[12.5px]">{t("landing.hero.sealSub")}</span>
            </div>
          </div>

          <div
            className="ba-glass ba-rv absolute bottom-[-6px] right-2.5 z-[4] flex items-center gap-3 rounded-[20px] px-3 py-2.5 sm:bottom-auto sm:left-[-6px] sm:right-auto sm:top-[38px] sm:py-3.5 sm:pl-3.5 sm:pr-4"
            style={{ "--d": 5 } as React.CSSProperties}
            data-depth="26"
          >
            <div className="flex gap-[5px]" aria-hidden="true">
              {SAFE_LETTERS.map((letter) => (
                <i
                  key={letter}
                  className={`grid h-[26px] w-[26px] place-items-center rounded-lg font-[family-name:var(--ba-display)] text-[12.5px] font-bold not-italic text-white sm:h-[30px] sm:w-[30px] sm:rounded-[9px] sm:text-sm ${
                    letter === "F" ? "bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))]" : "bg-[linear-gradient(150deg,#3d61c8,var(--ba-blue))]"
                  }`}
                >
                  {letter}
                </i>
              ))}
            </div>
            <div className="hidden sm:block">
              <b className="block whitespace-nowrap font-[family-name:var(--ba-display)] text-[13.5px] font-semibold tracking-[-0.01em] text-[var(--ba-navy)]">
                {t("landing.safeMethod.heading")} S.A.F.E.®
              </b>
              <small className="block text-[11.5px] font-medium text-[var(--ba-ink-3)]">{t("landing.hero.safeSub")}</small>
            </div>
          </div>
        </div>
      </div>

      <div className="ba-wrap ba-rv relative z-[2] mt-[clamp(18px,2.5vw,30px)]" style={{ "--d": 5 } as React.CSSProperties}>
        <InstitutionsMarquee />
      </div>
    </section>
  );
});

HeroSection.displayName = "HeroSection";

export default HeroSection;
