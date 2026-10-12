"use client";

import Image from "next/image";
import { ArrowRight, Instagram, Youtube, ClipboardCheck, Globe } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { useLanguage } from "@/i18n";
import { trackCtaClick } from "@/lib/tracking/events";
import logoHorizontal from "@/assets/logo-horizontal.png";
import leandroPhoto from "@/assets/leandro-founder-card.jpg";
import LanguageSelector from "@/components/LanguageSelector";
import MeshBackground from "@/components/brand/MeshBackground";
import { useBrandMotion } from "@/components/brand/useBrandMotion";

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://instagram.com/bolsaatletausa", icon: Instagram },
  { label: "TikTok", href: "https://tiktok.com/@bolsaatletausa", icon: TikTokIcon },
  { label: "YouTube", href: "https://youtube.com/@bolsaatletausa", icon: Youtube },
] as const;

const WHATSAPP_URL = "https://wa.me/+12233508213";

const FOCUS_RING = "focus-visible:outline focus-visible:outline-[2.5px] focus-visible:outline-offset-[3px] focus-visible:outline-[var(--ba-blue-2)]";

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

const trackFormsClick = () => trackCtaClick("links");

export default function LinksContent() {
  const { t } = useLanguage();
  // A página de links não passa pelo HomeContent, então liga aqui o motor de revelação
  useBrandMotion();

  return (
    <main className="ba-page relative isolate flex min-h-[100dvh] flex-col items-center overflow-hidden px-4 pb-10 pt-6 sm:pt-12">
      <MeshBackground grid />
      {/* Halos atrás do cartão: dão ao vidro algo para refratar, senão ele some no fundo claro */}
      <div aria-hidden="true" className="ba-glow left-1/2 top-[8%] h-[420px] w-[420px] -translate-x-[95%] bg-[rgba(71,107,192,0.42)]" />
      <div aria-hidden="true" className="ba-glow left-1/2 top-[48%] h-[380px] w-[380px] -translate-x-[5%] bg-[rgba(184,54,74,0.26)]" />

      <div className="ba-glass ba-rv absolute right-4 top-4 z-20 rounded-full p-0.5 sm:right-6 sm:top-6">
        <LanguageSelector size="lg" />
      </div>

      <div className="relative z-[1] mt-12 w-full max-w-[460px] sm:mt-6">
        <div className="ba-glass ba-rv-scale rounded-[30px] px-4 pb-5 pt-7 sm:rounded-[34px] sm:px-6 sm:pb-6 sm:pt-9">
          <header className="flex flex-col items-center text-center">
            {/* O PNG tem muita margem transparente: a moldura recorta só a marca */}
            <div className="ba-rv relative h-[74px] w-[140px] overflow-hidden" style={delay(1)}>
              <Image src={logoHorizontal} alt="Bolsa Atleta USA" width={165} priority className="absolute left-[-12px] top-[-14px] h-auto w-[165px] max-w-none" />
            </div>

            <h1 className="ba-rv mt-5 font-[family-name:var(--ba-display)] text-[12px] font-semibold uppercase tracking-[0.1em] sm:text-[13px] sm:tracking-[0.16em] text-[var(--ba-blue)]" style={delay(2)}>
              {t("links.brand")}
            </h1>
            <p className="ba-rv mt-2.5 max-w-[340px] text-[15px] leading-[1.55] text-[var(--ba-ink-2)]" style={delay(2)}>
              {t("links.subtitle")}
            </p>
            <span
              className="ba-rv mt-4 inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-[rgba(144,36,52,0.08)] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ba-wine)] shadow-[inset_0_0_0_1px_rgba(144,36,52,0.16)]"
              style={delay(3)}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ba-wine-2)]" aria-hidden="true" />
              {t("links.limitedSpots")}
            </span>

            <nav className="ba-rv mt-6 flex items-center justify-center gap-2.5" style={delay(3)}>
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={`ba-btn-ghost grid h-11 w-11 place-items-center rounded-full text-[var(--ba-navy)] transition-transform duration-500 hover:-translate-y-0.5 ${FOCUS_RING}`}
                >
                  <Icon className="h-[19px] w-[19px]" />
                </a>
              ))}
              <span className="mx-1 h-6 w-px bg-[var(--ba-stroke)]" aria-hidden="true" />
              <Link
                href="/"
                className={`ba-btn-ghost inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[12.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ba-navy)] transition-transform duration-500 hover:-translate-y-0.5 ${FOCUS_RING}`}
              >
                <Globe className="h-4 w-4" aria-hidden="true" />
                {t("links.officialSite")}
              </Link>
            </nav>
          </header>

          <div className="mt-7 flex flex-col gap-3">
            {/* Destaque: conversa com o fundador, o mesmo vidro escuro do momento de Autoridade da home */}
            <Link
              href="/forms"
              onClick={trackFormsClick}
              className={`ba-rv group relative isolate flex min-h-[176px] overflow-hidden rounded-[24px] bg-[var(--ba-navy-2)] text-white shadow-[var(--ba-shadow)] transition-transform duration-500 hover:-translate-y-1 ${FOCUS_RING}`}
              style={delay(4)}
            >
              <div aria-hidden="true" className="ba-glow left-[-80px] top-[-90px] h-[240px] w-[240px] bg-[rgba(71,107,192,0.55)]" />
              <div aria-hidden="true" className="ba-glow bottom-[-110px] left-[30%] h-[200px] w-[200px] bg-[rgba(144,36,52,0.5)]" />
              <div className="absolute inset-y-0 right-0 w-[48%] [-webkit-mask-image:linear-gradient(90deg,transparent,#000_55%)] [mask-image:linear-gradient(90deg,transparent,#000_55%)]">
                <Image
                  src={leandroPhoto}
                  alt="Leandro Ribeiro"
                  fill
                  sizes="200px"
                  className="object-cover object-[50%_20%] transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="relative z-[1] flex w-[64%] flex-col justify-center gap-1.5 p-5">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#cfdcff] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)]">
                  <span className="ba-pulse !h-1.5 !w-1.5" aria-hidden="true" />
                  {t("links.card1.label")}
                </span>
                <h2 className="mt-1 font-[family-name:var(--ba-display)] text-[22px] font-bold leading-[1.02] tracking-[-0.035em]">
                  {t("links.card1.title1")} <span className="ba-serif ba-grad-text-dark text-[1.12em]">{t("links.card1.title2")}</span>
                </h2>
                <p className="text-[12.5px] leading-[1.4] text-[rgba(232,238,255,0.8)]">{t("links.card1.description")}</p>
                <span className="mt-2 inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#fff,#e9eefb)] py-1.5 pl-3.5 pr-2 text-[12.5px] font-semibold text-[var(--ba-navy)] shadow-[inset_0_1px_0_#fff,0_10px_24px_-10px_rgba(0,0,0,0.6)]">
                  {t("links.card1.cta")}
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--ba-navy)] text-white transition-transform duration-500 group-hover:translate-x-0.5">
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </span>
              </div>
            </Link>

            <Link
              href="/forms"
              onClick={trackFormsClick}
              className={`ba-rv group flex items-center gap-3.5 rounded-[22px] bg-white/75 p-3.5 shadow-[inset_0_1px_0_#fff,0_0_0_1px_var(--ba-stroke),var(--ba-shadow-sm)] transition-[transform,background-color] duration-500 hover:-translate-y-0.5 hover:bg-white/90 ${FOCUS_RING}`}
              style={delay(5)}
            >
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-[linear-gradient(150deg,#2b4fbd,var(--ba-blue)_55%,#18348c)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_22px_-10px_rgba(31,63,163,0.7)]">
                <ClipboardCheck className="h-[22px] w-[22px]" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-[family-name:var(--ba-display)] text-[15.5px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--ba-ink)]">
                  {t("links.card2.title")}
                </span>
                <span className="mt-1 block text-[12.5px] leading-[1.4] text-[var(--ba-ink-3)]">{t("links.card2.description")}</span>
              </span>
              <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[rgba(31,63,163,0.08)] text-[var(--ba-blue)] transition-[transform,background-color,color] duration-500 group-hover:translate-x-0.5 group-hover:bg-[var(--ba-blue)] group-hover:text-white">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </span>
            </Link>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={`ba-rv group flex items-center gap-3.5 rounded-[22px] bg-white/75 p-3.5 shadow-[inset_0_1px_0_#fff,0_0_0_1px_var(--ba-stroke),var(--ba-shadow-sm)] transition-[transform,background-color] duration-500 hover:-translate-y-0.5 hover:bg-white/90 ${FOCUS_RING}`}
              style={delay(6)}
            >
              <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-[linear-gradient(150deg,#2fd27a,#139a52)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_22px_-10px_rgba(19,154,82,0.7)]">
                <WhatsAppIcon className="h-[22px] w-[22px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-[family-name:var(--ba-display)] text-[15.5px] font-semibold leading-[1.2] tracking-[-0.02em] text-[var(--ba-ink)]">
                  {t("links.card3.title")}
                </span>
                <span className="mt-1 block text-[12.5px] leading-[1.4] text-[var(--ba-ink-3)]">{t("links.card3.description")}</span>
              </span>
              <span className="flex-none whitespace-nowrap rounded-full bg-[rgba(19,154,82,0.1)] px-3 py-2 text-[12px] font-semibold text-[#0d7a40] transition-colors duration-500 group-hover:bg-[#139a52] group-hover:text-white">
                {t("links.card3.cta")}
              </span>
            </a>
          </div>
        </div>

        <p className="ba-rv mt-7 text-center text-[11.5px] font-medium uppercase tracking-[0.18em] text-[var(--ba-ink-3)]" style={delay(7)}>
          {t("links.copyright")}
        </p>
      </div>
    </main>
  );
}
