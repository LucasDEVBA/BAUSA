"use client";

import { memo } from "react";
import { Users, Shield, Clock, Target, Heart } from "lucide-react";

import { useLanguage } from "@/i18n";
import MeshBackground from "./brand/MeshBackground";

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;
const FAMILY_ICONS = [Users, Target, Shield] as const;

const HowWeWorkSection = memo(() => {
  const { t } = useLanguage();

  return (
    <section className="relative isolate overflow-hidden py-[clamp(80px,10vw,140px)]" aria-labelledby="como-atuamos-title">
      <MeshBackground blobs={["b2", "b4"]} className="[&_.ba-b2]:!right-auto [&_.ba-b2]:!left-[-12vw] [&_.ba-b2]:!opacity-35 [&_.ba-b4]:!left-auto [&_.ba-b4]:!right-[-10vw] [&_.ba-b4]:!bottom-[-10vw]" />
      {/* Halo navy no pé da seção: prepara a entrada da Autoridade escura logo abaixo */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[260px] bg-[radial-gradient(60%_100%_at_50%_100%,rgba(31,63,163,0.14),rgba(31,63,163,0))]" />

      <div className="ba-wrap relative z-[2]">
        <header className="mx-auto max-w-[820px] text-center">
          <span className="ba-eyebrow ba-glass ba-rv" style={delay(0)}>
            <span className="ba-dot" />
            {t("landing.howWeWork.badge")}
          </span>
          <h2 id="como-atuamos-title" className="ba-h2 ba-rv mt-6 text-[var(--ba-navy)]" style={delay(1)}>
            {t("landing.howWeWork.title")}
          </h2>
          <p className="ba-lead ba-rv mx-auto mt-6 max-w-[720px]" style={delay(2)}>
            {t("landing.howWeWork.subtitle1")} {t("landing.howWeWork.subtitle2")}{" "}
            <strong className="font-semibold text-[var(--ba-blue)]">{t("landing.howWeWork.methodName")}</strong>
            {t("landing.howWeWork.subtitle3")}
          </p>
        </header>

        {/* Faixa da filosofia: o momento de impacto da seção */}
        <div
          className="ba-rv-scale relative mt-[clamp(44px,5vw,72px)] overflow-hidden rounded-[30px] px-6 pb-14 pt-10 text-white shadow-[0_40px_90px_-34px_rgba(144,36,52,0.6),inset_0_1px_0_rgba(255,255,255,0.25)] [background:linear-gradient(120deg,var(--ba-wine)_0%,#6d2350_36%,#2a3c9c_72%,var(--ba-blue)_100%)] sm:rounded-[36px] sm:px-12 sm:pb-16 sm:pt-14 lg:pb-[150px] lg:pt-16"
          style={delay(1)}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-[-60%] animate-[spin_18s_linear_infinite] [background:conic-gradient(from_0deg,transparent_0_68%,rgba(255,255,255,0.16)_78%,transparent_88%)]" />
          <div aria-hidden="true" className="ba-lines opacity-70" />

          {/* Dois anéis entrelaçados: "nada é isolado" desenhado */}
          <svg className="pointer-events-none absolute -right-16 top-1/2 h-[300px] w-[420px] -translate-y-1/2 opacity-30 sm:right-[-20px] sm:opacity-40 lg:right-[4%] lg:opacity-55" viewBox="0 0 420 300" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="ba-ring-a" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
                <stop offset="1" stopColor="#fff" stopOpacity="0.1" />
              </linearGradient>
              <linearGradient id="ba-ring-b" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f0b1bb" stopOpacity="0.9" />
                <stop offset="1" stopColor="#b8caf7" stopOpacity="0.15" />
              </linearGradient>
            </defs>
            <circle cx="160" cy="150" r="110" stroke="url(#ba-ring-a)" strokeWidth="2" />
            <circle cx="260" cy="150" r="110" stroke="url(#ba-ring-b)" strokeWidth="2" />
            <circle cx="160" cy="150" r="70" stroke="#fff" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="3 7" />
            <circle cx="260" cy="150" r="70" stroke="#fff" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="3 7" />
          </svg>

          <div className="relative max-w-[760px]">
            <span className="ba-glass-dark inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold tracking-[0.16em]">
              <span className="ba-pulse" />
              {t("landing.howWeWork.philosophy.pill")}
            </span>
            <p className="m-0 mt-7 font-[family-name:var(--ba-display)] text-[clamp(40px,6.4vw,92px)] font-bold leading-[0.98] tracking-[-0.045em]">
              {t("landing.howWeWork.philosophy.line1")}
              <span className="ba-serif mt-1 block text-[1.08em] font-normal leading-[1] text-white/95">{t("landing.howWeWork.philosophy.line2")}</span>
            </p>
          </div>
        </div>

        {/* Cartões assimétricos sobrepostos à faixa: profundidade e ponte para a seção escura */}
        <div className="relative z-[3] mt-4 grid grid-cols-1 gap-4 sm:mt-5 sm:gap-5 lg:-mt-[96px] lg:grid-cols-12 lg:px-[clamp(20px,3vw,48px)]">
          <article className="ba-glass ba-rv flex flex-col rounded-[26px] !bg-white/[0.88] p-6 sm:rounded-[30px] sm:p-8 lg:col-span-7" style={delay(2)} data-tilt>
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 flex-none place-items-center rounded-[18px] bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine)_60%,#5e1621)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_28px_-12px_rgba(144,36,52,0.75)]">
                <Heart className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <span className="text-xs font-semibold tracking-[0.14em] text-[var(--ba-wine)]">{t("landing.howWeWork.card1.tagline")}</span>
                <h3 className="ba-h3 mt-1 text-[clamp(22px,2vw,28px)] text-[var(--ba-navy)]">{t("landing.howWeWork.card1.title")}</h3>
              </div>
            </div>
            <p className="mb-0 mt-5 text-[16px] leading-[1.6] text-[var(--ba-ink-2)]">
              {t("landing.howWeWork.card1.bodyBefore")} <strong className="font-semibold text-[var(--ba-navy)]">{t("landing.howWeWork.card1.bodyBold")}</strong>
              {t("landing.howWeWork.card1.bodyAfter")}
            </p>
            <span className="flex-1" aria-hidden="true" />
            <div className="mt-6 flex items-center gap-3 border-t border-[var(--ba-stroke)] pt-5">
              <div className="flex -space-x-2.5" aria-hidden="true">
                {FAMILY_ICONS.map((Icon, i) => (
                  <span key={i} className="grid h-9 w-9 place-items-center rounded-full bg-white text-[var(--ba-blue)] shadow-[0_0_0_2px_#fff,0_0_0_3px_var(--ba-stroke),var(--ba-shadow-sm)]">
                    <Icon className="h-4 w-4" />
                  </span>
                ))}
              </div>
              <span className="text-sm font-semibold text-[var(--ba-ink-2)]">{t("landing.howWeWork.card1.footer")}</span>
            </div>
          </article>

          <article
            className="ba-rv relative flex flex-col overflow-hidden rounded-[26px] p-6 text-white shadow-[var(--ba-shadow-lg),inset_0_1px_0_rgba(255,255,255,0.18)] [background:radial-gradient(110%_80%_at_100%_0%,rgba(71,107,192,0.6)_0%,rgba(71,107,192,0)_55%),linear-gradient(165deg,#13296b,var(--ba-navy-2))] sm:rounded-[30px] sm:p-8 lg:col-span-5"
            style={delay(3)}
            data-tilt
          >
            <div className="ba-glow -right-10 -top-10 h-40 w-40 bg-[rgba(144,36,52,0.45)]" />
            <div className="relative flex items-start justify-between gap-3">
              <span className="grid h-14 w-14 flex-none place-items-center rounded-[18px] bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_0_0_1px_rgba(255,255,255,0.2)] backdrop-blur-[14px]">
                <Shield className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="whitespace-nowrap rounded-full bg-[linear-gradient(135deg,var(--ba-wine-2),var(--ba-wine))] px-3 py-1.5 text-[11px] font-bold tracking-[0.14em] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_18px_-8px_rgba(144,36,52,0.8)]">
                {t("landing.howWeWork.card2.footerBadge")}
              </span>
            </div>
            <span className="relative mt-5 text-xs font-semibold tracking-[0.14em] text-[#f0b1bb]">{t("landing.howWeWork.card2.tagline")}</span>
            <h3 className="ba-h3 relative mt-1 text-[clamp(22px,2vw,28px)]">{t("landing.howWeWork.card2.title")}</h3>
            <p className="relative mb-0 mt-4 text-[16px] leading-[1.6] text-white/[0.84]">
              {t("landing.howWeWork.card2.bodyBefore")} <strong className="font-semibold text-white">{t("landing.howWeWork.card2.bodyBold")}</strong>
              {t("landing.howWeWork.card2.bodyAfter")}
            </p>
            <span className="flex-1" aria-hidden="true" />
            <div className="relative mt-6 flex items-center gap-2.5 border-t border-white/[0.12] pt-5">
              <Clock className="h-4 w-4 text-[#f0b1bb]" aria-hidden="true" />
              <span className="text-sm font-semibold text-white/[0.86]">{t("landing.howWeWork.card2.footerLabel")}</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
});

HowWeWorkSection.displayName = "HowWeWorkSection";

export default HowWeWorkSection;
