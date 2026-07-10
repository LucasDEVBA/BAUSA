import type { ReactNode } from "react";

import { AnalyticsNav } from "@/components/analytics/AnalyticsNav";

// Layout da seção Analytics (F3): renderiza a barra de abas uma única vez para
// todas as sub-rotas (/analytics, /atribuicao, /cac, /utm-builder). A proteção
// por papel continua em cada page (requirePapel("ceo")).
export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      {/* Nav sticky — a barra de abas fica sempre visível ao rolar o conteúdo. */}
      <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur-xl">
        <AnalyticsNav />
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}
