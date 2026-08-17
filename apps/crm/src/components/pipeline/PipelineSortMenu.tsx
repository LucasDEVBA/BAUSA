"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowUpDown, Check } from "lucide-react";
import type { Deal } from "@/types/deal";
import { cn } from "@/lib/utils";

/**
 * Ordenação de EXIBIÇÃO dos cards dentro das colunas do Kanban — escolhida
 * POR COLUNA (stage). É só um transform de render: não persiste ordem no
 * banco e não interfere no drag-and-drop entre colunas (que muda `stage`,
 * não a posição).
 */
export type PipelineSortMode = "padrao" | "recentes" | "antigos" | "alfabetica";

/** Escolha por coluna. Coluna ausente = "padrao" (ordem do servidor). */
export type PipelineSortMap = Record<string, PipelineSortMode>;

/** Chave única no localStorage — Record<stage, modo> serializado em JSON. */
export const PIPELINE_SORT_STORAGE_KEY = "bausa-pipeline-sort-colunas";

export const DEFAULT_PIPELINE_SORT: PipelineSortMode = "padrao";

const SORT_OPTIONS: Array<{ value: PipelineSortMode; label: string }> = [
  { value: "padrao", label: "Padrão (atividade)" },
  { value: "recentes", label: "Mais recentes" },
  { value: "antigos", label: "Mais antigos" },
  { value: "alfabetica", label: "Ordem alfabética" },
];

export function isPipelineSortMode(value: unknown): value is PipelineSortMode {
  return (
    typeof value === "string" &&
    SORT_OPTIONS.some((opt) => opt.value === value)
  );
}

/**
 * Reidrata o mapa por coluna do localStorage. Valor corrompido/parcial não
 * quebra: entradas inválidas são descartadas e o resto sobrevive.
 */
export function parseStoredSortMap(raw: string | null): PipelineSortMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
      return {};
    const map: PipelineSortMap = {};
    for (const [stage, mode] of Object.entries(parsed)) {
      if (isPipelineSortMode(mode)) map[stage] = mode;
    }
    return map;
  } catch {
    // JSON inválido — recomeça do padrão.
    return {};
  }
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
  /** Rótulo acessível do gatilho (ex.: "Ordenar coluna Lead"). */
  ariaLabel: string;
  /** Título do menu (contexto: coluna X ou o board todo). */
  menuLabel?: string;
  /** true = só o ícone (header de coluna); false = botão da barra de filtros. */
  compact?: boolean;
}

/**
 * Controle discreto de ordenação (ícone ArrowUpDown + menu).
 * Radix DropdownMenu = navegação por setas/Enter/Esc e roving focus de graça.
 * O gatilho bloqueia dragstart/click de subir — o header da coluna é draggable
 * (reordenação de colunas) e tem clique-para-editar; abrir o menu não pode
 * disparar nenhum dos dois.
 */
export function PipelineSortMenu({
  value,
  onChange,
  ariaLabel,
  menuLabel = "Ordenar cards",
  compact = false,
}: PipelineSortMenuProps) {
  const active = SORT_OPTIONS.find((opt) => opt.value === value);
  const isCustom = value !== DEFAULT_PIPELINE_SORT;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`${ariaLabel} — atual: ${active?.label ?? "Padrão"}`}
          title={ariaLabel}
          draggable={false}
          onDragStart={(e) => {
            // Header da coluna é draggable — o botão não pode iniciar arraste.
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            compact
              ? cn(
                  "flex h-5 w-5 items-center justify-center rounded-md",
                  isCustom
                    ? "text-primary hover:bg-card/70"
                    : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
                )
              : cn(
                  "inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium",
                  isCustom
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                ),
          )}
        >
          <ArrowUpDown className="h-3 w-3" />
          {!compact && isCustom && (
            <span className="hidden sm:inline">{active?.label}</span>
          )}
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
            {menuLabel}
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
