import type { Localized, VideoCategory, VideoChapter, YoutubeVideo } from "./types";

/*
 * Catálogo do canal @BolsaAtletaUSA (levantado em 2026-10-12): vídeos públicos e os não
 * listados que estão em playlists públicas. Títulos reescritos para o site (o canal tem caixa
 * alta e erros como "DAUNIVERSITY" e "IDEADE"); fatos só do que está no título, na descrição
 * ou nos capítulos. O Short "Zemyna Lekaviduté" (eRlMmr6SnBo) fica de fora até o dono
 * confirmar que é atleta da casa.
 *
 * `kind` segue o formato do arquivo, não a aba do canal: os depoimentos de família verticais
 * (405x720) entram como "short" porque é isso que define card e player em 9:16.
 */

/** "mm:ss" do YouTube para segundos (parâmetro start= do embed). */
function toSeconds(timestamp: string): number {
  const [minutes, seconds] = timestamp.split(":").map(Number);
  return minutes * 60 + seconds;
}

function ch(timestamp: string, pt: string, en: string, es: string): VideoChapter {
  return { start: toSeconds(timestamp), label: { pt, en, es } };
}

// Ordem dentro de cada categoria = ordem de curadoria (quem consome pode só filtrar).
export const VIDEOS: YoutubeVideo[] = [
  // ─── Tours: high schools e universidades ────────────────────────────────────
  {
    id: "qCeneZf3KgM",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Dentro da Montverde Academy: o que ninguém mostra sobre a escola",
      en: "Inside Montverde Academy: what no one shows you about the school",
      es: "Dentro de Montverde Academy: lo que nadie muestra de la escuela",
    },
    duration: "25:07",
    published: "2026-10-06",
    school: "montverde",
    people: ["Coach Andrew", "Leonardo", "Isadora Santiago", "Leandro Ribeiro"],
    chapters: [
      ch("00:00", "Boas-vindas do Coach Andrew, diretor do SIMA", "Welcome from Coach Andrew, SIMA director", "Bienvenida del Coach Andrew, director del SIMA"),
      ch("00:55", "A filosofia Montverde: pessoa, estudante, atleta", "The Montverde philosophy: person, student, athlete", "La filosofía Montverde: persona, estudiante, atleta"),
      ch("01:49", "Ex-alunos que se tornaram profissionais", "Alumni who went on to play professionally", "Exalumnos que llegaron al profesionalismo"),
      ch("03:12", "Encontro com o diretor de metodologia do SIMA", "Meeting SIMA's director of methodology", "Encuentro con el director de metodología del SIMA"),
      ch("04:52", "Conversa com Leonardo, atleta Bolsa Atleta USA na Montverde", "A talk with Leonardo, a Bolsa Atleta USA athlete at Montverde", "Charla con Leonardo, atleta de Bolsa Atleta USA en Montverde"),
      ch("05:34", "Middle school e divisão por categorias", "Middle school and age groups", "Middle school y división por categorías"),
      ch("06:15", "Treinos integrados ao horário escolar", "Training built into the school day", "Entrenamientos integrados al horario escolar"),
      ch("06:49", "Famílias internacionais que moram perto do campus", "International families living near campus", "Familias internacionales que viven cerca del campus"),
      ch("07:33", "Autonomia e disciplina dos alunos internos", "Independence and discipline of boarding students", "Autonomía y disciplina de los alumnos internos"),
      ch("08:14", "Sistema de penalidades e cultura da escola", "Discipline system and school culture", "Sistema de sanciones y cultura de la escuela"),
      ch("09:20", "Os seis campos de futebol do SIMA", "SIMA's six soccer fields", "Las seis canchas de fútbol del SIMA"),
      ch("10:08", "Suporte acadêmico diário dos professores", "Daily academic support from teachers", "Apoyo académico diario de los profesores"),
      ch("11:07", "Times internacionais que visitam a Montverde", "International teams that visit Montverde", "Equipos internacionales que visitan Montverde"),
      ch("11:42", "Os programas esportivos de referência", "The school's flagship athletic programs", "Los programas deportivos de referencia"),
      ch("12:14", "Alimentação completa para atletas de alta performance", "Complete nutrition for high-performance athletes", "Alimentación completa para atletas de alto rendimiento"),
      ch("13:54", "Alunos monitores e vida social no fim de semana", "Prefects and weekend social life", "Alumnos monitores y vida social el fin de semana"),
      ch("15:00", "Centro de tecnologia, música, teatro e artes", "Technology center, music, theater and arts", "Centro de tecnología, música, teatro y artes"),
      ch("15:58", "Como a Montverde forma líderes de verdade", "How Montverde develops real leaders", "Cómo Montverde forma líderes de verdad"),
      ch("16:47", "GPA, admissões de elite e a régua acadêmica", "GPA, elite admissions and the academic bar", "GPA, admisiones de élite y la exigencia académica"),
      ch("17:35", "O peso de começar no 9º ano e o programa de inglês (ESL)", "Why starting in Grade 9 matters, and the ESL program", "La importancia de empezar en 9.º grado y el programa de inglés (ESL)"),
      ch("18:11", "Brasileiros no SIMA e no internato", "Brazilians at SIMA and in boarding", "Brasileños en el SIMA y en el internado"),
      ch("19:00", "A high school principal e a flexibilidade geográfica", "The main high school and geographic flexibility", "La high school principal y la flexibilidad geográfica"),
      ch("19:54", "Alunos aprovados em Duke, Harvard, UCLA, MIT e Cornell", "Students admitted to Duke, Harvard, UCLA, MIT and Cornell", "Alumnos admitidos en Duke, Harvard, UCLA, MIT y Cornell"),
      ch("20:35", "Turmas pequenas, cursos AP e Honors", "Small classes, AP and Honors courses", "Clases pequeñas, cursos AP y Honors"),
      ch("21:17", "Student Center e convivência global", "The Student Center and a global community", "El Student Center y la convivencia global"),
      ch("22:34", "Festivais culturais e integração internacional", "Cultural festivals and international integration", "Festivales culturales e integración internacional"),
      ch("23:18", "\"Você veio estudar e jogar futebol. Não só jogar.\"", "\"You came here to study and play soccer. Not just play.\"", "\"Viniste a estudiar y jugar fútbol. No solo a jugar.\""),
      ch("24:02", "Isadora Santiago, atleta Bolsa Atleta USA e da Seleção, conta sua experiência", "Isadora Santiago, a Bolsa Atleta USA athlete and Brazil national team player, shares her experience", "Isadora Santiago, atleta de Bolsa Atleta USA y de la Selección, cuenta su experiencia"),
    ],
  },
  {
    id: "maZ2lIeo5EE",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "The Hotchkiss School: a experiência de uma boarding school de elite",
      en: "The Hotchkiss School: an elite boarding school experience",
      es: "The Hotchkiss School: la experiencia de un internado de élite",
    },
    duration: "14:07",
    published: "2025-12-21",
    school: "hotchkiss",
  },
  {
    id: "zlJ3WUHY_BI",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Dentro da IMG Academy: tour completo em português",
      en: "Inside IMG Academy: a full tour in Portuguese",
      es: "Dentro de IMG Academy: recorrido completo en portugués",
    },
    duration: "23:05",
    published: "2026-05-22",
    school: "img-academy",
    people: ["Leandro Ribeiro"],
  },
  {
    id: "Byr7E1W8JSk",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Tour exclusivo pela Benfica Residential Academy, a academia do Benfica nos EUA",
      en: "Exclusive tour of Benfica Residential Academy, Benfica's academy in the US",
      es: "Recorrido exclusivo por Benfica Residential Academy, la academia del Benfica en EE. UU.",
    },
    duration: "11:18",
    published: "2026-05-03",
    school: "benfica",
  },
  {
    id: "qlSNBAQQPUs",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Dentro de Harvard: o verdadeiro processo de recrutamento atlético nos EUA",
      en: "Inside Harvard: how athletic recruiting really works in the US",
      es: "Dentro de Harvard: el verdadero proceso de reclutamiento deportivo en EE. UU.",
    },
    duration: "32:40",
    published: "2025-11-08",
    school: "harvard",
    people: ["Leandro Ribeiro"],
  },
  {
    id: "gpT0gG8nK6U",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Dentro da University of Florida: tour com o head coach do futebol feminino dos Gators",
      en: "Inside the University of Florida: a tour with the Gators women's soccer head coach",
      es: "Dentro de la University of Florida: recorrido con el head coach del fútbol femenino de los Gators",
    },
    duration: "22:19",
    published: "2026-05-09",
    school: "florida",
    people: ["Nick Zimmerman"],
  },
  {
    id: "gvcUVL0j_eQ",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Dentro da University of Miami: tour com Ken Masuhr, head coach do futebol feminino",
      en: "Inside the University of Miami: a tour with Ken Masuhr, women's soccer head coach",
      es: "Dentro de la University of Miami: recorrido con Ken Masuhr, head coach del fútbol femenino",
    },
    duration: "23:04",
    published: "2026-05-28",
    school: "miami",
    people: ["Ken Masuhr"],
    chapters: [
      ch("00:00", "Introdução", "Introduction", "Introducción"),
      ch("01:30", "Apresentação do coach Ken Masuhr", "Meet coach Ken Masuhr", "Presentación del coach Ken Masuhr"),
      ch("03:30", "Estrutura do programa de futebol feminino", "Inside the women's soccer program", "Estructura del programa de fútbol femenino"),
      ch("06:00", "Filosofia de jogo dos Hurricanes", "The Hurricanes' style of play", "Filosofía de juego de los Hurricanes"),
      ch("09:00", "Critérios de recrutamento", "Recruiting criteria", "Criterios de reclutamiento"),
      ch("12:30", "O lado acadêmico da University of Miami", "Academics at the University of Miami", "La parte académica de la University of Miami"),
      ch("15:30", "Vida em Miami e ambiente do campus", "Life in Miami and campus atmosphere", "Vida en Miami y ambiente del campus"),
      ch("18:30", "Atletas que passaram pelo programa", "Athletes who came through the program", "Atletas que pasaron por el programa"),
      ch("21:00", "Mensagem do coach para as famílias brasileiras", "The coach's message to Brazilian families", "Mensaje del coach a las familias brasileñas"),
      ch("22:30", "Encerramento", "Wrap-up", "Cierre"),
    ],
  },
  {
    id: "t2-hpjOVjNQ",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Dentro da FIU: a única universidade D1 com futebol masculino em Miami",
      en: "Inside FIU: the only D1 university with men's soccer in Miami",
      es: "Dentro de FIU: la única universidad D1 con fútbol masculino en Miami",
    },
    duration: "32:01",
    published: "2026-05-15",
    school: "fiu",
  },
  {
    id: "ZPXd4GKYvQ8",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Acesso exclusivo à Taft School, uma das escolas mais seletivas dos EUA",
      en: "Exclusive access to the Taft School, one of the most selective schools in the US",
      es: "Acceso exclusivo a Taft School, una de las escuelas más selectivas de EE. UU.",
    },
    duration: "21:48",
    published: "2025-12-05",
    school: "taft",
    people: ["Coach Parente"],
  },
  {
    id: "VLnk65O91Pg",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Dentro da RPS Academies: high school num resort, com caminhos para o college e o profissional",
      en: "Inside RPS Academies: a resort-campus high school with paths to college and the pros",
      es: "Dentro de RPS Academies: una high school en un resort, con caminos al college y al profesionalismo",
    },
    duration: "9:21",
    published: "2026-06-04",
    school: "rps",
    people: ["Joshua", "Tiago Calvano"],
  },
  {
    id: "2CTSgmKx0-U",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Por dentro da Jacksonville University: o futebol feminino dos JU Dolphins, NCAA D1 na Flórida",
      en: "Inside Jacksonville University: JU Dolphins women's soccer, NCAA D1 in Florida",
      es: "Dentro de Jacksonville University: el fútbol femenino de los JU Dolphins, NCAA D1 en Florida",
    },
    duration: "11:45",
    published: "2026-09-10",
    school: "jacksonville",
    people: ["Ryan Moon", "Leandro Ribeiro"],
    chapters: [
      ch("00:00", "Chegada à Jacksonville University", "Arriving at Jacksonville University", "Llegada a Jacksonville University"),
      ch("00:30", "Recepção de Ryan Moon", "Welcome from Ryan Moon", "Recibimiento de Ryan Moon"),
      ch("01:00", "Instalações do futebol feminino", "Women's soccer facilities", "Instalaciones del fútbol femenino"),
      ch("02:00", "O que um head coach D1 busca em uma atleta internacional", "What a D1 head coach looks for in an international athlete", "Qué busca un head coach D1 en una atleta internacional"),
      ch("03:00", "Por que a mentalidade pesa mais que o vídeo de highlights", "Why mindset matters more than a highlight tape", "Por qué la mentalidad pesa más que el video de highlights"),
      ch("04:00", "Elenco internacional e diversidade cultural", "An international roster and cultural diversity", "Plantel internacional y diversidad cultural"),
      ch("05:00", "Atletas da Bolsa Atleta USA no radar do programa", "Bolsa Atleta USA athletes on the program's radar", "Atletas de Bolsa Atleta USA en el radar del programa"),
      ch("06:00", "Encerramento", "Wrap-up", "Cierre"),
    ],
  },
  {
    id: "-16QtoD5eis",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Por dentro da Florida Gulf Coast University (FGCU): futebol na NCAA D1",
      en: "Inside Florida Gulf Coast University (FGCU): NCAA D1 soccer",
      es: "Dentro de Florida Gulf Coast University (FGCU): fútbol en la NCAA D1",
    },
    duration: "29:40",
    published: "2026-06-30",
    school: "fgcu",
    people: ["Jim Blankenship", "Alex Ng", "Austin O'Connor", "Alia Skinner"],
  },
  {
    id: "IcazwAYhDSk",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Por dentro da University of North Florida: futebol masculino e o caminho para a NCAA D1",
      en: "Inside the University of North Florida: men's soccer and the path to NCAA D1",
      es: "Dentro de la University of North Florida: fútbol masculino y el camino a la NCAA D1",
    },
    duration: "28:23",
    published: "2026-06-10",
    school: "unf",
    people: ["Jamie Davies"],
  },
  {
    id: "TEvAVEOA28w",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Por dentro da University of Central Florida: o futebol masculino da UCF",
      en: "Inside the University of Central Florida: UCF men's soccer",
      es: "Dentro de la University of Central Florida: el fútbol masculino de UCF",
    },
    duration: "11:05",
    published: "2026-08-17",
    school: "ucf",
  },
  {
    id: "MAMzOtT6LaY",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Por dentro da Flagler College: futebol num dos campi mais bonitos dos EUA",
      en: "Inside Flagler College: soccer on one of the most beautiful campuses in the US",
      es: "Dentro de Flagler College: fútbol en uno de los campus más bonitos de EE. UU.",
    },
    duration: "32:07",
    published: "2026-08-17",
    school: "flagler",
  },
  {
    id: "l1h7TLvnZC8",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Tour completo pelo College of the Holy Cross, NCAA D1",
      en: "Full tour of the College of the Holy Cross, NCAA D1",
      es: "Recorrido completo por College of the Holy Cross, NCAA D1",
    },
    duration: "17:55",
    published: "2025-11-16",
    school: "holy-cross",
  },
  {
    id: "pG9mk__UxiA",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Tour pela Vermont Academy, high school de elite nos EUA",
      en: "Vermont Academy tour: an elite US high school",
      es: "Recorrido por Vermont Academy, high school de élite en EE. UU.",
    },
    duration: "23:36",
    published: "2025-12-21",
    school: "vermont-academy",
  },
  {
    id: "Lv-aZmKtc10",
    kind: "video",
    category: "tour_instituicao",
    title: {
      pt: "Tour pela Clark University: college soccer na NCAA DIII",
      en: "Clark University tour: college soccer in NCAA DIII",
      es: "Recorrido por Clark University: college soccer en la NCAA DIII",
    },
    duration: "15:09",
    published: "2025-12-22",
    school: "clark",
  },

  // ─── Fundador: Leandro Ribeiro em primeira pessoa ───────────────────────────
  {
    id: "2qtkeGlu5LE",
    kind: "video",
    category: "fundador_conteudo",
    title: {
      pt: "Método S.A.F.E.: como escolher a escola ideal para o futuro do seu filho ou filha",
      en: "The S.A.F.E. Method: how to choose the right school for your child's future",
      es: "Método S.A.F.E.: cómo elegir la escuela ideal para el futuro de tu hijo o hija",
    },
    duration: "2:28",
    published: "2026-01-05",
    people: ["Leandro Ribeiro"],
  },
  {
    id: "cLPA1PQjdiM",
    kind: "video",
    category: "fundador_conteudo",
    title: {
      pt: "Você não precisa de oportunidade. Você precisa de direção",
      en: "You don't need an opportunity. You need direction",
      es: "No necesitas una oportunidad. Necesitas dirección",
    },
    duration: "2:25",
    published: "2026-09-04",
    people: ["Leandro Ribeiro"],
    chapters: [
      ch("00:00", "A opinião dos outros sobre a sua vida", "Other people's opinions about your life", "La opinión de los demás sobre tu vida"),
      ch("00:30", "O risco de viver a expectativa alheia", "The risk of living up to others' expectations", "El riesgo de vivir las expectativas ajenas"),
      ch("00:45", "O que muitos atletas ainda não entendem", "What many athletes still don't understand", "Lo que muchos atletas todavía no entienden"),
      ch("01:10", "O que ninguém vê na jornada de um atleta", "What no one sees in an athlete's journey", "Lo que nadie ve en el camino de un atleta"),
      ch("01:30", "Nem todo desvio está te tirando do caminho", "Not every detour takes you off course", "No todo desvío te saca del camino"),
      ch("01:50", "Você precisa de mais do que oportunidade", "You need more than an opportunity", "Necesitas más que una oportunidad"),
      ch("02:10", "O que essa experiência realmente forma", "What this experience really builds", "Lo que esta experiencia realmente forma"),
    ],
  },
  {
    id: "JJOHwplQ51I",
    kind: "video",
    category: "fundador_conteudo",
    title: {
      pt: "Bolsas para atletas nas high schools americanas: as 4 categorias que ninguém explica",
      en: "Athletic scholarships at American high schools: the 4 categories no one explains",
      es: "Becas para atletas en las high schools de EE. UU.: las 4 categorías que nadie explica",
    },
    duration: "3:37",
    published: "2026-09-03",
    people: ["Leandro Ribeiro"],
    chapters: [
      ch("0:00", "A pergunta que eu recebo todos os dias", "The question I get every day", "La pregunta que recibo todos los días"),
      ch("0:14", "Por que a maioria das famílias escolhe pelo critério errado", "Why most families choose by the wrong criteria", "Por qué la mayoría de las familias elige con el criterio equivocado"),
      ch("0:38", "As 4 categorias de prep schools americanas", "The 4 categories of American prep schools", "Las 4 categorías de prep schools estadounidenses"),
      ch("0:48", "Categoria 1: escolas tradicionais com ajuda financeira", "Category 1: traditional schools with financial aid", "Categoría 1: escuelas tradicionales con ayuda financiera"),
      ch("1:27", "Categoria 2: escolas onde o treinador gerencia as bolsas", "Category 2: schools where the coach manages scholarships", "Categoría 2: escuelas donde el entrenador gestiona las becas"),
      ch("1:47", "Categoria 3: escolas que usam a bolsa como marketing", "Category 3: schools that use scholarships as marketing", "Categoría 3: escuelas que usan la beca como marketing"),
      ch("2:29", "Categoria 4: escolas com estrutura de investimento definida", "Category 4: schools with a set investment structure", "Categoría 4: escuelas con una estructura de inversión definida"),
      ch("2:42", "Método S.A.F.E.: como escolhemos a escola certa", "The S.A.F.E. Method: how we choose the right school", "Método S.A.F.E.: cómo elegimos la escuela correcta"),
    ],
  },
  {
    id: "VfmQ2LGCKpw",
    kind: "video",
    category: "fundador_conteudo",
    title: {
      pt: "A escola mais famosa nem sempre é a escola certa",
      en: "The most famous school isn't always the right school",
      es: "La escuela más famosa no siempre es la escuela correcta",
    },
    duration: "3:52",
    published: "2026-06-16",
    people: ["Leandro Ribeiro"],
    chapters: [
      ch("00:00", "A escola mais famosa nem sempre é a escola certa", "The most famous school isn't always the right one", "La escuela más famosa no siempre es la correcta"),
      ch("00:50", "O que realmente desenvolve um atleta", "What really develops an athlete", "Lo que realmente desarrolla a un atleta"),
      ch("01:00", "Vivendo o sistema americano por dentro", "Living the American system from the inside", "Vivir el sistema estadounidense desde adentro"),
      ch("01:44", "Decisões na high school definem o futuro universitário", "High school decisions shape the college future", "Las decisiones en la high school definen el futuro universitario"),
      ch("02:00", "Por que trabalhamos com projetos de vida", "Why we work with life projects", "Por qué trabajamos con proyectos de vida"),
      ch("02:38", "O conceito da Educação Esportiva Inteligente", "The Smart Sports Education concept", "El concepto de Educación Deportiva Inteligente"),
    ],
  },
  {
    id: "Ke-LTSF8Hes",
    kind: "video",
    category: "fundador_conteudo",
    title: {
      pt: "Qual a idade ideal para enviar seu filho ou filha para os EUA?",
      en: "What's the ideal age to send your child to the US?",
      es: "¿Cuál es la edad ideal para enviar a tu hijo o hija a EE. UU.?",
    },
    duration: "3:32",
    published: "2025-08-05",
    people: ["Leandro Ribeiro"],
  },
  {
    id: "vzwgRGP3zns",
    kind: "video",
    category: "fundador_conteudo",
    title: {
      pt: "Estudar e jogar futebol nos EUA: o que ninguém te conta sobre a adaptação",
      en: "Studying and playing soccer in the US: what no one tells you about adapting",
      es: "Estudiar y jugar fútbol en EE. UU.: lo que nadie te cuenta sobre la adaptación",
    },
    duration: "3:49",
    published: "2026-04-20",
    people: ["Leandro Ribeiro"],
    chapters: [
      ch("00:00", "Essa jornada vai exigir adaptação, e tudo bem", "This journey will require adapting, and that's okay", "Este camino te va a exigir adaptación, y está bien"),
      ch("00:21", "O que acontece enquanto você treina, joga e estuda", "What happens while you train, play and study", "Lo que pasa mientras entrenas, juegas y estudias"),
      ch("01:02", "Você precisa aprender mais sobre si do que sobre o jogo", "You need to learn more about yourself than about the game", "Necesitas aprender más sobre ti que sobre el juego"),
      ch("01:21", "As qualidades que crescem além do esporte", "The qualities that grow beyond the sport", "Las cualidades que crecen más allá del deporte"),
      ch("01:42", "Experiência não é só quando tudo dá certo", "Experience isn't only when everything goes right", "La experiencia no es solo cuando todo sale bien"),
      ch("02:02", "Os valores que formam a pessoa, não só o atleta", "The values that shape the person, not just the athlete", "Los valores que forman a la persona, no solo al atleta"),
      ch("02:16", "O que os pais realmente sonham", "What parents really dream of", "Lo que los padres realmente sueñan"),
      ch("02:47", "Por que essa jornada precisa ser bem conduzida", "Why this journey needs to be well guided", "Por qué este camino necesita estar bien guiado"),
      ch("03:05", "Educação Esportiva Inteligente", "Smart Sports Education", "Educación Deportiva Inteligente"),
    ],
  },
  {
    id: "NvAieGB-F3E",
    kind: "video",
    category: "fundador_conteudo",
    title: {
      pt: "Por que atletas talentosos fracassam nos Estados Unidos (e o que separa quem cresce)",
      en: "Why talented athletes fail in the United States (and what sets apart those who grow)",
      es: "Por qué atletas talentosos fracasan en Estados Unidos (y qué distingue a quienes crecen)",
    },
    duration: "3:28",
    published: "2026-08-22",
    people: ["Leandro Ribeiro"],
    // Sem capítulos: os da descrição passam da duração do vídeo (até 05:30 num vídeo de 3:28).
  },
  {
    id: "ordP1Ud6pD8",
    kind: "video",
    category: "fundador_conteudo",
    title: {
      pt: "O que ninguém te conta sobre fracassar na jornada de estudar e jogar nos EUA",
      en: "What no one tells you about failing on the journey to study and play in the US",
      es: "Lo que nadie te cuenta sobre fracasar en el camino de estudiar y jugar en EE. UU.",
    },
    duration: "4:56",
    published: "2026-05-21",
    people: ["Leandro Ribeiro"],
  },
  {
    id: "1QeP5rjTfGw",
    kind: "video",
    category: "fundador_conteudo",
    title: {
      pt: "Estudar e jogar futebol nos EUA: o guia de quem viveu 7 anos lá",
      en: "Studying and playing soccer in the US: a guide from someone who lived it for 7 years",
      es: "Estudiar y jugar fútbol en EE. UU.: la guía de quien vivió 7 años allí",
    },
    duration: "3:28",
    published: "2026-07-02",
    people: ["Leandro Ribeiro"],
  },
  {
    id: "MAZiGikpZWw",
    kind: "video",
    category: "fundador_conteudo",
    title: {
      pt: "A maior mentira sobre estudar e jogar nos EUA (e quase todo mundo cai nela)",
      en: "The biggest lie about studying and playing in the US (and almost everyone falls for it)",
      es: "La mayor mentira sobre estudiar y jugar en EE. UU. (y casi todos caen en ella)",
    },
    duration: "3:56",
    published: "2026-03-27",
    people: ["Leandro Ribeiro"],
  },

  // ─── Institucional da marca (2025) ──────────────────────────────────────────
  {
    id: "nlY464cX1Vs",
    kind: "video",
    category: "institucional",
    title: {
      pt: "Bolsa Atleta USA: vídeo institucional",
      en: "Bolsa Atleta USA: brand film",
      es: "Bolsa Atleta USA: video institucional",
    },
    duration: "4:08",
    published: "2025-07-01",
  },
  {
    id: "CIJEYd1-afI",
    kind: "video",
    category: "institucional",
    title: {
      pt: "Educação Esportiva Inteligente: muito além do intercâmbio esportivo",
      en: "Smart Sports Education: far beyond a sports exchange program",
      es: "Educación Deportiva Inteligente: mucho más que un intercambio deportivo",
    },
    duration: "1:28",
    published: "2025-08-05",
  },
  {
    id: "oPWy-LfRDus",
    kind: "video",
    category: "institucional",
    title: {
      pt: "Por que criamos a Bolsa Atleta USA?",
      en: "Why did we create Bolsa Atleta USA?",
      es: "¿Por qué creamos Bolsa Atleta USA?",
    },
    duration: "1:21",
    published: "2025-08-05",
  },
  {
    id: "JkQ4M76oBA0",
    kind: "video",
    category: "institucional",
    title: {
      pt: "Por que não trabalhamos com qualquer atleta?",
      en: "Why don't we work with just any athlete?",
      es: "¿Por qué no trabajamos con cualquier atleta?",
    },
    duration: "1:26",
    published: "2025-08-05",
  },

  // ─── Depoimentos de atletas ─────────────────────────────────────────────────
  {
    id: "P9QiMRW4dII",
    kind: "short",
    category: "depoimento_atleta",
    title: {
      pt: "Isadora Santiago: da Seleção Brasileira para a Montverde Academy",
      en: "Isadora Santiago: from Brazil's national team to Montverde Academy",
      es: "Isadora Santiago: de la Selección Brasileña a Montverde Academy",
    },
    duration: "1:06",
    published: "2026-02-18",
    people: ["Isadora Santiago"],
  },
  {
    id: "arIURGPP828",
    kind: "short",
    category: "depoimento_atleta",
    title: {
      pt: "Depoimento de Liz Valverde",
      en: "Liz Valverde's testimonial",
      es: "Testimonio de Liz Valverde",
    },
    duration: "1:21",
    published: "2026-02-22",
    people: ["Liz Valverde"],
  },
  {
    id: "7iso2Aj0PuQ",
    kind: "short",
    category: "depoimento_atleta",
    title: {
      pt: "Depoimento de Benjamin Bertolucci",
      en: "Benjamin Bertolucci's testimonial",
      es: "Testimonio de Benjamin Bertolucci",
    },
    duration: "1:29",
    published: "2026-02-18",
    people: ["Benjamin Bertolucci"],
  },
  {
    id: "kzh_jb9rmWI",
    kind: "short",
    category: "depoimento_atleta",
    title: {
      pt: "Depoimento de Robson Moraes",
      en: "Robson Moraes's testimonial",
      es: "Testimonio de Robson Moraes",
    },
    duration: "0:18",
    published: "2026-02-18",
    people: ["Robson Moraes"],
  },
  {
    id: "VzPQT-vdqbE",
    kind: "short",
    category: "depoimento_atleta",
    title: {
      pt: "Depoimento de Lin Feng",
      en: "Lin Feng's testimonial",
      es: "Testimonio de Lin Feng",
    },
    duration: "0:17",
    published: "2026-02-21",
    people: ["Lin Feng"],
  },
  // Versões 16:9 de histórias que já têm Short: para layouts horizontais, nunca na mesma tela do Short.
  {
    id: "AJCuLfHwTCY",
    kind: "video",
    category: "depoimento_atleta",
    title: {
      pt: "Liz Valverde: do Coritinhas à Seleção Brasileira e ao Benfica Residential Academy",
      en: "Liz Valverde: from Coritinhas to Brazil's national team and Benfica Residential Academy",
      es: "Liz Valverde: del Coritinhas a la Selección Brasileña y a Benfica Residential Academy",
    },
    duration: "1:41",
    published: "2026-05-02",
    people: ["Liz Valverde"],
  },
  {
    id: "pwOM4MG0R3Y",
    kind: "video",
    category: "depoimento_atleta",
    title: {
      pt: "Isadora Santiago: da Seleção Brasileira para a Montverde Academy",
      en: "Isadora Santiago: from Brazil's national team to Montverde Academy",
      es: "Isadora Santiago: de la Selección Brasileña a Montverde Academy",
    },
    duration: "1:06",
    published: "2025-11-07",
    people: ["Isadora Santiago"],
  },

  // ─── Depoimentos de famílias ────────────────────────────────────────────────
  {
    id: "enS5ZAGRJ0g",
    kind: "short",
    category: "depoimento_familia",
    title: {
      pt: "Depoimento de Maika",
      en: "Maika's testimonial",
      es: "Testimonio de Maika",
    },
    duration: "2:53",
    published: "2026-02-18",
    people: ["Maika"],
  },
  {
    id: "wJUf_efdc8s",
    kind: "short",
    category: "depoimento_familia",
    title: {
      pt: "Depoimento de Luciano Olimpio, pai da atleta Liz Valverde",
      en: "Testimonial from Luciano Olimpio, father of athlete Liz Valverde",
      es: "Testimonio de Luciano Olimpio, padre de la atleta Liz Valverde",
    },
    duration: "1:22",
    published: "2026-03-03",
    people: ["Luciano Olimpio", "Liz Valverde"],
  },
  {
    id: "1WDFoyA5p8U",
    kind: "short",
    category: "depoimento_familia",
    title: {
      pt: "Depoimento do pai de Bento Mello",
      en: "Testimonial from Bento Mello's father",
      es: "Testimonio del padre de Bento Mello",
    },
    duration: "1:03",
    published: "2026-02-18",
    people: ["Bento Mello"],
  },
  {
    id: "8RtvPgeZ8yI",
    kind: "short",
    category: "depoimento_familia",
    title: {
      pt: "Depoimento de Gabriel Machado",
      en: "Gabriel Machado's testimonial",
      es: "Testimonio de Gabriel Machado",
    },
    duration: "1:35",
    published: "2026-02-18",
    people: ["Gabriel Machado"],
  },
  {
    id: "KFkoxh4nTHU",
    kind: "short",
    category: "depoimento_familia",
    title: {
      pt: "Depoimento de Priscila Moraes",
      en: "Priscila Moraes's testimonial",
      es: "Testimonio de Priscila Moraes",
    },
    duration: "0:26",
    published: "2026-02-18",
    people: ["Priscila Moraes"],
  },
  {
    id: "lXzJkGgZkTw",
    kind: "video",
    category: "depoimento_familia",
    title: {
      pt: "Depoimento da família Comperlingo",
      en: "The Comperlingo family's testimonial",
      es: "Testimonio de la familia Comperlingo",
    },
    duration: "3:02",
    published: "2026-02-18",
    people: ["Família Comperlingo"],
  },
];

const VIDEOS_BY_ID = new Map(VIDEOS.map((video) => [video.id, video]));

export function getVideo(id: string): YoutubeVideo | undefined {
  return VIDEOS_BY_ID.get(id);
}

export function videosByCategory(category: VideoCategory): YoutubeVideo[] {
  return VIDEOS.filter((video) => video.category === category);
}

/** Os 18 tours da série "Dentro da", na ordem de curadoria (abre com o mais novo, Montverde). */
export const TOUR_VIDEOS = videosByCategory("tour_instituicao");

/** Conteúdo do fundador + institucionais: base para /metodo e /sobre. */
export const EDUCATIONAL_VIDEOS = VIDEOS.filter(
  (video) => video.category === "fundador_conteudo" || video.category === "institucional",
);

/** Um Short vertical por atleta, sem duplicatas: o trilho de depoimentos. */
export const ATHLETE_TESTIMONIALS = videosByCategory("depoimento_atleta").filter((video) => video.kind === "short");

/** Versões 16:9 (Liz e Isadora) para layouts horizontais; não misturar com o Short da mesma atleta. */
export const ATHLETE_TESTIMONIALS_WIDE = videosByCategory("depoimento_atleta").filter((video) => video.kind === "video");

export const FAMILY_TESTIMONIALS = videosByCategory("depoimento_familia");

/** Trecho de vídeo com link direto para o segundo exato (capítulo). */
export interface VideoMoment {
  videoId: string;
  start: number;
  label: Localized;
  /** Quem fala no trecho, quando o título do capítulo ou a descrição diz. */
  speaker?: string;
  role?: Localized;
  /** Slug da escola do tour. */
  school?: string;
}

function moment(videoId: string, timestamp: string, speaker?: string, role?: Localized): VideoMoment {
  const video = getVideo(videoId);
  const start = toSeconds(timestamp);
  const chapter = video?.chapters?.find((item) => item.start === start);
  // Erro de dado (id ou capítulo inexistente) quebra no import, nunca vira card vazio em produção
  if (!video || !chapter) throw new Error(`Capítulo inexistente no catálogo: ${videoId} @ ${timestamp}`);
  return { videoId, start, label: chapter.label, speaker, role, school: video.school };
}

const MIAMI_COACH: Localized = {
  pt: "Head coach do futebol feminino, University of Miami",
  en: "Women's soccer head coach, University of Miami",
  es: "Head coach del fútbol femenino, University of Miami",
};
const JACKSONVILLE_COACH: Localized = {
  pt: "Head coach do futebol feminino, Jacksonville University",
  en: "Women's soccer head coach, Jacksonville University",
  es: "Head coach del fútbol femenino, Jacksonville University",
};
const SIMA_DIRECTOR: Localized = {
  pt: "Diretor do SIMA, Montverde Academy",
  en: "SIMA director, Montverde Academy",
  es: "Director del SIMA, Montverde Academy",
};

/**
 * "Ouça quem decide": trechos em que treinadores e diretores falam direto com as famílias.
 * Os três primeiros são a seleção curta (home); o resto completa o trilho de /escolas.
 */
export const COACH_MOMENTS: VideoMoment[] = [
  moment("gvcUVL0j_eQ", "21:00", "Ken Masuhr", MIAMI_COACH),
  moment("2CTSgmKx0-U", "02:00", "Ryan Moon", JACKSONVILLE_COACH),
  moment("qCeneZf3KgM", "00:55", "Coach Andrew", SIMA_DIRECTOR),
  moment("2CTSgmKx0-U", "03:00", "Ryan Moon", JACKSONVILLE_COACH),
  moment("gvcUVL0j_eQ", "09:00", "Ken Masuhr", MIAMI_COACH),
  moment("2CTSgmKx0-U", "05:00", "Ryan Moon", JACKSONVILLE_COACH),
  moment("qCeneZf3KgM", "23:18"),
];

/** Atletas da casa dentro dos tours (link direto para o minuto em que aparecem). */
export const ATHLETE_MOMENTS: VideoMoment[] = [
  moment("qCeneZf3KgM", "04:52", "Leonardo"),
  moment("qCeneZf3KgM", "24:02", "Isadora Santiago"),
];
