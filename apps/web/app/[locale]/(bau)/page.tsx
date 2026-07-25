import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import {
  ArrowLink,
  Eyebrow,
  InstitutionalCard,
  LogoWall,
  Reveal,
  Section,
  VideoCard,
  Watermark,
} from "@/components/bau";
import { FinalCta } from "@/components/sections/FinalCta";
import { HomeHero } from "@/components/sections/HomeHero";
import { BAU_PAGES } from "@/config/site-pages";
import { SEO_DEFAULTS, SITE_URL } from "@/config/seo";
import {
  ESCOLAS_PARCEIRAS,
  INSTITUICOES_ECOSSISTEMA,
  UNIVERSIDADES_ECOSSISTEMA,
} from "@/data/institutions";
import { DEPOIMENTOS_ATLETAS } from "@/data/testimonials";
import { JsonLd } from "@/lib/jsonld";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });

  const title = `${t("brand.name")} | ${t("brand.concept")}`;
  const description = t("home.hero.sub");

  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: "/",
      languages: { "pt-BR": "/", en: "/en", es: "/es" },
    },
    openGraph: {
      title,
      description,
      url: SITE_URL,
      type: "website",
      images: [{ url: SEO_DEFAULTS.ogImage, width: 1200, height: 630, alt: SEO_DEFAULTS.ogImageAlt }],
    },
  };
}

interface PageProps {
  params: Promise<{ locale: string }>;
}

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SEO_DEFAULTS.siteName,
  url: SITE_URL,
  logo: { "@type": "ImageObject", url: `${SITE_URL}/favicon.ico` },
  sameAs: [
    "https://instagram.com/bolsaatletausa",
    "https://tiktok.com/@bolsaatletausa",
    "https://youtube.com/@bolsaatletausa",
  ],
  description:
    "Consultoria especializada em projetos de vida para jovens atletas no sistema educacional americano. High School. Universidade. Método S.A.F.E.®",
};

/**
 * Home — síntese premium e roteamento para as páginas profundas.
 *
 * NOTA sobre JSON-LD: o `FAQPage` que existia aqui foi removido. Ele declarava
 * 8 perguntas que NÃO tinham contrapartida visível na página, o que o Google
 * trata como structured data enganoso. As perguntas voltam junto com a página
 * /perguntas, onde terão conteúdo correspondente.
 */
export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("site");
  const copy = t.raw("home") as HomeCopy;

  return (
    <>
      <JsonLd data={organizationSchema} />

      <HomeHero
        eyebrow={copy.hero.eyebrow}
        titleLines={copy.hero.titleLines}
        sub={copy.hero.sub}
        ctaLabel={t("cta.primary")}
        secondaryCta={copy.hero.secondaryCta}
        secondaryHref={`/${BAU_PAGES.concept.slug}`}
        imageAlt={copy.hero.imageAlt}
      />

      {/* Reposicionamento — texto assimétrico + marca d'água à direita. */}
      <Section tone="deep">
        <Watermark side="right" />
        <div className="relative z-10 lg:grid lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Reveal>
              <Eyebrow>{copy.repositioning.eyebrow}</Eyebrow>
              <h2 className="bau-display mt-6 text-[2rem] lg:text-[3rem]">
                {copy.repositioning.title}
              </h2>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="bau-prose mt-8 text-[17px] text-bau-stone">
                {copy.repositioning.body}
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <ArrowLink href={`/${BAU_PAGES.concept.slug}`} className="mt-10">
                {copy.repositioning.link}
              </ArrowLink>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* Logo wall em DUAS faixas rotuladas — correção de credibilidade. */}
      <Section tone="navy" bleed space="tight">
        <div className="bau-container">
          <Reveal>
            <Eyebrow>{copy.institutions.eyebrow}</Eyebrow>
            <h2 className="bau-display mt-6 max-w-3xl text-[1.75rem] lg:text-[2.5rem]">
              {copy.institutions.title}
            </h2>
          </Reveal>
        </div>

        {/* Três faixas, sentidos alternados — o contraponto cria a sensação de
            arquivo vivo em vez de esteira única. */}
        <div className="mt-16 space-y-14">
          <LogoWall
            label={copy.institutions.partnersLabel}
            institutions={ESCOLAS_PARCEIRAS}
            direction={1}
          />
          <LogoWall
            label={copy.institutions.universitiesLabel}
            institutions={UNIVERSIDADES_ECOSSISTEMA}
            direction={-1}
          />
          <LogoWall
            label={copy.institutions.ecosystemLabel}
            institutions={INSTITUICOES_ECOSSISTEMA}
            direction={1}
          />
        </div>
      </Section>

      {/* Três cards de roteamento — grid estático, não carrossel. */}
      <Section tone="deep">
        <Reveal>
          <h2 className="bau-display text-[2rem] lg:text-[3rem]">{copy.pillars.title}</h2>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {copy.pillars.cards.map((card, i) => (
            <InstitutionalCard
              key={card.href}
              eyebrow={card.eyebrow}
              title={card.title}
              description={card.description}
              href={card.href}
              linkLabel={card.link}
              delay={i * 0.08}
            />
          ))}
        </div>
      </Section>

      {/* Prova social — sempre dentro do frame REC. */}
      <Section tone="navy">
        <Reveal>
          <Eyebrow>{copy.proof.eyebrow}</Eyebrow>
          <h2 className="bau-display mt-6 max-w-3xl text-[2rem] lg:text-[2.75rem]">
            {copy.proof.title}
          </h2>
          <p className="bau-prose mt-6 text-[17px] text-bau-stone">{copy.proof.sub}</p>
        </Reveal>

        <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {DEPOIMENTOS_ATLETAS.map((atleta) => (
            <li key={atleta.youtubeId}>
              <VideoCard
                youtubeId={atleta.youtubeId}
                thumbnail={atleta.thumbnail.src}
                name={atleta.name}
                context={atleta.context}
                timestamp={atleta.timestamp}
                playLabel={t("cta.watchTestimonial")}
              />
            </li>
          ))}
        </ul>

        <Reveal delay={0.16}>
          <ArrowLink href={`/${BAU_PAGES.stories.slug}`} className="mt-12">
            {copy.proof.link}
          </ArrowLink>
        </Reveal>
      </Section>

      {/* Bloco mãe — ÚNICA seção ivory da home. A mudança de temperatura
          sinaliza "aqui falamos de cuidado". */}
      <Section tone="ivory">
        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-6">
            <Reveal>
              <Eyebrow tone="light">{copy.safety.eyebrow}</Eyebrow>
              <h2 className="bau-display mt-6 text-[2rem] text-bau-navy-deep lg:text-[3rem]">
                {copy.safety.title}
              </h2>
            </Reveal>
          </div>
          <div className="mt-8 lg:col-span-5 lg:col-start-8 lg:mt-0">
            <Reveal delay={0.12}>
              <p className="bau-prose text-[17px] text-bau-navy/75">{copy.safety.body}</p>
              <ArrowLink href={`/${BAU_PAGES.boarding.slug}`} tone="light" className="mt-10">
                {copy.safety.link}
              </ArrowLink>
            </Reveal>
          </div>
        </div>
      </Section>

      {/* Fundador — versão curta. */}
      <Section tone="deep">
        <Watermark side="left" />
        <div className="relative z-10 lg:grid lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Reveal>
              <Eyebrow>{copy.founder.eyebrow}</Eyebrow>
              <h2 className="bau-display mt-6 text-[2rem] lg:text-[2.5rem]">
                {copy.founder.title}
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.12} className="mt-8 lg:col-span-6 lg:col-start-7 lg:mt-0">
            <p className="bau-prose text-[17px] text-bau-stone">{copy.founder.body}</p>
            <ArrowLink href={`/${BAU_PAGES.founder.slug}`} className="mt-10">
              {copy.founder.link}
            </ArrowLink>
          </Reveal>
        </div>
      </Section>

      <FinalCta
        eyebrow={copy.finalCta.eyebrow}
        title={copy.finalCta.title}
        body={copy.finalCta.body}
        signature={t("signatures.path")}
        ctaLabel={t("cta.primary")}
        source="final"
      />
    </>
  );
}

interface HomeCopy {
  hero: {
    eyebrow: string;
    title: string;
    titleLines: string[];
    sub: string;
    secondaryCta: string;
    imageAlt: string;
  };
  repositioning: { eyebrow: string; title: string; body: string; link: string };
  institutions: {
    eyebrow: string;
    title: string;
    partnersLabel: string;
    universitiesLabel: string;
    ecosystemLabel: string;
  };
  pillars: {
    title: string;
    cards: {
      eyebrow: string;
      title: string;
      description: string;
      href: string;
      link: string;
    }[];
  };
  proof: { eyebrow: string; title: string; sub: string; link: string };
  safety: { eyebrow: string; title: string; body: string; link: string };
  founder: { eyebrow: string; title: string; body: string; link: string };
  finalCta: { eyebrow: string; title: string; body: string };
}
