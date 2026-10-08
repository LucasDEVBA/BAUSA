"use client";

import { useEffect, useState } from "react";
import { type Lead } from "@/types/lead";
import { type Deal } from "@/types/deal";
import { LeadDetailModal } from "./LeadDetailModal";
import { DealDetailModal } from "@/components/pipeline/DealDetailModal";
import { fetchDeal } from "@/lib/deal-fetch";

interface LeadOrDealSheetProps {
  lead: Lead | null;
  onClose: () => void;
}

export function LeadOrDealSheet({ lead, onClose }: LeadOrDealSheetProps) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(false);
  // Rebusca o deal após editar o valor no modal (aqui não há router.refresh
  // que repinte: o deal é buscado no cliente).
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    if (!lead || !lead.is_in_pipeline || !lead.pipeline_deal_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeal(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchDeal(lead.pipeline_deal_id)
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
  }, [lead?.id, lead?.pipeline_deal_id, lead?.is_in_pipeline, versao]);

  if (!lead) return null;

  // Lead no pipeline e deal carregado: mostra modal central super-completo
  if (lead.is_in_pipeline && deal) {
    return (
      <DealDetailModal
        key={deal.id}
        deal={deal}
        onClose={onClose}
        onDealAtualizado={() => setVersao((v) => v + 1)}
      />
    );
  }

  // Carregando deal
  if (lead.is_in_pipeline && loading) {
    return (
      <>
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="rounded-2xl border border-border liquid-glass px-6 py-5 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-sm text-muted-foreground">
                Carregando deal...
              </span>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Lead fora do pipeline → modal central de lead
  return <LeadDetailModal lead={lead} onClose={onClose} />;
}
