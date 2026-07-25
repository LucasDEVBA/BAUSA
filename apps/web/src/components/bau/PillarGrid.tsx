import { Reveal } from "./Reveal";

/**
 * Os quatro pilares do Método S.A.F.E.® em grid 2×2, com as iniciais em Caslon
 * monumental como elemento gráfico (BAU-02 Parte 3, "O Método").
 *
 * A inicial é decorativa — o nome do pilar já está no `<h3>`. Por isso ela é
 * `aria-hidden`: um leitor de tela anunciando "S, Singularidade" seria ruído.
 *
 * O peso fica travado em 400: Libre Caslon Display não tem bold, e `font-bold`
 * aqui produziria synthetic bold, que destrói o desenho da fonte a 140px.
 */
export interface Pillar {
  initial: string;
  title: string;
  description: string;
}

export function PillarGrid({ pillars }: { pillars: readonly Pillar[] }) {
  return (
    <ul className="grid gap-px bg-[var(--bau-hairline)] sm:grid-cols-2">
      {pillars.map((pillar, i) => (
        <li key={pillar.initial} className="bg-bau-navy-deep">
          <Reveal delay={i * 80} className="group relative h-full p-8 lg:p-12">
            <span
              aria-hidden="true"
              className="bau-display pointer-events-none absolute right-6 top-4 select-none text-[7rem] leading-none text-bau-ivory/[0.07] transition-colors duration-200 group-hover:text-bau-blue/25 lg:text-[8.75rem]"
            >
              {pillar.initial}
            </span>

            <div className="relative z-10">
              <h3 className="bau-display text-[1.75rem] text-bau-ivory">{pillar.title}</h3>
              <p className="bau-prose mt-4 text-[16px] text-bau-stone">{pillar.description}</p>
            </div>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}
