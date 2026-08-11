import { Skeleton } from "./Skeleton";
import { cn } from "@/lib/utils";

/**
 * Blocos de skeleton que espelham os layouts reais do Engine.
 *
 * Regra: o skeleton tem de ter a MESMA anatomia da tela que substitui
 * (mesma altura de header, mesmo número de colunas/cards) — senão o conteúdo
 * "pula" quando chega e a espera fica pior do que uma tela vazia.
 *
 * Usados pelos `loading.tsx` de cada rota, que o Next renderiza como
 * Suspense boundary enquanto o Server Component busca os dados.
 */

/** Cabeçalho de página (PageHeader dense: eyebrow + título + ações). */
export function SkeletonPageHeader({ comAcoes = true }: { comAcoes?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-2">
        <Skeleton className="h-3 w-20 rounded-md" />
        <Skeleton className="h-6 w-44" />
      </div>
      {comAcoes && <Skeleton className="size-8 shrink-0 rounded-md" />}
    </div>
  );
}

/** Faixa de KPIs (StatCard: eyebrow + ícone + valor + rodapé). */
export function SkeletonStatCards({ total = 4 }: { total?: number }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-4",
        total >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-2.5 w-20 rounded-md" />
            <Skeleton className="size-7 rounded-lg" />
          </div>
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 h-2.5 w-28 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Tabela em card (toolbar opcional + header + linhas). */
export function SkeletonTable({
  linhas = 8,
  colunas = 6,
  comToolbar = true,
}: {
  linhas?: number;
  colunas?: number;
  comToolbar?: boolean;
}) {
  return (
    <div className="space-y-4">
      {comToolbar && (
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-full max-w-xs rounded-md" />
          <Skeleton className="h-9 w-48 rounded-md" />
          <Skeleton className="ml-auto h-3 w-24 rounded-md" />
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-4 border-b border-border px-5 py-3">
          {Array.from({ length: colunas }).map((_, i) => (
            <Skeleton key={i} className={cn("h-3 rounded-md", i === 0 ? "w-40" : "flex-1")} />
          ))}
        </div>
        {Array.from({ length: linhas }).map((_, l) => (
          <div key={l} className="flex items-center gap-4 border-b border-border/60 px-5 py-3.5 last:border-0">
            {Array.from({ length: colunas }).map((_, c) => (
              <Skeleton
                key={c}
                className={cn("h-3.5 rounded-md", c === 0 ? "w-40" : "flex-1")}
                style={{ opacity: 1 - l * 0.07 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Grade de cards (listas/hubs). */
export function SkeletonCards({
  total = 6,
  altura = "h-32",
  colunas = "lg:grid-cols-3",
}: {
  total?: number;
  altura?: string;
  colunas?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", colunas)}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={cn("rounded-2xl border border-border bg-card p-4", altura)}>
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
          <Skeleton className="mt-4 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/2 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** Card de gráfico (título + área do chart). */
export function SkeletonChart({ altura = "h-64" }: { altura?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Skeleton className="h-3 w-32 rounded-md" />
      <Skeleton className={cn("mt-4 w-full", altura)} />
    </div>
  );
}

/** Board Kanban (colunas com cards). */
export function SkeletonBoard({ colunas = 6 }: { colunas?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: colunas }).map((_, c) => (
        <div
          key={c}
          className="flex w-[252px] shrink-0 flex-col rounded-xl border border-border/70 bg-secondary/40"
        >
          <div className="flex items-center gap-1.5 px-2.5 py-2">
            <Skeleton className="size-2 rounded-full" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
          <div className="flex flex-col gap-1.5 p-1.5">
            {Array.from({ length: Math.max(1, 4 - c) }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-2.5">
                <Skeleton className="h-2.5 w-28 rounded-md" />
                <Skeleton className="mt-1.5 h-2.5 w-20 rounded-md" />
                <Skeleton className="mt-2 h-2.5 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Barra de abas (BrandTabs segmentado). */
export function SkeletonTabs({ total = 5 }: { total?: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-24 rounded-lg" />
      ))}
    </div>
  );
}

/** Lista vertical em card (itens com avatar + 2 linhas). */
export function SkeletonList({ itens = 5, altura }: { itens?: number; altura?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", altura)}>
      <Skeleton className="h-3 w-32 rounded-md" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: itens }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3 w-2/5 rounded-md" />
              <Skeleton className="h-2.5 w-3/5 rounded-md" />
            </div>
            <Skeleton className="h-3 w-14 shrink-0 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
