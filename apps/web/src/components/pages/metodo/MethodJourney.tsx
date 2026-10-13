import { ArrowRight, MapPin } from "lucide-react";

import MeshBackground from "@/components/brand/MeshBackground";
import { Link } from "@/i18n/navigation";
import type { Lang } from "@/i18n";
import { JOURNEY, JOURNEY_STEPS, type JourneyPhase } from "@/content/metodo";
import { pick } from "@/content/types";

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

// Quantas etapas cada fase ocupa: define a faixa "No Brasil / Nos EUA" do desktop
const PHASE_SPAN: Record<JourneyPhase, number> = JOURNEY_STEPS.reduce(
  (acc, step) => ({ ...acc, [step.phase]: acc[step.phase] + 1 }),
  { brasil: 0, eua: 0 } as Record<JourneyPhase, number>,
);
const PHASE_COL_SPAN: Record<number, string> = { 1: "xl:col-span-1", 2: "xl:col-span-2", 3: "xl:col-span-3", 4: "xl:col-span-4" };

const PhasePill = ({ phase, lang, className = "" }: { phase: JourneyPhase; lang: Lang; className?: string }) => (
  <span
    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[11.5px] font-bold uppercase tracking-[0.14em] ${
      phase === "brasil"
        ? "bg-[rgba(144,36,52,0.08)] text-[var(--ba-wine)] shadow-[inset_0_0_0_1px_rgba(144,36,52,0.14)]"
        : "bg-[rgba(31,63,163,0.08)] text-[var(--ba-blue)] shadow-[inset_0_0_0_1px_rgba(31,63,163,0.14)]"
    } ${className}`}
  >
    <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
    {pick(JOURNEY.phases[phase], lang)}
  </span>
);

interface MethodJourneyProps {
  lang: Lang;
}

/**
 * Linha do tempo da jornada (Brasil → High School → universidade). Mobile: trilho
 * vertical com nós numerados; desktop: cinco colunas sob a faixa de fases. A última
 * etapa é o destino e ganha o tratamento escuro, como no "Por que High School".
 */
export default function MethodJourney({ lang }: MethodJourneyProps) {
  const lastIndex = JOURNEY_STEPS.length - 1;

  return (
    <section className="relative isolate overflow-hidden py-[clamp(72px,9vw,128px)]" aria-labelledby="jornada-title">
      <MeshBackground
        blobs={["b2", "b3"]}
        className="[&_.ba-b2]:!right-[-18vw] [&_.ba-b2]:!top-[8%] [&_.ba-b2]:!opacity-40 [&_.ba-b3]:!left-[-12vw] [&_.ba-b3]:!top-[55%] [&_.ba-b3]:!opacity-30"
      />

      <div className="ba-wrap relative z-[2]">
        <header className="grid grid-cols-1 items-end gap-6 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <span className="ba-eyebrow ba-glass ba-rv" style={delay(0)}>
              <span className="ba-dot" />
              {pick(JOURNEY.eyebrow, lang)}
            </span>
            <h2 id="jornada-title" className="ba-h2 ba-rv mt-6 text-[var(--ba-navy)]" style={delay(1)}>
              {pick(JOURNEY.titleBefore, lang)} <span className="ba-serif ba-grad-text text-[1.12em]">{pick(JOURNEY.titleAccent, lang)}</span>
            </h2>
          </div>
          <p className="ba-lead ba-rv lg:col-span-5 lg:pb-2" style={delay(2)}>
            {pick(JOURNEY.lead, lang)}
          </p>
        </header>

        {/* Faixa das fases (xl): o trilho atravessa o oceano entre a 3ª e a 4ª etapa. Abaixo de 1280px as
            cinco colunas ficam estreitas demais (texto em 11 linhas, links quebrando): vale o trilho vertical */}
        <div className="mt-[clamp(48px,6vw,72px)] hidden grid-cols-5 gap-4 xl:grid" aria-hidden="true">
          {(["brasil", "eua"] as const).map((phase) => (
            <div key={phase} className={`ba-rv flex items-center gap-3 ${PHASE_COL_SPAN[PHASE_SPAN[phase]]}`} style={delay(phase === "brasil" ? 1 : 3)}>
              <PhasePill phase={phase} lang={lang} />
              <span
                className={`h-px flex-1 ${
                  phase === "brasil" ? "bg-[linear-gradient(90deg,rgba(144,36,52,0.3),rgba(144,36,52,0))]" : "bg-[linear-gradient(90deg,rgba(31,63,163,0.3),rgba(31,63,163,0))]"
                }`}
              />
            </div>
          ))}
        </div>

        <ol className="relative mt-10 grid grid-cols-1 gap-3 sm:gap-4 xl:mt-6 xl:grid-cols-5" role="list">
          {/* Trilho: vertical até o lg (centro dos nós); no xl vai do 1º ao último nó (5 colunas, gap de 1rem) */}
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[21px] top-[72px] w-[2px] rounded-full [mask-image:linear-gradient(180deg,#000_80%,transparent)] xl:[mask-image:none] bg-[linear-gradient(180deg,var(--ba-wine)_0%,#6d2350_30%,var(--ba-blue-2)_62%,var(--ba-blue)_100%)] opacity-35 xl:bottom-auto xl:left-[22px] xl:right-[calc((100%_-_4rem)/5_-_22px)] xl:top-[21px] xl:h-[2px] xl:w-auto xl:bg-[linear-gradient(90deg,var(--ba-wine)_0%,#6d2350_40%,var(--ba-blue-2)_62%,var(--ba-blue)_100%)]"
          />

          {JOURNEY_STEPS.map((step, index) => {
            const isLast = index === lastIndex;
            const startsPhase = index === 0 || JOURNEY_STEPS[index - 1].phase !== step.phase;
            return (
              <li key={step.key} className="ba-rv relative grid grid-cols-[44px_minmax(0,1fr)] gap-x-4 xl:grid-cols-1 xl:grid-rows-[auto_1fr] xl:gap-y-5" style={delay(index + 1)}>
                {startsPhase && (
                  <div className={`col-start-2 mb-1 xl:hidden ${index > 0 ? "mt-4" : ""}`}>
                    <PhasePill phase={step.phase} lang={lang} />
                  </div>
                )}
                <span
                  className={`relative z-[1] col-start-1 mt-4 grid h-11 w-11 place-items-center rounded-full font-[family-name:var(--ba-display)] text-[13px] font-bold xl:mt-0 ${
                    isLast
                      ? "bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))] text-white shadow-[0_0_0_6px_rgba(144,36,52,0.1),inset_0_1px_0_rgba(255,255,255,0.35)]"
                      : "ba-glass text-[var(--ba-blue)] shadow-[0_0_0_6px_rgba(31,63,163,0.06),var(--ba-shadow-sm)]"
                  }`}
                  aria-hidden="true"
                >
                  0{index + 1}
                </span>

                <article
                  /* lg (1024–1279): cartão largo em duas colunas (marcador e título | texto), para a linha não passar de ~70 caracteres */
                  className={`col-start-2 flex flex-col rounded-[24px] p-5 sm:rounded-[26px] sm:p-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-x-10 lg:p-7 xl:col-start-1 xl:flex xl:h-full xl:p-5 ${
                    isLast
                      ? "relative overflow-hidden text-white shadow-[var(--ba-shadow-lg),inset_0_1px_0_rgba(255,255,255,0.18)] [background:radial-gradient(110%_80%_at_100%_0%,rgba(71,107,192,0.7)_0%,rgba(71,107,192,0)_58%),radial-gradient(90%_70%_at_0%_100%,rgba(144,36,52,0.6)_0%,rgba(144,36,52,0)_60%),linear-gradient(160deg,#13296b,var(--ba-navy-2))]"
                      : "ba-glass"
                  }`}
                >
                  <span className="sr-only">
                    {pick(JOURNEY.stepLabel, lang)} {index + 1}:
                  </span>
                  <span
                    className={`self-start rounded-full px-2.5 py-1 text-[11.5px] font-semibold lg:col-start-1 lg:row-start-1 lg:justify-self-start ${
                      isLast
                        ? "bg-white/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]"
                        : "bg-[rgba(31,63,163,0.07)] text-[var(--ba-blue)] shadow-[inset_0_0_0_1px_rgba(31,63,163,0.1)]"
                    }`}
                  >
                    {pick(step.marker, lang)}
                  </span>
                  <h3 className={`ba-h3 mt-4 text-[clamp(20px,1.7vw,22px)] lg:col-start-1 lg:row-start-2 lg:mt-3 xl:mt-4 ${isLast ? "" : "text-[var(--ba-navy)]"}`}>{pick(step.title, lang)}</h3>
                  <p className={`mb-0 mt-2.5 text-[15px] leading-[1.55] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0 xl:mt-2.5 ${isLast ? "text-white/[0.86]" : "text-[var(--ba-ink-2)]"}`}>{pick(step.body, lang)}</p>
                  {step.link && (
                    <Link
                      href={step.link.href}
                      className={`group -mb-2 mt-auto inline-flex min-h-11 items-center gap-1.5 self-start whitespace-nowrap pt-3 text-[14px] font-semibold transition-colors lg:col-start-2 lg:row-start-3 lg:justify-self-start ${
                        isLast ? "text-[#cfdcff] hover:text-white" : "text-[var(--ba-blue)] hover:text-[var(--ba-navy)]"
                      }`}
                    >
                      {pick(step.link.label, lang)}
                      <ArrowRight className="h-4 w-4 transition-transform duration-500 [transition-timing-function:var(--ba-ease)] group-hover:translate-x-1" aria-hidden="true" />
                    </Link>
                  )}
                </article>
              </li>
            );
          })}
        </ol>

        {/* Fio que atravessa todas as etapas: a presença da equipe */}
        <div className="ba-glass ba-rv mt-4 flex items-start gap-3.5 rounded-[24px] p-5 sm:mt-5 sm:items-center sm:gap-4 sm:rounded-full sm:px-6 sm:py-4" style={delay(2)}>
          <span className="ba-pulse mt-1.5 sm:mt-0" aria-hidden="true" />
          <p className="m-0 text-[15px] leading-[1.5] text-[var(--ba-ink-2)]">
            <strong className="font-semibold text-[var(--ba-navy)]">{pick(JOURNEY.trackingTitle, lang)}.</strong> {pick(JOURNEY.trackingBody, lang)}
          </p>
        </div>
      </div>
    </section>
  );
}
