"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Inputs numéricos com MÁSCARA para a tela de parâmetros do sistema.
 *
 * O projeto não tinha nenhum: todo campo de dinheiro era `<input type=number>`
 * cru, sem separador de milhar — R$ 1.500.000 aparecia como "1500000" e era
 * fácil errar uma casa. Aqui o valor sempre volta como NÚMERO puro para o
 * estado; a máscara é só apresentação.
 */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Formata em BRL sem centavos (padrão dos valores do BAUSA). */
export function formatBRL(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "—";
  return BRL.format(valor);
}

/** Compacto para textos de apoio: R$ 1,5M / R$ 125k. */
export function formatBRLCompacto(valor: number): string {
  if (!Number.isFinite(valor)) return "—";
  if (Math.abs(valor) >= 1_000_000) return `R$ ${(valor / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (Math.abs(valor) >= 1_000) return `R$ ${Math.round(valor / 1_000)}k`;
  return BRL.format(valor);
}

const soDigitos = (s: string) => s.replace(/\D/g, "");

interface CampoBaseProps {
  label: string;
  valor: number;
  onChange: (v: number) => void;
  ajuda?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}

/** Moeda BRL com separador de milhar aplicado enquanto digita. */
export function CurrencyInput({
  label,
  valor,
  onChange,
  ajuda,
  id,
  disabled,
  className,
}: CampoBaseProps) {
  const inputId = id ?? `moeda-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const [texto, setTexto] = useState(() => (valor ? valor.toLocaleString("pt-BR") : ""));

  // Sincroniza quando o valor muda por fora (reset/carregamento)
  useEffect(() => {
    setTexto(valor ? valor.toLocaleString("pt-BR") : "");
  }, [valor]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className="block text-xs font-medium text-muted-foreground">
        {label} <span className="text-label-tertiary">(R$)</span>
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-label-tertiary">
          R$
        </span>
        <input
          id={inputId}
          inputMode="numeric"
          disabled={disabled}
          value={texto}
          onChange={(e) => {
            const digitos = soDigitos(e.target.value).slice(0, 12);
            const numero = digitos === "" ? 0 : Number(digitos);
            setTexto(digitos === "" ? "" : numero.toLocaleString("pt-BR"));
            onChange(numero);
          }}
          className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm tabular-nums text-foreground outline-none transition-colors focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/25 disabled:opacity-50"
        />
      </div>
      {ajuda && <p className="text-[11px] leading-relaxed text-label-tertiary">{ajuda}</p>}
    </div>
  );
}

/** Inteiro com unidade (dias, horas, contratos…). */
export function UnitInput({
  label,
  valor,
  onChange,
  unidade,
  min = 0,
  max = 9999,
  ajuda,
  id,
  className,
}: CampoBaseProps & { unidade: string; min?: number; max?: number }) {
  const inputId = id ?? `unidade-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className="block text-xs font-medium text-muted-foreground">
        {label} <span className="text-label-tertiary">({unidade})</span>
      </label>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isFinite(valor) ? valor : 0}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm tabular-nums text-foreground outline-none transition-colors focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/25"
      />
      {ajuda && <p className="text-[11px] leading-relaxed text-label-tertiary">{ajuda}</p>}
    </div>
  );
}

/** Percentual 0–100 com slider + campo, para pesos e faixas. */
export function PercentInput({
  label,
  valor,
  onChange,
  ajuda,
  comSlider = true,
  id,
  className,
}: CampoBaseProps & { comSlider?: boolean }) {
  const inputId = id ?? `pct-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const set = (n: number) => onChange(Math.min(100, Math.max(0, Math.round(n))));
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className="block text-xs font-medium text-muted-foreground">
        {label} <span className="text-label-tertiary">(%)</span>
      </label>
      <div className="flex items-center gap-3">
        {comSlider && (
          <input
            type="range"
            min={0}
            max={100}
            value={valor}
            aria-label={`${label} (slider)`}
            onChange={(e) => set(Number(e.target.value))}
            className="h-1.5 flex-1 accent-primary"
          />
        )}
        <div className="relative w-20 shrink-0">
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={valor}
            onChange={(e) => set(Number(e.target.value))}
            className="h-9 w-full rounded-lg border border-input bg-card pl-3 pr-6 text-sm tabular-nums text-foreground outline-none transition-colors focus-visible:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring/25"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-label-tertiary">
            %
          </span>
        </div>
      </div>
      {ajuda && <p className="text-[11px] leading-relaxed text-label-tertiary">{ajuda}</p>}
    </div>
  );
}

/** Switch acessível (o projeto tinha só um botão ad-hoc na tela antiga). */
export function ToggleField({
  label,
  ativo,
  onChange,
  ajuda,
}: {
  label: string;
  ativo: boolean;
  onChange: (v: boolean) => void;
  ajuda?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        {ajuda && <p className="mt-0.5 text-[11px] leading-relaxed text-label-tertiary">{ajuda}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={ativo}
        aria-label={label}
        onClick={() => onChange(!ativo)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          ativo ? "bg-primary" : "bg-secondary",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform",
            ativo ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
