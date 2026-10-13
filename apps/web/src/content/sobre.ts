import type { Lang } from "@/i18n";

import { pick, type Localized } from "./types";

/*
 * Textos da página /sobre e dos teasers da home que levam a ela. Fatos SÓ do que já é
 * público: textos do site (landing.founder, landing.whatIsEEI, FAQ da home) e descrições
 * dos vídeos do canal (1QeP5rjTfGw, VfmQ2LGCKpw, cLPA1PQjdiM, oPWy-LfRDus, JkQ4M76oBA0,
 * qlSNBAQQPUs). Nada de ranking, "primeira agência" ou números além dos publicados.
 */

const LANGS: readonly Lang[] = ["pt", "en", "es"];

/** Locale da rota para o idioma do conteúdo (o middleware já barra os demais). */
export function toLang(locale: string): Lang {
  return (LANGS as readonly string[]).includes(locale) ? (locale as Lang) : "pt";
}

export const SOBRE_VIDEOS = {
  /** "O guia de quem viveu 7 anos lá": destaque do hero e chip da FounderSection. */
  guide: "1QeP5rjTfGw",
  /** Filme institucional (4:08): destaque do bloco "Por que criamos". */
  film: "nlY464cX1Vs",
  /** Institucionais curtos de 2025, na ordem da narrativa: origem, conceito, critério. */
  why: ["oPWy-LfRDus", "CIJEYd1-afI", "JkQ4M76oBA0"],
  harvard: "qlSNBAQQPUs",
  /** Conceito da Educação Esportiva Inteligente: chip da WhatIsEEISection. */
  eei: "CIJEYd1-afI",
} as const;

/** Rótulos curtos dos chips da home (o título completo vai para o player). */
export const HOME_TEASERS = {
  founderVideo: {
    pt: "Assista: o guia de quem viveu 7 anos lá",
    en: "Watch: a guide built on 7 years in the US",
    es: "Mira: la guía de quien vivió 7 años allí",
  },
  founderStory: {
    pt: "Conheça a história",
    en: "Read the full story",
    es: "Conoce la historia",
  },
  eeiVideo: {
    pt: "Assista: muito além do intercâmbio",
    en: "Watch: far beyond a sports exchange",
    es: "Mira: mucho más que un intercambio",
  },
} satisfies Record<string, Localized>;

export const SOBRE_HERO = {
  eyebrow: { pt: "Sobre nós", en: "About us", es: "Sobre nosotros" },
  titleLead: {
    pt: "Nascida dentro do sistema,",
    en: "Born inside the system,",
    es: "Nacida dentro del sistema,",
  },
  titleAccent: { pt: "não fora\u00A0dele.", en: "not outside\u00A0it.", es: "no fuera de\u00A0él." },
  lead: {
    pt: "A Bolsa Atleta USA nasceu da experiência de Leandro Ribeiro: 7 anos nos Estados Unidos como estudante-atleta, com bolsa de 100% entre a high school e a universidade, além de atuação em admissões e recrutamento universitário.",
    en: "Bolsa Atleta USA was born from Leandro Ribeiro's own experience: 7 years in the United States as a student-athlete on a 100% scholarship, from high school through university, plus hands-on work in admissions and university recruiting.",
    es: "Bolsa Atleta USA nació de la experiencia de Leandro Ribeiro: 7 años en Estados Unidos como estudiante-atleta, con beca del 100% entre la high school y la universidad, además de su trabajo en admisiones y reclutamiento universitario.",
  },
  harvardCaption: { pt: "Em Harvard", en: "At Harvard", es: "En Harvard" },
  harvardAlt: {
    pt: "Leandro Ribeiro com o treinador de futebol da Universidade Harvard",
    en: "Leandro Ribeiro with Harvard University's soccer coach",
    es: "Leandro Ribeiro con el entrenador de fútbol de la Universidad Harvard",
  },
  videoEyebrow: { pt: "Assista", en: "Watch", es: "Mira" },
  videoTitle: {
    pt: "O guia de quem viveu 7 anos lá",
    en: "A guide from someone who lived it for 7 years",
    es: "La guía de quien vivió 7 años allí",
  },
} satisfies Record<string, Localized>;

/** Selo exibido em EN/ES: todos os vídeos do canal são em português. */
export const VIDEO_LANGUAGE_NOTE: Localized = {
  pt: "",
  en: "Videos in Portuguese",
  es: "Videos en portugués",
};

/** Mesmo aviso, curto, na linha de um único vídeo (vazio em PT). */
export const VIDEO_LANGUAGE_TAG: Localized = {
  pt: "",
  en: "In Portuguese",
  es: "En portugués",
};

/** Duração do vídeo com o aviso de idioma fora do PT (ex.: "3:28 · In Portuguese"). */
export function withLanguageTag(duration: string, lang: Lang): string {
  const tag = pick(VIDEO_LANGUAGE_TAG, lang);
  return tag ? `${duration} · ${tag}` : duration;
}

export interface SobreStat {
  value: string;
  label: Localized;
}

export const SOBRE_STATS: SobreStat[] = [
  {
    value: "17",
    label: {
      pt: "anos de idade quando deixou o Brasil",
      en: "years old when he left Brazil",
      es: "años de edad cuando dejó Brasil",
    },
  },
  {
    value: "7",
    label: {
      pt: "anos nos EUA como estudante-atleta",
      en: "years in the US as a student-athlete",
      es: "años en EE. UU. como estudiante-atleta",
    },
  },
  {
    value: "100%",
    label: {
      pt: "de bolsa na high school e na universidade",
      en: "scholarship in high school and university",
      es: "de beca en la high school y en la universidad",
    },
  },
];

export const SOBRE_JOURNEY_HEADER = {
  eyebrow: { pt: "A trajetória", en: "The journey", es: "La trayectoria" },
  titleLead: {
    pt: "Do futebol de base ao outro lado",
    en: "From youth soccer to the other side",
    es: "Del fútbol base al otro lado",
  },
  titleAccent: { pt: "da mesa.", en: "of the table.", es: "de la mesa." },
  lead: {
    pt: "Antes de conduzir projetos de vida, Leandro viveu cada etapa que uma família vai enfrentar: a saída do Brasil, a rotina de estudante-atleta e as decisões de quem escolhe quem entra.",
    en: "Before leading life projects, Leandro lived every stage a family will face: leaving Brazil, the routine of a student-athlete, and the decisions of those who choose who gets in.",
    es: "Antes de conducir proyectos de vida, Leandro vivió cada etapa que una familia va a enfrentar: la salida de Brasil, la rutina de estudiante-atleta y las decisiones de quienes eligen quién entra.",
  },
} satisfies Record<string, Localized>;

export type JourneyIcon = "departure" | "scholar" | "admissions" | "spark" | "team";

export interface JourneyStep {
  icon: JourneyIcon;
  kicker: Localized;
  title: Localized;
  text: Localized;
}

export const SOBRE_JOURNEY: JourneyStep[] = [
  {
    icon: "departure",
    kicker: { pt: "Brasil", en: "Brazil", es: "Brasil" },
    title: { pt: "Futebol de base", en: "Youth soccer", es: "Fútbol base" },
    text: {
      pt: "Leandro Ribeiro jogava futebol de base no Brasil. Aos 17 anos, deixou o país para entrar no sistema educacional americano.",
      en: "Leandro Ribeiro played youth soccer in Brazil. At 17, he left the country to enter the American education system.",
      es: "Leandro Ribeiro jugaba fútbol base en Brasil. A los 17 años, dejó el país para ingresar al sistema educativo estadounidense.",
    },
  },
  {
    icon: "scholar",
    kicker: { pt: "Estados Unidos · 7 anos", en: "United States · 7 years", es: "Estados Unidos · 7 años" },
    title: {
      pt: "Estudante-atleta com bolsa integral",
      en: "Student-athlete on a full scholarship",
      es: "Estudiante-atleta con beca completa",
    },
    text: {
      pt: "Estudou e jogou futebol nos EUA com bolsa integral na high school e, depois, na universidade. Só quando o ciclo terminou entendeu o que essa experiência forma em uma pessoa.",
      en: "He studied and played soccer in the US on a full scholarship in high school and, later, at university. Only when that chapter ended did he understand what the experience shapes in a person.",
      es: "Estudió y jugó fútbol en EE. UU. con beca completa en la high school y, después, en la universidad. Solo cuando el ciclo terminó entendió lo que esa experiencia forma en una persona.",
    },
  },
  {
    icon: "admissions",
    kicker: { pt: "Admissões e recrutamento", en: "Admissions and recruiting", es: "Admisiones y reclutamiento" },
    title: { pt: "Do outro lado da mesa", en: "On the other side of the table", es: "Del otro lado de la mesa" },
    text: {
      pt: "Atuou em admissões escolares e recrutamento universitário, participando das decisões que definem quem entra, em qual momento e sob quais critérios.",
      en: "He worked in school admissions and university recruiting, taking part in the decisions about who gets in, when, and on what criteria.",
      es: "Trabajó en admisiones escolares y reclutamiento universitario, participando en las decisiones que definen quién entra, en qué momento y bajo qué criterios.",
    },
  },
  {
    icon: "spark",
    kicker: { pt: "O conceito", en: "The concept", es: "El concepto" },
    title: {
      pt: "Nasce a Educação Esportiva Inteligente®",
      en: "Smart Sports Education® is born",
      es: "Nace la Educación Deportiva Inteligente®",
    },
    text: {
      pt: "Dessa vivência, dentro do sistema e não fora dele, nasceu o conceito que orienta todo o trabalho da Bolsa Atleta USA.",
      en: "From that experience, inside the system rather than outside it, came the concept that guides all of Bolsa Atleta USA's work.",
      es: "De esa vivencia, dentro del sistema y no fuera de él, nació el concepto que orienta todo el trabajo de Bolsa Atleta USA.",
    },
  },
  {
    icon: "team",
    kicker: { pt: "Hoje", en: "Today", es: "Hoy" },
    title: { pt: "À frente da Bolsa Atleta USA", en: "Leading Bolsa Atleta USA", es: "Al frente de Bolsa Atleta USA" },
    text: {
      pt: "Lidera um time multidisciplinar que acompanha ativamente cada jovem, com foco em segurança decisória, desenvolvimento humano e coerência em cada etapa.",
      en: "He leads a multidisciplinary team that actively supports each young athlete, with a focus on safe decisions, human development and consistency at every step.",
      es: "Lidera un equipo multidisciplinario que acompaña activamente a cada joven, con foco en la seguridad de cada decisión, el desarrollo humano y la coherencia en cada etapa.",
    },
  },
];

export const SOBRE_QUOTE = {
  text: {
    pt: "Antes da performance, existe identidade. E é o caráter, não o talento, que sustenta as oportunidades ao longo da vida.",
    en: "Before performance, there is identity. And it is character, not talent, that sustains opportunities throughout life.",
    es: "Antes del rendimiento, existe la identidad. Y es el carácter, no el talento, lo que sostiene las oportunidades a lo largo de la vida.",
  },
  portraitAlt: {
    pt: "Leandro Ribeiro, fundador da Bolsa Atleta USA",
    en: "Leandro Ribeiro, founder of Bolsa Atleta USA",
    es: "Leandro Ribeiro, fundador de Bolsa Atleta USA",
  },
} satisfies Record<string, Localized>;

export const SOBRE_WHY = {
  eyebrow: { pt: "Nossa origem", en: "Our origin", es: "Nuestro origen" },
  title: {
    pt: "Por que criamos a Bolsa Atleta USA",
    en: "Why we created Bolsa Atleta USA",
    es: "Por qué creamos Bolsa Atleta USA",
  },
  lead: {
    pt: "Durante anos, vimos atletas sendo enviados ao exterior como se isso bastasse. A Bolsa Atleta USA nasceu para transformar o intercâmbio esportivo em um projeto de vida, com propósito, planejamento e impacto real.",
    en: "For years, we watched athletes being sent abroad as if that were enough. Bolsa Atleta USA was created to turn a sports exchange into a life project, with purpose, planning and real impact.",
    es: "Durante años, vimos atletas siendo enviados al exterior como si eso bastara. Bolsa Atleta USA nació para transformar el intercambio deportivo en un proyecto de vida, con propósito, planificación e impacto real.",
  },
  manifestoLead: { pt: "Enviar não é guiar.", en: "Sending is not guiding.", es: "Enviar no es guiar." },
  manifestoAccent: {
    pt: "Oportunidade não é propósito.",
    en: "Opportunity is not purpose.",
    es: "Oportunidad no es propósito.",
  },
  manifestoNote: {
    pt: "Formamos líderes, guiamos atletas e construímos futuros. Chamamos isso de Educação Esportiva Inteligente®.",
    en: "We develop leaders, guide athletes and build futures. We call it Smart Sports Education®.",
    es: "Formamos líderes, guiamos atletas y construimos futuros. Lo llamamos Educación Deportiva Inteligente®.",
  },
} satisfies Record<string, Localized>;

export const SOBRE_HARVARD = {
  eyebrow: { pt: "Acesso de verdade", en: "Real access", es: "Acceso real" },
  titleLead: { pt: "Dentro de", en: "Inside", es: "Dentro de" },
  lead: {
    pt: "Um tour exclusivo pela estrutura esportiva de Harvard e pela rotina dos atletas, com uma conversa com o treinador sobre bolsas e admissões. É esse relacionamento direto com treinadores e diretores de admissão que levamos para dentro de cada projeto.",
    en: "An exclusive tour of Harvard's athletic facilities and its athletes' daily routine, including a conversation with the coach about scholarships and admissions. It is this direct relationship with coaches and admissions directors that we bring into every project.",
    es: "Un recorrido exclusivo por las instalaciones deportivas de Harvard y la rutina de sus atletas, con una charla con el entrenador sobre becas y admisiones. Es esa relación directa con entrenadores y directores de admisión la que llevamos a cada proyecto.",
  },
  allTours: { pt: "Ver todos os tours", en: "See all tours", es: "Ver todos los tours" },
} satisfies Record<string, Localized>;

export const SOBRE_VALUES_HEADER = {
  eyebrow: { pt: "Nossos valores", en: "Our values", es: "Nuestros valores" },
  titleLead: { pt: "Não prometemos bolsa.", en: "We don't promise scholarships.", es: "No prometemos becas." },
  titleAccent: { pt: "Entregamos método.", en: "We deliver a method.", es: "Entregamos método." },
  lead: {
    pt: "A bolsa é resultado de um projeto bem executado, não um produto à venda. Por isso trabalhamos com método e direção estratégica em cada decisão.",
    en: "A scholarship is the result of a well-executed project, not a product for sale. That's why we work with method and strategic direction in every decision.",
    es: "La beca es el resultado de un proyecto bien ejecutado, no un producto a la venta. Por eso trabajamos con método y dirección estratégica en cada decisión.",
  },
} satisfies Record<string, Localized>;

export type ValueIcon = "human" | "compass" | "criteria" | "family";

export interface SobreValue {
  icon: ValueIcon;
  title: Localized;
  text: Localized;
}

/** O primeiro é o cartão de destaque (faixa em gradiente). */
export const SOBRE_VALUES: SobreValue[] = [
  {
    icon: "human",
    title: { pt: "Formação humana no centro", en: "Human development at the center", es: "Formación humana en el centro" },
    text: {
      pt: "O esporte é ferramenta, a educação é estrutura e a formação humana é o centro da jornada.",
      en: "Sport is the tool, education is the structure and human development is the center of the journey.",
      es: "El deporte es la herramienta, la educación es la estructura y la formación humana es el centro del camino.",
    },
  },
  {
    icon: "compass",
    title: {
      pt: "A decisão certa, não a mais famosa",
      en: "The right decision, not the most famous one",
      es: "La decisión correcta, no la más famosa",
    },
    text: {
      pt: "Não buscamos a escola mais famosa nem a maior bolsa. Buscamos a decisão certa para cada atleta, porque ela precisa ser, acima de tudo, segura.",
      en: "We don't chase the most famous school or the biggest scholarship. We look for the right decision for each athlete, because above all it has to be a safe one.",
      es: "No buscamos la escuela más famosa ni la beca más grande. Buscamos la decisión correcta para cada atleta, porque ante todo tiene que ser segura.",
    },
  },
  {
    icon: "criteria",
    title: { pt: "Critério antes da escolha", en: "Criteria before the choice", es: "Criterio antes de la elección" },
    text: {
      pt: "Antes de indicar qualquer instituição, aplicamos o Método S.A.F.E.®, que cruza singularidade, acadêmico, financeiro e esporte.",
      en: "Before recommending any institution, we apply the S.A.F.E.® Method, which brings together singularity, academics, finances and sport.",
      es: "Antes de indicar cualquier institución, aplicamos el Método S.A.F.E.®, que cruza singularidad, lo académico, lo financiero y el deporte.",
    },
  },
  {
    icon: "family",
    title: { pt: "Projeto, não embarque", en: "A project, not a placement", es: "Un proyecto, no un envío" },
    text: {
      pt: "Seu filho não é um embarque nem um número. Trabalhamos com um número limitado de famílias por ciclo para acompanhar cada jovem de perto.",
      en: "Your child is not a placement or a number. We work with a limited number of families per cycle so we can follow each young athlete closely.",
      es: "Tu hijo no es un envío ni un número. Trabajamos con un número limitado de familias por ciclo para acompañar de cerca a cada joven.",
    },
  },
];

export const SOBRE_METHOD_LINK: Localized = {
  pt: "Conheça o Método S.A.F.E.®",
  en: "Explore the S.A.F.E.® Method",
  es: "Conoce el Método S.A.F.E.®",
};

/** Textos dos dados estruturados (JSON-LD) da página. */
export const SOBRE_SCHEMA = {
  personDescription: {
    pt: "Fundador da Bolsa Atleta USA e criador da Educação Esportiva Inteligente®. Viveu 7 anos nos Estados Unidos como estudante-atleta com bolsa integral, na high school e na universidade, e atuou em admissões e recrutamento universitário.",
    en: "Founder of Bolsa Atleta USA and creator of Smart Sports Education®. He spent 7 years in the United States as a student-athlete on a full scholarship, in high school and at university, and worked in admissions and university recruiting.",
    es: "Fundador de Bolsa Atleta USA y creador de la Educación Deportiva Inteligente®. Vivió 7 años en Estados Unidos como estudiante-atleta con beca completa, en la high school y en la universidad, y trabajó en admisiones y reclutamiento universitario.",
  },
  jobTitle: {
    pt: "Fundador e Estrategista-Chefe",
    en: "Founder and Chief Strategist",
    es: "Fundador y Estratega Jefe",
  },
  organizationDescription: {
    pt: "Assessoria que estrutura projetos de vida para jovens atletas no sistema educacional americano, da high school à universidade, com o Método S.A.F.E.®",
    en: "Advisory that builds life projects for young athletes in the American education system, from high school to university, with the S.A.F.E.® Method.",
    es: "Asesoría que estructura proyectos de vida para jóvenes atletas en el sistema educativo estadounidense, de la high school a la universidad, con el Método S.A.F.E.®",
  },
  guideDescription: {
    pt: "Leandro Ribeiro, fundador da Bolsa Atleta USA, conta o que 7 anos estudando e jogando futebol nos Estados Unidos com bolsa de 100% ensinaram sobre formação, caráter e decisões.",
    en: "Leandro Ribeiro, founder of Bolsa Atleta USA, shares what 7 years of studying and playing soccer in the United States on a 100% scholarship taught him about growth, character and decisions.",
    es: "Leandro Ribeiro, fundador de Bolsa Atleta USA, cuenta lo que 7 años estudiando y jugando fútbol en Estados Unidos con beca del 100% le enseñaron sobre formación, carácter y decisiones.",
  },
} satisfies Record<string, Localized>;
