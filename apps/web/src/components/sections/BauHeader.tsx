"use client";

import { useState } from "react";

import logoWhite from "@/assets/logo-white.png";
import LanguageSelector from "@/components/LanguageSelector";
import { CtaPrimary } from "@/components/bau";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
}

/**
 * Header do site institucional.
 *
 * A ordem dos itens é a lógica narrativa do BAU-01 — o que é → como funciona →
 * o que acontece na prática → como meu filho vai viver → quem já viveu → quem
 * conduz. Não reordenar por conveniência de layout.
 *
 * O drawer mobile usa `ui/sheet` (Radix): focus-trap, scroll-lock, ESC e ARIA
 * já resolvidos. Um drawer artesanal é o tipo de coisa que passa no olho e
 * falha em leitor de tela.
 */
export function BauHeader({
  items,
  ctaLabel,
  menuLabel,
  openMenuLabel,
}: {
  items: NavItem[];
  ctaLabel: string;
  menuLabel: string;
  openMenuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-50 h-[var(--bau-header-h)] border-b border-[var(--bau-hairline)] bg-bau-navy-deep/85 backdrop-blur-md">
      <div className="bau-container flex h-full items-center justify-between gap-6">
        <Link href="/" className="shrink-0">
          <img src={logoWhite.src} alt="Bolsa Atleta USA" className="h-8 w-auto lg:h-9" />
        </Link>

        <nav aria-label={menuLabel} className="hidden xl:block">
          <ul className="flex items-center gap-7">
            {items.map((item) => (
              <li key={item.href}>
                <NavAnchor item={item} active={pathname === item.href} />
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-4">
          <LanguageSelector variant="dark" />

          <div className="hidden sm:block">
            {/* Compacto e em uma linha: no header o CTA acompanha a navegação,
                não compete com ela. O CTA "cheio" é o do fecho de cada página. */}
            <CtaPrimary
              source="header"
              label={ctaLabel}
              variant="outline"
              className="min-h-[44px] whitespace-nowrap px-5 py-3 text-[11px]"
            />
          </div>

          {/* Drawer só onde a navegação horizontal não cabe. */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label={openMenuLabel}
              className="flex h-11 w-11 items-center justify-center xl:hidden"
            >
              <span aria-hidden="true" className="space-y-[5px]">
                <span className="block h-px w-6 bg-bau-ivory" />
                <span className="block h-px w-6 bg-bau-ivory" />
                <span className="block h-px w-4 bg-bau-ivory" />
              </span>
            </SheetTrigger>

            <SheetContent
              side="right"
              data-bau
              className="w-full border-l border-[var(--bau-hairline)] bg-bau-navy-deep sm:max-w-sm"
            >
              <SheetTitle className="bau-mono text-[11px] text-bau-stone">{menuLabel}</SheetTitle>

              <nav aria-label={menuLabel} className="mt-10">
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "bau-display block border-b border-[var(--bau-hairline)] py-4 text-[1.5rem]",
                          pathname === item.href ? "text-bau-ivory" : "text-bau-stone",
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              {/* No drawer o CTA é sólido: o header some atrás do overlay,
                  então não há dois vermelhos concorrendo. */}
              <div className="mt-10">
                <CtaPrimary source="header" label={ctaLabel} className="w-full" />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

function NavAnchor({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // nowrap: os rótulos são de duas palavras ("O Conceito", "Vida na
        // Boarding") e quebrariam em duas linhas, estourando a altura fixa.
        "group relative block whitespace-nowrap py-2 text-[14px] transition-colors duration-200",
        active ? "text-bau-ivory" : "text-bau-stone hover:text-bau-ivory",
      )}
    >
      {item.label}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 -bottom-px h-px origin-left bg-bau-blue transition-transform duration-200",
          active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100",
        )}
      />
    </Link>
  );
}
