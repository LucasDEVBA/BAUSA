"use client";

import { memo } from "react";
import Image from "next/image";
import { Target, Compass, ArrowUpRight, Sparkles } from "lucide-react";

import logoWhite from "@/assets/logo-white.png";
import { HOME_TEASERS, SOBRE_VIDEOS, withLanguageTag } from "@/content/sobre";
import { pick } from "@/content/types";
import { getVideo } from "@/content/videos";
import { useLanguage } from "@/i18n";
import MeshBackground from "./brand/MeshBackground";
import VideoChip from "./brand/VideoChip";

const CONCEPTS = [
  { key: "criteria", icon: Target, chip: "bg-[linear-gradient(150deg,#4a6dd0,var(--ba-blue)_60%,#172f7d)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_24px_-10px_rgba(31,63,163,0.7)]", bar: "from-[var(--ba-blue-2)] to-[var(--ba-blue)]" },
  { key: "guidance", icon: Compass, chip: "bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine)_60%,#5e1621)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_24px_-10px_rgba(144,36,52,0.7)]", bar: "from-[var(--ba-wine-2)] to-[var(--ba-wine)]" },
  { key: "vision", icon: ArrowUpRight, chip: "bg-[linear-gradient(150deg,#2b3f7d,var(--ba-navy)_60%,#081333)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_12px_24px_-10px_rgba(15,35,87,0.7)]", bar: "from-[var(--ba-blue)] to-[var(--ba-wine)]" },
] as const;

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

const eeiVideo = getVideo(SOBRE_VIDEOS.eei);

/** No itálico serifado o ® vira um círculo enorme: reduz a marca a sobrescrito discreto. */
const withSmallRegistered = (text: string) =>
  text.split("®").flatMap((part, i) => (i === 0 ? [part] : [<sup key={i} className="ml-0.5 align-super font-[family-name:var(--ba-body)] text-[0.32em] not-italic">®</sup>, part]));

const WhatIsEEISection = memo(() => {
  const { t, lang } = useLanguage();

  return (
    <section id="o-que-e" className="relative isolate overflow-hidden py-[clamp(80px,10vw,140px)]" aria-labelledby="o-que-e-title">
      {/* O brilho começa esmaecido no topo: sem isso aparecia uma linha na emenda com a seção de cima */}
      <MeshBackground blobs={["b2", "b4"]} className="[mask-image:linear-gradient(180deg,transparent,#000_12%)] [&_.ba-b2]:!opacity-40 [&_.ba-b4]:!opacity-70" />

      <div className="ba-wrap">
        <div className="relative z-[2] grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-[clamp(40px,5vw,80px)]">
          {/* Manifesto */}
          <div className="lg:col-span-7">
            <span className="ba-eyebrow ba-glass ba-rv" style={delay(0)}>
              <span className="ba-dot" />
              {t("landing.whatIsEEI.badge")}
            </span>

            <h2 id="o-que-e-title" className="ba-h2 ba-rv mt-6 text-[var(--ba-navy)]" style={delay(1)}>
              {t("landing.whatIsEEI.title1")}{" "}
              <span className="ba-serif ba-grad-text block text-[1.12em] leading-[1.02]">{withSmallRegistered(t("landing.whatIsEEI.title2"))}</span>
            </h2>

            <p className="ba-rv mt-7 max-w-[620px] font-[family-name:var(--ba-display)] text-[clamp(18px,1.7vw,23px)] font-medium leading-[1.45] tracking-[-0.02em] text-[var(--ba-ink)]" style={delay(2)}>
              {t("landing.whatIsEEI.p1Before")}
              <strong className="font-semibold text-[var(--ba-blue)]">{t("landing.eeiName")}</strong> {t("landing.whatIsEEI.p1After")}
            </p>

            <p className="ba-lead ba-rv mt-5 max-w-[580px]" style={delay(3)}>
              {t("landing.whatIsEEI.p2Before")} <strong className="font-semibold text-[var(--ba-wine)]">{t("landing.whatIsEEI.p2Bold")}</strong>
              {t("landing.whatIsEEI.p2After")}
            </p>

            {eeiVideo && (
              <div className="ba-rv mt-6" style={delay(3)}>
                <VideoChip
                  id={eeiVideo.id}
                  label={pick(HOME_TEASERS.eeiVideo, lang)}
                  title={pick(eeiVideo.title, lang)}
                  duration={withLanguageTag(eeiVideo.duration, lang)}
                />
              </div>
            )}

            <ul className="mt-9 grid grid-cols-3 gap-2.5 sm:gap-3.5" role="list">
              {CONCEPTS.map(({ key, icon: Icon, chip, bar }, index) => (
                <li key={key} className="ba-rv group" style={delay(4 + index)}>
                  <div className="ba-glass relative flex h-full flex-col gap-4 overflow-hidden rounded-[22px] p-3.5 transition-[translate,box-shadow] duration-500 [transition-timing-function:var(--ba-ease)] group-hover:-translate-y-1 group-hover:shadow-[var(--ba-shadow-lg)] sm:rounded-[26px] sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className={`grid h-10 w-10 place-items-center rounded-[14px] text-white transition-transform duration-500 [transition-timing-function:var(--ba-ease)] group-hover:-rotate-6 group-hover:scale-110 sm:h-12 sm:w-12 sm:rounded-2xl ${chip}`}>
                      <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" aria-hidden="true" />
                    </span>
                    <span className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ba-ink-3)]">0{index + 1}</span>
                  </div>
                  <h3 className="ba-h3 text-[15px] text-[var(--ba-navy)] sm:text-[19px]">{t(`landing.whatIsEEI.${key}`)}</h3>
                  {/* A barra "desenha" depois que o cartão aparece: ritmo de leitura 1, 2, 3 */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 bottom-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r transition-transform duration-[1200ms] [transition-timing-function:var(--ba-ease)] group-data-[in]:scale-x-100 ${bar}`}
                    style={{ transitionDelay: `${600 + index * 220}ms` }}
                  />
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Emblema em órbita: profundidade sem repetir fotos do Hero */}
          <div className="ba-rv-scale lg:col-span-5" style={delay(2)}>
            <div className="relative mx-auto h-[400px] max-w-[520px] sm:h-[520px] lg:h-[580px]" data-tilt-stage>
              <div
                className="absolute inset-0 overflow-hidden rounded-[30px] text-white shadow-[var(--ba-shadow-lg),inset_0_1px_0_rgba(255,255,255,0.18)] [background:radial-gradient(90%_70%_at_85%_0%,rgba(71,107,192,0.7)_0%,rgba(71,107,192,0)_60%),radial-gradient(80%_60%_at_0%_100%,rgba(144,36,52,0.6)_0%,rgba(144,36,52,0)_62%),linear-gradient(165deg,#13296b,var(--ba-navy-2))] sm:rounded-[32px]"
                data-depth="6"
              >
                <div className="ba-lines" />
                <div className="ba-glow left-1/2 top-[34%] sm:top-[44%] h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 bg-[rgba(120,150,235,0.35)]" />

                {/* Anéis concêntricos: critério, orientação e visão girando em torno do mesmo centro */}
                <div className="absolute left-1/2 top-[34%] -translate-x-1/2 -translate-y-1/2 sm:top-[44%]" aria-hidden="true">
                  <div className="absolute left-1/2 top-1/2 h-[330px] w-[330px] -translate-x-1/2 -translate-y-1/2 animate-[spin_60s_linear_infinite] rounded-full border border-white/[0.08] sm:h-[400px] sm:w-[400px]">
                    <span className="absolute left-1/2 top-[-4px] h-2 w-2 -translate-x-1/2 rounded-full bg-[#f0b1bb] shadow-[0_0_14px_3px_rgba(240,177,187,0.6)]" />
                  </div>
                  <div className="absolute left-1/2 top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite_reverse] rounded-full border border-dashed border-white/[0.14] sm:h-[300px] sm:w-[300px]">
                    <span className="absolute bottom-[-4px] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#b8caf7] shadow-[0_0_14px_3px_rgba(184,202,247,0.6)]" />
                  </div>
                  <div className="absolute left-1/2 top-1/2 h-[172px] w-[172px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.18] sm:h-[204px] sm:w-[204px]" />
                </div>
              </div>

              <div className="absolute left-1/2 top-[34%] z-[2] -translate-x-1/2 -translate-y-1/2 sm:top-[44%]">
                <div data-depth="16">
                  <div className="ba-glass-dark ba-float-a grid h-[136px] w-[136px] place-items-center rounded-full sm:h-[160px] sm:w-[160px]">
                    <Image src={logoWhite} alt="Bolsa Atleta USA" sizes="120px" className="h-auto w-[104px] sm:w-[122px]" />
                  </div>
                </div>
              </div>

              <div className="absolute right-4 top-4 z-[3] sm:right-6 sm:top-6" data-depth="22">
                <span className="ba-glass-dark inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold text-white">
                  <span className="ba-pulse" />
                  {t("landing.eeiName")}
                </span>
              </div>

              <figure className="absolute inset-x-4 bottom-4 z-[3] m-0 sm:inset-x-6 sm:bottom-6" data-depth="28">
                <div className="ba-glass rounded-[22px] !bg-white/[0.9] p-5 sm:rounded-[24px] sm:p-6">
                  <Sparkles className="mb-3 h-5 w-5 text-[var(--ba-wine)]" aria-hidden="true" />
                  <blockquote className="m-0 font-[family-name:var(--ba-display)] text-[clamp(18px,1.6vw,22px)] font-medium leading-[1.3] tracking-[-0.02em] text-[var(--ba-navy)]">
                    <span className="ba-serif text-[1.15em] text-[var(--ba-wine)]">{t("landing.whatIsEEI.p2Bold")}</span>
                  </blockquote>
                  <figcaption className="mt-3 text-[13px] font-semibold text-[var(--ba-ink-3)]">{t("landing.eeiName")}</figcaption>
                </div>
              </figure>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});

WhatIsEEISection.displayName = "WhatIsEEISection";

export default WhatIsEEISection;
