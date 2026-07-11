"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface BrandTab {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Indicador custom antes do rótulo (ex.: dot de status colorido). */
  indicator?: React.ReactNode;
  /** Se presente, a aba é um Link (navegação por rota). Senão, usa onSelect. */
  href?: string;
}

interface BrandTabsProps {
  items: BrandTab[];
  activeId: string;
  /** Aba por estado (usado quando os items não têm href). */
  onSelect?: (id: string) => void;
  variant?: "segmented" | "underline";
  ariaLabel?: string;
  className?: string;
}

/**
 * Abas da identidade visual BAU — acento no azul do wordmark (`bau-blue`).
 *
 * - `segmented`: pílulas num trilho (ideal para 2–4 abas internas).
 * - `underline`: sublinhado com scroll (ideal para muitas abas, ex. War Room).
 *
 * Funciona por rota (item.href → `<Link>`) ou por estado (onSelect → `<button>`).
 */
export function BrandTabs({
  items,
  activeId,
  onSelect,
  variant = "segmented",
  ariaLabel,
  className,
}: BrandTabsProps) {
  const segmented = variant === "segmented";

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        segmented
          ? "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)] p-1 shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(20px)] [scrollbar-width:none]"
          : "flex items-center gap-1 overflow-x-auto border-b border-border",
        className,
      )}
    >
      {items.map((tab) => {
        const active = tab.id === activeId;
        const Icon = tab.icon;
        const classes = cn(
          "flex items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-all",
          segmented
            ? cn(
                "rounded-lg px-3.5 py-1.5",
                active
                  ? "bg-card font-semibold text-bau-blue shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )
            : cn(
                "-mb-px border-b-2 px-3.5 py-2",
                active
                  ? "border-bau-blue text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ),
        );

        const content = (
          <>
            {Icon ? <Icon className="h-4 w-4" /> : null}
            {tab.indicator ?? null}
            {tab.label}
          </>
        );

        return tab.href ? (
          <Link
            key={tab.id}
            href={tab.href}
            role="tab"
            aria-selected={active}
            className={classes}
          >
            {content}
          </Link>
        ) : (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect?.(tab.id)}
            className={classes}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
