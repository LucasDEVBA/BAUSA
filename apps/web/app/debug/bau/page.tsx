import type { Metadata } from "next";

import {
  ArrowLink,
  ContrastTable,
  CtaPrimary,
  Eyebrow,
  InstitutionalCard,
  LogoWall,
  MonumentalPause,
  MonumentalStat,
  PillarGrid,
  RecFrame,
  Reveal,
  Section,
  Timeline,
  VideoCard,
  Watermark,
} from "@/components/bau";
import { ESCOLAS_PARCEIRAS, UNIVERSIDADES_ECOSSISTEMA } from "@/data/institutions";

/**
 * Galeria de verificação do design system — o "Storybook" do projeto.
 *
 * Mora em /debug de propósito: esse prefixo já está excluído do matcher do
 * middleware (`middleware.ts`) e no `disallow` do `robots.ts`, então não é
 * indexado nem sequestrado pelo encurtador de links. Zero infra nova.
 */
export const metadata: Metadata = {
  title: "Design System BAU",
  robots: { index: false, follow: false },
};

const PILLARS = [
  { initial: "S", title: "Singularidade", description: "Todo projeto começa pela família, não pela escola." },
  { initial: "A", title: "Acadêmico", description: "O pilar que define quais portas estarão abertas daqui a quatro anos." },
  { initial: "F", title: "Financeiro", description: "Viabilidade, previsibilidade e coerência do investimento." },
  { initial: "E", title: "Esporte", description: "Sonho esportivo com leitura realista. Sem promessas — posicionamento." },
];

const PHASES = [
  { label: "Fase 1", title: "Avaliação Estratégica", description: "Leitura completa da família e do jovem pelo Método S.A.F.E.®" },
  { label: "Fase 2", title: "Estratégia & Posicionamento", description: "Construção do perfil acadêmico-atlético." },
  { label: "Fase 3", title: "Colocação Estratégica", description: "Comunicação direta com admissões e treinadores." },
];

const CONTRAST = [
  { market: "Vagas e pacotes", bau: "Projetos de vida individuais" },
  { market: "A escola mais famosa", bau: "A escola certa para o perfil" },
  { market: "Envio e despedida", bau: "Acompanhamento ativo em cada etapa" },
];

function Spec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--bau-hairline)] py-16">
      <p className="bau-mono mb-10 text-[11px] text-bau-gold">{title}</p>
      {children}
    </div>
  );
}

export default function BauGalleryPage() {
  return (
    <div data-bau>
      <Section tone="deep" space="tight">
        <h1 className="bau-display text-[3rem]">Design System BAU</h1>
        <p className="bau-prose mt-4 text-bau-stone">
          Galeria de verificação das primitivas. Não indexada, não navegável a partir do site.
        </p>

        <Spec title="Eyebrow">
          <Eyebrow>Acompanhamento ativo em cada etapa</Eyebrow>
        </Spec>

        <Spec title="Tipografia">
          <p className="bau-display text-[4rem] leading-[1.05]">Educação Esportiva Inteligente®</p>
          <p className="bau-signature mt-8 text-[2rem]">Para quem entende o valor do caminho.</p>
          <p className="bau-prose mt-8 text-[18px] text-bau-stone">
            Corpo em Inter, 18px, entrelinha 1.65, largura máxima de 68 caracteres — o limite de
            leitura confortável definido no guia.
          </p>
        </Spec>

        <Spec title="CTA primário + link secundário">
          <div className="flex flex-wrap items-center gap-10">
            <CtaPrimary source="hero" label="Iniciar avaliação estratégica" />
            <ArrowLink href="/">Entenda a diferença</ArrowLink>
          </div>
        </Spec>

        <Spec title="Card institucional">
          <div className="grid gap-6 md:grid-cols-3">
            <InstitutionalCard
              eyebrow="O Conceito"
              title="Educação Esportiva Inteligente®"
              description="O modelo exclusivo que integra educação, esporte e formação humana."
              href="/"
              linkLabel="Conhecer o conceito"
            />
            <InstitutionalCard
              eyebrow="O Método"
              title="Método S.A.F.E.®"
              description="Quatro pilares: Singularidade, Acadêmico, Financeiro e Esporte."
              href="/"
              linkLabel="Ver como funciona"
              delay={80}
            />
            <InstitutionalCard
              eyebrow="A Jornada"
              title="Da leitura à universidade"
              description="Cada etapa acompanhada de perto, sem improviso."
              href="/"
              linkLabel="Ver a jornada completa"
              delay={160}
            />
          </div>
        </Spec>

        <Spec title="Frame REC (elemento-assinatura)">
          <RecFrame timestamp="MONTVERDE · FL · 2026" className="aspect-video max-w-2xl bg-bau-navy">
            <div className="absolute inset-0" />
          </RecFrame>
        </Spec>

        <Spec title="Grid de pilares">
          <PillarGrid pillars={PILLARS} />
        </Spec>

        <Spec title="Timeline">
          <Timeline phases={PHASES} />
        </Spec>

        <Spec title="Tabela de contraste">
          <ContrastTable
            marketLabel="O mercado"
            bauLabel="Educação Esportiva Inteligente®"
            rows={CONTRAST}
            caption="Comparação entre a oferta do mercado e o modelo da Bolsa Atleta USA"
          />
        </Spec>

        <Spec title="Destaque numérico">
          <MonumentalStat value="96%" eyebrow="O dado que muda tudo">
            das bolsas universitárias nos Estados Unidos são concedidas somente após avaliação
            presencial do atleta pelo treinador.
          </MonumentalStat>
        </Spec>

        <Spec title="Marca d'água monumental">
          <div className="relative h-64 overflow-hidden border border-[var(--bau-hairline)]">
            <Watermark />
            <p className="bau-prose relative z-10 p-8 text-bau-stone">
              Uma por seção, 60–80% da altura, tom sobre tom, sempre sangrando a borda.
            </p>
          </div>
        </Spec>

        <Spec title="Card de vídeo (facade)">
          <div className="max-w-xs">
            <VideoCard
              youtubeId="P9QiMRW4dII"
              thumbnail="/hero-campus.jpg"
              name="Isadora Santiago"
              context="16 anos · Montverde Academy"
              timestamp="MONTVERDE · FL · 2026"
              playLabel="Assistir ao depoimento de"
            />
          </div>
        </Spec>

        <Spec title="Reveal (escalonado)">
          <div className="flex gap-4">
            {[0, 80, 160, 240].map((delay) => (
              <Reveal key={delay} delay={delay}>
                <div className="flex h-24 w-24 items-center justify-center border border-[var(--bau-hairline)] text-bau-stone">
                  {delay}ms
                </div>
              </Reveal>
            ))}
          </div>
        </Spec>
      </Section>

      <Section tone="deep" space="tight" bleed>
        <div className="bau-container">
          <p className="bau-mono mb-10 text-[11px] text-bau-gold">Logo wall — duas faixas</p>
        </div>
        <div className="space-y-16">
          <LogoWall label="Escolas parceiras" institutions={ESCOLAS_PARCEIRAS} />
          <LogoWall
            label="Universidades do ecossistema de recrutamento"
            institutions={UNIVERSIDADES_ECOSSISTEMA}
          />
        </div>
      </Section>

      <MonumentalPause phrase="Nada é isolado. Tudo é integrado." />

      <Section tone="ivory" space="tight">
        <Eyebrow tone="light">Inversão de temperatura</Eyebrow>
        <p className="bau-display mt-6 text-[2.5rem] text-bau-navy-deep">
          A página de dia do site.
        </p>
        <p className="bau-prose mt-4 text-bau-navy/70">
          Fundo ivory é reservado às seções sobre cuidado — a mudança de atmosfera é a mensagem.
        </p>
      </Section>
    </div>
  );
}
