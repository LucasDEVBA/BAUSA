import type { StaticImageData } from "next/image";

import athleteHelena from "@/assets/athlete-helena.png";
import athleteIsadora from "@/assets/athlete-isadora.jpeg";
import athleteJulia from "@/assets/athlete-julia.png";
import athleteLin from "@/assets/athlete-lin.jpeg";
import athleteLiz from "@/assets/athlete-liz.jpeg";
import athleteMatheus from "@/assets/athlete-matheus.png";
import athleteRobson from "@/assets/athlete-robson.jpeg";
import benjamin from "@/assets/benjamin.jpeg";
import andressaAnuncio from "@/assets/instagram/andressa-anuncio-capa.jpg";
import andressaCopa from "@/assets/instagram/andressa-copa-capa.jpg";
import andressaSaraConvocadas from "@/assets/instagram/andressa-sara-convocadas.jpg";
import bernardoAnuncio from "@/assets/instagram/bernardo-anuncio-capa.jpg";
import bernardoEmAcao1 from "@/assets/instagram/bernardo-em-acao-1.jpg";
import bernardoEmAcao2 from "@/assets/instagram/bernardo-em-acao-2.jpg";
import bernardoEmAcao3 from "@/assets/instagram/bernardo-em-acao-3.jpg";
import bernardoMediaDay1 from "@/assets/instagram/bernardo-media-day-1.jpg";
import bernardoMediaDay2 from "@/assets/instagram/bernardo-media-day-2.jpg";
import bernardoMediaDay3 from "@/assets/instagram/bernardo-media-day-3.jpg";
import bernardoSiAllAmerica from "@/assets/instagram/bernardo-si-all-america.jpg";

import type { AthleteStory, Localized, School, YoutubeVideo } from "./types";
import { getSchool } from "./schools";
import { getVideo } from "./videos";

/*
 * Atletas com material publicado (YouTube, Instagram ou pôster da marca). Headline só com o
 * que foi publicado; sem página individual nem schema Person (menores de idade).
 * Fora de propósito: "No. 1 goalkeeper in the nation" (alegação do post) e contagens
 * regressivas, que vencem.
 * Grafias com divergência entre fontes ficam em constante para trocar num lugar só:
 * Bertolucci (título do YouTube; Instagram e pôster grafam Bertoluci) e Lin Feng (YouTube;
 * o pôster grafa Li Feng).
 */
const BENJAMIN_NAME = "Benjamin Bertolucci";
const LIN_NAME = "Lin Feng";

const instagramPost = (shortcode: string) => `https://www.instagram.com/p/${shortcode}/`;

const GOALKEEPER_F: Localized = { pt: "Goleira", en: "Goalkeeper", es: "Portera" };
const GOALKEEPER_M: Localized = { pt: "Goleiro", en: "Goalkeeper", es: "Portero" };

// Pôsteres sem headline publicada recebem a única frase que todos sustentam
const houseAthleteAt = (school: string): Localized => ({
  pt: `Atleta Bolsa Atleta USA na ${school}`,
  en: `Bolsa Atleta USA athlete at ${school}`,
  es: `Atleta de Bolsa Atleta USA en ${school}`,
});

export const ATHLETES: AthleteStory[] = [
  {
    slug: "isadora-santiago",
    name: "Isadora Santiago",
    school: "Montverde Academy",
    headline: {
      pt: "Da Seleção Brasileira para a Montverde Academy",
      en: "From Brazil's national team to Montverde Academy",
      es: "De la Selección Brasileña a Montverde Academy",
    },
    image: athleteIsadora,
    imageAlt: {
      pt: "Isadora Santiago domina a bola em pôster da Bolsa Atleta USA",
      en: "Isadora Santiago controls the ball in a Bolsa Atleta USA poster",
      es: "Isadora Santiago controla el balón en un póster de Bolsa Atleta USA",
    },
    videoId: "P9QiMRW4dII",
    videoKind: "short",
  },
  {
    slug: "andressa-macedo",
    name: "Andressa Macedo",
    position: GOALKEEPER_F,
    school: "Life Prep Academy · FC Wichita",
    headline: {
      pt: "Convocada para a Copa do Mundo Feminina Sub-17 da FIFA",
      en: "Called up for the FIFA U-17 Women's World Cup",
      es: "Convocada a la Copa Mundial Femenina Sub-17 de la FIFA",
    },
    image: andressaCopa,
    imageAlt: {
      pt: "Andressa Macedo com o uniforme de goleira da Seleção Brasileira, na arte da Copa do Mundo Feminina Sub-17",
      en: "Andressa Macedo in Brazil's goalkeeper kit, in artwork for the U-17 Women's World Cup",
      es: "Andressa Macedo con el uniforme de portera de la Selección Brasileña, en el arte de la Copa Mundial Femenina Sub-17",
    },
    instagram: instagramPost("DeJbsDtqUxj"),
    highlight: true,
  },
  {
    slug: "sara-pedot",
    name: "Sara Pedot",
    school: "IMG Academy",
    headline: {
      pt: "Convocada para a Seleção Brasileira Sub-17",
      en: "Called up to Brazil's U-17 national team",
      es: "Convocada a la Selección Brasileña Sub-17",
    },
    image: andressaSaraConvocadas,
    imageAlt: {
      pt: "Sara Pedot e Andressa Macedo com as camisas da Seleção Brasileira na arte \"Convocadas\"",
      en: "Sara Pedot and Andressa Macedo in Brazil national team shirts, in the \"Called up\" artwork",
      es: "Sara Pedot y Andressa Macedo con las camisetas de la Selección Brasileña, en el arte \"Convocadas\"",
    },
    instagram: instagramPost("DdVCI-ItADo"),
  },
  {
    slug: "liz-valverde",
    name: "Liz Valverde",
    school: "Benfica Residential Academy",
    headline: {
      pt: "Do Coritinhas à Seleção Brasileira e ao Benfica",
      en: "From Coritinhas to Brazil's national team and Benfica",
      es: "Del Coritinhas a la Selección Brasileña y al Benfica",
    },
    image: athleteLiz,
    imageAlt: {
      pt: "Liz Valverde sorri com a camisa da Seleção Brasileira em pôster da Bolsa Atleta USA",
      en: "Liz Valverde smiles in a Brazil national team shirt in a Bolsa Atleta USA poster",
      es: "Liz Valverde sonríe con la camiseta de la Selección Brasileña en un póster de Bolsa Atleta USA",
    },
    videoId: "arIURGPP828",
    videoKind: "short",
  },
  {
    slug: "bernardo-herdy",
    name: "Bernardo Herdy",
    position: GOALKEEPER_M,
    school: "Hoosac School",
    headline: {
      pt: "Selecionado para o Preseason All-America da Sports Illustrated",
      en: "Named to Sports Illustrated's Preseason All-America team",
      es: "Seleccionado para el Preseason All-America de Sports Illustrated",
    },
    image: bernardoSiAllAmerica,
    imageAlt: {
      pt: "Bernardo Herdy na arte do Preseason All-America da Sports Illustrated",
      en: "Bernardo Herdy in the Sports Illustrated Preseason All-America artwork",
      es: "Bernardo Herdy en el arte del Preseason All-America de Sports Illustrated",
    },
    instagram: instagramPost("DdbWVTYxbu8"),
    highlight: true,
  },
  {
    slug: "benjamin-bertolucci",
    name: BENJAMIN_NAME,
    school: "SPIRE Academy",
    headline: {
      pt: "Estudante-atleta na SPIRE Academy, em Ohio",
      en: "Student-athlete at SPIRE Academy in Ohio",
      es: "Estudiante-atleta en SPIRE Academy, en Ohio",
    },
    image: benjamin,
    imageAlt: {
      pt: `${BENJAMIN_NAME} com a camisa da SPIRE Academy, apontando para o alto`,
      en: `${BENJAMIN_NAME} in a SPIRE Academy shirt, pointing upward`,
      es: `${BENJAMIN_NAME} con la camiseta de SPIRE Academy, señalando hacia arriba`,
    },
    videoId: "7iso2Aj0PuQ",
    videoKind: "short",
  },
  {
    slug: "robson-moraes",
    name: "Robson Moraes",
    position: GOALKEEPER_M,
    // Escola lida do pôster (escudo do SIMA, o instituto de futebol da Montverde Academy)
    school: "SIMA · Montverde Academy",
    headline: houseAthleteAt("Montverde Academy"),
    image: athleteRobson,
    imageAlt: {
      pt: "Robson Moraes, goleiro, em pôster da Bolsa Atleta USA com o escudo do SIMA",
      en: "Goalkeeper Robson Moraes in a Bolsa Atleta USA poster with the SIMA crest",
      es: "Robson Moraes, portero, en un póster de Bolsa Atleta USA con el escudo del SIMA",
    },
    videoId: "kzh_jb9rmWI",
    videoKind: "short",
  },
  {
    slug: "lin-feng",
    name: LIN_NAME,
    // Universidade lida do pôster (UMass Lowell, NCAA)
    school: "UMass Lowell",
    headline: {
      pt: "Atleta da UMass Lowell, na NCAA",
      en: "UMass Lowell athlete in the NCAA",
      es: "Atleta de UMass Lowell, en la NCAA",
    },
    image: athleteLin,
    imageAlt: {
      pt: `${LIN_NAME} conduz a bola com o uniforme da UMass Lowell`,
      en: `${LIN_NAME} dribbles in a UMass Lowell kit`,
      es: `${LIN_NAME} conduce el balón con el uniforme de UMass Lowell`,
    },
    videoId: "VzPQT-vdqbE",
    videoKind: "short",
  },
  {
    slug: "helena-gennaro",
    name: "Helena Gennaro",
    school: "SPIRE Academy",
    headline: houseAthleteAt("SPIRE Academy"),
    image: athleteHelena,
    imageAlt: {
      pt: "Helena Gennaro em ação com a bola em pôster da SPIRE Academy",
      en: "Helena Gennaro in action with the ball in a SPIRE Academy poster",
      es: "Helena Gennaro en acción con el balón en un póster de SPIRE Academy",
    },
  },
  {
    slug: "matheus-belcuo",
    name: "Matheus Belcuo",
    school: "Hoosac School",
    headline: houseAthleteAt("Hoosac School"),
    image: athleteMatheus,
    imageAlt: {
      pt: "Matheus Belcuo com o uniforme da Hoosac School em pôster da Bolsa Atleta USA",
      en: "Matheus Belcuo in a Hoosac School kit in a Bolsa Atleta USA poster",
      es: "Matheus Belcuo con el uniforme de Hoosac School en un póster de Bolsa Atleta USA",
    },
  },
  {
    slug: "julia-dinis",
    name: "Julia Dinis",
    school: "DME Academy",
    headline: houseAthleteAt("DME Academy"),
    image: athleteJulia,
    imageAlt: {
      pt: "Julia Dinis com o uniforme da DME Academy em pôster da Bolsa Atleta USA",
      en: "Julia Dinis in a DME Academy kit in a Bolsa Atleta USA poster",
      es: "Julia Dinis con el uniforme de DME Academy en un póster de Bolsa Atleta USA",
    },
  },
];

const ATHLETES_BY_SLUG = new Map(ATHLETES.map((athlete) => [athlete.slug, athlete]));

export function getAthlete(slug: string): AthleteStory | undefined {
  return ATHLETES_BY_SLUG.get(slug);
}

/** Conquistas com selo de terceiro (Seleção, Sports Illustrated): os cards em destaque. */
export const HIGHLIGHT_ATHLETES = ATHLETES.filter((athlete) => athlete.highlight);

/** Atletas com depoimento em vídeo (Short 9:16). */
export const ATHLETES_WITH_VIDEO = ATHLETES.filter((athlete) => athlete.videoId);

/**
 * Pôster local do Short de um atleta, para passar ao VideoCard. Obrigatório para Robson e
 * Lin: a capa deles no YouTube é só o logo da marca sobre fundo branco.
 */
export function getVideoPoster(videoId: string): StaticImageData | undefined {
  return ATHLETES.find((athlete) => athlete.videoId === videoId)?.image;
}

/* ─── Escola com tour no canal ("Conheça a escola") ─────────────────────────── */

const ATHLETE_TOUR: Record<string, { school: string; start?: number }> = {
  // 24:02 do tour: a própria Isadora conta a experiência na Montverde
  "isadora-santiago": { school: "montverde", start: 1442 },
  "robson-moraes": { school: "montverde" },
  "liz-valverde": { school: "benfica" },
  "sara-pedot": { school: "img-academy" },
};

export interface AthleteTour {
  school: School;
  video: YoutubeVideo;
  /** Segundo do capítulo em que o atleta aparece, quando houver. */
  start?: number;
}

export function getAthleteTour(slug: string): AthleteTour | undefined {
  const link = ATHLETE_TOUR[slug];
  const school = link ? getSchool(link.school) : undefined;
  const video = school?.tourVideoId ? getVideo(school.tourVideoId) : undefined;
  if (!link || !school || !video) return undefined;
  return { school, video, start: link.start };
}

/* ─── Peças do Instagram hospedadas no projeto (mural de conquistas) ─────────── */

export type InstagramPostKind = "conquista" | "anuncio" | "bastidores";

export interface InstagramPost {
  shortcode: string;
  kind: InstagramPostKind;
  /** Slugs de ATHLETES. */
  athletes: string[];
  title: Localized;
  image: StaticImageData;
  imageAlt: Localized;
  /** Demais fotos do carrossel, na ordem do post. */
  gallery?: StaticImageData[];
  url: string;
}

export const INSTAGRAM_POSTS: InstagramPost[] = [
  {
    shortcode: "DeJbsDtqUxj",
    kind: "conquista",
    athletes: ["andressa-macedo"],
    title: {
      pt: "Convocada para a Copa do Mundo Feminina Sub-17 da FIFA",
      en: "Called up for the FIFA U-17 Women's World Cup",
      es: "Convocada a la Copa Mundial Femenina Sub-17 de la FIFA",
    },
    image: andressaCopa,
    imageAlt: {
      pt: "Andressa Macedo com o uniforme de goleira da Seleção Brasileira, na arte da Copa do Mundo Feminina Sub-17",
      en: "Andressa Macedo in Brazil's goalkeeper kit, in artwork for the U-17 Women's World Cup",
      es: "Andressa Macedo con el uniforme de portera de la Selección Brasileña, en el arte de la Copa Mundial Femenina Sub-17",
    },
    url: instagramPost("DeJbsDtqUxj"),
  },
  {
    shortcode: "DdVCI-ItADo",
    kind: "conquista",
    athletes: ["andressa-macedo", "sara-pedot"],
    title: {
      pt: "Convocadas para a Seleção Brasileira Sub-17",
      en: "Called up to Brazil's U-17 national team",
      es: "Convocadas a la Selección Brasileña Sub-17",
    },
    image: andressaSaraConvocadas,
    imageAlt: {
      pt: "Sara Pedot e Andressa Macedo com as camisas da Seleção Brasileira na arte \"Convocadas\"",
      en: "Sara Pedot and Andressa Macedo in Brazil national team shirts, in the \"Called up\" artwork",
      es: "Sara Pedot y Andressa Macedo con las camisetas de la Selección Brasileña, en el arte \"Convocadas\"",
    },
    url: instagramPost("DdVCI-ItADo"),
  },
  {
    shortcode: "DdbWVTYxbu8",
    kind: "conquista",
    athletes: ["bernardo-herdy"],
    title: {
      pt: "Preseason All-America da Sports Illustrated",
      en: "Sports Illustrated Preseason All-America",
      es: "Preseason All-America de Sports Illustrated",
    },
    image: bernardoSiAllAmerica,
    imageAlt: {
      pt: "Bernardo Herdy na arte do Preseason All-America da Sports Illustrated",
      en: "Bernardo Herdy in the Sports Illustrated Preseason All-America artwork",
      es: "Bernardo Herdy en el arte del Preseason All-America de Sports Illustrated",
    },
    url: instagramPost("DdbWVTYxbu8"),
  },
  {
    shortcode: "Dd-CfSdjeJq",
    kind: "bastidores",
    athletes: ["bernardo-herdy"],
    title: {
      pt: "Media Day na Hoosac School",
      en: "Media Day at Hoosac School",
      es: "Media Day en Hoosac School",
    },
    image: bernardoMediaDay1,
    imageAlt: {
      pt: "Bernardo Herdy de uniforme de goleiro, com a bola no ombro, no painel da Hoosac School",
      en: "Bernardo Herdy in his goalkeeper kit, ball on his shoulder, in front of the Hoosac School backdrop",
      es: "Bernardo Herdy con el uniforme de portero y el balón al hombro, frente al panel de Hoosac School",
    },
    gallery: [bernardoMediaDay2, bernardoMediaDay3],
    url: instagramPost("Dd-CfSdjeJq"),
  },
  {
    shortcode: "DbMWlrgKRTB",
    kind: "anuncio",
    athletes: ["andressa-macedo"],
    title: {
      pt: "Rumo à Life Prep Academy e ao FC Wichita",
      en: "Headed to Life Prep Academy and FC Wichita",
      es: "Rumbo a Life Prep Academy y al FC Wichita",
    },
    image: andressaAnuncio,
    imageAlt: {
      pt: "Andressa Macedo com o uniforme de goleira da Seleção Brasileira na arte de anúncio da Bolsa Atleta USA",
      en: "Andressa Macedo in Brazil's goalkeeper kit in the Bolsa Atleta USA announcement artwork",
      es: "Andressa Macedo con el uniforme de portera de la Selección Brasileña en el arte de anuncio de Bolsa Atleta USA",
    },
    url: instagramPost("DbMWlrgKRTB"),
  },
  {
    shortcode: "DaiITAVK4xs",
    kind: "anuncio",
    athletes: ["bernardo-herdy"],
    title: {
      pt: "Da base do Vitória à Hoosac School",
      en: "From Vitória's youth academy to Hoosac School",
      es: "De las inferiores del Vitória a Hoosac School",
    },
    image: bernardoAnuncio,
    imageAlt: {
      pt: "Bernardo Herdy com o uniforme de goleiro da Hoosac School na arte de anúncio da Bolsa Atleta USA",
      en: "Bernardo Herdy in his Hoosac School goalkeeper kit in the Bolsa Atleta USA announcement artwork",
      es: "Bernardo Herdy con el uniforme de portero de Hoosac School en el arte de anuncio de Bolsa Atleta USA",
    },
    url: instagramPost("DaiITAVK4xs"),
  },
  {
    shortcode: "DeSzcIzjbV4",
    kind: "bastidores",
    athletes: ["bernardo-herdy"],
    title: {
      pt: "Em campo pela Hoosac School",
      en: "On the field for Hoosac School",
      es: "En la cancha con Hoosac School",
    },
    // Fotos 1:1 em baixa resolução (745 a 1065 px): só para tiles pequenos
    image: bernardoEmAcao2,
    imageAlt: {
      pt: "Bernardo Herdy de costas, com a camisa 22 da Hoosac, durante um jogo",
      en: "Bernardo Herdy from behind, wearing Hoosac's number 22 shirt, during a match",
      es: "Bernardo Herdy de espaldas, con la camiseta 22 de Hoosac, durante un partido",
    },
    gallery: [bernardoEmAcao1, bernardoEmAcao3],
    url: instagramPost("DeSzcIzjbV4"),
  },
];

/** Mural de conquistas: só reconhecimentos (convocações e Sports Illustrated). */
export const ACHIEVEMENTS = INSTAGRAM_POSTS.filter((post) => post.kind === "conquista");

for (const athlete of ATHLETES) {
  if (athlete.videoId && !getVideo(athlete.videoId)) {
    throw new Error(`Vídeo de ${athlete.slug} fora do catálogo: ${athlete.videoId}`);
  }
}
for (const post of INSTAGRAM_POSTS) {
  const unknown = post.athletes.find((slug) => !ATHLETES_BY_SLUG.has(slug));
  if (unknown) throw new Error(`Post ${post.shortcode} cita atleta inexistente: ${unknown}`);
}
