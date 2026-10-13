import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface VideoRailProps {
  /** Nome da lista para o leitor de tela. */
  label: string;
  /** Texto "deslize" exibido só onde há rolagem horizontal. */
  swipeHint: string;
  /** Colunas da grade no desktop (o trilho vira grade a partir de lg). */
  desktopColumns: 5 | 6;
  children: ReactNode;
}

const DESKTOP_GRID: Record<VideoRailProps["desktopColumns"], string> = {
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

/**
 * Trilho de Shorts 9:16: rolagem horizontal com snap sangrando até a borda no mobile
 * (só CSS, sem JS de carrossel) e grade no desktop. O respiro vertical existe para a
 * sombra e o hover dos cards não serem cortados pelo overflow do trilho.
 */
export default function VideoRail({ label, swipeHint, desktopColumns, children }: VideoRailProps) {
  return (
    <>
      <ul
        aria-label={label}
        className={`scrollbar-hide -mx-[var(--ba-gutter)] -my-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[var(--ba-gutter)] py-6 [scroll-padding-inline:var(--ba-gutter)] sm:gap-4 lg:mx-0 lg:grid lg:gap-5 lg:overflow-visible lg:px-0 ${DESKTOP_GRID[desktopColumns]}`}
      >
        {children}
      </ul>
      <p className="mt-4 flex items-center justify-center gap-1 text-xs font-medium text-[var(--ba-ink-3)] lg:hidden" aria-hidden="true">
        {swipeHint}
        <ChevronRight className="h-3.5 w-3.5" />
      </p>
    </>
  );
}

/** Item do trilho: largura fixa no mobile, coluna da grade no desktop. */
export function VideoRailItem({ children }: { children: ReactNode }) {
  return <li className="w-[min(60vw,240px)] flex-none snap-start sm:w-[240px] lg:w-auto">{children}</li>;
}
