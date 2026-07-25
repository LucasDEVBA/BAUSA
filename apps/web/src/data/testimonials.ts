import thumbComperlingo from "@/assets/Comperlingo.jpeg";
import thumbMachado from "@/assets/GABRIEL-MACHADO.jpeg";
import thumbIsadoraMae from "@/assets/MAE-ISADORA.jpeg";
import thumbBento from "@/assets/PAI-BENTO.jpeg";
import thumbMoraes from "@/assets/PRISCILA-MORAES.jpeg";
import thumbIsadora from "@/assets/athlete-isadora.jpeg";
import thumbLiz from "@/assets/athlete-liz.jpeg";
import thumbBenjamin from "@/assets/benjamin.jpeg";
import thumbHarvard from "@/assets/leandro-harvard.jpg";
import thumbValverde from "@/assets/paiLizValverde.jpg";
import thumbTaft from "@/assets/thumb-Taft.jpg";
import thumbHolyCross from "@/assets/thumb-holyCross.jpg";

/**
 * Prova social em vídeo — fonte única.
 *
 * Antes esses dados estavam triplicados em TestimonialsCarousel,
 * ParentTestimonialsSection e InstitutionalRecognitionSection, cada um com uma
 * estratégia diferente de embed. Agora todos consomem daqui e renderizam pelo
 * mesmo `VideoCard` (facade + frame REC).
 *
 * `timestamp` é a legenda documental do frame REC — o que faz a prova parecer
 * gravada, e não montada.
 */
export interface VideoTestimonial {
  name: string;
  youtubeId: string;
  thumbnail: { src: string };
  timestamp: string;
  /** Contexto exibido sob o nome, ex.: "16 anos · Montverde Academy". */
  context?: string;
  /** Marca depoimentos de mães — a voz da página /vida-na-boarding. */
  mae?: boolean;
}

export const DEPOIMENTOS_ATLETAS: readonly VideoTestimonial[] = [
  {
    name: "Isadora Santiago",
    context: "16 anos · Montverde Academy",
    youtubeId: "P9QiMRW4dII",
    thumbnail: thumbIsadora,
    timestamp: "MONTVERDE · FL · 2026",
  },
  {
    name: "Benjamin Bertolucci",
    context: "15 anos · Spire Academy",
    youtubeId: "7iso2Aj0PuQ",
    thumbnail: thumbBenjamin,
    timestamp: "SPIRE · OH · 2026",
  },
  {
    name: "Liz Valverde",
    context: "15 anos · Benfica Residential Academy",
    youtubeId: "arIURGPP828",
    thumbnail: thumbLiz,
    timestamp: "BENFICA · 2026",
  },
];

export const DEPOIMENTOS_FAMILIAS: readonly VideoTestimonial[] = [
  {
    name: "Família Santiago",
    youtubeId: "enS5ZAGRJ0g",
    thumbnail: thumbIsadoraMae,
    timestamp: "FAMÍLIA SANTIAGO · 2026",
    mae: true,
  },
  {
    name: "Família Moraes",
    youtubeId: "KFkoxh4nTHU",
    thumbnail: thumbMoraes,
    timestamp: "FAMÍLIA MORAES · 2026",
    mae: true,
  },
  {
    name: "Família Comperlingo",
    youtubeId: "lXzJkGgZkTw",
    thumbnail: thumbComperlingo,
    timestamp: "FAMÍLIA COMPERLINGO · 2026",
    mae: true,
  },
  {
    name: "Família Valverde",
    youtubeId: "wJUf_efdc8s",
    thumbnail: thumbValverde,
    timestamp: "FAMÍLIA VALVERDE · 2026",
  },
  {
    name: "Família Mello",
    youtubeId: "1WDFoyA5p8U",
    thumbnail: thumbBento,
    timestamp: "FAMÍLIA MELLO · 2026",
  },
  {
    name: "Família Machado",
    youtubeId: "8RtvPgeZ8yI",
    thumbnail: thumbMachado,
    timestamp: "FAMÍLIA MACHADO · 2026",
  },
];

/** Tours institucionais — a estética "REC" aplicada à presença do fundador. */
export const VISITAS_INSTITUCIONAIS: readonly VideoTestimonial[] = [
  {
    name: "Harvard University",
    context: "Cambridge, MA",
    youtubeId: "qlSNBAQQPUs",
    thumbnail: thumbHarvard,
    timestamp: "HARVARD · MA · 2026",
  },
  {
    name: "College of The Holy Cross",
    context: "Worcester, MA",
    youtubeId: "l1h7TLvnZC8",
    thumbnail: thumbHolyCross,
    timestamp: "HOLY CROSS · MA · 2026",
  },
  {
    name: "The Taft School",
    context: "Watertown, CT",
    youtubeId: "ZPXd4GKYvQ8",
    thumbnail: thumbTaft,
    timestamp: "TAFT · CT · 2026",
  },
];
