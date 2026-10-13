import type { Lang } from "@/i18n";

import type { Localized } from "./types";

/*
 * Textos da página /metodo e dos chips de vídeo das seções do método (home e /metodo).
 * Fatos só do que o site já afirma (FAQ, seções existentes) ou do catálogo de vídeos:
 * nada de número novo, ranking ou promessa de bolsa. Sem travessão em texto visível.
 */

const LANGS: readonly Lang[] = ["pt", "en", "es"];

/** Locale da rota para o idioma do conteúdo; qualquer valor estranho cai no PT. */
export function toLang(locale: string): Lang {
  return LANGS.find((lang) => lang === locale) ?? "pt";
}

const IN_PORTUGUESE: Record<Lang, string> = { pt: "", en: "In Portuguese", es: "En portugués" };

/** Mantém "EE. UU." na mesma linha nos títulos do catálogo exibidos em espanhol. */
export function keepTogether(text: string): string {
  return text.replace(/EE\. UU\./g, "EE.\u00a0UU.");
}

/** Linha de apoio do chip: duração e, fora do PT, o aviso de que o vídeo é em português. */
export function videoSubline(duration: string, lang: Lang): string {
  return IN_PORTUGUESE[lang] ? `${duration} · ${IN_PORTUGUESE[lang]}` : duration;
}

/** Chip "Assista" que aponta para um vídeo do catálogo (título e duração vêm de videos.ts). */
export interface MethodVideoChipData {
  videoId: string;
  label: Localized;
}

/** Chip que abre o tour no minuto exato (capítulo). */
export interface MethodMomentChipData {
  videoId: string;
  start: number;
  label: Localized;
}

// ─── Chips das seções do método (home e /metodo) ──────────────────────────────

export const SAFE_CHIPS = {
  intro: {
    videoId: "2qtkeGlu5LE",
    label: { pt: "Entenda o método em 2 min", en: "The method in 2 minutes", es: "El método en 2 minutos" },
  },
  singularidade: {
    videoId: "VfmQ2LGCKpw",
    label: { pt: "Escola famosa ou certa?", en: "Famous or right school?", es: "¿Escuela famosa o correcta?" },
  },
  financeiro: {
    videoId: "JJOHwplQ51I",
    label: { pt: "As 4 categorias de bolsa", en: "The 4 scholarship categories", es: "Las 4 categorías de beca" },
  },
} satisfies Record<string, MethodVideoChipData>;

export const WHY_HIGH_SCHOOL_CHIPS: MethodVideoChipData[] = [
  {
    videoId: "Ke-LTSF8Hes",
    label: { pt: "Qual a idade ideal para ir?", en: "What's the ideal age to go?", es: "¿Cuál es la edad ideal para ir?" },
  },
  {
    videoId: "vzwgRGP3zns",
    label: { pt: "Como é a adaptação nos EUA", en: "What adapting to the US is like", es: "Cómo es la adaptación en EE.\u00a0UU." },
  },
];

/** Vídeo em destaque na faixa "Nada é isolado" do Como atuamos. */
export const HOW_WE_WORK_FEATURED_VIDEO = "cLPA1PQjdiM";

/** Montverde: os dois capítulos em que atletas da casa aparecem (04:52 e 24:02). */
export const HOW_WE_WORK_MOMENTS: MethodMomentChipData[] = [
  {
    videoId: "qCeneZf3KgM",
    start: 292,
    label: { pt: "Leonardo na Montverde", en: "Leonardo at Montverde", es: "Leonardo en Montverde" },
  },
  {
    videoId: "qCeneZf3KgM",
    start: 1442,
    label: { pt: "Isadora conta a experiência", en: "Isadora shares her experience", es: "Isadora cuenta su experiencia" },
  },
];

export const METHOD_COPY = {
  fullMethodLink: { pt: "Ver o método completo", en: "See the full method", es: "Ver el método completo" },
  momentsLabel: {
    pt: "Na prática, no tour pela Montverde",
    en: "In practice, on the Montverde tour",
    es: "En la práctica, en el tour por Montverde",
  },
  montverdeTour: { pt: "Tour Montverde", en: "Montverde tour", es: "Tour Montverde" },
  founderMeta: { pt: "Leandro Ribeiro · Fundador", en: "Leandro Ribeiro · Founder", es: "Leandro Ribeiro · Fundador" },
  /** Nome do método na ordem natural de cada idioma (em inglês o nome vem antes de "Method"). */
  methodName: { pt: "Método S.A.F.E.®", en: "S.A.F.E.® Method", es: "Método S.A.F.E.®" },
} satisfies Record<string, Localized>;

// ─── Abertura da página ───────────────────────────────────────────────────────

export const METHOD_HERO = {
  breadcrumbHome: { pt: "Início", en: "Home", es: "Inicio" },
  breadcrumbCurrent: { pt: "Método", en: "Method", es: "Método" },
  eyebrow: { pt: "Educação Esportiva Inteligente®", en: "Smart Sports Education®", es: "Educación Deportiva Inteligente®" },
  titleBefore: { pt: "Método", en: "The", es: "Método" },
  titleAccent: { pt: "S.A.F.E.", en: "S.A.F.E.", es: "S.A.F.E." },
  titleAfter: { pt: "", en: "Method", es: "" },
  lead: {
    pt: "Quatro pilares orientam cada projeto de vida, da escolha da High School à universidade: quem é o atleta e a família, onde ele está nos estudos, o que o investimento pode sustentar e onde o esporte tem espaço real.",
    en: "Four pillars guide every life project, from choosing a High School to university: who the athlete and family are, where the athlete stands academically, what the investment can sustain and where the sport has real room to grow.",
    es: "Cuatro pilares orientan cada proyecto de vida, desde la elección de la High School hasta la universidad: quién es el atleta y su familia, en qué punto está en los estudios, qué puede sostener la inversión y dónde el deporte tiene espacio real.",
  },
  cta: { pt: "Iniciar avaliação estratégica", en: "Start strategic assessment", es: "Iniciar evaluación estratégica" },
  visualCaption: { pt: "Quatro pilares de decisão", en: "Four decision pillars", es: "Cuatro pilares de decisión" },
  visualCenter: { pt: "4 pilares", en: "4 pillars", es: "4 pilares" },
  visualBadge: { pt: "Da High School à universidade", en: "From High School to university", es: "De la High School a la universidad" },
  visualNav: { pt: "Pilares do método", en: "Method pillars", es: "Pilares del método" },
} satisfies Record<string, Localized>;

// ─── Linha do tempo da jornada ────────────────────────────────────────────────

export type JourneyPhase = "brasil" | "eua";

export interface JourneyStep {
  key: string;
  phase: JourneyPhase;
  title: Localized;
  /** Marcador curto do momento (idade, série, sistema). */
  marker: Localized;
  body: Localized;
  link?: { href: string; label: Localized };
}

export const JOURNEY = {
  eyebrow: { pt: "A jornada", en: "The journey", es: "El camino" },
  titleBefore: { pt: "Do Brasil à universidade,", en: "From Brazil to university,", es: "De Brasil a la universidad," },
  titleAccent: { pt: "etapa por etapa", en: "step by step", es: "etapa por etapa" },
  lead: {
    pt: "Um projeto de vida tem etapas, e cada uma pede uma decisão diferente. A equipe acompanha todas, do primeiro contato à universidade.",
    en: "A life project has stages, and each one calls for a different decision. Our team is present in all of them, from the first conversation to university.",
    es: "Un proyecto de vida tiene etapas, y cada una pide una decisión distinta. El equipo las acompaña todas, desde el primer contacto hasta la universidad.",
  },
  phases: {
    brasil: { pt: "No Brasil", en: "In Brazil", es: "En Brasil" },
    eua: { pt: "Nos EUA", en: "In the US", es: "En EE.\u00a0UU." },
  } satisfies Record<JourneyPhase, Localized>,
  trackingTitle: { pt: "Acompanhamento ativo em cada etapa", en: "Active guidance at every step", es: "Acompañamiento activo en cada etapa" },
  trackingBody: {
    pt: "Leitura criteriosa, direcionamento institucional e presença da equipe ao longo de toda a jornada.",
    en: "Careful assessment, institutional direction and our team's presence throughout the whole journey.",
    es: "Lectura cuidadosa, orientación institucional y presencia del equipo a lo largo de todo el camino.",
  },
  stepLabel: { pt: "Etapa", en: "Step", es: "Etapa" },
} satisfies Record<string, Localized | Record<JourneyPhase, Localized>>;

export const JOURNEY_STEPS: JourneyStep[] = [
  {
    key: "avaliacao",
    phase: "brasil",
    title: { pt: "Avaliação estratégica", en: "Strategic assessment", es: "Evaluación estratégica" },
    marker: { pt: "Primeiro passo", en: "First step", es: "Primer paso" },
    body: {
      pt: "Começa com a candidatura no site. As famílias selecionadas conversam diretamente com o fundador, e cada ciclo tem um número limitado de famílias.",
      en: "It starts with an application on the website. Selected families talk directly with the founder, and each cycle has a limited number of families.",
      es: "Empieza con la candidatura en el sitio. Las familias seleccionadas conversan directamente con el fundador, y cada ciclo tiene un número limitado de familias.",
    },
  },
  {
    key: "preparacao",
    phase: "brasil",
    title: { pt: "Preparação no Brasil", en: "Preparation in Brazil", es: "Preparación en Brasil" },
    marker: { pt: "A partir dos 13 ou 14 anos", en: "From age 13 or 14", es: "Desde los 13 o 14 años" },
    body: {
      pt: "Ainda há tempo para alinhar a trajetória esportiva, acadêmica e o inglês às exigências do sistema americano. Inglês fluente não é pré-requisito: ele é construído ao longo do projeto.",
      en: "There is still time to align the athletic path, academics and English with what the American system requires. Fluent English is not a prerequisite: it is built throughout the project.",
      es: "Todavía hay tiempo para alinear la trayectoria deportiva, la académica y el inglés con las exigencias del sistema estadounidense. El inglés fluido no es requisito: se construye a lo largo del proyecto.",
    },
  },
  {
    key: "escolha",
    phase: "brasil",
    title: { pt: "Escolha da escola", en: "Choosing the school", es: "Elección de la escuela" },
    marker: { pt: "Método S.A.F.E.®", en: "S.A.F.E.® Method", es: "Método S.A.F.E.®" },
    body: {
      pt: "Os quatro pilares orientam a decisão: o atleta e a família, o acadêmico, o financeiro e o esporte. A escola mais famosa nem sempre é a escola certa.",
      en: "The four pillars guide the decision: the athlete and family, academics, finances and sport. The most famous school isn't always the right school.",
      es: "Los cuatro pilares orientan la decisión: el atleta y su familia, lo académico, lo financiero y el deporte. La escuela más famosa no siempre es la escuela correcta.",
    },
  },
  {
    key: "high-school",
    phase: "eua",
    title: { pt: "High School nos EUA", en: "High School in the US", es: "High School en EE.\u00a0UU." },
    marker: { pt: "Da 9ª à 12ª série", en: "Grades 9 to 12", es: "Del 9.º al 12.º grado" },
    body: {
      pt: "O ensino médio americano é a vitrine para os recrutadores universitários: histórico acadêmico competitivo, preparação para o SAT e presença onde os treinadores observam.",
      en: "American high school is the showcase for college recruiters: a competitive academic record, SAT preparation and a presence where coaches are watching.",
      es: "La secundaria estadounidense es la vitrina para los reclutadores universitarios: historial académico competitivo, preparación para el SAT y presencia donde los entrenadores observan.",
    },
    link: { href: "/escolas", label: { pt: "Por dentro das escolas", en: "Inside the schools", es: "Dentro de las escuelas" } },
  },
  {
    key: "universidade",
    phase: "eua",
    title: { pt: "Universidade", en: "University", es: "Universidad" },
    marker: { pt: "NCAA · NAIA · NJCAA", en: "NCAA · NAIA · NJCAA", es: "NCAA · NAIA · NJCAA" },
    body: {
      pt: "É na universidade que acontecem as bolsas atléticas oficiais. A bolsa é resultado de um projeto bem executado, não um produto à venda.",
      en: "University is where official athletic scholarships happen. A scholarship is the result of a well-executed project, not a product for sale.",
      es: "Es en la universidad donde se otorgan las becas deportivas oficiales. La beca es el resultado de un proyecto bien ejecutado, no un producto a la venta.",
    },
    link: { href: "/historias", label: { pt: "Histórias de atletas", en: "Athlete stories", es: "Historias de atletas" } },
  },
];

// ─── Trilha "Assista" ─────────────────────────────────────────────────────────

export const WATCH = {
  eyebrow: { pt: "Assista", en: "Watch", es: "Mira" },
  titleBefore: { pt: "Aprenda com quem", en: "Learn from someone who", es: "Aprende con quien" },
  titleAccent: { pt: "viveu o sistema", en: "lived the system", es: "vivió el sistema" },
  lead: {
    pt: "Leandro Ribeiro, fundador da Bolsa Atleta USA, responde em vídeos curtos a perguntas das famílias: a idade ideal, os tipos de bolsa, a adaptação e o que separa quem cresce.",
    en: "In short videos, Leandro Ribeiro, founder of Bolsa Atleta USA, answers questions families ask: the ideal age, types of scholarships, adapting to a new country and what sets apart those who grow.",
    es: "Leandro Ribeiro, fundador de Bolsa Atleta USA, responde en videos cortos a preguntas de las familias: la edad ideal, los tipos de beca, la adaptación y lo que distingue a quienes crecen.",
  },
  languageNote: { pt: "", en: "Videos in Portuguese", es: "Videos en portugués" },
  institutionalMeta: { pt: "Bolsa Atleta USA", en: "Bolsa Atleta USA", es: "Bolsa Atleta USA" },
  prev: { pt: "Vídeos anteriores", en: "Previous videos", es: "Videos anteriores" },
  next: { pt: "Próximos vídeos", en: "Next videos", es: "Siguientes videos" },
  railLabel: { pt: "Vídeos do canal", en: "Channel videos", es: "Videos del canal" },
} satisfies Record<string, Localized>;

// ─── Perguntas frequentes (visível + JSON-LD FAQPage, mesma fonte) ────────────

export interface FaqItem {
  key: string;
  question: Localized;
  answer: Localized;
  /** Vídeo do canal que responde à pergunta (só quando responde de fato). */
  video?: MethodVideoChipData;
  /** Mostra o botão de candidatura abaixo da resposta. */
  cta?: boolean;
}

/** Seletividade e vagas limitadas: o vídeo que de fato responde "como funciona a avaliação". */
const SELECTIVE_CHIP: MethodVideoChipData = {
  videoId: "JkQ4M76oBA0",
  label: { pt: "Por que somos seletivos", en: "Why we are selective", es: "Por qué somos selectivos" },
};

export const FAQ_COPY = {
  eyebrow: { pt: "Perguntas frequentes", en: "FAQ", es: "Preguntas frecuentes" },
  titleBefore: { pt: "Dúvidas que toda", en: "Questions every", es: "Dudas que toda" },
  titleAccent: { pt: "família tem", en: "family asks", es: "familia tiene" },
  lead: {
    pt: "Respostas diretas sobre idade, inglês, bolsas e o processo de avaliação. O que não estiver aqui, a equipe responde na conversa estratégica.",
    en: "Straight answers about age, English, scholarships and the assessment process. Anything not covered here, our team will answer in the strategic conversation.",
    es: "Respuestas directas sobre edad, inglés, becas y el proceso de evaluación. Lo que no esté aquí, el equipo lo responde en la conversación estratégica.",
  },
  watchAnswer: { pt: "Assista à resposta", en: "Watch the answer", es: "Mira la respuesta" },
  cta: { pt: "Iniciar avaliação estratégica", en: "Start strategic assessment", es: "Iniciar evaluación estratégica" },
} satisfies Record<string, Localized>;

export const FAQ_ITEMS: FaqItem[] = [
  {
    key: "metodo",
    question: { pt: "O que é o Método S.A.F.E.®?", en: "What is the S.A.F.E.® Method?", es: "¿Qué es el Método S.A.F.E.®?" },
    answer: {
      pt: "O Método S.A.F.E.® é a metodologia proprietária da Bolsa Atleta USA para estruturar projetos de vida de jovens atletas no sistema educacional esportivo americano, cobrindo da High School à universidade com acompanhamento contínuo.",
      en: "The S.A.F.E.® Method is Bolsa Atleta USA's proprietary methodology for structuring life projects for young athletes in the American sports education system, from High School to university, with continuous guidance.",
      es: "El Método S.A.F.E.® es la metodología propia de Bolsa Atleta USA para estructurar proyectos de vida de jóvenes atletas en el sistema educativo deportivo estadounidense, desde la High School hasta la universidad, con acompañamiento continuo.",
    },
    video: SAFE_CHIPS.intro,
  },
  {
    key: "avaliacao",
    question: {
      pt: "Como funciona a avaliação estratégica?",
      en: "How does the strategic assessment work?",
      es: "¿Cómo funciona la evaluación estratégica?",
    },
    answer: {
      pt: "A avaliação estratégica é um processo seletivo individual. Candidaturas aprovadas são convidadas para uma conversa direta com o fundador da Bolsa Atleta USA. Trabalhamos com um número limitado de famílias por ciclo.",
      en: "The strategic assessment is an individual selection process. Approved applicants are invited to a direct conversation with the founder of Bolsa Atleta USA. We work with a limited number of families each cycle.",
      es: "La evaluación estratégica es un proceso de selección individual. Las candidaturas aprobadas reciben una invitación para conversar directamente con el fundador de Bolsa Atleta USA. Trabajamos con un número limitado de familias por ciclo.",
    },
    video: SELECTIVE_CHIP,
  },
  {
    key: "esportes",
    question: { pt: "Quais esportes são atendidos?", en: "Which sports do you work with?", es: "¿Con qué deportes trabajan?" },
    answer: {
      pt: "A Bolsa Atleta USA atende jovens atletas de diversas modalidades esportivas dentro do sistema NCAA e do sistema educacional americano de High School e Universidade.",
      en: "Bolsa Atleta USA works with young athletes from a range of sports within the NCAA system and the American High School and university education system.",
      es: "Bolsa Atleta USA trabaja con jóvenes atletas de diversas disciplinas deportivas dentro del sistema NCAA y del sistema educativo estadounidense de High School y universidad.",
    },
  },
  {
    key: "idade",
    question: {
      pt: "A partir de qual idade um atleta pode iniciar o processo?",
      en: "At what age can an athlete start the process?",
      es: "¿A partir de qué edad puede un atleta iniciar el proceso?",
    },
    answer: {
      pt: "Recomendamos iniciar o planejamento estratégico a partir dos 13 ou 14 anos, fase em que ainda há tempo hábil para alinhar trajetória esportiva, acadêmica e linguística com os requisitos do sistema americano. Casos de atletas mais velhos são avaliados individualmente.",
      en: "We recommend starting strategic planning at 13 or 14, when there is still enough time to align the athletic, academic and language path with the requirements of the American system. Older athletes are evaluated case by case.",
      es: "Recomendamos empezar la planificación estratégica a partir de los 13 o 14 años, cuando todavía hay tiempo para alinear la trayectoria deportiva, académica y lingüística con los requisitos del sistema estadounidense. Los casos de atletas mayores se evalúan de forma individual.",
    },
    video: WHY_HIGH_SCHOOL_CHIPS[0],
  },
  {
    key: "ingles",
    question: {
      pt: "É necessário ter inglês fluente para iniciar?",
      en: "Does the athlete need to be fluent in English to start?",
      es: "¿Es necesario hablar inglés con fluidez para empezar?",
    },
    answer: {
      pt: "Não. O domínio do inglês é construído ao longo do projeto. O que avaliamos no início é o potencial esportivo e acadêmico, o engajamento da família e a clareza do projeto de vida. O inglês entra como pilar de preparação dentro do Método S.A.F.E.®.",
      en: "No. English proficiency is built throughout the project. At the start, we assess athletic and academic potential, family commitment and how clear the life project is. English is part of the preparation within the S.A.F.E.® Method.",
      es: "No. El dominio del inglés se construye a lo largo del proyecto. Al inicio evaluamos el potencial deportivo y académico, el compromiso de la familia y la claridad del proyecto de vida. El inglés forma parte de la preparación dentro del Método S.A.F.E.®.",
    },
  },
  {
    key: "high-school-universidade",
    question: {
      pt: "Qual a diferença entre High School e Universidade nos EUA?",
      en: "What is the difference between High School and university in the US?",
      es: "¿Cuál es la diferencia entre High School y universidad en EE.\u00a0UU.?",
    },
    answer: {
      pt: "High School é o ensino médio americano (geralmente da 9ª à 12ª série) e funciona como vitrine para recrutadores universitários. Universidade (College/University) é onde ocorrem as bolsas atléticas oficiais via NCAA, NAIA ou NJCAA. A Bolsa Atleta USA atua estrategicamente em ambas as fases.",
      en: "High School is American secondary school (usually grades 9 to 12) and works as a showcase for college recruiters. University (college) is where official athletic scholarships happen, through the NCAA, NAIA or NJCAA. Bolsa Atleta USA works strategically in both stages.",
      es: "La High School es la secundaria estadounidense (en general, del 9.º al 12.º grado) y funciona como vitrina para los reclutadores universitarios. La universidad (college) es donde se otorgan las becas deportivas oficiales, a través de la NCAA, la NAIA o la NJCAA. Bolsa Atleta USA actúa de forma estratégica en ambas etapas.",
    },
  },
  {
    key: "garantia",
    question: {
      pt: "A Bolsa Atleta USA garante uma bolsa esportiva nos EUA?",
      en: "Does Bolsa Atleta USA guarantee a sports scholarship in the US?",
      es: "¿Bolsa Atleta USA garantiza una beca deportiva en EE.\u00a0UU.?",
    },
    answer: {
      pt: "Não trabalhamos com promessa de bolsa. Trabalhamos com método e direção estratégica para maximizar as chances do atleta dentro do sistema esportivo-educacional americano. A bolsa é resultado de um projeto bem executado, não um produto à venda.",
      en: "We don't promise scholarships. We work with method and strategic direction to maximize the athlete's chances within the American sports and education system. A scholarship is the result of a well-executed project, not a product for sale.",
      es: "No trabajamos con promesas de beca. Trabajamos con método y dirección estratégica para maximizar las posibilidades del atleta dentro del sistema deportivo y educativo estadounidense. La beca es el resultado de un proyecto bien ejecutado, no un producto a la venta.",
    },
  },
  {
    key: "inicio",
    question: { pt: "Como faço para iniciar o processo?", en: "How do I start the process?", es: "¿Cómo inicio el proceso?" },
    answer: {
      pt: "O primeiro passo é a Avaliação Estratégica: um formulário de candidatura disponível no site. As famílias selecionadas são convidadas para uma conversa direta com o fundador. Por trabalharmos com vagas limitadas, nem todas as candidaturas avançam.",
      en: "The first step is the Strategic Assessment: an application form available on the website. Selected families are invited to a direct conversation with the founder. Because spots are limited, not every application moves forward.",
      es: "El primer paso es la Evaluación Estratégica: un formulario de candidatura disponible en el sitio. Las familias seleccionadas reciben una invitación para conversar directamente con el fundador. Como trabajamos con plazas limitadas, no todas las candidaturas avanzan.",
    },
    cta: true,
  },
];
