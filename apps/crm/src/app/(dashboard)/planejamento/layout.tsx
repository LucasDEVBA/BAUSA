import type { ReactNode } from "react";

import { PlanejamentoNav } from "@/components/planejamento/PlanejamentoNav";

// Seção Planejamento: a barra de abas é renderizada uma vez para todas as
// sub-rotas. A proteção por papel fica em cada page (requirePapel).
export default function PlanejamentoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur-xl">
        <PlanejamentoNav />
      </div>
      <div className="pt-4">{children}</div>
    </div>
  );
}
