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
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl max-h-[85vh] flex flex-col liquid-glass"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-foreground">Nova Família</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-fill-4 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/80">
              Lista mostra atletas com deal em <code>sinal_pago</code>,{" "}
              <code>admission_process</code> ou <code>concluido</code> que ainda
              não têm registro de experiência.
            </p>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 rounded-md border border-input bg-card px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar atleta pelo nome..."
              className="bg-transparent text-xs text-foreground placeholder:text-placeholder outline-none flex-1"
            />
            {atletas.length > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {filtered.length}/{atletas.length}
              </span>
            )}
          </div>

          {/* Lista */}
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Carregando atletas elegíveis...
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center">
                <p className="text-xs text-muted-foreground">
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
                    "w-full flex items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors",
                    selectedId === a.atleta_id
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-card hover:border-primary/20",
                  )}
                >
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {a.nome}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Etapa: {ETAPA_LABELS[a.etapa] ?? a.etapa}
                    </p>
                  </div>
                  {selectedId === a.atleta_id && (
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-bold text-primary">
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
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary mb-1.5">
                Fase inicial da jornada
              </label>
              <select
                value={fase}
                onChange={(e) => setFase(e.target.value as FamilyJourneyStage)}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary/40"
              >
                {FAMILY_JOURNEY_STAGES.map((f) => (
                  <option key={f} value={f}>
                    {JOURNEY_STAGE_CONFIG[f].label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-label-tertiary">
                Default: Admissão. Indicadores iniciais: ansiedade 3/5,
                satisfação 5/5, risco 1/5. Editáveis depois.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!selected || isPending}
            className={cn(
              "flex flex-[2] items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-colors",
              selected && !isPending
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-primary/30 text-foreground/50 cursor-not-allowed",
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
