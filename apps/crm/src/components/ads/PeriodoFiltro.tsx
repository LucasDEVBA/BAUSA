"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PERIODO_PRESETS, type PeriodoPreset } from "@/lib/meta-ads";
import { cn } from "@/lib/utils";

// Filtro de período da seção Ads: presets fechados OU range de datas
// específico (?de=YYYY-MM-DD&ate=...). Server refetch via querystring —
// a page relê searchParams e busca o range certo.

const PRESET_LABEL: Record<PeriodoPreset, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  "6m": "6 meses",
  "12m": "12 meses",
};

export function PeriodoFiltro({
  presetAtivo,
  de,
  ate,
}: {
  /** null = range custom ativo */
  presetAtivo: PeriodoPreset | null;
  de: string;
  ate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [deLocal, setDeLocal] = useState(de);
  const [ateLocal, setAteLocal] = useState(ate);

  // Preserva os demais filtros da tela (ex.: ?campanha=) ao trocar o período.
  const navegar = (mudancas: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor === null) params.delete(chave);
      else params.set(chave, valor);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const aplicarPreset = (p: PeriodoPreset) => navegar({ periodo: p, de: null, ate: null });
  const aplicarRange = () => {
    if (deLocal && ateLocal && deLocal <= ateLocal) navegar({ de: deLocal, ate: ateLocal, periodo: null });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="group" aria-label="Período fechado" className="flex flex-wrap gap-1.5">
        {PERIODO_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => aplicarPreset(p)}
            aria-pressed={presetAtivo === p}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              presetAtivo === p
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {PRESET_LABEL[p]}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <label className="sr-only" htmlFor="ads-de">Data inicial</label>
        <input
          id="ads-de"
          type="date"
          value={deLocal}
          onChange={(e) => setDeLocal(e.target.value)}
          className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-xs text-label-tertiary">até</span>
        <label className="sr-only" htmlFor="ads-ate">Data final</label>
        <input
          id="ads-ate"
          type="date"
          value={ateLocal}
          onChange={(e) => setAteLocal(e.target.value)}
          className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="button"
          onClick={aplicarRange}
          disabled={!deLocal || !ateLocal || deLocal > ateLocal}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            presetAtivo === null
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
