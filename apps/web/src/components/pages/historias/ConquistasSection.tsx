import Image, { type StaticImageData } from "next/image";
import { ArrowUpRight, Award, Instagram, Play, Trophy } from "lucide-react";

import andressaCopa from "@/assets/instagram/andressa-copa-capa.jpg";
import andressaSaraConvocadas from "@/assets/instagram/andressa-sara-convocadas.jpg";
import bernardoEmAcao2 from "@/assets/instagram/bernardo-em-acao-2.jpg";
import bernardoEmAcao3 from "@/assets/instagram/bernardo-em-acao-3.jpg";
import bernardoMediaDay2 from "@/assets/instagram/bernardo-media-day-2.jpg";
import bernardoSiAllAmerica from "@/assets/instagram/bernardo-si-all-america.jpg";
import { INSTAGRAM_POSTS, type InstagramPost } from "@/content/athletes";
import { HISTORIAS_PAGE } from "@/content/historias";
import { pick, type Localized } from "@/content/types";
import type { Lang } from "@/i18n";
import { keepTogether } from "./keepTogether";
import SectionHeading from "./SectionHeading";

const TEXT = HISTORIAS_PAGE.conquistas;

const delay = (d: number) => ({ "--d": d }) as React.CSSProperties;

function post(shortcode: string): InstagramPost {
  const found = INSTAGRAM_POSTS.find((item) => item.shortcode === shortcode);
  // Shortcode errado quebra no build, nunca vira link morto em produção
  if (!found) throw new Error(`Post do Instagram fora do catálogo: ${shortcode}`);
  return found;
}

const CONVOCADAS = post("DdVCI-ItADo");
const COPA = post("DeJbsDtqUxj");
const SI = post("DdbWVTYxbu8");
const MEDIA_DAY = post("Dd-CfSdjeJq");
const EM_CAMPO = post("DeSzcIzjbV4");

interface GalleryTile {
  image: StaticImageData;
  alt: Localized;
  post: InstagramPost;
  /** Ponto de interesse da foto no recorte 3:4. */
  position: string;
}

// Fotos 1:1 de jogo (baixa resolução) só em tile pequeno, como pede o catálogo
const BERNARDO_GALLERY: GalleryTile[] = [
  { image: bernardoMediaDay2, alt: TEXT.si.flagAlt, post: MEDIA_DAY, position: "50% 20%" },
  { image: bernardoEmAcao2, alt: EM_CAMPO.imageAlt, post: EM_CAMPO, position: "50% 40%" },
  {
    image: bernardoEmAcao3,
    alt: {
      pt: "Bernardo Herdy de uniforme verde cobrando um tiro de meta pela Hoosac School",
      en: "Bernardo Herdy in a green kit taking a goal kick for Hoosac School",
      es: "Bernardo Herdy con uniforme verde sacando de meta con Hoosac School",
    },
    post: EM_CAMPO,
    position: "45% 50%",
  },
];

/** Link externo para o post, com o aviso de nova aba no nome acessível. */
function instagramLabel(title: string, lang: Lang) {
  return `${pick(TEXT.instagram, lang)}: ${title} (${pick(TEXT.newTab, lang)})`;
}

function InstagramLink({ href, title, lang }: { href: string; title: string; lang: Lang }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={instagramLabel(title, lang)}
      className="ba-glass-dark inline-flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-full py-1.5 pl-1.5 pr-4 text-[13.5px] font-semibold text-white transition-[transform,background-color] duration-500 [transition-timing-function:var(--ba-ease)] hover:-translate-y-0.5 hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-[linear-gradient(150deg,var(--ba-wine-2),var(--ba-wine)_55%,var(--ba-blue))] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
        <Instagram className="h-4 w-4" />
      </span>
      {pick(TEXT.instagram, lang)}
      <ArrowUpRight className="h-4 w-4 text-white/70" aria-hidden="true" />
    </a>
  );
}

function Person({ name, role }: { name: string; role: string }) {
  return (
    <li className="flex flex-col gap-0.5 border-t border-white/[0.12] py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <span className="font-[family-name:var(--ba-display)] text-[15.5px] font-semibold tracking-[-0.015em] text-white">{name}</span>
      <span className="text-[13px] font-medium text-white/70 sm:text-right">{keepTogether(role)}</span>
    </li>
  );
}

interface FeatureTextProps {
  titleId: string;
  icon: typeof Trophy;
  kicker: string;
  title: string;
  body: string;
  people: Array<{ name: string; role: string }>;
  link: { href: string; title: string };
  lang: Lang;
}

function FeatureText({ titleId, icon: Icon, kicker, title, body, people, link, lang }: FeatureTextProps) {
  return (
    <div className="max-w-[560px]">
      <p className="ba-rv flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#cfdcff]">
        <Icon className="h-4 w-4 flex-none text-[#f0b1bb]" aria-hidden="true" />
        {kicker}
      </p>
      <h3 id={titleId} className="ba-h3 ba-rv mt-4 text-balance text-[clamp(26px,3.2vw,40px)] text-white" style={delay(1)}>
        {keepTogether(title)}
      </h3>
      <p className="ba-rv mt-4 text-[15.5px] leading-[1.65] text-[rgba(232,238,255,0.84)] sm:text-[16.5px]" style={delay(2)}>
        {keepTogether(body)}
      </p>
      <ul className="ba-rv mt-6 border-b border-white/[0.12]" style={delay(3)}>
        {people.map((person) => (
          <Person key={person.name} {...person} />
        ))}
      </ul>
      <div className="ba-rv mt-6 flex flex-wrap items-center gap-x-4 gap-y-2" style={delay(4)}>
        <InstagramLink href={link.href} title={link.title} lang={lang} />
        <span className="text-[12.5px] font-medium text-white/60">{pick(TEXT.via, lang)}</span>
      </div>
    </div>
  );
}

/**
 * Andressa e Sara: díptico com a arte "Convocadas" e o reel da Copa (abre no Instagram), lado a
 * lado e com a mesma altura, para nenhuma das duas peças cobrir o rosto das atletas.
 */
function SelecaoVisual({ lang }: { lang: Lang }) {
  const reelTitle = pick(TEXT.selecao.reelTitle, lang);

  return (
    <div className="mx-auto grid w-full max-w-[560px] grid-cols-[1.42fr_1fr] items-start gap-2.5 sm:gap-4">
      <figure className="ba-glass-dark ba-rv-scale m-0 rounded-[22px] p-[5px] sm:rounded-[30px] sm:p-2">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[17px] bg-[var(--ba-navy)] sm:rounded-[23px]">
          <Image
            src={andressaSaraConvocadas}
            alt={pick(CONVOCADAS.imageAlt, lang)}
            fill
            sizes="(max-width: 640px) 58vw, (max-width: 1024px) 330px, 330px"
            className="object-cover"
          />
        </div>
      </figure>
      <a
        href={COPA.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${pick(TEXT.selecao.reel, lang)}: ${reelTitle} (${pick(TEXT.newTab, lang)})`}
        className="group ba-glass-dark ba-rv-scale mt-[18%] block rounded-[20px] p-[5px] transition-transform duration-500 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white sm:rounded-[26px] sm:p-2"
        style={delay(2)}
      >
        <span className="relative block aspect-[9/16] overflow-hidden rounded-[15px] bg-[var(--ba-navy)] sm:rounded-[19px]">
          <Image src={andressaCopa} alt="" fill sizes="(max-width: 640px) 40vw, 230px" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
          <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,26,69,0)_50%,rgba(6,15,42,0.9)_100%)]" />
          <span aria-hidden="true" className="absolute left-1/2 top-[44%] grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/[0.2] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] backdrop-blur-md transition-transform duration-500 group-hover:scale-110 sm:h-14 sm:w-14">
            <Play className="ml-0.5 h-4 w-4 fill-white text-white sm:h-5 sm:w-5" />
          </span>
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex items-start gap-1.5 p-2.5 text-[11px] font-semibold leading-tight text-white sm:p-3.5 sm:text-[13px]">
            <Instagram className="mt-px h-3.5 w-3.5 flex-none" />
            {pick(TEXT.selecao.reel, lang)}
          </span>
        </span>
      </a>
    </div>
  );
}

/**
 * Bernardo: a arte da Sports Illustrated com a galeria do Media Day e de jogo. No mobile a
 * galeria fica embaixo; no desktop vira coluna ao lado, para o bloco não ficar mais alto que o texto.
 */
function SiVisual({ lang }: { lang: Lang }) {
  return (
    <div className="mx-auto grid w-full max-w-[520px] gap-3 lg:max-w-none lg:grid-cols-[1fr_0.34fr] lg:gap-4">
      <figure className="ba-glass-dark ba-rv-scale m-0 rounded-[26px] p-[6px] sm:rounded-[32px] sm:p-2">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-[var(--ba-navy)] sm:rounded-[25px]">
          <Image
            src={bernardoSiAllAmerica}
            alt={pick(SI.imageAlt, lang)}
            fill
            sizes="(max-width: 640px) 90vw, (max-width: 1024px) 480px, 420px"
            className="object-cover"
          />
        </div>
      </figure>
      <div className="lg:flex lg:flex-col lg:justify-end">
        <p className="ba-rv mt-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/60 lg:sr-only">{pick(TEXT.si.gallery, lang)}</p>
        <ul className="mt-3 grid grid-cols-3 gap-2.5 sm:gap-3.5 lg:mt-0 lg:grid-cols-1">
          {BERNARDO_GALLERY.map((tile, index) => (
            <li key={tile.image.src} className="ba-rv-scale" style={delay(index + 1)}>
              <a
                href={tile.post.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={instagramLabel(pick(tile.post.title, lang), lang)}
                className="group ba-glass-dark block rounded-[16px] p-1 transition-transform duration-500 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:rounded-[20px] sm:p-1.5"
              >
                <span className="relative block aspect-[3/4] overflow-hidden rounded-[12px] bg-[var(--ba-navy)] sm:rounded-[15px] lg:aspect-square">
                  <Image
                    src={tile.image}
                    alt={pick(tile.alt, lang)}
                    fill
                    sizes="(max-width: 640px) 30vw, 170px"
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                    style={{ objectPosition: tile.position }}
                  />
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Destaque editorial das conquistas recentes (peças do Instagram hospedadas no projeto).
 * Seção escura para as fotos ganharem contraste; cada destaque tem âncora própria, que é
 * para onde os Destaques da home levam Andressa e Bernardo.
 */
export default function ConquistasSection({ lang }: { lang: Lang }) {
  return (
    <section
      id="conquistas"
      className="ba-dark relative isolate overflow-hidden rounded-[clamp(28px,4vw,48px)] py-[clamp(72px,9vw,128px)]"
      aria-labelledby="conquistas-title"
    >
      <div aria-hidden="true" className="ba-glow left-[-180px] top-[-140px] h-[560px] w-[560px] animate-[ba-drift1_30s_ease-in-out_infinite_alternate] bg-[rgba(71,107,192,0.5)]" />
      <div aria-hidden="true" className="ba-glow right-[-200px] top-[38%] h-[520px] w-[520px] animate-[ba-drift3_34s_ease-in-out_infinite_alternate] bg-[rgba(144,36,52,0.45)]" />
      <div aria-hidden="true" className="ba-glow bottom-[-160px] left-[20%] h-[460px] w-[460px] animate-[ba-drift2_28s_ease-in-out_infinite_alternate] bg-[rgba(31,63,163,0.4)]" />
      <div aria-hidden="true" className="ba-lines" />

      <div className="ba-wrap relative z-[2]">
        <SectionHeading
          id="conquistas-title"
          tone="dark"
          eyebrow={pick(TEXT.eyebrow, lang)}
          titleLead={pick(TEXT.titleLead, lang)}
          titleAccent={pick(TEXT.titleAccent, lang)}
          trailing="."
          lead={pick(TEXT.lead, lang)}
        />

        <div className="mt-[clamp(48px,7vw,96px)] grid gap-[clamp(64px,9vw,120px)]">
          <article id="andressa-macedo" className="grid scroll-mt-28 items-center gap-10 lg:grid-cols-2 lg:gap-[clamp(40px,6vw,96px)]" aria-labelledby="selecao-title">
            <SelecaoVisual lang={lang} />
            <FeatureText
              titleId="selecao-title"
              icon={Trophy}
              kicker={pick(TEXT.selecao.kicker, lang)}
              title={pick(TEXT.selecao.title, lang)}
              body={pick(TEXT.selecao.body, lang)}
              people={[
                { name: "Andressa Macedo", role: pick(TEXT.selecao.andressaRole, lang) },
                { name: "Sara Pedot", role: pick(TEXT.selecao.saraRole, lang) },
              ]}
              link={{ href: CONVOCADAS.url, title: pick(CONVOCADAS.title, lang) }}
              lang={lang}
            />
          </article>

          <article id="bernardo-herdy" className="grid scroll-mt-28 items-center gap-10 lg:grid-cols-2 lg:gap-[clamp(40px,6vw,96px)]" aria-labelledby="si-title">
            <div className="lg:order-2">
              <SiVisual lang={lang} />
            </div>
            <FeatureText
              titleId="si-title"
              icon={Award}
              kicker={pick(TEXT.si.kicker, lang)}
              title={pick(TEXT.si.title, lang)}
              body={pick(TEXT.si.body, lang)}
              people={[{ name: "Bernardo Herdy", role: pick(TEXT.si.role, lang) }]}
              link={{ href: SI.url, title: pick(SI.title, lang) }}
              lang={lang}
            />
          </article>
        </div>
      </div>
    </section>
  );
}
