"use client";

import { memo } from "react";
import { Link } from "@/i18n/navigation";
import logoHorizontal from "@/assets/logo-horizontal.png";
import LanguageSelector from "./LanguageSelector";
import { useLanguage } from "@/i18n";
import { trackCtaClick } from "@/lib/tracking/events";

const Header = memo(() => {
  const { t } = useLanguage();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <img 
            src={logoHorizontal.src} 
            alt="Bolsa Atleta USA" 
            className="h-10 sm:h-12 w-auto"
          />
        </Link>
        
        <nav className="flex items-center gap-3 sm:gap-6">
          <LanguageSelector variant="light" size="lg" />
          <Link
            href="/forms"
            onClick={() => trackCtaClick("header")}
            className="hidden sm:inline-flex px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t("header.contact")}
          </Link>
        </nav>
      </div>
    </header>
  );
});

Header.displayName = "Header";

export default Header;
