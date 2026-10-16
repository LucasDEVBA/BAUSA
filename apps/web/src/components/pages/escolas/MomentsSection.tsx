import { ESCOLAS_TEXT } from "@/content/escolas";
import { pick } from "@/content/types";
import { COACH_MOMENTS } from "@/content/videos";
import type { Lang } from "@/i18n";

import CoachMoments from "./CoachMoments";

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

/** Faixa escura logo após a abertura: treinadores e diretores falando direto com as famílias. */
export default function MomentsSection({ lang }: { lang: Lang }) {
  const titleAccent = pick(ESCOLAS_TEXT.momentsTitleAccent, lang);

  return (
    <section
      className="ba-dark relative isolate overflow-hidden rounded-[clamp(28px,4vw,48px)] py-[clamp(64px,8vw,112px)]"
      aria-labelledby="ouca-quem-decide"
    >
      <div aria-hidden="true" className="ba-glow left-[-180px] top-[-160px] h-[520px] w-[520px] animate-[ba-drift1_30s_ease-in-out_infinite_alternate] bg-[rgba(71,107,192,0.5)]" />
      <div aria-hidden="true" className="ba-glow bottom-[-200px] right-[-160px] h-[520px] w-[520px] animate-[ba-drift3_34s_ease-in-out_infinite_alternate] bg-[rgba(144,36,52,0.45)]" />
      <div aria-hidden="true" className="ba-lines" />

      <div className="ba-wrap relative z-[2]">
        <div className="mb-[clamp(28px,4vw,48px)] grid items-end gap-5 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div>
            <span className="ba-eyebrow ba-glass-dark ba-rv !text-[#cfdcff]">
              <span className="ba-dot" />
              {pick(ESCOLAS_TEXT.momentsEyebrow, lang)}
            </span>
            <h2 id="ouca-quem-decide" className="ba-h2 ba-rv mt-5 text-[clamp(32px,4.6vw,58px)] text-white" style={delay(1)}>
              {pick(ESCOLAS_TEXT.momentsTitle, lang)} <span className="ba-serif ba-grad-text-dark text-[1.1em]">{titleAccent}</span>
            </h2>
          </div>
          <p
            className="ba-rv max-w-[460px] text-[clamp(15.5px,1.25vw,18px)] leading-[1.6] text-[rgba(232,238,255,0.84)] lg:mb-2 lg:border-l lg:border-white/[0.14] lg:pl-8"
            style={delay(2)}
          >
            {pick(ESCOLAS_TEXT.momentsLead, lang)}
          </p>
        </div>

        <div className="ba-rv" style={delay(2)}>
          <CoachMoments moments={COACH_MOMENTS} label={`${pick(ESCOLAS_TEXT.momentsTitle, lang)} ${titleAccent}`} />
        </div>
      </div>
    </section>
  );
}
