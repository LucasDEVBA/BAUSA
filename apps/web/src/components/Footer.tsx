"use client";

import { memo } from "react";
import { Instagram, Linkedin, Youtube, Mail } from "lucide-react";
import { Link } from "@/i18n/navigation";
import logoBau from "@/assets/logo-bau.png";
import { Button } from "./ui/button";
import { useLanguage } from "@/i18n";

const Footer = memo(() => {
  const { t } = useLanguage();

  return (
    <footer className="py-8 sm:py-12 border-t border-border/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-5 sm:gap-6 md:flex-row md:justify-between">
          {/* Logo */}
          <div className="text-center md:text-left">
            <img
              src={logoBau.src}
              alt="Bolsa Atleta USA"
              className="h-14 sm:h-16 w-auto"
            />
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href="#"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center hover:bg-burgundy/20 transition-colors"
            >
              <Instagram className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground hover:text-burgundy" />
            </a>
            <a
              href="#"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center hover:bg-burgundy/20 transition-colors"
            >
              <Linkedin className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground hover:text-burgundy" />
            </a>
            <a
              href="#"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center hover:bg-burgundy/20 transition-colors"
            >
              <Youtube className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground hover:text-burgundy" />
            </a>
            <a
              href="mailto:contato@bolsaatletausa.com"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-muted flex items-center justify-center hover:bg-burgundy/20 transition-colors"
            >
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground hover:text-burgundy" />
            </a>
          </div>


          {/* Copyright + legal */}
          <div className="text-center md:text-right">
            <p className="text-[10px] sm:text-sm text-muted-foreground">
              {t("landing.footer.copyright")}
            </p>
            {/* A Meta exige política de privacidade alcançável a partir do site
                para aprovar o app do Instagram — e, independente disso, é o
                lugar onde qualquer pessoa espera encontrar. */}
            <p className="mt-2 text-[10px] sm:text-xs text-muted-foreground">
              <Link href="/privacidade" className="hover:text-burgundy transition-colors">
                {t("landing.footer.privacidade")}
              </Link>
              <span className="mx-2 opacity-40">·</span>
              <Link href="/exclusao-de-dados" className="hover:text-burgundy transition-colors">
                {t("landing.footer.exclusaoDados")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";

export default Footer;
