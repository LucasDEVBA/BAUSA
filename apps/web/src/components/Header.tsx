"use client";

import { memo, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

import logoHorizontal from "@/assets/logo-horizontal.png";
import {
  CHROME_TRANSITION,
  DESKTOP_QUERY,
  useKeyboardFocusWithin,
  useMediaQuery,
  useScrollCompact,
} from "@/components/site/MobileDock";
import { HEADER_NAV, MAIN_CONTENT_ID, NAV_A11Y, isActivePath } from "@/config/navigation";
import { pick } from "@/content/types";
import { Link, usePathname } from "@/i18n/navigation";
import { useLanguage } from "@/i18n";
import { dockStateMachine } from "@/lib/dock-state";
import { trackCtaClick } from "@/lib/tracking/events";
import LanguageSelector from "./LanguageSelector";

// Percentual da própria altura: com a safe-area do topo (até ~59px) a pílula ainda sai inteira
const HEADER_HIDDEN_Y = "-200%";

const Header = memo(() => {
  const { t, lang } = useLanguage();
  const pathname = usePathname();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const reducedMotion = useReducedMotion() ?? false;
  const scrollCompact = useScrollCompact();
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { focusWithin, focusHandlers } = useKeyboardFocusWithin();

  // No mobile a pílula do topo sai junto com a dock compacta (mesma regra) e
  // nunca com foco de teclado dentro dela; no desktop fica sempre. Escondida
  // ela NÃO fica inert: o Tab (ou o Shift+Tab vindo do conteúdo) entra nela e o
  // foco de teclado a traz de volta, em vez de pular logo e idioma em silêncio.
  const hidden = dockStateMachine.headerMode({ scrollCompact, reducedMotion, focusWithin, desktop }) === "hidden";


  // Pílula ganha mais opacidade depois que o topo da página sai da tela.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-10 w-px" />
      {/* Primeiro Tab da página: no desktop são 7 paradas até o conteúdo */}
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="ba-btn ba-btn-primary fixed left-[max(12px,env(safe-area-inset-left))] top-[max(12px,env(safe-area-inset-top))] z-[60] -translate-y-[200%] whitespace-nowrap !min-h-[44px] !px-5 !py-2.5 !text-sm opacity-0 focus:translate-y-0 focus:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ba-blue-2)]"
      >
        {pick(NAV_A11Y.skipToContent, lang)}
      </a>
      <motion.header
        className="pointer-events-none fixed inset-x-0 top-[max(10px,env(safe-area-inset-top))] z-50 px-[var(--ba-gutter)] sm:top-[max(14px,env(safe-area-inset-top))] print:hidden"
        initial={false}
        animate={{ y: hidden ? HEADER_HIDDEN_Y : "0%", opacity: hidden ? 0 : 1 }}
        transition={
          reducedMotion ? CHROME_TRANSITION.instant : hidden ? CHROME_TRANSITION.hide : CHROME_TRANSITION.expand
        }
        {...focusHandlers}
      >
        <nav
          aria-label={pick(NAV_A11Y.headerNav, lang)}
          className={`ba-glass pointer-events-auto mx-auto flex h-[58px] max-w-[1240px] items-center justify-between gap-4 rounded-full pl-3.5 pr-1.5 max-[299px]:gap-2 max-[299px]:pl-2.5 transition-[background-color] duration-500 sm:h-[66px] sm:pl-5 sm:pr-2.5 ${
            scrolled ? "!bg-white/80" : ""
          }`}
        >
          <Link href="/" aria-label="Bolsa Atleta USA" className="relative block h-11 w-[88px] flex-none overflow-hidden sm:h-[50px] sm:w-[104px]">
            {/* O arquivo do logo tem margem interna; o recorte por CSS evita redesenhar a marca */}
            <Image
              src={logoHorizontal}
              alt="Bolsa Atleta USA"
              width={124}
              loading="eager"
              className="absolute -left-2 -top-3 h-auto w-[104px] max-w-none sm:-left-[9px] sm:-top-3.5 sm:w-[124px]"
            />
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {HEADER_NAV.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative isolate flex min-h-11 items-center whitespace-nowrap rounded-full px-[15px] py-[9px] text-[14.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ba-blue-2)] ${
                      active
                        ? "text-[var(--ba-navy)]"
                        : "text-[var(--ba-ink-2)] hover:bg-[rgba(31,63,163,0.07)] hover:text-[var(--ba-navy)]"
                    }`}
                  >
                    {/* Pílula do ativo desliza de página em página: o header não remonta entre rotas */}
                    {active && (
                      <motion.span
                        layoutId="ba-header-active"
                        aria-hidden="true"
                        className="absolute inset-0 -z-[1] rounded-full bg-white shadow-[inset_0_0_0_1px_var(--ba-stroke),0_1px_2px_rgba(15,35,87,0.06),0_8px_18px_-10px_rgba(31,63,163,0.45)]"
                        transition={reducedMotion ? CHROME_TRANSITION.instant : CHROME_TRANSITION.pill}
                      />
                    )}
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2">
            {/* Alvo de toque de 44px no botão do seletor (o componente é compartilhado com o
                /forms); com zoom de 200% o globo sai e fica só a bandeira */}
            <div className="rounded-full bg-white/55 shadow-[inset_0_0_0_1px_var(--ba-stroke)] [&>div>button]:min-h-[44px] [&>div>button]:min-w-[44px] [&>div>button]:justify-center [&>div>button]:px-3 max-[299px]:[&>div>button>svg]:hidden">
              <LanguageSelector variant="light" />
            </div>
            {/* No mobile o CTA mora na dock (cta_source "dock") */}
            <Link
              href="/forms"
              onClick={() => trackCtaClick("header")}
              className="ba-btn ba-btn-primary hidden !min-h-0 !px-5 !py-3 !text-sm lg:inline-flex"
            >
              {t("header.contact")}
            </Link>
          </div>
        </nav>
      </motion.header>
    </>
  );
});

Header.displayName = "Header";

export default Header;
