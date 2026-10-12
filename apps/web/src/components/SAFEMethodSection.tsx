"use client";

import { memo } from "react";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

import fieldPhoto from "@/assets/thumb-holyCross.jpg";
import soccerField from "@/assets/soccer-field-bg.jpg";
import athleteJulia from "@/assets/athlete-julia.png";
import athleteRobson from "@/assets/athlete-robson.jpeg";
import benjamin from "@/assets/benjamin.jpeg";
import { Link } from "@/i18n/navigation";
import { useLanguage } from "@/i18n";
import { trackCtaClick } from "@/lib/tracking/events";
import MeshBackground from "./brand/MeshBackground";

const PILLARS = ["s", "a", "f", "e"] as const;
const FAN_POSTERS = [
  { src: athleteJulia, position: "left-[2%] -translate-y-[46%] -rotate-[10deg] group-hover:-translate-x-3.5 group-hover:-rotate-[14deg]" },
  { src: benjamin, position: "left-[30%] z-[2] -translate-y-[54%] -rotate-2 group-hover:-translate-y-[60%] group-hover:rotate-0" },
  { src: athleteRobson, position: "left-[58%] z-[1] -translate-y-[48%] rotate-[7deg] group-hover:translate-x-3.5 group-hover:rotate-[11deg]" },
];

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

const letterGlass =
  "grid h-[58px] w-[58px] flex-none place-items-center rounded-[18px] bg-white/[0.14] font-[family-name:var(--ba-display)] text-[28px] font-extrabold tracking-[-0.04em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_0_0_1px_rgba(255,255,255,0.2)] backdrop-blur-[14px]";
const cellBase = "relative overflow-hidden rounded-[26px] transition-[transform,box-shadow] duration-700 [transition-timing-function:var(--ba-ease)] hover:shadow-[var(--ba-shadow-lg)] sm:rounded-[30px]";
const tagBase = "whitespace-nowrap rounded-full px-[11px] py-1.5 text-xs font-semibold";

const SAFEMethodSection = memo(() => {
  const { t } = useLanguage();
  const pillar = (key: (typeof PILLARS)[number], field: "title" | "description") => t(`landing.safeMethod.pillars.${key}.${field}`);

  return (
    <section id="metodo" className="relative isolate overflow-hidden py-[clamp(80px,10vw,140px)]" aria-labelledby="metodo-title">
      <MeshBackground blobs={["b1", "b3"]} className="[&_.ba-b1]:!left-auto [&_.ba-b1]:!right-[-20vw] [&_.ba-b1]:!top-0 [&_.ba-b1]:!opacity-60 [&_.ba-b3]:!left-[-8vw] [&_.ba-b3]:!top-[40%] [&_.ba-b3]:!opacity-35" />

      <div className="ba-wrap">
        <div className="relative z-[2] grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-6 lg:grid-cols-12">
          {/* Introdução */}
          <article className={`${cellBase} ba-glass ba-rv flex flex-col px-[22px] py-[26px] md:col-span-6 lg:col-span-5 lg:row-span-2 lg:p-[clamp(28px,3vw,44px)]`} style={delay(0)} data-tilt>
            <span className="ba-eyebrow !pl-0">
              <span className="ba-dot" />
              {t("landing.safeMethod.heading")} S.A.F.E.®
            </span>
            <h2 id="metodo-title" className="ba-h2 mb-[22px] mt-5 text-[var(--ba-navy)]">
              {t("landing.safeMethod.criteriaLine")}
            </h2>
            <p className="ba-lead max-w-[440px]">
              {t("landing.safeMethod.desc1")} {t("landing.safeMethod.desc2")}
            </p>
            <nav className="mt-auto grid grid-cols-4 gap-1.5 pt-[26px] sm:gap-2 sm:pt-[34px]" aria-label={`${t("landing.safeMethod.heading")} S.A.F.E.`}>
              {PILLARS.map((key) => (
                <a
                  key={key}
                  href={`#pilar-${key}`}
                  className="flex flex-col gap-0.5 rounded-[13px] bg-white/60 px-2 py-2.5 shadow-[inset_0_0_0_1px_var(--ba-stroke)] transition-[background-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-white sm:rounded-2xl sm:px-3 sm:py-3"
                >
                  <b className={`font-[family-name:var(--ba-display)] text-[19px] font-bold leading-none tracking-[-0.03em] sm:text-[22px] ${key === "f" ? "text-[var(--ba-wine)]" : "text-[var(--ba-blue)]"}`}>
                    {key.toUpperCase()}
                  </b>
                  <span className="truncate text-[10.5px] font-semibold text-[var(--ba-ink-2)] sm:text-xs">{pillar(key, "title")}</span>
                </a>
              ))}
            </nav>
          </article>

          {/* S: foto real */}
          <article id="pilar-s" className={`${cellBase} ba-rv min-h-[440px] scroll-mt-28 text-white shadow-[var(--ba-shadow)] md:col-span-3 md:min-h-[480px] lg:col-span-3 lg:row-span-2 lg:min-h-[560px]`} style={delay(1)} data-tilt>
            <Image src={fieldPhoto} alt="" fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover object-[50%_40%]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,69,0.15)_0%,rgba(10,26,69,0)_30%,rgba(10,26,69,0.82)_100%)]" />
            <div className="absolute inset-x-6 top-6 z-[2] flex items-center justify-between gap-3">
              <span className={letterGlass}>S</span>
              <span className="ba-glass-dark whitespace-nowrap rounded-full px-3 py-[7px] text-xs font-semibold">01 · {t("landing.safeMethod.humanPillar")}</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 z-[2] p-7">
              <h3 className="ba-h3 mb-2.5 text-[clamp(24px,2.1vw,30px)]">{pillar("s", "title")}</h3>
              <p className="m-0 max-w-[300px] text-[15px] leading-[1.55] text-white/[0.88]">{pillar("s", "description")}</p>
            </div>
          </article>

          {/* A: vidro claro */}
          <article id="pilar-a" className={`${cellBase} ba-glass ba-rv scroll-mt-28 px-[22px] py-6 md:col-span-3 lg:col-span-4 lg:p-7`} style={delay(2)} data-tilt>
            <div className="flex items-center justify-between gap-3">
              <span className="grid h-[58px] w-[58px] flex-none place-items-center rounded-[18px] bg-[linear-gradient(150deg,#4a6dd0,var(--ba-blue)_60%,#172f7d)] font-[family-name:var(--ba-display)] text-[28px] font-extrabold tracking-[-0.04em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_24px_-10px_rgba(31,63,163,0.7)]">
                A
              </span>
              <span className="text-xs font-semibold tracking-[0.14em] text-[var(--ba-ink-3)]">02</span>
            </div>
            <h3 className="ba-h3 mb-2.5 mt-[22px] text-[clamp(24px,2.1vw,30px)] text-[var(--ba-navy)]">{pillar("a", "title")}</h3>
            <p className="m-0 text-[15px] leading-[1.55] text-[var(--ba-ink-2)]">{pillar("a", "description")}</p>
            <div className="mt-[18px] flex flex-wrap gap-1.5">
              {(["a0", "a1", "a2"] as const).map((tag) => (
                <span key={tag} className={`${tagBase} bg-[rgba(31,63,163,0.07)] text-[var(--ba-blue)] shadow-[inset_0_0_0_1px_rgba(31,63,163,0.1)]`}>
                  {t(`landing.safeMethod.tags.${tag}`)}
                </span>
              ))}
            </div>
          </article>

          {/* F: navy com brilho */}
          <article
            id="pilar-f"
            className={`${cellBase} ba-rv scroll-mt-28 px-[22px] py-6 text-white shadow-[var(--ba-shadow),inset_0_1px_0_rgba(255,255,255,0.18)] [background:radial-gradient(120%_90%_at_100%_0%,rgba(71,107,192,0.75)_0%,rgba(71,107,192,0)_55%),radial-gradient(90%_80%_at_0%_110%,rgba(144,36,52,0.75)_0%,rgba(144,36,52,0)_60%),linear-gradient(160deg,#13296b,var(--ba-navy-2))] md:col-span-6 lg:col-span-4 lg:p-7`}
            style={delay(3)}
            data-tilt
          >
            <svg className="pointer-events-none absolute -right-2.5 top-[18px] h-[90px] w-[58%] opacity-55" viewBox="0 0 220 90" fill="none" aria-hidden="true">
              <defs>
                <linearGradient id="ba-spark" x1="0" x2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity="0" />
                  <stop offset="1" stopColor="#fff" />
                </linearGradient>
              </defs>
              <path d="M2 78 C 30 74, 46 60, 70 62 S 110 40, 134 44 S 172 18, 218 10" stroke="url(#ba-spark)" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <div className="flex items-center justify-between gap-3">
              <span className={letterGlass}>F</span>
              <span className="text-xs font-semibold tracking-[0.14em] opacity-75">03</span>
            </div>
            <h3 className="ba-h3 mb-2.5 mt-[22px] text-[clamp(24px,2.1vw,30px)]">{pillar("f", "title")}</h3>
            <p className="m-0 text-[15px] leading-[1.55] text-white/[0.86]">{pillar("f", "description")}</p>
            <div className="mt-[18px] flex flex-wrap gap-1.5">
              {(["f0", "f1", "f2"] as const).map((tag) => (
                <span key={tag} className={`${tagBase} bg-white/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]`}>
                  {t(`landing.safeMethod.tags.${tag}`)}
                </span>
              ))}
            </div>
          </article>

          {/* E: leque de pôsteres dos atletas */}
          <article id="pilar-e" className={`${cellBase} group ba-rv min-h-[520px] scroll-mt-28 bg-[#0b1a44] text-white shadow-[var(--ba-shadow)] md:col-span-6 md:min-h-[330px] lg:col-span-7`} style={delay(1)} data-tilt>
            <Image src={soccerField} alt="" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover opacity-55" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,69,0.95)_0%,rgba(10,26,69,0.82)_46%,rgba(10,26,69,0.25)_100%)] md:bg-[linear-gradient(90deg,rgba(10,26,69,0.96)_0%,rgba(10,26,69,0.78)_42%,rgba(10,26,69,0.1)_100%)]" />
            <div className="pointer-events-none absolute bottom-[-30px] left-1/2 z-[1] h-[240px] w-[340px] -translate-x-1/2 md:bottom-auto md:left-auto md:right-[4%] md:top-1/2 md:h-[120%] md:w-[52%] md:-translate-y-1/2 md:translate-x-0" aria-hidden="true">
              {FAN_POSTERS.map((poster) => (
                <div
                  key={poster.src.src}
                  className={`absolute top-1/2 aspect-[9/16] w-[118px] overflow-hidden rounded-2xl shadow-[0_30px_50px_-18px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.25)] transition-transform duration-[900ms] [transition-timing-function:var(--ba-ease)] md:w-[clamp(120px,11vw,160px)] ${poster.position}`}
                >
                  <Image src={poster.src} alt="" fill sizes="160px" className="object-cover" />
                </div>
              ))}
            </div>
            <div className="relative z-[2] flex h-full max-w-none flex-col justify-start gap-6 px-[22px] py-6 md:max-w-[400px] md:justify-between md:p-[clamp(28px,3vw,40px)]">
              <div className="flex items-center gap-3.5">
                <span className={letterGlass}>E</span>
                <span className="text-xs font-semibold tracking-[0.14em] opacity-75">04</span>
              </div>
              <div>
                <h3 className="ba-h3 mb-2.5 text-[clamp(24px,2.1vw,30px)]">{pillar("e", "title")}</h3>
                <p className="m-0 text-[15px] leading-[1.55] text-white/[0.86]">{pillar("e", "description")}</p>
              </div>
            </div>
          </article>

          {/* Fecho do método */}
          <article
            className={`${cellBase} ba-rv flex flex-col justify-between px-[22px] py-7 text-white [background:linear-gradient(135deg,var(--ba-wine)_0%,#6d2350_38%,var(--ba-blue)_100%)] shadow-[0_30px_70px_-28px_rgba(144,36,52,0.6),inset_0_1px_0_rgba(255,255,255,0.25)] md:col-span-6 lg:col-span-5 lg:p-[clamp(28px,3vw,40px)]`}
            style={delay(2)}
            data-tilt
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-[-40%] animate-[spin_14s_linear_infinite] [background:conic-gradient(from_0deg,transparent_0_70%,rgba(255,255,255,0.18)_80%,transparent_90%)]" />
            <span className="ba-serif relative text-[96px] leading-[0.6] opacity-35" aria-hidden="true">
              “
            </span>
            <blockquote className="relative m-0 font-[family-name:var(--ba-display)] text-[clamp(22px,2.1vw,30px)] font-medium leading-[1.22] tracking-[-0.025em]">
              {t("landing.safeMethod.closingBefore")} <em className="ba-serif text-[1.12em] not-italic [font-style:italic]">{t("landing.safeMethod.closingBold")}</em>
              {t("landing.safeMethod.closingAfter")}
            </blockquote>
            <div className="relative mt-[22px] flex items-center justify-between gap-3 text-[13px] font-semibold opacity-[0.92]">
              <span>{t("landing.safeMethod.heading")} S.A.F.E.®</span>
              <Link
                href="/forms"
                onClick={() => trackCtaClick("hero")}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.14] px-3.5 py-[9px] shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] transition-colors hover:bg-white/25"
              >
                {t("landing.safeMethod.ctaShort")}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
});

SAFEMethodSection.displayName = "SAFEMethodSection";

export default SAFEMethodSection;
