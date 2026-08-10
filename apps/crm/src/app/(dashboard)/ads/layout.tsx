import type { ReactNode } from "react";

import { AdsNav } from "@/components/ads/AdsNav";

// Layout da seção Ads (A1): barra de abas única para as sub-rotas
// (/ads, /ads/desempenho) — espelho do padrão /analytics. A proteção por
// papel continua em cada page (requirePapel("ceo")).
export default function AdsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur-xl">
        <AdsNav />
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}
