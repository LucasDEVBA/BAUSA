"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowUpDown, Check } from "lucide-react";
import type { Deal } from "@/types/deal";
import { cn } from "@/lib/utils";

/**
 * Ordenação de EXIBIÇÃO dos cards dentro das colunas do Kanban.
 * É só um transform de render — não persiste ordem no banco e não interfere
 * no drag-and-drop entre colunas (que muda `stage`, não a posição).
 */
export type PipelineSortMode = "padrao" | "recentes" | "antigos" | "alfabetica";

/** Chave única no localStorage — escolha do CEO sobrevive ao reload. */
export const PIPELINE_SORT_STORAGE_KEY = "bausa-pipeline-sort";

export const DEFAULT_PIPELINE_SORT: PipelineSortMode = "padrao";

const SORT_OPTIONS: Array<{ value: PipelineSortMode; label: string }> = [
  { value: "padrao", label: "Padrão (atividade)" },
  { value: "recentes", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigos" },
  { value: "alfabetica", label: "Ordem alfabética" },
];

export function isPipelineSortMode(value: string): value is PipelineSortMode {
  return SORT_OPTIONS.some((opt) => opt.value === value);
}

function createdAtMs(deal: Deal): number {
  const ms = new Date(deal.created_at).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Transform puro de exibição. "padrao" preserva a ordem vinda do servidor
 * (updated_at desc — comportamento histórico do board).
 */
export function sortDealsForDisplay(
  deals: Deal[],
  mode: PipelineSortMode,
): Deal[] {
  switch (mode) {
    case "recentes":
      return [...deals].sort((a, b) => createdAtMs(b) - createdAtMs(a));
    case "antigos":
      return [...deals].sort((a, b) => createdAtMs(a) - createdAtMs(b));
    case "alfabetica":
      return [...deals].sort((a, b) =>
        a.athlete_name.localeCompare(b.athlete_name, "pt-BR", {
          sensitivity: "base",
        }),
      );
    case "padrao":
      return deals;
  }
}

interface PipelineSortMenuProps {
  value: PipelineSortMode;
  onChange: (mode: PipelineSortMode) => void;
}

/**
 * Controle discreto de ordenação do board (ícone ArrowUpDown + menu).
 * Radix DropdownMenu = navegação por setas/Enter/Esc e roving focus de graça.
 */
export function PipelineSortMenu({ value, onChange }: PipelineSortMenuProps) {
  const active = SORT_OPTIONS.find((opt) => opt.value === value);
  const isCustom = value !== DEFAULT_PIPELINE_SORT;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Ordenar cards das colunas — atual: ${active?.label ?? "Padrão"}`}
          title="Ordenar cards das colunas"
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            isCustom
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-border bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowUpDown className="h-3 w-3" />
          {isCustom && <span className="hidden sm:inline">{active?.label}</span>}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 min-w-44 rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          <DropdownMenu.Label className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Ordenar cards
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={value}
            onValueChange={(v) => {
              if (isPipelineSortMode(v)) onChange(v);
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <DropdownMenu.RadioItem
                key={opt.value}
                value={opt.value}
                className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] text-foreground outline-none transition-colors data-[highlighted]:bg-secondary"
              >
                {opt.label}
                <DropdownMenu.ItemIndicator>
                  <Check className="h-3 w-3 text-primary" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
