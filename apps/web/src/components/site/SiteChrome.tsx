"use client";

import type { ReactNode } from "react";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileDock from "@/components/site/MobileDock";
import { useBrandMotion } from "@/components/brand/useBrandMotion";
import { VideoPlayerProvider } from "@/components/brand/VideoPlayer";
import { usePathname } from "@/i18n/navigation";

// Páginas que não terminam com o CTA final escuro: o rodapé precisa de cantos próprios
const STANDALONE_FOOTER_PATHS = new Set(["/privacidade", "/exclusao-de-dados"]);

interface SiteChromeProps {
  children: ReactNode;
}

/**
 * Moldura persistente das páginas de conteúdo: Header, dock mobile e rodapé
 * sobrevivem à navegação entre páginas (a dock não remonta) e o motor de
 * revelação ao rolar roda uma vez para todas as seções.
 */
export default function SiteChrome({ children }: SiteChromeProps) {
  useBrandMotion();
  const pathname = usePathname();

  return (
    <VideoPlayerProvider>
      <div className="ba-page flex min-h-screen flex-col">
        <Header />
        <main id="conteudo" className="flex flex-1 flex-col">
          {children}
        </main>
        <Footer variant={STANDALONE_FOOTER_PATHS.has(pathname) ? "standalone" : "attached"} />
        <MobileDock />
      </div>
    </VideoPlayerProvider>
  );
}
