import BrandCta from "@/components/brand/BrandCta";
import VideoChip from "@/components/brand/VideoChip";
import { BEFORE_CHOOSING_VIDEOS, ESCOLAS_TEXT } from "@/content/escolas";
import { pick } from "@/content/types";
import { getVideo } from "@/content/videos";
import { PAGE_PATH } from "@/config/routes";
import type { Lang } from "@/i18n";

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

/**
 * Fecho antes do CTA final: o tour mostra o lugar, o método decide se é o lugar certo.
 * Liga o acervo de tours ao /metodo e aos vídeos curtos do fundador sobre escolha de escola.
 */
export default function BeforeChoosing({ lang }: { lang: Lang }) {
  return (
    <section className="ba-wrap pb-[clamp(64px,8vw,112px)]" aria-labelledby="antes-de-escolher">
      <div className="ba-glass ba-rv-scale relative grid gap-8 overflow-hidden rounded-[30px] px-5 py-9 sm:rounded-[36px] sm:px-10 sm:py-12 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-14 lg:px-14 lg:py-14">
        <div aria-hidden="true" className="ba-glow right-[-120px] top-[-140px] h-[360px] w-[360px] bg-[rgba(169,192,242,0.55)]" />
        <div aria-hidden="true" className="ba-glow bottom-[-180px] left-[-120px] h-[340px] w-[340px] bg-[rgba(184,54,74,0.14)]" />

        <div className="relative">
          <span className="ba-eyebrow bg-white/70 shadow-[inset_0_0_0_1px_var(--ba-stroke)]">
            <span className="ba-dot" />
            {pick(ESCOLAS_TEXT.beforeEyebrow, lang)}
          </span>
          <h2 id="antes-de-escolher" className="ba-h2 mt-5 text-[clamp(28px,3.6vw,46px)] text-[var(--ba-navy)]">
            {pick(ESCOLAS_TEXT.beforeTitle, lang)} <span className="ba-serif ba-grad-text text-[1.1em]">{pick(ESCOLAS_TEXT.beforeTitleAccent, lang)}</span>
          </h2>
          <p className="ba-lead mt-4 max-w-[520px]">{pick(ESCOLAS_TEXT.beforeBody, lang)}</p>
          <div className="mt-7">
            <BrandCta href={PAGE_PATH.metodo} variant="ghost">
              {pick(ESCOLAS_TEXT.beforeMethodCta, lang)}
            </BrandCta>
          </div>
        </div>

        <div className="relative">
          <p className="mb-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-[var(--ba-blue)]">{pick(ESCOLAS_TEXT.beforeWatch, lang)}</p>
          {/* Mesma largura para os três: pílulas de tamanhos diferentes empilhadas pareciam desalinhadas */}
          <ul className="flex flex-col gap-2.5 lg:max-w-[440px]">
            {BEFORE_CHOOSING_VIDEOS.map(({ id, label }, index) => {
              const video = getVideo(id);
              if (!video) return null;
              return (
                <li key={id} className="ba-rv" style={delay(index + 1)}>
                  <VideoChip
                    id={id}
                    kind={video.kind}
                    label={pick(label, lang)}
                    title={pick(video.title, lang)}
                    duration={video.duration}
                    className="w-full"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
