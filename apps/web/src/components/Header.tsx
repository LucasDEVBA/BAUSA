"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

import logoHorizontal from "@/assets/logo-horizontal.png";
import { Link } from "@/i18n/navigation";
import { useLanguage } from "@/i18n";
import { trackCtaClick } from "@/lib/tracking/events";
import LanguageSelector from "./LanguageSelector";

const NAV_ITEMS = [
  { hash: "metodo", labelKey: "header.navMethod" },
  { hash: "autoridade", labelKey: "header.navAuthority" },
  { hash: "depoimentos", labelKey: "header.navTestimonials" },
] as const;

const Header = memo(() => {
  const { t } = useLanguage();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Pílula ganha mais opacidade depois que o topo da página sai da tela.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting));
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-10 w-px" />
      <header className="pointer-events-none fixed inset-x-0 top-2.5 z-50 px-[var(--ba-gutter)] sm:top-3.5">
        <nav
          aria-label="Principal"
          className={`ba-glass pointer-events-auto mx-auto flex h-[58px] max-w-[1240px] items-center justify-between gap-4 rounded-full pl-3.5 pr-1.5 transition-[background-color] duration-500 sm:h-[66px] sm:pl-5 sm:pr-2.5 ${
            scrolled ? "!bg-white/80" : ""
          }`}
        >
          <Link href="/" aria-label="Bolsa Atleta USA" className="relative block h-[42px] w-[88px] flex-none overflow-hidden sm:h-[50px] sm:w-[104px]">
            {/* O arquivo do logo tem margem interna; o recorte por CSS evita redesenhar a marca */}
            <img
              src={logoHorizontal.src}
              alt="Bolsa Atleta USA"
              width={757}
              height={506}
              className="absolute -left-2 -top-3 h-auto w-[104px] max-w-none sm:-left-[9px] sm:-top-3.5 sm:w-[124px]"
            />
          </Link>

          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => (
              <li key={item.hash}>
                <Link
                  href={`/#${item.hash}`}
                  className="block rounded-full px-[15px] py-[9px] text-[14.5px] font-medium text-[var(--ba-ink-2)] transition-colors hover:bg-[rgba(31,63,163,0.07)] hover:text-[var(--ba-navy)]"
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-full bg-white/55 shadow-[inset_0_0_0_1px_var(--ba-stroke)] lg:block">
              <LanguageSelector variant="light" />
            </div>
            <Link
              href="/forms"
              onClick={() => trackCtaClick("header")}
              className="ba-btn ba-btn-primary !min-h-0 !px-4 !py-2.5 !text-[13.5px] sm:!px-5 sm:!py-3 sm:!text-sm"
            >
              {t("header.contact")}
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="ba-mobile-menu"
              aria-label={menuOpen ? t("header.closeMenu") : t("header.openMenu")}
              className="grid h-[42px] w-[42px] place-items-center rounded-full bg-white/60 text-[var(--ba-navy)] shadow-[inset_0_0_0_1px_var(--ba-stroke)] lg:hidden"
            >
              {menuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <div
            id="ba-mobile-menu"
            className="ba-glass pointer-events-auto mx-auto mt-2 max-w-[1240px] rounded-[26px] !bg-white/90 p-3 lg:hidden"
          >
            <ul className="flex flex-col">
              {NAV_ITEMS.map((item) => (
                <li key={item.hash}>
                  <Link
                    href={`/#${item.hash}`}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-2xl px-4 py-3.5 font-[family-name:var(--ba-display)] text-[17px] font-semibold tracking-[-0.02em] text-[var(--ba-navy)] hover:bg-[rgba(31,63,163,0.06)]"
                  >
                    {t(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-[var(--ba-stroke)] px-2 pt-3">
              <LanguageSelector variant="light" size="lg" />
            </div>
          </div>
        )}
      </header>
    </>
  );
});

Header.displayName = "Header";

export default Header;
