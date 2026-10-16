import logoBenfica from "@/assets/academys/logoBenfica.png";
import logoHarvard from "@/assets/academys/logoHavard.png";
import logoHotchkiss from "@/assets/academys/logoHotchkiss.png";
import logoImgAcademy from "@/assets/academys/logoIMGAcademy.svg";
import logoMiami from "@/assets/academys/logoMiami.png";
import logoMontverde from "@/assets/academys/logoMontverde.png";
import logoTaft from "@/assets/academys/logoTaft.png";
import logoVermontAcademy from "@/assets/academys/logoVermontAcademy.png";

import type { School } from "./types";
import { getVideo } from "./videos";

/*
 * Instituições com tour no canal. Liga e fatos saem do título, da descrição ou dos capítulos
 * do tour; nada de ranking nem de "parceria oficial" (ainda a confirmar com o dono).
 * Localização: cidade da descrição do vídeo ou a que o site já publicava; Montverde,
 * Hotchkiss, Vermont Academy, FGCU e Clark não trazem cidade no vídeo e usam a sede pública.
 */
export const SCHOOLS: School[] = [
  {
    slug: "montverde",
    name: "Montverde Academy",
    type: "high_school",
    location: "Montverde, FL",
    tourVideoId: "qCeneZf3KgM",
    logo: logoMontverde,
    facts: [
      { pt: "Boas-vindas do Coach Andrew, diretor do SIMA", en: "Welcome from Coach Andrew, SIMA director", es: "Bienvenida del Coach Andrew, director del SIMA" },
      { pt: "Seis campos de futebol no SIMA", en: "Six soccer fields at SIMA", es: "Seis canchas de fútbol en el SIMA" },
      { pt: "Alunos aprovados em Duke, Harvard, UCLA, MIT e Cornell", en: "Students admitted to Duke, Harvard, UCLA, MIT and Cornell", es: "Alumnos admitidos en Duke, Harvard, UCLA, MIT y Cornell" },
    ],
  },
  {
    slug: "hotchkiss",
    name: "The Hotchkiss School",
    type: "high_school",
    location: "Lakeville, CT",
    tourVideoId: "maZ2lIeo5EE",
    logo: logoHotchkiss,
    facts: [
      { pt: "Boarding school na Nova Inglaterra", en: "Boarding school in New England", es: "Internado en Nueva Inglaterra" },
      { pt: "Campus, estrutura acadêmica e esportiva", en: "Campus, academics and athletic facilities", es: "Campus, estructura académica y deportiva" },
    ],
  },
  {
    slug: "img-academy",
    name: "IMG Academy",
    type: "high_school",
    league: "MLS NEXT · ECNL",
    location: "Bradenton, FL",
    tourVideoId: "zlJ3WUHY_BI",
    logo: logoImgAcademy,
    facts: [
      { pt: "Tour completo em português", en: "Full tour in Portuguese", es: "Recorrido completo en portugués" },
      { pt: "Futebol na MLS NEXT e na ECNL", en: "Soccer in MLS NEXT and ECNL", es: "Fútbol en la MLS NEXT y la ECNL" },
      { pt: "Atletas de mais de 80 países", en: "Athletes from over 80 countries", es: "Atletas de más de 80 países" },
    ],
  },
  {
    slug: "benfica",
    name: "Benfica Residential Academy",
    type: "high_school",
    location: "Saint Leo, FL",
    tourVideoId: "Byr7E1W8JSk",
    logo: logoBenfica,
    facts: [
      { pt: "Academia oficial do Benfica nos EUA", en: "Benfica's official academy in the US", es: "Academia oficial del Benfica en EE. UU." },
      { pt: "High school e futebol no mesmo programa", en: "High school and soccer in one program", es: "High school y fútbol en un mismo programa" },
      { pt: "Alojamento e rotina diária dos atletas", en: "Housing and the athletes' daily routine", es: "Alojamiento y rutina diaria de los atletas" },
    ],
  },
  {
    slug: "harvard",
    name: "Harvard University",
    type: "universidade",
    league: "NCAA D1 · Ivy League",
    location: "Cambridge, MA",
    tourVideoId: "qlSNBAQQPUs",
    logo: logoHarvard,
    facts: [
      { pt: "Conversa com o treinador sobre bolsas e admissões", en: "Talk with the coach about scholarships and admissions", es: "Charla con el entrenador sobre becas y admisiones" },
      { pt: "Estrutura esportiva e rotina dos atletas", en: "Athletic facilities and the athletes' routine", es: "Estructura deportiva y rutina de los atletas" },
    ],
  },
  {
    slug: "florida",
    name: "University of Florida",
    type: "universidade",
    league: "NCAA D1 · SEC",
    location: "Gainesville, FL",
    tourVideoId: "gpT0gG8nK6U",
    facts: [
      { pt: "Tour com Nick Zimmerman, head coach do futebol feminino", en: "Tour with Nick Zimmerman, women's soccer head coach", es: "Recorrido con Nick Zimmerman, head coach del fútbol femenino" },
      { pt: "Quando o programa começa a observar uma atleta", en: "When the program starts watching an athlete", es: "Cuándo el programa empieza a observar a una atleta" },
      { pt: "O que pesa além da técnica no recrutamento", en: "What matters beyond technique in recruiting", es: "Lo que pesa más allá de la técnica en el reclutamiento" },
    ],
  },
  {
    slug: "miami",
    name: "University of Miami",
    type: "universidade",
    league: "NCAA D1 · ACC",
    location: "Coral Gables, FL",
    tourVideoId: "gvcUVL0j_eQ",
    logo: logoMiami,
    facts: [
      { pt: "Tour com Ken Masuhr, head coach do futebol feminino", en: "Tour with Ken Masuhr, women's soccer head coach", es: "Recorrido con Ken Masuhr, head coach del fútbol femenino" },
      { pt: "Futebol feminino na ACC, no Cobb Stadium", en: "Women's soccer in the ACC, at Cobb Stadium", es: "Fútbol femenino en la ACC, en el Cobb Stadium" },
      { pt: "Mensagem do coach às famílias brasileiras", en: "The coach's message to Brazilian families", es: "Mensaje del coach a las familias brasileñas" },
    ],
  },
  {
    slug: "fiu",
    name: "Florida International University",
    type: "universidade",
    league: "NCAA D1 · Conference USA",
    location: "Miami, FL",
    tourVideoId: "t2-hpjOVjNQ",
    facts: [
      { pt: "Única universidade D1 com futebol masculino em Miami", en: "The only D1 university with men's soccer in Miami", es: "La única universidad D1 con fútbol masculino en Miami" },
      { pt: "Tour com o treinador assistente do futebol masculino", en: "Tour with the men's soccer assistant coach", es: "Recorrido con el entrenador asistente del fútbol masculino" },
      { pt: "Vestiário, análise de desempenho e estádio", en: "Locker room, performance analysis and stadium", es: "Vestuario, análisis de rendimiento y estadio" },
    ],
  },
  {
    slug: "taft",
    name: "The Taft School",
    type: "high_school",
    location: "Watertown, CT",
    tourVideoId: "ZPXd4GKYvQ8",
    logo: logoTaft,
    facts: [
      { pt: "Tour com o Coach Parente, head coach do futebol masculino", en: "Tour with Coach Parente, boys' soccer head coach", es: "Recorrido con el Coach Parente, head coach del fútbol masculino" },
      { pt: "Centro atlético de padrão internacional", en: "International-standard athletic center", es: "Centro deportivo de nivel internacional" },
      { pt: "Campus acadêmico e rotina dos atletas", en: "Academic campus and the athletes' daily life", es: "Campus académico y rutina de los atletas" },
    ],
  },
  {
    slug: "rps",
    name: "RPS Academies",
    type: "high_school",
    league: "UPSL",
    location: "Port St. Lucie, FL",
    tourVideoId: "VLnk65O91Pg",
    facts: [
      { pt: "Tour com o head de recrutamento de soccer", en: "Tour with the head of soccer recruitment", es: "Recorrido con el responsable de reclutamiento de fútbol" },
      { pt: "Campus no antigo Club Med Sandpiper Bay", en: "Campus at the former Club Med Sandpiper Bay", es: "Campus en el antiguo Club Med Sandpiper Bay" },
      { pt: "Currículo Cambridge ou americano", en: "Cambridge or American curriculum", es: "Currículo Cambridge o estadounidense" },
    ],
  },
  {
    slug: "jacksonville",
    name: "Jacksonville University",
    type: "universidade",
    league: "NCAA D1 · ASUN",
    location: "Jacksonville, FL",
    tourVideoId: "2CTSgmKx0-U",
    facts: [
      { pt: "Tour guiado pelo head coach Ryan Moon", en: "Tour led by head coach Ryan Moon", es: "Recorrido guiado por el head coach Ryan Moon" },
      { pt: "Futebol feminino dos JU Dolphins", en: "JU Dolphins women's soccer", es: "Fútbol femenino de los JU Dolphins" },
      { pt: "Elenco com atletas de mais de 13 países", en: "A roster with athletes from 13+ countries", es: "Plantel con atletas de más de 13 países" },
    ],
  },
  {
    slug: "fgcu",
    name: "Florida Gulf Coast University",
    type: "universidade",
    league: "NCAA D1",
    location: "Fort Myers, FL",
    tourVideoId: "-16QtoD5eis",
    facts: [
      { pt: "Futebol feminino dos Eagles, no Pickering Field", en: "Eagles women's soccer at Pickering Field", es: "Fútbol femenino de los Eagles, en el Pickering Field" },
      { pt: "Reunião com o head coach Jim Blankenship", en: "Meeting with head coach Jim Blankenship", es: "Reunión con el head coach Jim Blankenship" },
      { pt: "Tour com a comissão técnica do programa", en: "Tour with the program's coaching staff", es: "Recorrido con el cuerpo técnico del programa" },
    ],
  },
  {
    slug: "unf",
    name: "University of North Florida",
    type: "universidade",
    league: "NCAA D1 · ASUN",
    location: "Jacksonville, FL",
    tourVideoId: "IcazwAYhDSk",
    facts: [
      { pt: "Futebol masculino campeão da ASUN em 2024", en: "Men's soccer, 2024 ASUN champions", es: "Fútbol masculino campeón de la ASUN en 2024" },
      { pt: "De volta ao NCAA Tournament em 2024, após 10 anos", en: "Back in the NCAA Tournament in 2024 after 10 years", es: "De vuelta al NCAA Tournament en 2024, tras 10 años" },
      { pt: "Programa do head coach Jamie Davies", en: "Program led by head coach Jamie Davies", es: "Programa del head coach Jamie Davies" },
    ],
  },
  {
    slug: "ucf",
    name: "University of Central Florida",
    type: "universidade",
    league: "NCAA D1 · Big 12",
    location: "Orlando, FL",
    tourVideoId: "TEvAVEOA28w",
    facts: [
      { pt: "Futebol masculino em Orlando, na Big 12", en: "Men's soccer in Orlando, in the Big 12", es: "Fútbol masculino en Orlando, en la Big 12" },
      { pt: "Estrutura e ambiente de um programa NCAA D1", en: "Facilities and environment of an NCAA D1 program", es: "Estructura y ambiente de un programa NCAA D1" },
    ],
  },
  {
    slug: "flagler",
    name: "Flagler College",
    type: "universidade",
    league: "NCAA D2 · Peach Belt",
    location: "St. Augustine, FL",
    tourVideoId: "MAMzOtT6LaY",
    facts: [
      { pt: "Liberal arts college de alto nível acadêmico", en: "Academically strong liberal arts college", es: "Liberal arts college de alto nivel académico" },
      { pt: "Em St. Augustine, a cidade mais antiga dos EUA", en: "In St. Augustine, the oldest city in the US", es: "En St. Augustine, la ciudad más antigua de EE. UU." },
    ],
  },
  {
    slug: "holy-cross",
    name: "College of the Holy Cross",
    type: "universidade",
    league: "NCAA D1 · Patriot League",
    location: "Worcester, MA",
    tourVideoId: "l1h7TLvnZC8",
    facts: [
      { pt: "Campus, prédios históricos e áreas de estudo", en: "Campus, historic buildings and study spaces", es: "Campus, edificios históricos y áreas de estudio" },
      { pt: "Espaços de treino e performance", en: "Training and performance facilities", es: "Espacios de entrenamiento y rendimiento" },
    ],
  },
  {
    slug: "vermont-academy",
    name: "Vermont Academy",
    type: "high_school",
    league: "NEPSAC",
    location: "Saxtons River, VT",
    tourVideoId: "pG9mk__UxiA",
    logo: logoVermontAcademy,
    facts: [
      { pt: "Futebol feminino campeão da NEPSAC", en: "NEPSAC champion girls' soccer", es: "Fútbol femenino campeón de la NEPSAC" },
      { pt: "Títulos na Lakes Region no futebol masculino", en: "Lakes Region titles in boys' soccer", es: "Títulos de la Lakes Region en el fútbol masculino" },
      { pt: "Boarding school focada em caráter e identidade", en: "Boarding school focused on character and identity", es: "Internado enfocado en el carácter y la identidad" },
    ],
  },
  {
    slug: "clark",
    name: "Clark University",
    type: "universidade",
    league: "NCAA D3",
    location: "Worcester, MA",
    tourVideoId: "Lv-aZmKtc10",
    facts: [
      { pt: "Tour com o treinador assistente do futebol masculino", en: "Tour with the men's soccer assistant coach", es: "Recorrido con el entrenador asistente del fútbol masculino" },
      { pt: "Universidade privada com forte tradição acadêmica", en: "Private university with a strong academic reputation", es: "Universidad privada con fuerte tradición académica" },
    ],
  },
];

// Os três arquivos de conteúdo se referenciam por id/slug: um erro de digitação quebra no import, não na tela
for (const school of SCHOOLS) {
  const tour = school.tourVideoId ? getVideo(school.tourVideoId) : undefined;
  if (school.tourVideoId && tour?.school !== school.slug) {
    throw new Error(`Tour de ${school.slug} não bate com o catálogo de vídeos (${school.tourVideoId})`);
  }
}

const SCHOOLS_BY_SLUG = new Map(SCHOOLS.map((school) => [school.slug, school]));

export function getSchool(slug: string): School | undefined {
  return SCHOOLS_BY_SLUG.get(slug);
}

export const HIGH_SCHOOLS = SCHOOLS.filter((school) => school.type === "high_school");

export const UNIVERSITIES = SCHOOLS.filter((school) => school.type === "universidade");
