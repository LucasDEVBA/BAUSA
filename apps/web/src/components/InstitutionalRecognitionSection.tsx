"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, X, MapPin, ChevronLeft, ChevronRight, GraduationCap, School } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { StaticImageData } from "next/image";

import { useLanguage } from "@/i18n";
import leandroHarvard from "@/assets/leandro-harvard.jpg";
import thumbTaft from "@/assets/thumb-Taft.jpg";
import thumbBenfica from "@/assets/thumb-benfica.jpg";
import thumbImgAcademy from "@/assets/thumb-imgAcademy.jpg";
import thumbRps from "@/assets/thumb-rps.jpg";
import thumbMiami from "@/assets/thumb-miami.jpg";
import thumbFlorida from "@/assets/thumb-florida.jpg";
import thumbFiu from "@/assets/thumb-fiu.jpg";

interface Institution {
  id: string;
  name: string;
  location: string;
  type: "university" | "prep-school";
  photo: StaticImageData;
  /** Compensa o crop 16:9 nas fotos verticais (mantém rostos no quadro) */
  imagePosition?: string;
  youtubeId: string;
}

const schools: Institution[] = [
  {
    id: "taft",
    name: "The Taft School",
    location: "Watertown, CT",
    type: "prep-school",
    photo: thumbTaft,
    imagePosition: "50% 35%",
    youtubeId: "ZPXd4GKYvQ8",
  },
  {
    id: "benfica",
    name: "Benfica Residential Academy",
    location: "Saint Leo, FL",
    type: "prep-school",
    photo: thumbBenfica,
    youtubeId: "Byr7E1W8JSk",
  },
  {
    id: "img-academy",
    name: "IMG Academy",
    location: "Bradenton, FL",
    type: "prep-school",
    photo: thumbImgAcademy,
    youtubeId: "zlJ3WUHY_BI",
  },
  {
    id: "rps",
    name: "RPS Academies",
    location: "Port St. Lucie, FL",
    type: "prep-school",
    photo: thumbRps,
    youtubeId: "VLnk65O91Pg",
  },
];

const universities: Institution[] = [
  {
    id: "harvard",
    name: "Harvard University",
    location: "Cambridge, MA",
    type: "university",
    photo: leandroHarvard,
    imagePosition: "50% 30%",
    youtubeId: "qlSNBAQQPUs", // Placeholder video
  },
  {
    id: "miami",
    name: "University of Miami",
    location: "Coral Gables, FL",
    type: "university",
    photo: thumbMiami,
    youtubeId: "gvcUVL0j_eQ",
  },
  {
    id: "florida",
    name: "University of Florida",
    location: "Gainesville, FL",
    type: "university",
    photo: thumbFlorida,
    youtubeId: "gpT0gG8nK6U",
  },
  {
    id: "fiu",
    name: "Florida International University",
    location: "Miami, FL",
    type: "university",
    photo: thumbFiu,
    youtubeId: "t2-hpjOVjNQ",
  },
];

const allInstitutions = [...schools, ...universities];

// Sem chave de tradução para o botão de fechar: rótulo acessível local nos 3 idiomas.

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

const arrowButton =
  "ba-glass-dark grid h-10 w-10 place-items-center rounded-full text-white transition-[background-color,opacity,transform] duration-300 hover:-translate-y-0.5 hover:bg-white/[0.16] focus-visible:outline-[2.5px] focus-visible:outline-offset-2 focus-visible:outline-[#b8caf7] disabled:pointer-events-none disabled:opacity-30 sm:h-11 sm:w-11";

interface InstitutionCardProps {
  institution: Institution;
  onPlay: (id: string) => void;
}

const InstitutionCard = ({ institution, onPlay }: InstitutionCardProps) => {
  const { t } = useLanguage();
  const isUniversity = institution.type === "university";
  const typeLabel = isUniversity ? t("landing.institutionalRecognition.typeUniversity") : t("landing.institutionalRecognition.typePrepSchool");

  return (
    // Vidro sem backdrop-filter: dentro do trilho transformado do embla o desfoque pintava um retângulo
    // claro do tamanho do viewport atrás dos cartões; sobre o navy o efeito visual é o mesmo.
    <article className="group h-full rounded-[24px] border border-white/[0.14] bg-white/[0.07] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_30px_70px_-30px_rgba(0,0,0,0.6)] p-[6px] transition-[transform,background-color] duration-700 [transition-timing-function:var(--ba-ease)] hover:bg-white/[0.1] sm:rounded-[30px] sm:p-2" data-tilt>
      <button
        type="button"
        onClick={() => onPlay(institution.id)}
        aria-label={`${institution.name}, ${institution.location}. Video tour`}
        className="relative block aspect-[16/10] w-full cursor-pointer overflow-hidden rounded-[19px] text-left focus-visible:outline-[2.5px] focus-visible:outline-offset-[-4px] focus-visible:outline-white sm:rounded-[23px]"
      >
        <Image
          src={institution.photo}
          alt={`${t("landing.institutionalRecognition.photoAltPrefix")} ${institution.name}`}
          fill
          sizes="(max-width: 640px) 85vw, (max-width: 768px) 55vw, 560px"
          className="object-cover transition-transform duration-[1200ms] [transition-timing-function:var(--ba-ease)] group-hover:scale-[1.05]"
          style={{ objectPosition: institution.imagePosition ?? "center" }}
        />
        <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,15,42,0.4)_0%,rgba(6,15,42,0)_30%,rgba(6,15,42,0.15)_55%,rgba(6,15,42,0.9)_100%)]" />

        {/* Topo: tipo da instituição + gravação */}
        <span className="absolute inset-x-3 top-3 flex items-center justify-between gap-2 sm:inset-x-4 sm:top-4">
          <span
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10.5px] font-bold tracking-[0.12em] text-white sm:text-[11px] ${
              isUniversity
                ? "bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine))] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_20px_-8px_rgba(144,36,52,0.8)]"
                : "ba-glass-dark"
            }`}
          >
            {typeLabel}
          </span>
          <span className="ba-glass-dark flex items-center gap-1.5 rounded-full px-2.5 py-[5px]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff5a6e]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white">REC</span>
          </span>
        </span>

        {/* Base: nome, local e play em vidro */}
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
          <span className="min-w-0">
            <span className="block truncate font-[family-name:var(--ba-display)] text-[18px] font-semibold leading-tight tracking-[-0.025em] text-white sm:text-[22px] md:text-[24px]">
              {institution.name}
            </span>
            <span className="mt-1 flex items-center gap-1.5 text-[12.5px] text-white/80 sm:text-sm">
              <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              {institution.location}
            </span>
          </span>
          <span aria-hidden="true" className="grid h-12 w-12 flex-none place-items-center rounded-full bg-white/[0.16] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_0_0_1px_rgba(255,255,255,0.3)] backdrop-blur-md transition-transform duration-500 [transition-timing-function:var(--ba-ease)] group-hover:scale-110 sm:h-14 sm:w-14">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(180deg,#fff,#e6ecfb)] sm:h-10 sm:w-10">
              <Play className="ml-0.5 h-4 w-4 fill-[var(--ba-navy)] text-[var(--ba-navy)]" />
            </span>
          </span>
        </span>
      </button>
    </article>
  );
};

interface InstitutionCarouselProps {
  title: string;
  icon: LucideIcon;
  institutions: Institution[];
  onPlay: (id: string) => void;
}

const InstitutionCarousel = ({ title, icon: Icon, institutions, onPlay }: InstitutionCarouselProps) => {
  const { t } = useLanguage();
  // Slides a 45% no desktop: 2 cards inteiros + pedaço do próximo visível:
  // o corte é o affordance de que a fileira é um carrossel.
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragThreshold: 20,
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCanPrev(emblaApi.canScrollPrev());
    setCanNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="ba-rv">
      <div className="mb-5 flex items-center gap-3 sm:mb-7 sm:gap-4">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[linear-gradient(150deg,rgba(255,255,255,0.22),rgba(255,255,255,0.06))] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] sm:h-11 sm:w-11 sm:rounded-[14px]">
          <Icon className="h-[19px] w-[19px] text-[#dbe5ff]" aria-hidden="true" />
        </span>
        <h3 className="ba-h3 whitespace-nowrap text-[20px] text-white sm:text-[24px]">{title}</h3>
        <span className="text-xs font-semibold tracking-[0.14em] text-white/55">{String(institutions.length).padStart(2, "0")}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-[linear-gradient(90deg,rgba(255,255,255,0.18),rgba(255,255,255,0))]" />
        <div className="flex flex-none items-center gap-2">
          <button type="button" onClick={() => emblaApi?.scrollPrev()} disabled={!canPrev} aria-label={t("landing.institutionalRecognition.carouselPrev")} className={arrowButton}>
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          <button type="button" onClick={() => emblaApi?.scrollNext()} disabled={!canNext} aria-label={t("landing.institutionalRecognition.carouselNext")} className={arrowButton}>
            <ChevronRight className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* Respiro no viewport (maior embaixo, onde a sombra cai) para a sombra dos cartões não ser cortada em linha reta */}
      <div className="-mb-20 -mt-5 touch-pan-y overflow-hidden pb-20 pt-5" ref={emblaRef}>
        <div className="flex touch-pan-y gap-4 sm:gap-6">
          {institutions.map((institution) => (
            <div key={institution.id} className="min-w-0 flex-[0_0_85%] sm:flex-[0_0_55%] md:flex-[0_0_45%]">
              <InstitutionCard institution={institution} onPlay={onPlay} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface VideoModalProps {
  institution: Institution | undefined;
  onClose: () => void;
}

// Portal no body: a seção usa `isolate`, e um modal preso no contexto dela ficaria atrás das seções seguintes.
const VideoModal = ({ institution, onClose }: VideoModalProps) => {
  const { t } = useLanguage();

  useEffect(() => {
    if (!institution) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [institution, onClose]);

  return createPortal(
    <AnimatePresence>
      {institution && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(4,10,30,0.82)] p-4 backdrop-blur-md"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={institution.name}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="ba-glass-dark relative w-full max-w-4xl rounded-[28px] p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video overflow-hidden rounded-[21px] bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${institution.youtubeId}?autoplay=1&rel=0`}
                title="Video Tour"
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              autoFocus
              aria-label={t("landing.closeVideo")}
              className="ba-glass-dark absolute -top-3 right-3 z-10 grid h-11 w-11 place-items-center rounded-full text-white transition-colors hover:bg-white/20 focus-visible:outline-[2.5px] focus-visible:outline-white sm:-right-3"
            >
              <X className="h-5 w-5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

const InstitutionalRecognitionSection = () => {
  const { t } = useLanguage();
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const closeVideo = useCallback(() => setActiveVideo(null), []);

  useEffect(() => setMounted(true), []);

  return (
    // Emenda com a Autoridade: sobe sobre o padding inferior dela com um degradê transparente→navy, para os halos
    // dela se dissolverem no navy daqui sem costura; fecha o capítulo escuro com cantos inferiores arredondados.
    <section
      id="instituicoes"
      className="relative isolate -mt-10 overflow-hidden rounded-b-[clamp(28px,4vw,48px)] bg-[linear-gradient(180deg,rgba(10,26,69,0)_0px,var(--ba-navy-2)_40px)] pb-[clamp(80px,10vw,140px)] pt-[clamp(96px,10vw,200px)] text-white sm:-mt-20 sm:bg-[linear-gradient(180deg,rgba(10,26,69,0)_0px,var(--ba-navy-2)_80px)] lg:-mt-[120px] lg:bg-[linear-gradient(180deg,rgba(10,26,69,0)_0px,var(--ba-navy-2)_120px)]"
      aria-labelledby="instituicoes-title"
    >
      <div aria-hidden="true" className="ba-glow left-[38%] top-[220px] h-[520px] w-[520px] bg-[rgba(31,63,163,0.45)]" />
      <div aria-hidden="true" className="ba-glow right-[-200px] top-[200px] h-[440px] w-[440px] bg-[rgba(144,36,52,0.32)]" />
      <div aria-hidden="true" className="ba-glow bottom-[-200px] left-[-160px] h-[560px] w-[560px] bg-[rgba(144,36,52,0.42)]" />
      <div aria-hidden="true" className="ba-glow bottom-[10%] right-[-180px] h-[460px] w-[460px] bg-[rgba(71,107,192,0.4)]" />
      <div aria-hidden="true" className="ba-lines [mask-image:radial-gradient(ellipse_70%_60%_at_20%_30%,#000,transparent_75%)]" />

      <div className="ba-wrap relative z-[2]">
        <div className="mb-[clamp(44px,6vw,80px)] grid items-end gap-6 border-t border-white/[0.1] pt-[clamp(40px,4.5vw,64px)] lg:grid-cols-[1.3fr_1fr] lg:gap-16">
          <div>
            <span className="ba-eyebrow ba-glass-dark ba-rv !text-[#cfdcff]">
              <span className="ba-dot" />
              {t("landing.institutionalRecognition.badge")}
            </span>
            <h2 id="instituicoes-title" className="ba-h2 ba-rv mt-5 text-[clamp(32px,4.6vw,60px)] text-white" style={delay(1)}>
              {t("landing.institutionalRecognition.title1")} <span className="ba-grad-text-dark">{t("landing.institutionalRecognition.title2")}</span>
            </h2>
          </div>
          <p className="ba-rv max-w-[440px] text-[clamp(15.5px,1.25vw,18px)] leading-[1.62] text-[rgba(232,238,255,0.84)] lg:mb-2 lg:border-l lg:border-white/[0.14] lg:pl-8" style={delay(2)}>
            {t("landing.institutionalRecognition.subtitle")}
          </p>
        </div>

        <div className="space-y-[clamp(48px,6vw,80px)]">
          <InstitutionCarousel title={t("landing.institutionalRecognition.schoolsTitle")} icon={School} institutions={schools} onPlay={setActiveVideo} />
          <InstitutionCarousel title={t("landing.institutionalRecognition.universitiesTitle")} icon={GraduationCap} institutions={universities} onPlay={setActiveVideo} />
        </div>

        <div className="ba-rv mt-[clamp(44px,5vw,64px)] flex justify-center" style={delay(1)}>
          <p className="ba-glass-dark inline-flex items-center gap-3 rounded-full px-5 py-3 text-center text-[13.5px] font-medium leading-[1.4] text-[rgba(232,238,255,0.86)] sm:text-[14.5px]">
            <span className="ba-pulse" aria-hidden="true" />
            {t("landing.institutionalRecognition.bottomNote")}
          </p>
        </div>
      </div>

      {mounted && <VideoModal institution={allInstitutions.find((i) => i.id === activeVideo)} onClose={closeVideo} />}
    </section>
  );
};

export default InstitutionalRecognitionSection;
