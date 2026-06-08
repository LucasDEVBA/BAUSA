"use client";

import { useState, useEffect } from "react";

import { type Deal } from "@/types/deal";
import { DealDetailSheet } from "@/components/pipeline/DealDetailSheet";
import { fetchDeal } from "@/lib/deal-fetch";

// ════════════════════════════════════════════════════════════════════════
// Abre o DealDetailSheet completo a partir de um dealId — usado na lista de
// leads da tela /remarketing. Reusa o mesmo sheet do Pipeline/Leads (DRY),
// buscando o deal sob demanda (client-side) ao clicar no lead.
// ════════════════════════════════════════════════════════════════════════

interface RemarketingLeadSheetProps {
  dealId: string | null;
  onClose: () => void;
}

export function RemarketingLeadSheet({ dealId, onClose }: RemarketingLeadSheetProps) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!dealId) {
      setDeal(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchDeal(dealId)
      .then((d) => {
        if (!cancelled) {
          setDeal(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeal(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [dealId]);

  if (!dealId) return null;

  if (deal) {
    return <DealDetailSheet key={deal.id} deal={deal} onClose={onClose} />;
  }

  if (loading) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg items-center justify-center border-l border-[#1e2130] bg-[#0f1117]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <span className="text-sm text-zinc-500">Carregando lead…</span>
          </div>
        </div>
      </>
    );
  }

  // dealId informado mas deal não encontrado (ex.: removido) — fecha silenciosamente.
  return null;
}
