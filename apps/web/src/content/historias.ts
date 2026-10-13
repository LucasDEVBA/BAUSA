import type { Lang } from "@/i18n";

import type { Localized } from "./types";

/*
 * Textos da página /historias e das peças de prova social da home (Destaques, chip do tour no
 * Hero, links "Ver todas as histórias"). Só fatos publicados: títulos e legendas do YouTube e do
 * Instagram e as artes dos depoimentos (ex.: "Maika | Mãe da Isadora"). Sem números que
 * envelhecem (contagem de convocações, "invicto") e sem promessa de resultado.
 *
 * Este arquivo NÃO importa os catálogos (videos/athletes/schools) nem imagens: o HeroSection
 * usa o chip daqui e não pode puxar o catálogo inteiro para o bundle acima da dobra.
 */

/** Idioma da rota (string do params) para o tipo do site; desconhecido cai no PT. */
export function asLang(locale: string): Lang {
  return locale === "en" || locale === "es" ? locale : "pt";
}

const same = (text: string): Localized => ({ pt: text, en: text, es: text });

/* ─── Home ──────────────────────────────────────────────────────────────────── */

/** Tour mais recente do canal, aberto pelo chip do Hero. */
export const HERO_TOUR = {
  videoId: "qCeneZf3KgM",
  duration: "25:07",
  badge: { pt: "Novo tour", en: "New tour", es: "Nuevo tour" } satisfies Localized,
  school: "Montverde Academy",
  title: {
    pt: "Dentro da Montverde Academy",
    en: "Inside Montverde Academy",
    es: "Dentro de Montverde Academy",
  } satisfies Localized,
};

export const HOME_STORIES_TEXT = {
  railTitle: { pt: "Destaques", en: "Highlights", es: "Destacados" },
  railHint: {
    pt: "Toque para assistir ou ver a conquista",
    en: "Tap to watch or see the achievement",
    es: "Toca para ver el video o el logro",
  },
  seeAll: { pt: "Ver todas", en: "See all", es: "Ver todas" },
  seeAllStories: { pt: "Ver todas as histórias", en: "See all stories", es: "Ver todas las historias" },
  watch: { pt: "Assistir", en: "Watch", es: "Ver" },
  storyOf: { pt: "Ver a história de", en: "See the story of", es: "Ver la historia de" },
  testimonial: { pt: "depoimento", en: "testimonial", es: "testimonio" },
  trustLink: { pt: "Ver histórias", en: "See stories", es: "Ver historias" },
  /** Complemento do alt das fotos de atletas no Hero ("Matheus Belcuo, atleta ..."). */
  athleteAlt: { pt: "atleta Bolsa Atleta USA", en: "Bolsa Atleta USA athlete", es: "atleta de Bolsa Atleta USA" },
} satisfies Record<string, Localized>;

/* ─── Famílias (depoimentos em vídeo) ───────────────────────────────────────── */

export interface FamilyStory {
  family: Localized;
  /** Quem fala, como está na arte do vídeo publicado. */
  relation: Localized;
}

/** Por id do vídeo em FAMILY_TESTIMONIALS (src/content/videos.ts). */
export const FAMILY_STORIES: Record<string, FamilyStory> = {
  enS5ZAGRJ0g: {
    family: { pt: "Família Santiago", en: "The Santiago family", es: "Familia Santiago" },
    relation: { pt: "Maika, mãe da Isadora", en: "Maika, Isadora's mother", es: "Maika, madre de Isadora" },
  },
  wJUf_efdc8s: {
    family: { pt: "Família Valverde", en: "The Valverde family", es: "Familia Valverde" },
    relation: { pt: "Luciano, pai da Liz", en: "Luciano, Liz's father", es: "Luciano, padre de Liz" },
  },
  "1WDFoyA5p8U": {
    family: { pt: "Família Mello", en: "The Mello family", es: "Familia Mello" },
    relation: { pt: "Pai do Bento", en: "Bento's father", es: "Padre de Bento" },
  },
  "8RtvPgeZ8yI": {
    family: { pt: "Família Machado", en: "The Machado family", es: "Familia Machado" },
    relation: { pt: "Gabriel, pai do João Gabriel", en: "Gabriel, João Gabriel's father", es: "Gabriel, padre de João Gabriel" },
  },
  KFkoxh4nTHU: {
    family: { pt: "Família Moraes", en: "The Moraes family", es: "Familia Moraes" },
    relation: { pt: "Priscila, mãe do Robson", en: "Priscila, Robson's mother", es: "Priscila, madre de Robson" },
  },
  lXzJkGgZkTw: {
    family: { pt: "Família Comperlingo", en: "The Comperlingo family", es: "Familia Comperlingo" },
    relation: { pt: "Pai do Gabriel", en: "Gabriel's father", es: "Padre de Gabriel" },
  },
};

/* ─── Página /historias ─────────────────────────────────────────────────────── */

export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@BolsaAtletaUSA";

export const HISTORIAS_PAGE = {
  breadcrumb: {
    home: { pt: "Início", en: "Home", es: "Inicio" },
    current: { pt: "Histórias", en: "Stories", es: "Historias" },
  },

  hero: {
    eyebrow: { pt: "Atletas e famílias", en: "Athletes and families", es: "Atletas y familias" },
    titleLead: { pt: "Histórias que", en: "Stories that", es: "Historias que" },
    titleAccent: { pt: "falam por nós", en: "speak for us", es: "hablan por nosotros" },
    lead: {
      pt: "Convocações para a Seleção Brasileira, reconhecimento da Sports Illustrated e depoimentos de quem vive o projeto nos Estados Unidos, contados pelos próprios atletas e por suas famílias.",
      en: "National team call-ups, recognition from Sports Illustrated and testimonials from those living the project in the United States, told by the athletes themselves and by their families.",
      es: "Convocatorias a la Selección Brasileña, reconocimiento de Sports Illustrated y testimonios de quienes viven el proyecto en Estados Unidos, contados por los propios atletas y sus familias.",
    },
    cta: { pt: "Iniciar avaliação estratégica", en: "Start strategic assessment", es: "Iniciar evaluación estratégica" },
    chip: {
      pt: "Isadora: da Seleção à Montverde",
      en: "Isadora: from Team Brazil to Montverde",
      es: "Isadora: de la Selección a Montverde",
    },
    mainAlt: {
      pt: "Bernardo Herdy com o uniforme de goleiro da Hoosac School e a bandeira do Brasil nas costas",
      en: "Bernardo Herdy in his Hoosac School goalkeeper kit, with the Brazilian flag behind him",
      es: "Bernardo Herdy con el uniforme de portero de Hoosac School y la bandera de Brasil a la espalda",
    },
    mainPlace: { pt: "Hoosac School · Nova York", en: "Hoosac School · New York", es: "Hoosac School · Nueva York" },
    floatAlt: {
      pt: "Andressa Macedo com o uniforme de goleira da Seleção Brasileira",
      en: "Andressa Macedo in Brazil's goalkeeper kit",
      es: "Andressa Macedo con el uniforme de portera de la Selección Brasileña",
    },
    badgeCopaTitle: { pt: "Convocada para o Mundial Sub-17", en: "Called up for the U-17 World Cup", es: "Convocada al Mundial Sub-17" },
    badgeCopaSub: { pt: "Andressa Macedo · Seleção Brasileira", en: "Andressa Macedo · Brazil", es: "Andressa Macedo · Selección Brasileña" },
    badgeSiTitle: same("Preseason All-America"),
    badgeSiSub: same("Sports Illustrated · Bernardo Herdy"),
  },

  conquistas: {
    eyebrow: { pt: "Conquistas recentes", en: "Recent achievements", es: "Logros recientes" },
    titleLead: { pt: "Sair do Brasil não tira ninguém do", en: "Leaving Brazil doesn't take anyone off the", es: "Salir de Brasil no saca a nadie del" },
    titleAccent: same("radar"),
    lead: {
      pt: "Estudando e jogando nos Estados Unidos, atletas da Bolsa Atleta USA continuam sendo chamados pela Seleção Brasileira e ganhando espaço na imprensa esportiva americana.",
      en: "While studying and playing in the United States, Bolsa Atleta USA athletes keep getting called up by Brazil's national teams and earning space in the American sports press.",
      es: "Mientras estudian y juegan en Estados Unidos, los atletas de Bolsa Atleta USA siguen siendo convocados por la Selección Brasileña y ganando espacio en la prensa deportiva estadounidense.",
    },
    instagram: { pt: "Ver no Instagram", en: "View on Instagram", es: "Ver en Instagram" },
    newTab: { pt: "abre em nova aba", en: "opens in a new tab", es: "se abre en una pestaña nueva" },
    via: same("via @bolsaatletausa"),
    selecao: {
      kicker: { pt: "Seleção Brasileira Sub-17", en: "Brazil U-17 national team", es: "Selección Brasileña Sub-17" },
      title: {
        pt: "Andressa Macedo e Sara Pedot, convocadas",
        en: "Andressa Macedo and Sara Pedot, called up",
        es: "Andressa Macedo y Sara Pedot, convocadas",
      },
      body: {
        pt: "As duas foram chamadas pela Seleção Sub-17 para a reta final antes da Copa do Mundo Feminina Sub-17 da FIFA, no Marrocos, e Andressa foi convocada para defender o Brasil no Mundial. Ela é goleira, estuda na Life Prep Academy e joga pelo FC Wichita. Sara está na IMG Academy.",
        en: "Both were called up by Brazil's U-17 team for the final stretch before the FIFA U-17 Women's World Cup in Morocco, and Andressa was named to defend Brazil at the tournament. She is a goalkeeper who studies at Life Prep Academy and plays for FC Wichita. Sara is at IMG Academy.",
        es: "Las dos fueron llamadas por la Selección Sub-17 para la recta final antes de la Copa Mundial Femenina Sub-17 de la FIFA, en Marruecos, y Andressa fue convocada para defender a Brasil en el Mundial. Es portera, estudia en Life Prep Academy y juega en el FC Wichita. Sara está en IMG Academy.",
      },
      andressaRole: {
        pt: "Goleira · Life Prep Academy · FC Wichita",
        en: "Goalkeeper · Life Prep Academy · FC Wichita",
        es: "Portera · Life Prep Academy · FC Wichita",
      },
      saraRole: same("IMG Academy"),
      reel: { pt: "Assista no Instagram", en: "Watch on Instagram", es: "Mira en Instagram" },
      reelTitle: {
        pt: "Reel da convocação para a Copa do Mundo",
        en: "World Cup call-up reel",
        es: "Reel de la convocatoria al Mundial",
      },
    },
    si: {
      kicker: same("Sports Illustrated"),
      title: {
        pt: "Bernardo Herdy no Preseason All-America da Sports Illustrated",
        en: "Bernardo Herdy named to Sports Illustrated's Preseason All-America",
        es: "Bernardo Herdy en el Preseason All-America de Sports Illustrated",
      },
      body: {
        pt: "Goleiro formado na base do EC Vitória, onde foi campeão continental Sub-17, Bernardo deixou o clube por escolha para conciliar futebol e estudo. Hoje faz o último ano de high school na Hoosac School, em Nova York.",
        en: "A goalkeeper who came up through EC Vitória's youth academy, where he won a continental U-17 title, Bernardo chose to leave the club to combine soccer and school. He is now in his final year of high school at Hoosac School, in New York.",
        es: "Portero formado en las inferiores del EC Vitória, donde fue campeón continental Sub-17, Bernardo dejó el club por decisión propia para combinar fútbol y estudios. Hoy cursa el último año de high school en Hoosac School, en Nueva York.",
      },
      role: {
        pt: "Goleiro · Hoosac School, Nova York",
        en: "Goalkeeper · Hoosac School, New York",
        es: "Portero · Hoosac School, Nueva York",
      },
      gallery: { pt: "Media Day e jogos pela Hoosac", en: "Media Day and games for Hoosac", es: "Media Day y partidos con Hoosac" },
      flagAlt: {
        pt: "Bernardo Herdy envolto na bandeira do Brasil no Media Day da Hoosac School",
        en: "Bernardo Herdy wrapped in the Brazilian flag at Hoosac School's Media Day",
        es: "Bernardo Herdy envuelto en la bandera de Brasil en el Media Day de Hoosac School",
      },
    },
  },

  mural: {
    eyebrow: { pt: "Mural de atletas", en: "Athlete wall", es: "Mural de atletas" },
    titleLead: { pt: "Quem já está", en: "Already", es: "Quienes ya están" },
    titleAccent: { pt: "em campo", en: "on the field", es: "en la cancha" },
    lead: {
      pt: "Atletas da Bolsa Atleta USA em high schools e universidades dos Estados Unidos. Toque para ouvir o depoimento, conhecer a escola ou ver a publicação.",
      en: "Bolsa Atleta USA athletes at high schools and universities across the United States. Tap to hear their testimonial, tour their school or see the post.",
      es: "Atletas de Bolsa Atleta USA en high schools y universidades de Estados Unidos. Toca para escuchar su testimonio, conocer la escuela o ver la publicación.",
    },
    testimonial: { pt: "Depoimento", en: "Testimonial", es: "Testimonio" },
    tour: { pt: "Tour da escola", en: "School tour", es: "Tour de la escuela" },
    tourOf: { pt: "Tour da", en: "Tour of", es: "Tour de" },
    testimonialOf: { pt: "Depoimento de", en: "Testimonial from", es: "Testimonio de" },
    ctaTitle: {
      pt: "A próxima história pode começar com uma conversa.",
      en: "The next story can start with a conversation.",
      es: "La próxima historia puede empezar con una conversación.",
    },
    ctaAction: { pt: "Iniciar avaliação", en: "Start assessment", es: "Iniciar evaluación" },
  },

  atletas: {
    eyebrow: { pt: "Depoimentos em vídeo", en: "Video testimonials", es: "Testimonios en video" },
    titleLead: { pt: "Nas palavras", en: "In their", es: "En sus" },
    titleAccent: { pt: "deles", en: "own words", es: "propias palabras" },
    lead: {
      pt: "Depoimentos curtos de atletas da Bolsa Atleta USA que estudam e jogam nos Estados Unidos.",
      en: "Short testimonials from Bolsa Atleta USA athletes who study and play in the United States.",
      es: "Testimonios breves de atletas de Bolsa Atleta USA que estudian y juegan en Estados Unidos.",
    },
    railLabel: { pt: "Depoimentos de atletas", en: "Athlete testimonials", es: "Testimonios de atletas" },
    swipe: { pt: "Deslize para ver mais", en: "Swipe to see more", es: "Desliza para ver más" },
    momentsTitle: {
      pt: "Eles também aparecem no tour da Montverde",
      en: "They also appear in our Montverde tour",
      es: "También aparecen en nuestro tour de Montverde",
    },
    moments: {
      Leonardo: { pt: "Leonardo, atleta na Montverde", en: "Leonardo, an athlete at Montverde", es: "Leonardo, atleta en Montverde" },
      "Isadora Santiago": { pt: "Isadora conta sua experiência", en: "Isadora shares her experience", es: "Isadora cuenta su experiencia" },
    } as Record<string, Localized>,
    momentAt: { pt: "Tour Montverde, a partir de", en: "Montverde tour, from", es: "Tour de Montverde, desde" },
  },

  familias: {
    eyebrow: { pt: "Famílias", en: "Families", es: "Familias" },
    titleLead: { pt: "O que dizem", en: "What", es: "Lo que dicen" },
    titleAccent: { pt: "as famílias", en: "families say", es: "las familias" },
    lead: {
      pt: "Pais e mães de atletas da Bolsa Atleta USA contam, com as próprias palavras, como é viver esse projeto ao lado dos filhos.",
      en: "Parents of Bolsa Atleta USA athletes share, in their own words, what it is like to live this project alongside their children.",
      es: "Padres y madres de atletas de Bolsa Atleta USA cuentan, con sus propias palabras, cómo es vivir este proyecto junto a sus hijos.",
    },
    railLabel: { pt: "Depoimentos de famílias", en: "Family testimonials", es: "Testimonios de familias" },
    channel: {
      pt: "Mais vídeos no canal do YouTube",
      en: "More videos on our YouTube channel",
      es: "Más videos en nuestro canal de YouTube",
    },
  },
};
