"use client";

import { memo } from "react";
import Image from "next/image";
import { ArrowRight, Instagram, Youtube, Mail } from "lucide-react";

import logoWhite from "@/assets/logo-white.png";
import { FOOTER_NAV, FOOTER_NAV_LABEL, NAV_A11Y, isActivePath } from "@/config/navigation";
import { pick } from "@/content/types";
import { Link, usePathname } from "@/i18n/navigation";
import { useLanguage } from "@/i18n";
import { trackCtaClick } from "@/lib/tracking/events";

const CONTACT_EMAIL = "contato@bolsaatletausa.com";

const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://instagram.com/bolsaatletausa", icon: Instagram },
  { label: "YouTube", href: "https://youtube.com/@bolsaatletausa", icon: Youtube },
] as const;

interface FooterProps {
  /**
   * "attached": continua o CTA final escuro da home sem emenda.
   * "standalone": em páginas claras (legais), ganha cantos e respiro próprios.
   */
  variant?: "attached" | "standalone";
}

const SOCIAL_BUTTON_CLASS =
  "ba-glass-dark grid h-11 w-11 place-items-center rounded-full text-white/80 transition-[transform,background-color,color] duration-500 hover:-translate-y-0.5 hover:bg-white/[0.14] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a9c0f2]";

const SITEMAP_LINK_CLASS =
  "inline-flex min-h-[44px] items-center gap-1.5 rounded-sm text-[15px] font-medium text-[rgba(232,238,255,0.82)] transition-colors hover:text-white aria-[current=page]:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a9c0f2] lg:min-h-[36px]";

// Alvo de toque de 44px no celular (eram 19px de altura); no desktop, com mouse, fica no tamanho do texto
const LEGAL_LINK_CLASS =
  "inline-flex min-h-[44px] items-center rounded-sm text-[rgba(232,238,255,0.72)] underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a9c0f2] lg:min-h-[28px]";

const Footer = memo(({ variant = "attached" }: FooterProps) => {
  const { t, lang } = useLanguage();
  const pathname = usePathname();
  const standalone = variant === "standalone";

  return (
    <footer
      className={`ba-dark relative isolate overflow-hidden ${
        standalone ? "rounded-t-[clamp(28px,4vw,48px)] pt-[clamp(56px,7vw,88px)]" : "pt-2"
      } pb-[calc(var(--ba-dock-space)+24px)] lg:pb-[max(32px,env(safe-area-inset-bottom))]`}
    >
      <div aria-hidden="true" className="ba-glow bottom-[-220px] left-[30%] h-[420px] w-[620px] bg-[rgba(31,63,163,0.35)]" />

      <div className="ba-wrap relative z-[2]">
        <div
          className={`grid gap-9 pb-10 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end lg:gap-x-[clamp(48px,6vw,104px)] ${
            standalone ? "" : "border-t border-white/[0.1] pt-12"
          }`}
        >
          <div className="max-w-[380px]">
            {/* O PNG tem muita margem transparente: a moldura recorta só a marca */}
            <div className="relative h-[85px] w-[160px] overflow-hidden">
              <Image src={logoWhite} alt="Bolsa Atleta USA" width={188} className="absolute left-[-14px] top-[-16px] h-auto w-[188px] max-w-none" />
            </div>
            <p className="mt-5 text-[14.5px] leading-[1.6] text-[rgba(232,238,255,0.72)]">{t("links.subtitle")}</p>
          </div>

          {/* Mapa do site: no mobile a dock leva só 4 destinos, aqui está tudo */}
          <nav aria-labelledby="ba-footer-sitemap">
            <p id="ba-footer-sitemap" className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-[rgba(232,238,255,0.62)]">
              {pick(FOOTER_NAV_LABEL, lang)}
            </p>
            <ul className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-3 lg:mt-3 lg:grid-cols-[repeat(3,auto)] lg:gap-x-9 lg:gap-y-1">
              {FOOTER_NAV.map((item) => {
                const apply = item.key === "apply";
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      aria-current={!apply && isActivePath(pathname, item.href) ? "page" : undefined}
                      onClick={apply ? () => trackCtaClick("footer") : undefined}
                      className={`${SITEMAP_LINK_CLASS} ${apply ? "!text-[#cfdcff] hover:!text-white" : ""}`}
                    >
                      {t(item.labelKey)}
                      {/* Seta reta: o diagonal (↗) sugere link externo, e a avaliação é do próprio site */}
                      {apply && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex flex-col gap-4 lg:items-end">
            <div className="flex items-center gap-2.5">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={`${label} (${pick(NAV_A11Y.newTab, lang)})`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={SOCIAL_BUTTON_CLASS}
                >
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </a>
              ))}
            </div>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="ba-glass-dark inline-flex min-h-[44px] w-fit items-center gap-2.5 rounded-full py-2.5 pl-3 pr-4 text-[14px] font-medium text-white/90 transition-[transform,background-color] duration-500 hover:-translate-y-0.5 hover:bg-white/[0.14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a9c0f2]"
            >
              <Mail className="h-[17px] w-[17px] text-[#cfdcff]" aria-hidden="true" />
              {CONTACT_EMAIL}
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/[0.1] pt-6 text-[12.5px] sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[rgba(232,238,255,0.62)]">{t("landing.footer.copyright")}</p>
          {/* A Meta exige política de privacidade alcançável a partir do site
              para aprovar o app do Instagram e, independente disso, é o
              lugar onde qualquer pessoa espera encontrar. */}
          <nav aria-label={pick(NAV_A11Y.legalNav, lang)} className="flex flex-wrap items-center gap-x-3">
            <Link href="/privacidade" className={LEGAL_LINK_CLASS}>
              {t("landing.footer.privacidade")}
            </Link>
            <span aria-hidden="true" className="text-white/30">·</span>
            <Link href="/exclusao-de-dados" className={LEGAL_LINK_CLASS}>
              {t("landing.footer.exclusaoDados")}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
