"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

import { obterLeadDossie } from "@/lib/actions/leads-busca";
import { type DealStageConfigMap } from "@/lib/etapas-deal";
import { type Lead } from "@/types/lead";

// Só no navegador: o dossiê formata datas no fuso de quem vê e usa Date.now().
// Com o deep-link ?atleta= ele nasce aberto e seria renderizado no servidor
// (UTC) — texto diferente na hidratação. De quebra, os modais pesados saem do
// bundle inicial de /leads e /pipeline.
const LeadOrDealSheet = dynamic(
  () => import("@/components/leads/LeadOrDealSheet").then((m) => m.LeadOrDealSheet),
  { ssr: false, loading: () => <AbrindoDossie /> },
);

type EstadoDossie =
  | { status: "fechado" }
  | { status: "carregando" }
  | { status: "aberto"; lead: Lead };

/**
 * Dossiê sob demanda (T8/T13): a lista de /leads e a faixa "Fora do
 * pipeline" só têm o resumo; o Lead completo vem do servidor no clique.
 * Resposta atrasada de um clique anterior é descartada (só o último abre).
 * `leadInicial` (deep-link ?atleta=/?lead=) abre ao montar E quando o id muda.
 */
export function useDossieLead(leadInicial: Lead | null = null) {
  const [estado, setEstado] = useState<EstadoDossie>(
    leadInicial ? { status: "aberto", lead: leadInicial } : { status: "fechado" },
  );
  const requisicao = useRef(0);

  // O Next preserva o estado da página quando só a query muda: o sininho já
  // em /leads (router.push("/leads?lead=Y")) traz um leadInicial novo sem
  // remontar — e a notificação já saiu do sininho como lida. Abre pelo id.
  const leadInicialId = leadInicial?.id ?? null;
  const [leadInicialVisto, setLeadInicialVisto] = useState(leadInicialId);
  if (leadInicialId !== leadInicialVisto) {
    setLeadInicialVisto(leadInicialId);
    if (leadInicial) setEstado({ status: "aberto", lead: leadInicial });
  }
  // Clique anterior ainda em voo não pode cobrir o dossiê do deep-link.
  useEffect(() => {
    if (leadInicialId) requisicao.current++;
  }, [leadInicialId]);

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
  stageConfig,
  podeEditarValor,
}: {
  estado: EstadoDossie;
  onClose: () => void;
  /** Config MESCLADA das colunas (a do board) — o dossiê abre o editor do deal. */
  stageConfig: DealStageConfigMap;
  podeEditarValor?: boolean;
}) {
  if (estado.status === "fechado") return null;
  if (estado.status === "aberto") {
    return (
      <LeadOrDealSheet
        key={estado.lead.id}
        lead={estado.lead}
        onClose={onClose}
        stageConfig={stageConfig}
        podeEditarValor={podeEditarValor}
      />
    );
  }
  return <AbrindoDossie onClose={onClose} />;
}

/** Overlay "Abrindo dossiê…" (busca do lead e carga do módulo do modal). */
function AbrindoDossie({ onClose }: { onClose?: () => void }) {
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
