import type { StaticImageData } from "next/image";

import leandroHarvard from "@/assets/leandro-harvard.jpg";
import thumbHolyCross from "@/assets/thumb-holyCross.jpg";
import thumbTaft from "@/assets/thumb-Taft.jpg";
import type { Lang } from "@/i18n";
import { routing } from "@/i18n/routing";

import { SCHOOLS } from "./schools";
import type { Localized, School, SchoolType, YoutubeVideo } from "./types";
import { getVideo, TOUR_VIDEOS } from "./videos";

/*
 * Conteúdo da página /escolas e do teaser de tours da home. Fatos vêm de schools.ts e
 * videos.ts; aqui ficam só os textos de interface, a curadoria (pôsteres, destaques) e
 * as ligações entre escola e tour.
 */

export function toLang(locale: string): Lang {
  return (routing.locales as readonly string[]).includes(locale) ? (locale as Lang) : "pt";
}

/** Troca {chave} pelo valor: os números da página saem do catálogo, nunca do texto. */
export function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** "mm:ss" para exibir o minuto do capítulo. */
export function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// ─── Escola + tour ────────────────────────────────────────────────────────────

export interface SchoolTour {
  school: School;
  video: YoutubeVideo;
}

// Só entra quem tem tour no catálogo: o card sem vídeo não teria o que mostrar
export const SCHOOL_TOURS: SchoolTour[] = SCHOOLS.flatMap((school) => {
  const video = school.tourVideoId ? getVideo(school.tourVideoId) : undefined;
  return video ? [{ school, video }] : [];
});

const TOURS_BY_SLUG = new Map(SCHOOL_TOURS.map((tour) => [tour.school.slug, tour]));

export function getSchoolTour(slug: string): SchoolTour | undefined {
  return TOURS_BY_SLUG.get(slug);
}

export function toursByType(type: SchoolType): SchoolTour[] {
  return SCHOOL_TOURS.filter((tour) => tour.school.type === type);
}

/** Tour publicado por último: ganha o selo "mais recente" e abre a página. */
export const LATEST_TOUR_ID = [...TOUR_VIDEOS].sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""))[0]?.id;

// ─── Pôsteres ─────────────────────────────────────────────────────────────────

type YoutubeFrame = "maxres1" | "maxres2" | "maxres3" | "hq720";

/**
 * Quadro do próprio vídeo como pôster. A capa oficial do canal tem o título queimado na
 * arte, que brigava com o título sobreposto do card; os quadros maxres1-3 que o YouTube
 * gera são 1280x720 limpos. O formato de StaticImageData deixa o mesmo pôster servir ao
 * VideoCard e ao next/image (i.ytimg.com já está liberado no next.config).
 */
function youtubeFrame(id: string, frame: YoutubeFrame): StaticImageData {
  return { src: `https://i.ytimg.com/vi/${id}/${frame}.jpg`, width: 1280, height: 720 };
}

interface TourPoster {
  image: StaticImageData;
  /** object-position quando o recorte livre (home) corta rostos. */
  position?: string;
}

// Curadoria quadro a quadro: sem legenda queimada, sem imagem de terceiros e com gente da casa ou do programa
const TOUR_POSTERS: Record<string, TourPoster> = {
  montverde: { image: youtubeFrame("qCeneZf3KgM", "maxres3") },
  hotchkiss: { image: youtubeFrame("maZ2lIeo5EE", "maxres1"), position: "50% 30%" },
  "img-academy": { image: youtubeFrame("zlJ3WUHY_BI", "maxres1") },
  benfica: { image: youtubeFrame("Byr7E1W8JSk", "maxres3") },
  harvard: { image: leandroHarvard, position: "50% 30%" },
  florida: { image: youtubeFrame("gpT0gG8nK6U", "maxres2") },
  miami: { image: youtubeFrame("gvcUVL0j_eQ", "maxres2") },
  fiu: { image: youtubeFrame("t2-hpjOVjNQ", "maxres1") },
  taft: { image: thumbTaft, position: "50% 35%" },
  rps: { image: youtubeFrame("VLnk65O91Pg", "maxres1") },
  jacksonville: { image: youtubeFrame("2CTSgmKx0-U", "hq720") },
  fgcu: { image: youtubeFrame("-16QtoD5eis", "hq720") },
  unf: { image: youtubeFrame("IcazwAYhDSk", "hq720") },
  ucf: { image: youtubeFrame("TEvAVEOA28w", "maxres2") },
  flagler: { image: youtubeFrame("MAMzOtT6LaY", "hq720") },
  "holy-cross": { image: thumbHolyCross, position: "50% 40%" },
  // Biblioteca do campus: o maxres1 tinha estouro de luz rosa e um aluno que pode ser menor
  "vermont-academy": { image: youtubeFrame("pG9mk__UxiA", "maxres3") },
  clark: { image: youtubeFrame("Lv-aZmKtc10", "maxres1") },
};

export function getTourPoster(slug: string): TourPoster | undefined {
  return TOUR_POSTERS[slug];
}

// Trechos do mesmo tour no trilho "Ouça quem decide" ganham quadros diferentes, para o trilho não repetir a foto
const MOMENT_POSTERS: Record<string, TourPoster> = {
  "2CTSgmKx0-U@180": { image: youtubeFrame("2CTSgmKx0-U", "maxres2") },
  "2CTSgmKx0-U@300": { image: youtubeFrame("2CTSgmKx0-U", "maxres3") },
};

export function getMomentPoster(videoId: string, start: number): TourPoster | undefined {
  return MOMENT_POSTERS[`${videoId}@${start}`];
}

// ─── Marca da escola (logo ou monograma) ──────────────────────────────────────

/** Sigla para as escolas sem logo em src/assets/academys (como os próprios programas se apresentam). */
const MONOGRAMS: Record<string, string> = {
  florida: "UF",
  fiu: "FIU",
  rps: "RPS",
  jacksonville: "JU",
  fgcu: "FGCU",
  unf: "UNF",
  ucf: "UCF",
  flagler: "FC",
  "holy-cross": "HC",
  clark: "CU",
};

/** Logos com muito respiro no arquivo: ampliados para ler no mesmo tamanho dos outros. */
const LOGO_ZOOM: Record<string, number> = {
  harvard: 1.15,
  miami: 1.2,
};

export function getMonogram(school: School): string {
  return MONOGRAMS[school.slug] ?? school.name.replace(/[^A-Z]/g, "").slice(0, 3);
}

export function getLogoZoom(slug: string): number {
  return LOGO_ZOOM[slug] ?? 1;
}

// ─── Destaque da página (tour da Montverde) ───────────────────────────────────

export interface FeaturedChapter {
  start: number;
  label: Localized;
}

function chapterAt(video: YoutubeVideo, timestamp: string, label?: Localized): FeaturedChapter {
  const [minutes, seconds] = timestamp.split(":").map(Number);
  const start = minutes * 60 + seconds;
  const chapter = video.chapters?.find((item) => item.start === start);
  // Capítulo que não existe no catálogo quebra no import, nunca vira botão que abre o minuto errado
  if (!chapter) throw new Error(`Capítulo inexistente no tour em destaque: ${video.id} @ ${timestamp}`);
  return { start, label: label ?? chapter.label };
}

const FEATURED_VIDEO_ID = "qCeneZf3KgM";
const featuredVideo = getVideo(FEATURED_VIDEO_ID);
if (!featuredVideo?.school) throw new Error(`Tour em destaque fora do catálogo: ${FEATURED_VIDEO_ID}`);

export const FEATURED_TOUR = {
  slug: featuredVideo.school,
  video: featuredVideo,
  // 00:55 e 23:18 ficam no trilho "Ouça quem decide"; aqui, o que só a Montverde mostra
  chapters: [
    chapterAt(featuredVideo, "04:52", {
      pt: "Leonardo, atleta Bolsa Atleta USA na Montverde",
      en: "Leonardo, a Bolsa Atleta USA athlete at Montverde",
      es: "Leonardo, atleta de Bolsa Atleta USA en Montverde",
    }),
    chapterAt(featuredVideo, "09:20"),
    chapterAt(featuredVideo, "19:54", {
      pt: "Aprovados em Duke, Harvard, UCLA, MIT e Cornell",
      en: "Admitted to Duke, Harvard, UCLA, MIT and Cornell",
      es: "Admitidos en Duke, Harvard, UCLA, MIT y Cornell",
    }),
    chapterAt(featuredVideo, "24:02", {
      pt: "Isadora Santiago conta a experiência dela",
      en: "Isadora Santiago shares her experience",
      es: "Isadora Santiago cuenta su experiencia",
    }),
  ],
};

// ─── Teaser da home ───────────────────────────────────────────────────────────

function toursFor(slugs: string[]): SchoolTour[] {
  return slugs.map((slug) => {
    const tour = getSchoolTour(slug);
    if (!tour) throw new Error(`Escola sem tour no teaser da home: ${slug}`);
    return tour;
  });
}

// Ordem de curadoria do plano: o mais recente abre, Hotchkiss (o mais assistido) logo depois
export const HOME_HIGH_SCHOOL_TOURS = toursFor(["montverde", "hotchkiss", "img-academy", "benfica", "taft", "rps"]);
export const HOME_UNIVERSITY_TOURS = toursFor(["harvard", "florida", "miami", "fiu"]);

/** Quantos trechos do trilho "Ouça quem decide" entram na home (os primeiros do COACH_MOMENTS). */
export const HOME_MOMENTS_COUNT = 3;

// ─── Textos ───────────────────────────────────────────────────────────────────

export const ESCOLAS_TEXT = {
  breadcrumbHome: { pt: "Início", en: "Home", es: "Inicio" },
  breadcrumbCurrent: { pt: "Escolas", en: "Schools", es: "Escuelas" },

  heroEyebrow: { pt: "Tours exclusivos em vídeo", en: "Exclusive video tours", es: "Tours exclusivos en video" },
  heroTitle: { pt: "Por dentro das escolas e", en: "Inside the schools and", es: "Por dentro de las escuelas y" },
  heroTitleAccent: { pt: "universidades", en: "universities", es: "universidades" },
  // Atleta não decide admissão: "quem decide" fica para a faixa dos treinadores
  heroLead: {
    pt: "Visitamos high schools e universidades nos Estados Unidos e conversamos com treinadores, diretores e atletas. São {n} tours em vídeo para a sua família conhecer cada lugar por dentro antes de escolher.",
    en: "We visit high schools and universities across the United States and talk with coaches, directors and athletes. Here are {n} video tours so your family can see each place from the inside before choosing.",
    es: "Visitamos high schools y universidades en Estados Unidos y conversamos con entrenadores, directores y atletas. Son {n} tours en video para que tu familia conozca cada lugar por dentro antes de elegir.",
  },
  heroToursCta: { pt: "Ver os {n} tours", en: "See all {n} tours", es: "Ver los {n} tours" },
  heroApplyCta: { pt: "Iniciar avaliação", en: "Start your evaluation", es: "Iniciar evaluación" },

  latestBadge: { pt: "Tour mais recente", en: "Latest tour", es: "Tour más reciente" },
  latestShort: { pt: "Novo", en: "New", es: "Nuevo" },
  chaptersLabel: { pt: "Vá direto ao momento", en: "Jump to a moment", es: "Ve directo al momento" },
  chaptersCount: { pt: "{n} capítulos", en: "{n} chapters", es: "{n} capítulos" },
  chapterAria: { pt: "Assistir a partir de {time}: {label}", en: "Watch from {time}: {label}", es: "Ver desde {time}: {label}" },
  // Plano de curadoria: todos os tours são narrados em português; quem lê em EN/ES precisa saber antes do play
  videoLanguage: { pt: "", en: "Video in Portuguese", es: "Video en portugués" },

  momentsEyebrow: { pt: "Direto da fonte", en: "Straight from the source", es: "Directo de la fuente" },
  momentsTitle: { pt: "Ouça quem", en: "Hear from the people who", es: "Escucha a quienes" },
  momentsTitleAccent: { pt: "decide", en: "decide", es: "deciden" },
  momentsLead: {
    pt: "Trechos em que treinadores e diretores falam direto com as famílias. Toque e o vídeo abre no minuto exato.",
    en: "Moments where coaches and directors speak directly to families. Tap and the video starts right at that point.",
    es: "Fragmentos en los que entrenadores y directores hablan directamente con las familias. Toca y el video se abre en el minuto exacto.",
  },
  momentsFromTour: { pt: "No tour pela escola", en: "From the school tour", es: "En el tour por la escuela" },
  momentAria: {
    pt: "{label} {who} Abre o tour da {school} em {time}",
    en: "{label} {who} Opens the {school} tour at {time}",
    es: "{label} {who} Abre el tour de {school} en {time}",
  },
  railPrev: { pt: "Trechos anteriores", en: "Previous moments", es: "Fragmentos anteriores" },
  railNext: { pt: "Próximos trechos", en: "Next moments", es: "Siguientes fragmentos" },

  toursEyebrow: { pt: "O acervo completo", en: "The full library", es: "El archivo completo" },
  toursTitle: { pt: "Escolha por onde", en: "Choose where to", es: "Elige por dónde" },
  toursTitleAccent: { pt: "começar", en: "start", es: "empezar" },
  toursLead: {
    pt: "Filtre pela etapa da jornada. Cada tour mostra o campus, a estrutura esportiva e a rotina de quem vive ali.",
    en: "Filter by stage of the journey. Each tour shows the campus, the athletic facilities and daily life there.",
    es: "Filtra por etapa del camino. Cada tour muestra el campus, la estructura deportiva y la rutina de quienes viven allí.",
  },
  filterLabel: { pt: "Filtrar tours por etapa", en: "Filter tours by stage", es: "Filtrar tours por etapa" },
  filterAll: { pt: "Todos", en: "All", es: "Todos" },
  filterHighSchools: { pt: "High Schools", en: "High Schools", es: "High Schools" },
  filterUniversities: { pt: "Universidades", en: "Universities", es: "Universidades" },
  filterStatus: { pt: "Mostrando {n} tours", en: "Showing {n} tours", es: "Mostrando {n} tours" },
  groupHighSchools: { pt: "High Schools", en: "High Schools", es: "High Schools" },
  groupHighSchoolsNote: {
    pt: "Boarding schools e academias esportivas",
    en: "Boarding schools and sports academies",
    es: "Internados y academias deportivas",
  },
  groupUniversities: { pt: "Universidades", en: "Universities", es: "Universidades" },
  groupUniversitiesNote: { pt: "Programas NCAA D1, D2 e D3", en: "NCAA D1, D2 and D3 programs", es: "Programas NCAA D1, D2 y D3" },

  beforeEyebrow: { pt: "Antes de escolher", en: "Before you choose", es: "Antes de elegir" },
  beforeTitle: { pt: "A escola mais famosa nem sempre é a escola", en: "The most famous school isn't always the", es: "La escuela más famosa no siempre es la escuela" },
  beforeTitleAccent: { pt: "certa", en: "right one", es: "correcta" },
  beforeBody: {
    pt: "O tour mostra o lugar. O Método S.A.F.E.® mostra se ele faz sentido para o atleta, para a família e para o projeto de vida.",
    en: "A tour shows you the place. The S.A.F.E. Method® shows whether it makes sense for the athlete, the family and their life project.",
    es: "El tour muestra el lugar. El Método S.A.F.E.® muestra si tiene sentido para el atleta, para la familia y para su proyecto de vida.",
  },
  beforeMethodCta: { pt: "Conheça o método", en: "Explore the method", es: "Conoce el método" },
  beforeWatch: { pt: "Assista antes de decidir", en: "Watch before deciding", es: "Mira antes de decidir" },

  homeAllTours: { pt: "Ver todos os {n} tours", en: "See all {n} tours", es: "Ver los {n} tours" },
  homeAllToursNote: {
    pt: "{hs} high schools e {uni} universidades, cada uma vista por dentro.",
    en: "{hs} high schools and {uni} universities, each one seen from the inside.",
    es: "{hs} high schools y {uni} universidades, cada una vista por dentro.",
  },
  homeMomentsTitle: { pt: "Ouça quem decide", en: "Hear from the people who decide", es: "Escucha a quienes deciden" },
  watchTour: { pt: "Assistir ao tour", en: "Watch the tour", es: "Ver el tour" },
  marqueeWatch: { pt: "Assistir ao tour: {name}", en: "Watch the tour: {name}", es: "Ver el tour: {name}" },
} satisfies Record<string, Localized>;

/** Vídeos curtos do fundador que respondem "qual escola?" (fecho da página). */
export const BEFORE_CHOOSING_VIDEOS: { id: string; label: Localized }[] = [
  {
    id: "VfmQ2LGCKpw",
    label: { pt: "A escola mais famosa é a certa?", en: "Is the most famous school the right one?", es: "¿La escuela más famosa es la correcta?" },
  },
  {
    id: "JJOHwplQ51I",
    label: { pt: "Os 4 tipos de bolsa nas high schools", en: "4 kinds of high school scholarships", es: "Los 4 tipos de beca en las high schools" },
  },
  {
    id: "Ke-LTSF8Hes",
    label: { pt: "Qual a idade ideal para ir?", en: "What's the ideal age to go?", es: "¿Cuál es la edad ideal para ir?" },
  },
];

for (const { id } of BEFORE_CHOOSING_VIDEOS) {
  if (!getVideo(id)) throw new Error(`Vídeo do fecho de /escolas fora do catálogo: ${id}`);
}
