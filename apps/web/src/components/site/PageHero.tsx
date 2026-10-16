import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import MeshBackground from "@/components/brand/MeshBackground";
import { Link } from "@/i18n/navigation";

interface PageHeroProps {
  /** Rótulo da pílula acima do título (ex.: "Método S.A.F.E.®"). */
  eyebrow: string;
  /** Título já com o acento serif aplicado pela página, se houver. */
  title: ReactNode;
  lead: ReactNode;
  /** Trilha "Início > Página" (rótulos já traduzidos). */
  breadcrumb: { homeLabel: string; current: string };
  /** CTAs e chips abaixo do texto. */
  actions?: ReactNode;
  /** Coluna de mídia à direita no desktop (abaixo do texto no mobile). */
  media?: ReactNode;
}

/**
 * Abertura padrão das páginas de conteúdo: mesmo sistema do Hero da home
 * (malha viva, pílula, Sora com acento serif), mais compacto, para a página
 * entrar direto no assunto. Mobile-first: texto antes da mídia.
 */
export default function PageHero({ eyebrow, title, lead, breadcrumb, actions, media }: PageHeroProps) {
  return (
    <section className="relative isolate overflow-hidden pb-[clamp(40px,6vw,72px)] pt-[clamp(92px,12vw,148px)]" aria-labelledby="page-title">
      <MeshBackground grid />
      {/* Esmaece a malha no pé: a seção seguinte começa sem emenda de cor */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-28 bg-gradient-to-b from-transparent to-[var(--ba-bg)]" />
      <div className={`ba-wrap relative z-[2] grid items-center gap-9 ${media ? "lg:grid-cols-[1.05fr_1fr] lg:gap-[clamp(32px,4vw,64px)]" : ""}`}>
        <div className="max-w-[720px]">
          <nav aria-label="Breadcrumb" className="ba-rise -my-3 mb-2 text-[13px] font-medium text-[var(--ba-ink-3)]">
            <ol className="flex items-center gap-1.5">
              <li>
                {/* Área de toque de 44px sem mudar o desenho: o -my do nav compensa a altura extra */}
                <Link href="/" className="-mx-2 inline-flex min-h-11 items-center rounded-full px-2 transition-colors hover:text-[var(--ba-navy)]">
                  {breadcrumb.homeLabel}
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li aria-current="page" className="flex min-h-11 items-center text-[var(--ba-ink-2)]">
                {breadcrumb.current}
              </li>
            </ol>
          </nav>
          <span className="ba-eyebrow ba-glass ba-rise !text-[11px] sm:!text-[12.5px]" style={{ "--d": 1 } as React.CSSProperties}>
            <span className="ba-dot" />
            {eyebrow}
          </span>
          <h1
            id="page-title"
            className="ba-display ba-rise mt-[18px] text-[clamp(38px,9.6vw,44px)] text-[var(--ba-navy)] sm:mt-[22px] sm:text-[clamp(44px,5.4vw,76px)]"
            style={{ "--d": 2 } as React.CSSProperties}
          >
            {title}
          </h1>
          <div className="ba-lead ba-rise mt-5 max-w-[600px]" style={{ "--d": 3 } as React.CSSProperties}>
            {lead}
          </div>
          {actions && (
            <div className="ba-rise mt-7 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3" style={{ "--d": 4 } as React.CSSProperties}>
              {actions}
            </div>
          )}
        </div>
        {media && (
          <div className="ba-rise-scale" style={{ "--d": 3 } as React.CSSProperties}>
            {media}
          </div>
        )}
      </div>
    </section>
  );
}
