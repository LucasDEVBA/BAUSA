import type { Institution } from "@/data/institutions";

import { Eyebrow } from "./Eyebrow";

/**
 * Faixa de logos institucionais (BAU-02 §2.5).
 *
 * Marquee lento (60s por ciclo), pausa no hover e no foco de teclado. Logos em
 * monocromático a 55% de opacidade; cor original no hover.
 *
 * Server Component: o movimento é CSS puro (`.bau-marquee-track`, definido em
 * `app/bau.css`, que já respeita `prefers-reduced-motion`).
 *
 * A cópia da lista existe só para fechar o loop visual e leva `aria-hidden` —
 * sem isso um leitor de tela anuncia cada instituição duas vezes, que é o bug
 * de "conteúdo duplicado" apontado no guia.
 */
export function LogoWall({
  label,
  institutions,
}: {
  label: string;
  institutions: readonly Institution[];
}) {
  return (
    <div className="bau-marquee">
      <Eyebrow className="bau-container mb-8">{label}</Eyebrow>

      <div className="relative overflow-hidden">
        {/* Esfumaçado nas bordas: os logos entram e saem em vez de serem cortados. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-bau-navy-deep to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-bau-navy-deep to-transparent"
        />

        <ul className="bau-marquee-track flex w-max items-center gap-16 pr-16">
          {institutions.map((institution) => (
            <LogoItem key={institution.name} institution={institution} />
          ))}
          {institutions.map((institution) => (
            <LogoItem key={`dup-${institution.name}`} institution={institution} duplicate />
          ))}
        </ul>
      </div>
    </div>
  );
}

function LogoItem({
  institution,
  duplicate = false,
}: {
  institution: Institution;
  duplicate?: boolean;
}) {
  return (
    <li aria-hidden={duplicate || undefined} className="shrink-0">
      <img
        src={institution.logo.src}
        alt={duplicate ? "" : institution.name}
        loading="lazy"
        decoding="async"
        className="h-10 w-auto opacity-55 brightness-0 invert transition duration-200 hover:opacity-100 hover:brightness-100 hover:invert-0 lg:h-12"
      />
    </li>
  );
}
