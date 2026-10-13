"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { ESCOLAS_TEXT, fill } from "@/content/escolas";
import { pick, type SchoolType } from "@/content/types";
import { useLanguage } from "@/i18n";

export type TourFilterValue = "all" | SchoolType;

interface TourFilterProps {
  counts: Record<TourFilterValue, number>;
  /** Grupos já renderizados no servidor; o filtro só decide quais aparecem. */
  children: ReactNode;
}

// Valor do data-filter sem "_": no Tailwind o sublinhado de um seletor arbitrário vira espaço
const FILTER_ATTR: Record<TourFilterValue, string> = { all: "all", high_school: "high-school", universidade: "universidade" };

const OPTIONS: { value: TourFilterValue; label: keyof typeof ESCOLAS_TEXT }[] = [
  { value: "all", label: "filterAll" },
  { value: "high_school", label: "filterHighSchools" },
  { value: "universidade", label: "filterUniversities" },
];

/**
 * Controle segmentado em vidro (Todos / High Schools / Universidades). Os cards são
 * Server Components passados como children: o filtro troca um data-attribute e o CSS
 * esconde o grupo que sobra, sem refazer a lista nem recarregar a página.
 */
export default function TourFilter({ counts, children }: TourFilterProps) {
  const { lang } = useLanguage();
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<TourFilterValue>("all");

  return (
    <>
      <div
        role="group"
        aria-label={pick(ESCOLAS_TEXT.filterLabel, lang)}
        className="ba-glass ba-rv flex w-full rounded-full p-1 sm:inline-flex sm:w-auto"
        style={{ "--d": 2 } as React.CSSProperties}
      >
        {OPTIONS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              aria-controls="tours-grid"
              onClick={() => setFilter(option.value)}
              className={`relative flex min-h-11 min-w-0 flex-auto items-center justify-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[13px] min-[400px]:gap-1.5 min-[400px]:px-3 min-[400px]:text-[13.5px] font-semibold transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ba-blue-2)] sm:px-[18px] sm:text-[14.5px] ${
                active ? "text-white" : "text-[var(--ba-ink-2)] hover:text-[var(--ba-navy)]"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="tour-filter-pill"
                  aria-hidden="true"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                  className="absolute inset-0 rounded-full bg-[linear-gradient(180deg,#2b4fbd_0%,var(--ba-blue)_55%,#18348c_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_22px_-10px_rgba(31,63,163,0.75)]"
                />
              )}
              <span className="relative">{pick(ESCOLAS_TEXT[option.label], lang)}</span>
              <span
                className={`relative rounded-full px-1.5 py-px text-[10.5px] font-bold tabular-nums max-[359px]:hidden ${
                  active ? "bg-white/20 text-white" : "bg-[rgba(31,63,163,0.08)] text-[var(--ba-blue)]"
                }`}
              >
                {counts[option.value]}
              </span>
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {fill(pick(ESCOLAS_TEXT.filterStatus, lang), { n: counts[filter] })}
      </p>

      <div id="tours-grid" data-filter={FILTER_ATTR[filter]} className="group/tours mt-[clamp(32px,4vw,52px)]">
        {children}
      </div>
    </>
  );
}
