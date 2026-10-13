import { GraduationCap, School, type LucideIcon } from "lucide-react";

import { ESCOLAS_TEXT, SCHOOL_TOURS, toursByType, type SchoolTour } from "@/content/escolas";
import { pick, type Localized, type SchoolType } from "@/content/types";
import type { Lang } from "@/i18n";

import TourCard, { type TourCardWide } from "./TourCard";
import TourFilter from "./TourFilter";

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

interface TourGroupProps {
  type: SchoolType;
  title: Localized;
  note: Localized;
  icon: LucideIcon;
  tours: SchoolTour[];
  lang: Lang;
}

// O grupo some quando o filtro escolhe o outro tipo; @starting-style faz o que volta entrar com fade
const HIDE_WHEN: Record<SchoolType, string> = {
  high_school: "group-data-[filter=universidade]/tours:hidden",
  universidade: "group-data-[filter=high-school]/tours:hidden",
};

const SPAN_CLASS: Record<TourCardWide, string> = { sm: "sm:col-span-2", lg: "lg:col-span-2" };

/**
 * Quais cards ficam largos para nenhuma fileira sobrar com um card só: na grade de 2
 * colunas o primeiro fica largo quando o total é ímpar; na de 3, o primeiro e, se
 * preciso, o último completam a conta.
 */
function wideCards(count: number): Map<number, TourCardWide> {
  const wide = new Map<number, TourCardWide>();
  const extraForThree = (3 - (count % 3)) % 3;
  const firstWideOnTwo = count % 2 === 1;
  const firstWideOnThree = extraForThree >= 1;
  // Largo a partir do sm vale também no lg; o primeiro só pode ser largo nos dois ou só no lg
  if (firstWideOnTwo && firstWideOnThree) wide.set(0, "sm");
  else if (firstWideOnThree) wide.set(0, "lg");
  if (extraForThree === 2 && count > 1) wide.set(count - 1, "lg");
  return wide;
}

function TourGroup({ type, title, note, icon: Icon, tours, lang }: TourGroupProps) {
  const headingId = `grupo-${type}`;
  const wide = wideCards(tours.length);

  return (
    <section
      aria-labelledby={headingId}
      className={`transition-opacity duration-500 starting:opacity-0 [&+&]:mt-[clamp(48px,6vw,80px)] group-data-[filter=high-school]/tours:!mt-0 group-data-[filter=universidade]/tours:!mt-0 ${HIDE_WHEN[type]}`}
    >
      <div className="ba-rv mb-5 flex items-center gap-3 sm:mb-7 sm:gap-4">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[linear-gradient(150deg,#3d61c8,var(--ba-blue))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_22px_-10px_rgba(31,63,163,0.7)] sm:h-11 sm:w-11 sm:rounded-[14px]">
          <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 id={headingId} className="ba-h3 flex items-baseline gap-2.5 whitespace-nowrap text-[21px] text-[var(--ba-navy)] sm:text-[25px]">
            {pick(title, lang)}
            {/* "07" é ornamento; a lista logo abaixo já anuncia quantos itens tem */}
            <span aria-hidden="true" className="font-[family-name:var(--ba-body)] text-[12px] font-bold tracking-[0.14em] text-[var(--ba-ink-3)]">
              {String(tours.length).padStart(2, "0")}
            </span>
          </h3>
          <p className="mt-0.5 truncate text-[13px] font-medium text-[var(--ba-ink-3)]">{pick(note, lang)}</p>
        </div>
        <span aria-hidden="true" className="hidden h-px flex-1 bg-[linear-gradient(90deg,var(--ba-stroke),rgba(31,63,163,0))] sm:block" />
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        {tours.map((tour, index) => {
          const cardWide = wide.get(index);
          return (
            <li key={tour.school.slug} className={cardWide ? SPAN_CLASS[cardWide] : undefined}>
              <TourCard tour={tour} lang={lang} index={index} wide={cardWide} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Acervo completo de tours, agrupado por etapa da jornada, com filtro segmentado. */
export default function ToursSection({ lang }: { lang: Lang }) {
  const highSchools = toursByType("high_school");
  const universities = toursByType("universidade");

  return (
    <section id="tours" className="relative isolate scroll-mt-24 py-[clamp(64px,8vw,120px)]" aria-labelledby="tours-title">
      <div aria-hidden="true" className="ba-glow left-[-12%] top-[8%] -z-[1] h-[480px] w-[480px] bg-[rgba(169,192,242,0.45)]" />
      <div aria-hidden="true" className="ba-glow right-[-10%] top-[46%] -z-[1] h-[420px] w-[420px] bg-[rgba(184,54,74,0.12)]" />

      <div className="ba-wrap">
        <div className="mb-[clamp(28px,4vw,44px)] flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="max-w-[640px]">
            <span className="ba-eyebrow ba-glass ba-rv">
              <span className="ba-dot" />
              {pick(ESCOLAS_TEXT.toursEyebrow, lang)}
            </span>
            <h2 id="tours-title" className="ba-h2 ba-rv mt-5 text-[clamp(32px,4.6vw,58px)] text-[var(--ba-navy)]" style={delay(1)}>
              {pick(ESCOLAS_TEXT.toursTitle, lang)} <span className="ba-serif ba-grad-text text-[1.1em]">{pick(ESCOLAS_TEXT.toursTitleAccent, lang)}</span>
            </h2>
            <p className="ba-lead ba-rv mt-4" style={delay(2)}>
              {pick(ESCOLAS_TEXT.toursLead, lang)}
            </p>
          </div>
        </div>

        <TourFilter counts={{ all: SCHOOL_TOURS.length, high_school: highSchools.length, universidade: universities.length }}>
          <TourGroup
            type="high_school"
            title={ESCOLAS_TEXT.groupHighSchools}
            note={ESCOLAS_TEXT.groupHighSchoolsNote}
            icon={School}
            tours={highSchools}
            lang={lang}
          />
          <TourGroup
            type="universidade"
            title={ESCOLAS_TEXT.groupUniversities}
            note={ESCOLAS_TEXT.groupUniversitiesNote}
            icon={GraduationCap}
            tours={universities}
            lang={lang}
          />
        </TourFilter>
      </div>
    </section>
  );
}
