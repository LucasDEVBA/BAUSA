"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Search,
  UserPlus,
  X,
  AlertCircle,
} from "lucide-react";
import {
  criarFamiliaManual,
  listarAtletasElegiveis,
} from "@/lib/actions/experiencia";
import {
  JOURNEY_STAGE_CONFIG,
  FAMILY_JOURNEY_STAGES,
  type FamilyJourneyStage,
} from "@/types/family";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AtletaElegivel {
  atleta_id: string;
  deal_id: string;
  nome: string;
  etapa: string;
}

const ETAPA_LABELS: Record<string, string> = {
  sinal_pago: "Sinal Pago",
  admission_process: "Admission Process",
  concluido: "Concluído",
};

interface NovaFamiliaModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function NovaFamiliaModal({
  open,
  onClose,
  onCreated,
}: NovaFamiliaModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loadPending, startLoadTransition] = useTransition();
  const [atletas, setAtletas] = useState<AtletaElegivel[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fase, setFase] = useState<FamilyJourneyStage>("admissao");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    startLoadTransition(async () => {
      const data = await listarAtletasElegiveis();
      if (!cancelled) setAtletas(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const loading = loadPending;

  if (!open) return null;

  const filtered = search.trim()
    ? atletas.filter((a) =>
        a.nome.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : atletas;

  const selected = atletas.find((a) => a.atleta_id === selectedId);

  const handleCreate = () => {
    if (!selected) {
      toast.error("Selecione um atleta");
      return;
    }
    startTransition(async () => {
      const result = await criarFamiliaManual(
        selected.atleta_id,
        selected.deal_id,
        fase,
      );
      if (result.success) {
        toast.success("Família criada", {
          description: selected.nome,
        });
        onCreated?.();
        router.refresh();
        onClose();
      } else {
        toast.error(result.error ?? "Falha ao criar família");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-[#1e2130] bg-[#0f1117] shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e2130] px-5 py-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-indigo-400" />
            <p className="text-sm font-bold text-white">Nova Família</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-indigo-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-200">
              Lista mostra atletas com deal em <code>sinal_pago</code>,{" "}
              <code>admission_process</code> ou <code>concluido</code> que ainda
              não têm registro de experiência.
            </p>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2">
            <Search className="h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar atleta pelo nome..."
              className="bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 outline-none flex-1"
            />
            {atletas.length > 0 && (
              <span className="text-[10px] text-zinc-600">
                {filtered.length}/{atletas.length}
              </span>
            )}
          </div>

          {/* Lista */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Carregando atletas elegíveis...
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#1e2130] py-10 text-center">
                <p className="text-xs text-zinc-500">
                  {atletas.length === 0
                    ? "Nenhum atleta elegível. Todos os deals em Admission+ já têm família."
                    : "Nenhum resultado para a busca."}
                </p>
              </div>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.atleta_id}
                  type="button"
                  onClick={() => setSelectedId(a.atleta_id)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                    selectedId === a.atleta_id
                      ? "border-indigo-500/40 bg-indigo-500/10"
                      : "border-[#1e2130] bg-[#141720] hover:border-indigo-500/20",
                  )}
                >
                  <div>
                    <p className="text-xs font-semibold text-white">
                      {a.nome}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      Etapa: {ETAPA_LABELS[a.etapa] ?? a.etapa}
                    </p>
                  </div>
                  {selectedId === a.atleta_id && (
                    <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[9px] font-bold text-indigo-300">
                      Selecionado
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Fase inicial */}
          {selected && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-1.5">
                Fase inicial da jornada
              </label>
              <select
                value={fase}
                onChange={(e) => setFase(e.target.value as FamilyJourneyStage)}
                className="w-full rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs text-zinc-200 outline-none focus:border-indigo-500/40"
              >
                {FAMILY_JOURNEY_STAGES.map((f) => (
                  <option key={f} value={f}>
                    {JOURNEY_STAGE_CONFIG[f].label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-zinc-600">
                Default: Admissão. Indicadores iniciais: ansiedade 3/5,
                satisfação 5/5, risco 1/5. Editáveis depois.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#1e2130] px-5 py-3 flex gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-[#1a1d2a] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!selected || isPending}
            className={cn(
              "flex flex-[2] items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
              selected && !isPending
                ? "bg-indigo-600 text-white hover:bg-indigo-500"
                : "bg-indigo-600/30 text-white/50 cursor-not-allowed",
            )}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Criar família{selected ? ` para ${selected.nome}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
