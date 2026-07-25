import { Eyebrow } from "./Eyebrow";
import { Reveal } from "./Reveal";

/**
 * Espinha vertical da página /jornada (BAU-02 §2.5): linha de 1px em azul
 * institucional, com os nós acendendo conforme cada fase entra em cena.
 *
 * O "acender" é o próprio `Reveal` da fase — nó e conteúdo aparecem juntos, sem
 * observer adicional. A lista é `<ol>` porque a ordem das fases é significativa.
 */
export interface TimelinePhase {
  label: string;
  title: string;
  description: string;
}

export function Timeline({ phases }: { phases: readonly TimelinePhase[] }) {
  return (
    <ol className="relative">
      {/* A linha para no último nó em vez de vazar para o rodapé da seção. */}
      <span
        aria-hidden="true"
        className="absolute bottom-8 left-[7px] top-2 w-px bg-bau-blue/40 lg:left-[calc(16.666%+7px)]"
      />

      {phases.map((phase, i) => (
        <li key={phase.label} className="relative pb-14 pl-10 last:pb-0 lg:pl-0">
          <Reveal delay={i * 0.06}>
            <div className="lg:grid lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-2">
                <Eyebrow className="lg:justify-end">{phase.label}</Eyebrow>
              </div>

              {/* Nó sobre a linha. */}
              <span
                aria-hidden="true"
                className="absolute left-0 top-[3px] h-[15px] w-[15px] rounded-full border border-bau-blue bg-bau-navy-deep lg:left-[16.666%]"
              />

              <div className="lg:col-span-8 lg:col-start-4">
                <h3 className="bau-display mt-4 text-[1.5rem] text-bau-ivory lg:mt-0">{phase.title}</h3>
                <p className="bau-prose mt-3 text-[16px] text-bau-stone">{phase.description}</p>
              </div>
            </div>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}
