"use client";

import { useState, useEffect } from "react";

import { type Deal } from "@/types/deal";
import { type DealStageConfigMap } from "@/lib/etapas-deal";
import { DealDetailSheet } from "@/components/pipeline/DealDetailSheet";
import { fetchDeal } from "@/lib/deal-fetch";

// ════════════════════════════════════════════════════════════════════════
// Abre o DealDetailSheet completo a partir de um dealId — usado na lista de
// leads da tela /remarketing. Reusa o mesmo sheet do Pipeline/Leads (DRY),
// buscando o deal sob demanda (client-side) ao clicar no lead. Depois de
// editar o valor, `versao` dispara nova busca (o router.refresh não repinta
// um deal buscado no cliente).
//
// O componente é remontado por dealId (key no pai), então o estado começa
// limpo a cada abertura — não precisamos resetar estado de forma síncrona
// dentro do efeito (evita setState síncrono em effect).
// ════════════════════════════════════════════════════════════════════════

interface RemarketingLeadSheetProps {
  dealId: string | null;
  onClose: () => void;
  /** Config MESCLADA das colunas — a MESMA do board. Obrigatória: sem ela o
   *  editor oferecia slot oculto/sem nome e tirava o deal das métricas de ganho. */
  stageConfig: DealStageConfigMap;
}

export function RemarketingLeadSheet({ dealId, onClose, stageConfig }: RemarketingLeadSheetProps) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [erro, setErro] = useState(false);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    fetchDeal(dealId)
      .then((d) => {
        if (cancelled) return;
        if (d) setDeal(d);
        else setErro(true);
      })
      .catch(() => {
        if (!cancelled) setErro(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId, versao]);

  if (!dealId) return null;

  if (deal) {
    return (
      <DealDetailSheet
        key={deal.id}
        deal={deal}
        onClose={onClose}
        stageConfig={stageConfig}
        onDealAtualizado={() => setVersao((v) => v + 1)}
      />
    );
  }

  // dealId informado mas deal não encontrado (ex.: removido) — fecha silenciosamente.
  if (erro) return null;

  // Carregando (sem deal e sem erro ainda).
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg items-center justify-center liquid-glass">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Carregando lead…</span>
        </div>
      </div>
    </>
  );
}
