"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Save,
  Loader2,
} from "lucide-react";
import { atualizarResultadoEscola } from "@/lib/actions/escolas";
import {
  type MatchClassification,
  MATCH_CLASSIFICATION_CONFIG,
} from "@/types/matching";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface StrategyData {
  id: string;
  school_name: string;
  school_type: string;
  school_state: string;
  score: number;
  classification: MatchClassification;
  estimated_scholarship_pct: number;
  compatibility_notes: string[];
  blockers: string[];
  bolsa_obtida_pct: number | null;
  bolsa_obtida_valor: number | null;
  data_aplicacao: string | null;
  data_resposta: string | null;
  resultado: string;
}

interface EditableStrategyRowProps {
  strategy: StrategyData;
}

const RESULTADO_OPTIONS = [
  { value: "nao_aplicado", label: "Nao aplicado" },
  { value: "aplicado", label: "Aplicado" },
  { value: "aceito", label: "Aceito" },
  { value: "rejeitado", label: "Rejeitado" },
  { value: "lista_espera", label: "Lista de espera" },
  { value: "desistiu", label: "Desistiu" },
];

function ScoreMeter({ score, classification }: { score: number; classification: MatchClassification }) {
  const cfg = MATCH_CLASSIFICATION_CONFIG[classification];
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e2130" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${score} ${100 - score}`}
            className={cfg.color}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-xs font-bold", cfg.color)}>{score}</span>
        </div>
      </div>
      <div>
        <p className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</p>
      </div>
    </div>
  );
}

export function EditableStrategyRow({ strategy }: EditableStrategyRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [bolsaPct, setBolsaPct] = useState(strategy.bolsa_obtida_pct?.toString() ?? "");
  const [bolsaValor, setBolsaValor] = useState(strategy.bolsa_obtida_valor?.toString() ?? "");
  const [dataAplicacao, setDataAplicacao] = useState(strategy.data_aplicacao ?? "");
  const [dataResposta, setDataResposta] = useState(strategy.data_resposta ?? "");
  const [resultado, setResultado] = useState(strategy.resultado);

  const cfg = MATCH_CLASSIFICATION_CONFIG[strategy.classification];

  const handleSave = () => {
    startTransition(async () => {
      const result = await atualizarResultadoEscola(strategy.id, {
        resultado,
        bolsa_obtida_pct: bolsaPct ? Number(bolsaPct) : undefined,
        bolsa_obtida_valor: bolsaValor ? Number(bolsaValor) : undefined,
        data_resposta: dataResposta || undefined,
      });
      if (result.success) {
        toast.success("Estrategia atualizada!");
      } else {
        toast.error(result.error ?? "Erro ao salvar");
      }
    });
  };

  const inputClass =
    "w-full rounded-lg border border-[#1e2130] bg-[#141720] py-2 px-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500";

  return (
    <div className={cn("rounded-lg border p-3 transition-colors", cfg.border, cfg.bg)}>
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ScoreMeter score={strategy.score} classification={strategy.classification} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white">{strategy.school_name}</p>
            <span className="text-[10px] font-medium text-zinc-500">
              {strategy.school_type} {strategy.school_state ? `· ${strategy.school_state}` : ""}
            </span>
            {resultado !== "nao_aplicado" && (
              <span className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                resultado === "aceito" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                  : resultado === "rejeitado" ? "border-red-500/30 bg-red-500/10 text-red-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-400"
              )}>
                {RESULTADO_OPTIONS.find((o) => o.value === resultado)?.label ?? resultado}
              </span>
            )}
          </div>
          {strategy.estimated_scholarship_pct > 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              Bolsa estimada: <span className="font-semibold text-emerald-400">{strategy.estimated_scholarship_pct}%</span>
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {strategy.compatibility_notes.map((n, i) => (
              <span key={i} className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                <CheckCircle className="h-2.5 w-2.5" /> {n}
              </span>
            ))}
            {strategy.blockers.map((b, i) => (
              <span key={i} className="flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-400">
                <AlertCircle className="h-2.5 w-2.5" /> {b}
              </span>
            ))}
          </div>
        </div>
        <button className="flex-shrink-0 p-1 text-zinc-500 hover:text-zinc-300">
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Editable fields */}
      {isExpanded && (
        <div className="mt-4 space-y-3 border-t border-[#1e2130] pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Resultado</label>
              <select
                value={resultado}
                onChange={(e) => setResultado(e.target.value)}
                className={cn(inputClass, "appearance-none")}
              >
                {RESULTADO_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Bolsa obtida (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={bolsaPct}
                onChange={(e) => setBolsaPct(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Bolsa obtida (USD)</label>
              <input
                type="number"
                min="0"
                value={bolsaValor}
                onChange={(e) => setBolsaValor(e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Data aplicacao</label>
              <input
                type="date"
                value={dataAplicacao}
                onChange={(e) => setDataAplicacao(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Data resposta</label>
              <input
                type="date"
                value={dataResposta}
                onChange={(e) => setDataResposta(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            disabled={isPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Resultado
          </button>
        </div>
      )}
    </div>
  );
}
