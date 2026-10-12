import type { StaticImageData } from "next/image";

import type { Lang } from "@/i18n";

/** Texto nos três idiomas do site. Conteúdo das páginas fica fora do dicionário global. */
export type Localized = Record<Lang, string>;

export type VideoKind = "video" | "short";

export type VideoCategory =
  | "depoimento_atleta"
  | "depoimento_familia"
  | "tour_instituicao"
  | "fundador_conteudo"
  | "institucional";

export interface VideoChapter {
  /** Segundo de início, usado no parâmetro start= do embed. */
  start: number;
  label: Localized;
}

export interface YoutubeVideo {
  id: string;
  kind: VideoKind;
  category: VideoCategory;
  /** Título limpo para o site (sem erros de digitação do canal). */
  title: Localized;
  /** Duração como exibida (ex.: "3:28"). */
  duration: string;
  /** ISO yyyy-mm-dd, aproximado pela data relativa do canal. */
  published?: string;
  /** Slug da instituição em src/content/schools.ts, quando for tour. */
  school?: string;
  /** Pessoas citadas no título/descrição (como publicadas). */
  people?: string[];
  chapters?: VideoChapter[];
}

export type SchoolType = "high_school" | "universidade";

export interface School {
  slug: string;
  name: string;
  type: SchoolType;
  /** Ex.: "NCAA D1 · ACC", "MLS NEXT · ECNL". */
  league?: string;
  location: string;
  /** Vídeo do tour no YouTube. */
  tourVideoId?: string;
  /** Logo em src/assets/academys, quando existir. */
  logo?: StaticImageData;
  /** 2 ou 3 fatos curtos, só o que está nos títulos/descrições do tour. */
  facts: Localized[];
}

export interface AthleteStory {
  slug: string;
  name: string;
  /** Ex.: "Goleira", "Atacante". */
  position?: Localized;
  school: string;
  /** Conquista/headline principal, só o que foi publicado. */
  headline: Localized;
  image: StaticImageData;
  imageAlt: Localized;
  /** Short/vídeo do YouTube com depoimento ou anúncio. */
  videoId?: string;
  videoKind?: VideoKind;
  /** Post de origem no Instagram (link externo). */
  instagram?: string;
  highlight?: boolean;
}

/** URL do pôster do YouTube: hq720 (16:9) para vídeos e oar2 (9:16) para Shorts. */
export function youtubeThumb(id: string, kind: VideoKind): string {
  return `https://i.ytimg.com/vi/${id}/${kind === "short" ? "oar2" : "hq720"}.jpg`;
}
