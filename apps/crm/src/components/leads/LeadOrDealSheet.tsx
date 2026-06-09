"use client";

import { useState, useEffect } from "react";
import { type Lead } from "@/types/lead";
import { type Deal } from "@/types/deal";
import { LeadDetailSheet } from "./LeadDetailSheet";
import { DealDetailSheet } from "@/components/pipeline/DealDetailSheet";
import { fetchDeal } from "@/lib/deal-fetch";

interface LeadOrDealSheetProps {
  lead: Lead | null;
  onClose: () => void;
}

export function LeadOrDealSheet({ lead, onClose }: LeadOrDealSheetProps) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lead || !lead.is_in_pipeline || !lead.pipeline_deal_id) {
      setDeal(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchDeal(lead.pipeline_deal_id).then((d) => {
      if (!cancelled) {
        setDeal(d);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setDeal(null);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [lead?.id, lead?.pipeline_deal_id, lead?.is_in_pipeline]);

  if (!lead) return null;

  // Lead no pipeline e deal carregado: mostrar DealDetailSheet completo
  if (lead.is_in_pipeline && deal) {
    return <DealDetailSheet key={deal.id} deal={deal} onClose={onClose} />;
  }

  // Lead no pipeline mas ainda carregando
  if (lead.is_in_pipeline && loading) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg items-center justify-center border-l border-border bg-popover">
          <div className="flex flex-col items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Carregando deal...</span>
          </div>
        </div>
      </>
    );
  }

  // Nao esta no pipeline: mostrar LeadDetailSheet simples
  return <LeadDetailSheet lead={lead} onClose={onClose} />;
}
