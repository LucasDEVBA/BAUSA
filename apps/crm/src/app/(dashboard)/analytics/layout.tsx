import type { ReactNode } from "react";

import { AnalyticsNav } from "@/components/analytics/AnalyticsNav";

// Layout da seção Analytics (F3): renderiza a barra de abas uma única vez para
// todas as sub-rotas (/analytics, /atribuicao, /cac, /utm-builder). A proteção
// por papel continua em cada page (requirePapel("ceo")).
export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <AnalyticsNav />
      {children}
    </div>
  );
}
