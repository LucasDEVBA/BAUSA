"use client";

import { usePathname, useRouter } from "next/navigation";

import type { Period } from "@/lib/cac-queries";
import { cn } from "@/lib/utils";

const OPCOES: Array<{ id: Period; label: string }> = [
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "6m", label: "6 meses" },
  { id: "12m", label: "12 meses" },
];

export function RoiPeriodo({ periodoAtivo }: { periodoAtivo: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div role="group" aria-label="Período do ROI" className="flex flex-wrap gap-1.5">
      {OPCOES.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => router.push(`${pathname}?periodo=${o.id}`)}
          aria-pressed={periodoAtivo === o.id}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
            periodoAtivo === o.id
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
