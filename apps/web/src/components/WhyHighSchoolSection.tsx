"use client";

import { memo, useMemo } from "react";
import Image from "next/image";
import { GraduationCap, Eye, TrendingUp, Building2, Check, type LucideIcon } from "lucide-react";

import athleteLin from "@/assets/athlete-lin.jpeg";
import athleteLiz from "@/assets/athlete-liz.jpeg";
import { useLanguage } from "@/i18n";
import { WHY_HIGH_SCHOOL_CHIPS } from "@/content/metodo";
import MeshBackground from "./brand/MeshBackground";
import { MethodVideoChip } from "./pages/metodo/MethodVideoChip";

interface Highlight {
  key: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  topics: string[];
}

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

/** Destaca o percentual que já existe no texto traduzido, sem alterar uma vírgula (o ES começa com "El 96%"). */
function splitStat(text: string) {
  const match = text.match(/\d+([.,]\d+)?%/);
  if (!match || match.index === undefined) return null;
  return {
    before: text.slice(0, match.index).trim(),
    stat: match[0],
    after: text.slice(match.index + match[0].length).trim(),
  };
}

const TopicList = ({ topics, dark = false }: { topics: string[]; dark?: boolean }) => (
  <ul className="mt-4 space-y-2.5" role="list">
    {topics.map((topic) => (
      <li key={topic} className="flex items-start gap-3">
        <span
          className={`mt-[2px] grid h-5 w-5 flex-none place-items-center rounded-full ${
            dark ? "bg-white/[0.14] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]" : "bg-[rgba(31,63,163,0.08)] text-[var(--ba-blue)] shadow-[inset_0_0_0_1px_rgba(31,63,163,0.12)]"
          }`}
        >
          <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
        </span>
        <span className={`text-[15px] leading-[1.55] ${dark ? "text-white/[0.86]" : "text-[var(--ba-ink-2)]"}`}>{topic}</span>
      </li>
    ))}
  </ul>
);

const WhyHighSchoolSection = memo(() => {
  const { t } = useLanguage();

  const highlights = useMemo<Highlight[]>(
    () => [
      {
        key: "academic",
        icon: GraduationCap,
        title: t("landing.whyHighSchool.highlights.academic.title"),
        topics: [0, 1, 2].map((i) => t(`landing.whyHighSchool.highlights.academic.topic${i}`)),
      },
      {
        key: "athletic",
        icon: TrendingUp,
        title: t("landing.whyHighSchool.highlights.athletic.title"),
        topics: [0, 1, 2].map((i) => t(`landing.whyHighSchool.highlights.athletic.topic${i}`)),
      },
      {
        key: "adaptation",
        icon: Building2,
        title: t("landing.whyHighSchool.highlights.adaptation.title"),
        topics: [0, 1, 2].map((i) => t(`landing.whyHighSchool.highlights.adaptation.topic${i}`)),
      },
      {
        key: "visibility",
        icon: Eye,
        title: t("landing.whyHighSchool.highlights.visibility.title"),
        subtitle: t("landing.whyHighSchool.highlights.visibility.subtitle"),
        topics: [0, 1].map((i) => t(`landing.whyHighSchool.highlights.visibility.topic${i}`)),
      },
    ],
    [t],
  );

  return (
    // overflow-clip (não hidden): hidden cria um contêiner de rolagem e a coluna dos pôsteres nunca grudava
    <section className="relative isolate overflow-hidden py-[clamp(80px,10vw,140px)] supports-[overflow:clip]:overflow-clip" aria-labelledby="high-school-title">
      <MeshBackground blobs={["b1", "b3"]} className="[&_.ba-b1]:!left-[-20vw] [&_.ba-b1]:!top-[20%] [&_.ba-b1]:!opacity-60 [&_.ba-b3]:!left-auto [&_.ba-b3]:!right-[-10vw] [&_.ba-b3]:!top-[55%] [&_.ba-b3]:!opacity-30" />

      <div className="ba-wrap relative z-[2]">
        {/* Cabeçalho editorial: título à esquerda, tese à direita */}
        <header className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <span className="ba-eyebrow ba-glass ba-rv" style={delay(0)}>
              <span className="ba-dot" />
              {t("landing.whyHighSchool.badge")}
            </span>
            <p className="ba-rv mt-6 text-[15px] font-semibold text-[var(--ba-wine)]" style={delay(1)}>
              {t("landing.whyHighSchool.tagline")}
            </p>
            <h2 id="high-school-title" className="ba-h2 ba-rv mt-3 text-[var(--ba-navy)]" style={delay(2)}>
              {t("landing.whyHighSchool.title1")} <span className="ba-serif ba-grad-text text-[1.14em]">{t("landing.whyHighSchool.title2")}</span>
            </h2>
          </div>
          <div className="lg:col-span-5 lg:pb-2">
            <p className="ba-lead ba-rv m-0" style={delay(3)}>
              {t("landing.whyHighSchool.subtitle")}
            </p>
            {/* Mini-trilha "Assista": as duas dúvidas que mais pesam antes da High School */}
            <div className="ba-rv mt-6 flex flex-wrap gap-2.5" style={delay(4)}>
              {WHY_HIGH_SCHOOL_CHIPS.map((chip) => (
                <MethodVideoChip key={chip.videoId} chip={chip} />
              ))}
            </div>
          </div>
        </header>

        <div className="mt-[clamp(48px,6vw,80px)] grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-[clamp(40px,4vw,64px)]">
          {/* Pôsteres em camadas + texto-base num vidro sobreposto */}
          <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
            <div className="ba-rv-scale relative mx-auto h-[400px] max-w-[460px] sm:h-[500px] lg:h-[460px]" style={delay(1)} data-tilt-stage aria-hidden="true">
              <div className="ba-glow left-[10%] top-[12%] h-[70%] w-[80%] bg-[rgba(71,107,192,0.35)]" />
              <div className="absolute right-[2%] top-[2%] w-[54%]" data-depth="8">
                <div className="relative aspect-[9/16] rotate-[7deg] overflow-hidden rounded-[22px] shadow-[var(--ba-shadow-lg),0_0_0_1px_rgba(255,255,255,0.6)]">
                  <Image src={athleteLiz} alt="" fill sizes="(max-width: 1024px) 50vw, 240px" className="object-cover" />
                </div>
              </div>
              <div className="absolute left-[4%] top-[8%] w-[58%]" data-depth="20">
                <div className="relative aspect-[9/16] -rotate-[4deg] overflow-hidden rounded-[24px] shadow-[0_40px_80px_-30px_rgba(15,35,87,0.55),0_0_0_1px_rgba(255,255,255,0.9)]">
                  <Image src={athleteLin} alt="" fill sizes="(max-width: 1024px) 55vw, 260px" className="object-cover" />
                </div>
              </div>
              <div className="absolute right-[6%] top-[48%]" data-depth="30">
                <span className="ba-glass ba-float-b inline-flex items-center gap-2.5 whitespace-nowrap rounded-full py-2 pl-2 pr-4 text-[13px] font-semibold text-[var(--ba-navy)]">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(150deg,#4a6dd0,var(--ba-blue))] text-white">
                    <GraduationCap className="h-4 w-4" />
                  </span>
                  High School
                </span>
              </div>
            </div>

            <div className="ba-glass ba-rv relative z-[3] -mt-24 rounded-[26px] p-6 sm:mx-6 sm:-mt-28 sm:rounded-[28px] sm:p-7" style={delay(2)}>
              <p className="m-0 text-[16px] leading-[1.6] text-[var(--ba-ink)] sm:text-[17px]">
                {t("landing.whyHighSchool.p1Before")}
                <strong className="font-semibold text-[var(--ba-blue)]">{t("landing.eeiName")}</strong> {t("landing.whyHighSchool.p1After")}
              </p>
              <p className="mb-0 mt-4 text-[15px] leading-[1.6] text-[var(--ba-ink-2)]">
                {t("landing.whyHighSchool.p2Before")} <strong className="font-semibold text-[var(--ba-wine)]">{t("landing.whyHighSchool.p2Bold")}</strong>{" "}
                {t("landing.whyHighSchool.p2After")}
              </p>
            </div>
          </div>

          {/* Trilha dos quatro destaques */}
          <ol className="relative lg:col-span-7" role="list">
            <span
              aria-hidden="true"
              className="absolute bottom-10 left-[25px] top-6 hidden w-[2px] sm:block rounded-full bg-[linear-gradient(180deg,rgba(31,63,163,0.05),var(--ba-blue-2)_18%,var(--ba-blue)_55%,var(--ba-wine)_100%)] opacity-40"
            />
            {highlights.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === highlights.length - 1;
              const stat = item.subtitle ? splitStat(item.subtitle) : null;
              return (
                <li key={item.key} className="ba-rv group relative grid grid-cols-1 pb-4 last:pb-0 sm:grid-cols-[52px_1fr] sm:gap-5 sm:pb-5" style={delay(index + 1)}>
                  <span
                    className={`relative z-[1] mt-5 hidden h-11 w-11 place-items-center rounded-full font-[family-name:var(--ba-display)] text-[13px] font-bold transition-[box-shadow,background-color] duration-700 sm:grid sm:h-[52px] sm:w-[52px] sm:text-sm ${
                      isLast
                        ? "bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))] text-white shadow-[0_0_0_6px_rgba(144,36,52,0.1),inset_0_1px_0_rgba(255,255,255,0.35)]"
                        : "ba-glass text-[var(--ba-blue)] group-data-[in]:shadow-[0_0_0_6px_rgba(31,63,163,0.08),var(--ba-shadow-sm)]"
                    }`}
                  >
                    0{index + 1}
                  </span>

                  {isLast ? (
                    <article className="relative overflow-hidden rounded-[26px] p-6 text-white shadow-[var(--ba-shadow-lg),inset_0_1px_0_rgba(255,255,255,0.18)] [background:radial-gradient(100%_80%_at_100%_0%,rgba(71,107,192,0.7)_0%,rgba(71,107,192,0)_58%),radial-gradient(80%_70%_at_0%_100%,rgba(144,36,52,0.65)_0%,rgba(144,36,52,0)_60%),linear-gradient(160deg,#13296b,var(--ba-navy-2))] sm:rounded-[30px] sm:p-8">
                      <div className="ba-lines" />
                      <div className="relative flex items-center gap-3">
                        <span className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_0_0_1px_rgba(255,255,255,0.2)] backdrop-blur-[14px]">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <h3 className="ba-h3 text-[clamp(20px,1.8vw,24px)]">{item.title}</h3>
                        <span className="ml-auto text-xs font-semibold tracking-[0.14em] text-white/70 sm:hidden">0{index + 1}</span>
                      </div>
                      {item.subtitle && (
                        <p className="relative mb-0 mt-6 border-l-2 border-[#f0b1bb]/70 pl-4 text-[16px] leading-[1.5] text-white/[0.9] sm:text-[17px]">
                          {stat ? (
                            <>
                              <span className="mb-2 flex items-baseline gap-2.5">
                                {stat.before && <span>{stat.before}</span>}
                                <span className="ba-grad-text-dark font-[family-name:var(--ba-display)] text-[clamp(56px,6.4vw,84px)] font-bold leading-[0.9] tracking-[-0.05em]">{stat.stat}</span>
                              </span>
                              <span className="block max-w-[520px]">{stat.after}</span>
                            </>
                          ) : (
                            item.subtitle
                          )}
                        </p>
                      )}
                      <div className="relative">
                        <TopicList topics={item.topics} dark />
                      </div>
                    </article>
                  ) : (
                    <article className="ba-glass rounded-[26px] p-6 transition-[translate,box-shadow] duration-500 [transition-timing-function:var(--ba-ease)] hover:-translate-y-1 hover:shadow-[var(--ba-shadow-lg)] sm:rounded-[30px] sm:p-7">
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-[linear-gradient(150deg,#4a6dd0,var(--ba-blue)_60%,#172f7d)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_24px_-10px_rgba(31,63,163,0.7)]">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <h3 className="ba-h3 text-[clamp(20px,1.8vw,24px)] text-[var(--ba-navy)]">{item.title}</h3>
                        <span className="ml-auto self-start text-xs font-semibold tracking-[0.14em] text-[var(--ba-ink-3)] sm:hidden">0{index + 1}</span>
                      </div>
                      <TopicList topics={item.topics} />
                    </article>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
});

WhyHighSchoolSection.displayName = "WhyHighSchoolSection";

export default WhyHighSchoolSection;
