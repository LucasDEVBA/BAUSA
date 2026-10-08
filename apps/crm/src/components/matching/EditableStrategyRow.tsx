"use client";

import { useId, useState, useTransition } from "react";
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
  RESULTADO_ESTRATEGIA_LABEL,
  RESULTADO_ESTRATEGIA_OPTIONS,
  isValorDe,
  RESULTADO_ESTRATEGIA_VALUES,
  type ResultadoEstrategia,
} from "@/components/escolas/school-options";
import {
  type MatchClassification,
  MATCH_CLASSIFICATION_CONFIG,
} from "@/types/matching";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";
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

// Valores = CHECK estrategia_escolas.resultado (as opções antigas
// "aplicado/rejeitado/lista_espera/desistiu" violavam o CHECK → 23514).

/** "" → null (limpa o campo); número inválido → null. */
function numeroOuNull(texto: string): number | null {
  if (texto.trim() === "") return null;
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function ScoreMeter({ score, classification }: { score: number; classification: MatchClassification }) {
  const cfg = MATCH_CLASSIFICATION_CONFIG[classification];
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12 flex-shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
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
  const [resultado, setResultado] = useState<ResultadoEstrategia>(
    isValorDe(RESULTADO_ESTRATEGIA_VALUES, strategy.resultado) ? strategy.resultado : "nao_aplicado",
  );
  const idBase = useId();

  const cfg = MATCH_CLASSIFICATION_CONFIG[strategy.classification];

  const handleSave = () => {
    startTransition(async () => {
      try {
        const result = await atualizarResultadoEscola(strategy.id, {
          resultado,
          bolsa_obtida_pct: numeroOuNull(bolsaPct),
          bolsa_obtida_valor: numeroOuNull(bolsaValor),
          data_aplicacao: dataAplicacao || null,
          data_resposta: dataResposta || null,
        });
        if (result.success) {
          toast.success("Resultado salvo.");
        } else {
          toast.error(result.error);
        }
      } catch (e) {
        console.error({ level: "error", action: "atualizar_resultado_escola_ui", estrategiaId: strategy.id, erro: String(e) });
        toast.error("Falha de conexão ao salvar. Tente de novo.");
      }
    });
  };

  const inputClass =
    "w-full rounded-lg border border-border bg-card py-2 px-3 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary";

  return (
    <div className={cn("rounded-lg border p-3 transition-colors", cfg.border, cfg.bg)}>
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <ScoreMeter score={strategy.score} classification={strategy.classification} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{strategy.school_name}</p>
            <span className="text-[10px] font-medium text-muted-foreground">
              {strategy.school_type} {strategy.school_state ? `· ${strategy.school_state}` : ""}
            </span>
            {resultado !== "nao_aplicado" && (
              <span className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                resultado === "aceito" ? "border-sys-green/30 bg-sys-green/10 text-sys-green"
                  : resultado === "recusado" ? "border-sys-red/30 bg-sys-red/10 text-sys-red"
                  : "border-sys-orange/30 bg-sys-orange/10 text-sys-orange"
              )}>
                {RESULTADO_ESTRATEGIA_LABEL[resultado]}
              </span>
            )}
          </div>
          {strategy.estimated_scholarship_pct > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Bolsa estimada: <span className="font-semibold text-sys-green">{strategy.estimated_scholarship_pct}%</span>
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {strategy.compatibility_notes.map((n, i) => (
              <span key={i} className="flex items-center gap-1 rounded-md bg-sys-green/10 px-1.5 py-0.5 text-[10px] text-sys-green">
                <CheckCircle className="h-2.5 w-2.5" /> {n}
              </span>
            ))}
            {strategy.blockers.map((b, i) => (
              <span key={i} className="flex items-center gap-1 rounded-md bg-sys-red/10 px-1.5 py-0.5 text-[10px] text-sys-red">
                <AlertCircle className="h-2.5 w-2.5" /> {b}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? `Recolher ${strategy.school_name}` : `Registrar resultado em ${strategy.school_name}`}
          className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Editable fields */}
      {isExpanded && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor={`${idBase}-resultado`} className="text-xs font-medium text-muted-foreground">Resultado</label>
              <select
                id={`${idBase}-resultado`}
                value={resultado}
                onChange={(e) => {
                  const valor = e.target.value;
                  if (isValorDe(RESULTADO_ESTRATEGIA_VALUES, valor)) setResultado(valor);
                }}
                className={cn(inputClass, "appearance-none")}
              >
                {RESULTADO_ESTRATEGIA_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor={`${idBase}-pct`} className="text-xs font-medium text-muted-foreground">Bolsa obtida (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                id={`${idBase}-pct`}
                value={bolsaPct}
                onChange={(e) => setBolsaPct(e.target.value)}
                placeholder="Não informado"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${idBase}-valor`} className="text-xs font-medium text-muted-foreground">Bolsa obtida (USD)</label>
              <input
                type="number"
                min="0"
                id={`${idBase}-valor`}
                value={bolsaValor}
                onChange={(e) => setBolsaValor(e.target.value)}
                placeholder="Não informado"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${idBase}-aplicacao`} className="text-xs font-medium text-muted-foreground">Data de aplicação</label>
              <input
                type="date"
                id={`${idBase}-aplicacao`}
                value={dataAplicacao}
                onChange={(e) => setDataAplicacao(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${idBase}-resposta`} className="text-xs font-medium text-muted-foreground">Data de resposta</label>
              <input
                type="date"
                id={`${idBase}-resposta`}
                value={dataResposta}
                onChange={(e) => setDataResposta(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              handleSave();
            }}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
            Salvar resultado
          </Button>
        </div>
      )}
    </div>
  );
}
