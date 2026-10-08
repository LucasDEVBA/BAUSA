"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { LeadOrDealSheet } from "@/components/leads/LeadOrDealSheet";
import { obterLeadDossie } from "@/lib/actions/leads-busca";
import { type Lead } from "@/types/lead";

type EstadoDossie =
  | { status: "fechado" }
  | { status: "carregando" }
  | { status: "aberto"; lead: Lead };

/**
 * Dossiê sob demanda (T8/T13): a lista de /leads e a faixa "Fora do
 * pipeline" só têm o resumo; o Lead completo vem do servidor no clique.
 * Resposta atrasada de um clique anterior é descartada (só o último abre).
 */
export function useDossieLead(leadInicial: Lead | null = null) {
  const [estado, setEstado] = useState<EstadoDossie>(
    leadInicial ? { status: "aberto", lead: leadInicial } : { status: "fechado" },
  );
  const requisicao = useRef(0);

  const abrir = useCallback(async (formSubmissionId: string) => {
    const minha = ++requisicao.current;
    setEstado({ status: "carregando" });
    try {
      const r = await obterLeadDossie(formSubmissionId);
      if (minha !== requisicao.current) return;
      if (r.success) {
        setEstado({ status: "aberto", lead: r.lead });
      } else {
        setEstado({ status: "fechado" });
        toast.error(r.error);
      }
    } catch {
      if (minha !== requisicao.current) return;
      setEstado({ status: "fechado" });
      toast.error("Falha de rede ao abrir o dossiê. Tente de novo.");
    }
  }, []);

  const fechar = useCallback(() => {
    requisicao.current++;
    setEstado({ status: "fechado" });
  }, []);

  return { estado, abrir, fechar };
}

/** Renderiza o carregamento e o dossiê (mesmo LeadOrDealSheet de /leads). */
export function DossieLeadView({
  estado,
  onClose,
}: {
  estado: EstadoDossie;
  onClose: () => void;
}) {
  if (estado.status === "fechado") return null;
  if (estado.status === "aberto") {
    return <LeadOrDealSheet key={estado.lead.id} lead={estado.lead} onClose={onClose} />;
  }
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="status" aria-live="polite">
        <div className="rounded-2xl border border-border liquid-glass px-6 py-5 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Abrindo dossiê…</span>
          </div>
        </div>
      </div>
    </>
  );
}
