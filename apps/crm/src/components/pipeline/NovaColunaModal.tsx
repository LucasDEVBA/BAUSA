"use client";

import { useState, useTransition } from "react";
import { Columns3, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import {
  ETAPA_ACCENTS,
  ETAPA_ACCENT_DOT,
  ETAPA_ACCENT_LABEL,
  ETAPA_DEAL_LABEL_MAX,
  type EtapaDealAccent,
} from "@/lib/etapas-deal";
import { criarColunaPipeline } from "@/lib/actions/etapas-pipeline";
import { cn } from "@/lib/utils";

/**
 * Cria uma coluna nova no board: nomeia o primeiro slot custom livre
 * (custom_1..6 — o enum é fixo; rótulo/cor/ordem vivem em etapas_deal_config,
 * mesma camada do PR #307). Máx. 6 colunas personalizadas.
 */
export function NovaColunaModal({
  onClose,
  onCriada,
}: {
  onClose: () => void;
  onCriada: () => void;
}) {
  const [nome, setNome] = useState("");
  const [accent, setAccent] = useState<EtapaDealAccent>("blue");
  const [pending, startTransition] = useTransition();

  const criar = () => {
    startTransition(async () => {
      const r = await criarColunaPipeline({ label: nome, accent });
      if (r.success) {
        toast.success(`Coluna "${nome.trim()}" criada no fim do board`, {
          description: "Arraste-a pelo cabeçalho para a posição que quiser.",
        });
        onCriada();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => !pending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nova-coluna-titulo"
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Columns3 className="size-4" />
            </span>
            <div>
              <h2 id="nova-coluna-titulo" className="text-sm font-semibold text-foreground">
                Nova coluna
              </h2>
              <p className="text-xs text-muted-foreground">Entra no fim do board — arraste para posicionar.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar" disabled={pending}>
            <X />
          </Button>
        </div>

        <label htmlFor="nova-coluna-nome" className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
          Nome da coluna
        </label>
        <input
          id="nova-coluna-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={ETAPA_DEAL_LABEL_MAX}
          placeholder="Ex.: Indicações, Retomar em 2027…"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && nome.trim() && !pending) criar();
          }}
          className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-label-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />

        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Cor</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cor da coluna">
          {ETAPA_ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={accent === a}
              title={ETAPA_ACCENT_LABEL[a]}
              onClick={() => setAccent(a)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                accent === a
                  ? "border-primary/50 bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:bg-accent",
              )}
            >
              <span className={cn("size-2.5 rounded-full", ETAPA_ACCENT_DOT[a])} aria-hidden />
              {ETAPA_ACCENT_LABEL[a]}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button variant="primary" size="sm" onClick={criar} disabled={pending || nome.trim().length === 0}>
            {pending ? <Loader2 className="animate-spin" /> : <Columns3 />}
            Criar coluna
          </Button>
        </div>
      </div>
    </div>
  );
}
