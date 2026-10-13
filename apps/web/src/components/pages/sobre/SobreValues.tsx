import { ArrowRight, Compass, HeartHandshake, Scale, Users, type LucideIcon } from "lucide-react";

import MeshBackground from "@/components/brand/MeshBackground";
import { PAGE_PATH } from "@/config/routes";
import type { Lang } from "@/i18n";
import { Link } from "@/i18n/navigation";
import { SOBRE_METHOD_LINK, SOBRE_VALUES, SOBRE_VALUES_HEADER, type ValueIcon } from "@/content/sobre";
import { pick } from "@/content/types";

const ICONS: Record<ValueIcon, LucideIcon> = {
  human: HeartHandshake,
  compass: Compass,
  criteria: Scale,
  family: Users,
};

const CHIP_TONE: Record<ValueIcon, string> = {
  human: "",
  compass: "bg-[linear-gradient(150deg,#4a6dd0,var(--ba-blue)_60%,#172f7d)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_12px_24px_-10px_rgba(31,63,163,0.7)]",
  criteria: "bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine)_60%,#5e1621)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_12px_24px_-10px_rgba(144,36,52,0.7)]",
  family: "bg-[linear-gradient(150deg,#2b3f7d,var(--ba-navy)_60%,#081333)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_12px_24px_-10px_rgba(15,35,87,0.7)]",
};

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

interface SobreValuesProps {
  lang: Lang;
}

/** Valores: o que a marca não promete e o que ela entrega. */
export default function SobreValues({ lang }: SobreValuesProps) {
  const [featured, ...rest] = SOBRE_VALUES;
  const FeaturedIcon = ICONS[featured.icon];

  return (
    <section className="relative isolate overflow-hidden py-[clamp(72px,9vw,128px)]" aria-labelledby="valores-title">
      <MeshBackground blobs={["b2", "b4"]} className="[&_.ba-b2]:!opacity-40 [&_.ba-b4]:!opacity-70 [mask-image:linear-gradient(180deg,transparent,#000_16%,#000_84%,transparent)]" />

      <div className="ba-wrap relative z-[2]">
        <header className="max-w-[860px]">
          <span className="ba-eyebrow ba-glass ba-rv">
            <span className="ba-dot" />
            {pick(SOBRE_VALUES_HEADER.eyebrow, lang)}
          </span>
          <h2 id="valores-title" className="ba-h2 ba-rv mt-6 text-[var(--ba-navy)]" style={delay(1)}>
            {pick(SOBRE_VALUES_HEADER.titleLead, lang)}{" "}
            <span className="ba-serif ba-grad-text block text-[1.1em] leading-[1.04]">{pick(SOBRE_VALUES_HEADER.titleAccent, lang)}</span>
          </h2>
          <p className="ba-lead ba-rv mt-6 max-w-[640px]" style={delay(2)}>
            {pick(SOBRE_VALUES_HEADER.lead, lang)}
          </p>
        </header>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:mt-14 lg:grid-cols-12 lg:gap-5" role="list">
          <li className="ba-rv-scale lg:col-span-7 lg:row-span-3" style={delay(1)}>
            <article className="relative isolate flex h-full min-h-[340px] flex-col justify-between overflow-hidden rounded-[30px] p-7 text-white shadow-[0_40px_90px_-34px_rgba(15,35,87,0.6),inset_0_1px_0_rgba(255,255,255,0.18)] [background:radial-gradient(90%_70%_at_85%_0%,rgba(71,107,192,0.7)_0%,rgba(71,107,192,0)_60%),radial-gradient(80%_60%_at_0%_100%,rgba(144,36,52,0.6)_0%,rgba(144,36,52,0)_62%),linear-gradient(165deg,#13296b,var(--ba-navy-2))] sm:rounded-[34px] sm:p-10">
              <div aria-hidden="true" className="ba-lines -z-[1]" />
              {/* Três anéis concêntricos: esporte, educação e formação humana em torno do mesmo centro */}
              <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 -z-[1] sm:-right-16 sm:-top-16">
                <div className="relative h-[320px] w-[320px] animate-[spin_60s_linear_infinite] rounded-full border border-white/[0.1]">
                  <span className="absolute left-1/2 top-[-4px] h-2 w-2 -translate-x-1/2 rounded-full bg-[#f0b1bb] shadow-[0_0_14px_3px_rgba(240,177,187,0.6)]" />
                </div>
                <div className="absolute left-1/2 top-1/2 h-[220px] w-[220px] -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite_reverse] rounded-full border border-dashed border-white/[0.16]">
                  <span className="absolute bottom-[-4px] left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-[#b8caf7] shadow-[0_0_14px_3px_rgba(184,202,247,0.6)]" />
                </div>
                <div className="absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.2]" />
              </div>

              <div className="flex items-center gap-3">
                <span className="ba-glass-dark grid h-12 w-12 place-items-center rounded-[16px]">
                  <FeaturedIcon className="h-[22px] w-[22px] text-[#f0b1bb]" aria-hidden="true" />
                </span>
                <h3 className="m-0 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#cfdcff]">{pick(featured.title, lang)}</h3>
              </div>
              <p className="m-0 mt-16 max-w-[560px] font-[family-name:var(--ba-display)] text-[clamp(28px,3.4vw,46px)] font-semibold leading-[1.08] tracking-[-0.035em] sm:mt-24">
                {pick(featured.text, lang)}
              </p>
            </article>
          </li>

          {rest.map((value, index) => {
            const Icon = ICONS[value.icon];
            const isCriteria = value.icon === "criteria";
            return (
              <li key={value.icon} className="ba-rv lg:col-span-5" style={delay(2 + index)}>
                <article className="ba-glass flex h-full gap-4 rounded-[26px] !bg-white/[0.74] p-5 sm:rounded-[30px] sm:p-7" data-tilt>
                  <span className={`grid h-12 w-12 flex-none place-items-center rounded-[16px] text-white ${CHIP_TONE[value.icon]}`}>
                    <Icon className="h-[22px] w-[22px]" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="ba-h3 m-0 text-[18px] text-[var(--ba-navy)] sm:text-[20px]">{pick(value.title, lang)}</h3>
                    <p className="m-0 mt-2 text-[15px] leading-[1.6] text-[var(--ba-ink-2)]">{pick(value.text, lang)}</p>
                    {isCriteria && (
                      <Link
                        href={PAGE_PATH.metodo}
                        className="group mt-2 inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full text-[14.5px] font-semibold text-[var(--ba-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ba-blue-2)]"
                      >
                        {pick(SOBRE_METHOD_LINK, lang)}
                        <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
