"use client";

import { useState, useTransition } from "react";
import {
  Users,
  Search,
  Phone,
  Briefcase,
  AlertTriangle,
  Target,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ETAPA_LABELS } from "@/types/crm";
import { getFamilyModalData } from "@/lib/actions/experiencia";
import {
  FamilyDetailModal,
  type FamilyModalData,
} from "@/components/familias-shared/FamilyDetailModal";
import { toast } from "sonner";
import type { FamiliaConsolidada } from "./page";

interface FamiliasConsolidadasClientProps {
  familias: FamiliaConsolidada[];
}

const CLASSIFICATION_BADGE: Record<string, string> = {
  QUENTE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  MORNO: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  FRIO: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const FASE_BADGE: Record<string, string> = {
  admissao: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20",
  aprovado: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  pre_embarque: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  embarcado_inicial: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  acompanhamento: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  encerrado: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
};

const FASE_LABELS: Record<string, string> = {
  admissao: "Admissão",
  aprovado: "Aprovado",
  pre_embarque: "Pré-embarque",
  embarcado_inicial: "Embarcado",
  acompanhamento: "Acompanhamento",
  encerrado: "Encerrado",
};

const STATUS_BADGE: Record<string, { label: string; bg: string }> = {
  satisfeita: {
    label: "Satisfeita",
    bg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  },
  atencao: {
    label: "Atenção",
    bg: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  },
  crise: {
    label: "Crise",
    bg: "bg-red-500/10 text-red-300 border-red-500/20",
  },
};

function formatBRL(v: number) {
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

export function FamiliasConsolidadasClient({
  familias,
}: FamiliasConsolidadasClientProps) {
  const [search, setSearch] = useState("");
  const [modalData, setModalData] = useState<FamilyModalData | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtered = familias.filter(
    (f) =>
      f.responsavel_nome.toLowerCase().includes(search.toLowerCase()) ||
      f.atletas.some((a) =>
        a.nome_completo.toLowerCase().includes(search.toLowerCase()),
      ),
  );

  const totalFamilias = familias.length;
  const totalAtletas = familias.reduce((s, f) => s + f.atletas.length, 0);
  const totalValor = familias.reduce((s, f) => s + f.valor_total, 0);
  const familiasComAlerta = familias.filter((f) =>
    f.atletas.some(
      (a) => a.status === "atencao" || a.status === "crise",
    ),
  );

  const handleAtletaClick = (experienciaId: string | null) => {
    if (!experienciaId) {
      toast.error("Atleta ainda não tem registro de experiência");
      return;
    }
    setLoadingId(experienciaId);
    startTransition(async () => {
      const data = await getFamilyModalData(experienciaId);
      setLoadingId(null);
      if (!data) {
        toast.error("Não foi possível carregar os dados da família");
        return;
      }
      setModalData(data);
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Users className="h-5 w-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-zinc-100">
              Visão Consolidada por Família
            </h1>
          </div>
          <p className="text-sm text-zinc-500">
            Famílias agrupadas por responsável (apenas em Admissão+). Clique
            num atleta para editar.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Famílias
          </p>
          <p className="mt-1 text-2xl font-bold text-indigo-400">
            {totalFamilias}
          </p>
        </div>
        <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Atletas
          </p>
          <p className="mt-1 text-2xl font-bold text-white">{totalAtletas}</p>
        </div>
        <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Valor total
          </p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">
            {formatBRL(totalValor)}
          </p>
        </div>
        <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Em atenção/crise
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-400">
            {familiasComAlerta.length}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 max-w-sm">
        <Search className="h-3.5 w-3.5 text-zinc-500" />
        <input
          type="text"
          placeholder="Buscar por responsavel ou atleta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none w-full"
        />
      </div>

      {/* Family Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-600">
          <Users className="mb-3 h-10 w-10" />
          <p className="text-sm">Nenhuma família encontrada</p>
          <p className="mt-1 text-xs text-zinc-700">
            Famílias aparecem aqui quando o deal chega em{" "}
            <code>admission_process</code>.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((familia) => {
            const hasAlertStatus = familia.atletas.some(
              (a) => a.status === "atencao" || a.status === "crise",
            );
            const fases = familia.atletas
              .map((a) => a.fase)
              .filter(Boolean);
            const hasMixedFases =
              familia.atletas.length > 1 && new Set(fases).size > 1;

            return (
              <div
                key={familia.responsavel_id}
                className={cn(
                  "rounded-xl border bg-[#141720] p-5 transition-colors",
                  hasAlertStatus
                    ? "border-amber-500/30"
                    : "border-[#1e2130]",
                )}
              >
                {/* Guardian Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white">
                    {familia.responsavel_nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate">
                      {familia.responsavel_nome}
                    </p>
                    {familia.profissao && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Briefcase className="h-3 w-3 text-zinc-600" />
                        <p className="text-[10px] text-zinc-500 truncate">
                          {familia.profissao}
                        </p>
                      </div>
                    )}
                    {familia.whatsapp && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3 text-zinc-600" />
                        <p className="text-[10px] text-zinc-500">
                          {familia.whatsapp}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-emerald-400">
                      {formatBRL(familia.valor_total)}
                    </p>
                    <p className="text-[10px] text-zinc-600">valor total</p>
                  </div>
                </div>

                {/* Alerts */}
                {(hasAlertStatus || hasMixedFases) && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {hasAlertStatus && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Atenção/Crise
                      </span>
                    )}
                    {hasMixedFases && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                        <Target className="h-2.5 w-2.5" />
                        Fases diferentes
                      </span>
                    )}
                  </div>
                )}

                {/* Athletes */}
                <div className="space-y-2">
                  {familia.atletas.map((atleta) => {
                    const isLoading = loadingId === atleta.experiencia_id;
                    const statusCfg = atleta.status
                      ? STATUS_BADGE[atleta.status]
                      : null;
                    return (
                      <button
                        type="button"
                        key={atleta.id}
                        onClick={() =>
                          handleAtletaClick(atleta.experiencia_id)
                        }
                        disabled={isLoading || !atleta.experiencia_id}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-lg border border-[#1e2130] bg-[#0c0e16] px-3 py-2.5 text-left transition-colors",
                          atleta.experiencia_id
                            ? "hover:border-indigo-500/40 cursor-pointer"
                            : "opacity-60 cursor-not-allowed",
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-200 truncate">
                            {atleta.nome_completo}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {atleta.classificacao && (
                              <span
                                className={cn(
                                  "inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold",
                                  CLASSIFICATION_BADGE[atleta.classificacao] ??
                                    "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                                )}
                              >
                                {atleta.classificacao}
                              </span>
                            )}
                            {atleta.fase && (
                              <span
                                className={cn(
                                  "inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold",
                                  FASE_BADGE[atleta.fase] ??
                                    "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
                                )}
                              >
                                {FASE_LABELS[atleta.fase] ?? atleta.fase}
                              </span>
                            )}
                            {statusCfg && (
                              <span
                                className={cn(
                                  "inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold",
                                  statusCfg.bg,
                                )}
                              >
                                {statusCfg.label}
                              </span>
                            )}
                            {atleta.etapa && (
                              <span className="text-[10px] text-zinc-500 truncate">
                                Deal:{" "}
                                {(ETAPA_LABELS as Record<string, string>)[
                                  atleta.etapa
                                ] ?? atleta.etapa}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {atleta.lead_score != null && (
                            <div className="text-center">
                              <p className="text-xs font-bold text-indigo-400">
                                {atleta.lead_score}
                              </p>
                              <p className="text-[9px] text-zinc-600">score</p>
                            </div>
                          )}
                          {atleta.deal_valor != null && (
                            <div className="text-center">
                              <p className="text-xs font-bold text-emerald-400">
                                {formatBRL(atleta.deal_valor)}
                              </p>
                              <p className="text-[9px] text-zinc-600">valor</p>
                            </div>
                          )}
                          {isLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                          ) : (
                            <span className="text-[10px] text-indigo-400 font-semibold">
                              Editar
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalData && (
        <FamilyDetailModal
          family={modalData}
          onClose={() => setModalData(null)}
        />
      )}
    </div>
  );
}
