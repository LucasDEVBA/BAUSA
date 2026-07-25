import logoWhite from "@/assets/logo-white.png";
import { Link } from "@/i18n/navigation";

import type { NavItem } from "./BauHeader";

/**
 * Rodapé institucional — navegação completa e o bloco de assinatura do BAU-01.
 *
 * Os links sociais aqui são os reais. O rodapé anterior tinha três âncoras
 * `href="#"` (Instagram, LinkedIn, YouTube) em produção.
 *
 * Server Component.
 */
export function BauFooter({
  items,
  navLabel,
  contactLabel,
  brand,
}: {
  items: NavItem[];
  navLabel: string;
  contactLabel: string;
  brand: {
    name: string;
    concept: string;
    tagline: string;
    email: string;
    instagram: string;
    instagramUrl: string;
    copyright: string;
  };
}) {
  return (
    <footer className="border-t border-[var(--bau-hairline)] bg-bau-navy-deep">
      <div className="bau-container py-[4rem] lg:py-[6.5rem]">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          {/* Bloco de assinatura */}
          <div className="lg:col-span-5">
            <img src={logoWhite.src} alt={brand.name} className="h-10 w-auto" />
            <p className="bau-mono mt-8 text-[11px] text-bau-stone">{brand.concept}</p>
            <p className="bau-signature mt-4 text-[1.25rem] text-bau-ivory/80">{brand.tagline}</p>
          </div>

          <nav aria-label={navLabel} className="mt-14 lg:col-span-3 lg:col-start-7 lg:mt-0">
            <h2 className="bau-mono text-[11px] text-bau-stone">{navLabel}</h2>
            <ul className="mt-6 space-y-3">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[15px] text-bau-stone transition-colors duration-200 hover:text-bau-ivory"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-14 lg:col-span-3 lg:col-start-10 lg:mt-0">
            <h2 className="bau-mono text-[11px] text-bau-stone">{contactLabel}</h2>
            <ul className="mt-6 space-y-3">
              <li>
                <a
                  href={`mailto:${brand.email}`}
                  className="text-[15px] text-bau-stone transition-colors duration-200 hover:text-bau-ivory"
                >
                  {brand.email}
                </a>
              </li>
              <li>
                <a
                  href={brand.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[15px] text-bau-stone transition-colors duration-200 hover:text-bau-ivory"
                >
                  {brand.instagram}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-16 border-t border-[var(--bau-hairline)] pt-8 text-[13px] text-bau-stone/70">
          {brand.copyright}
        </p>
      </div>
    </footer>
  );
}
